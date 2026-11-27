// Adapter for Ant Design X `useXAgent`.
//
// The flow is as follows:
//   1. The model gateway (`platform_core.api.model.complete`) produces the reply. The model key stays on the server.
//   2. If the model requests a tool, the tool runs on the MCP endpoint (`platform_core.api.ai.mcp`) with the session cookie.
//      A read tool reads with the user's permissions. A write tool only opens a proposal; it does not change the document.
//   3. The reply is converted to the `{ text, steps, ui[] }` shape (U1).
//
// Only this adapter adds the approval block. An approval block written by the model is discarded.
// Approval is given via `approveProposal` only when the user presses the button (U4).
// `steps` carries only real tool events. There is no fake progress (AX-5).
import messages from './ai-messages.json';
import { TOOL_RESULT_PREFIX } from './ai-protocol';
import type { ApiClient } from './client';
import type { MessageLocale } from './errors';
import type { CompletionRequest } from './guards';
import { isPreview, isRecord } from './guards';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** One item of the `ui` array. If its type is not registered, the rendering layer uses a safe JSON view (U2). */
export interface UiBlock {
  type: string;
  [prop: string]: unknown;
}

export interface ConfirmBlock extends UiBlock {
  type: 'confirm';
  proposalId: string;
  tool: string;
  action: string;
  summary: string;
  changes: unknown[];
  expiresAt: string;
}

export interface AssistantReply {
  text: string;
  steps: string[];
  ui: UiBlock[];
}

export interface AgentInput {
  messages?: ChatMessage[];
  message?: ChatMessage;
}

export interface AgentCallbacks {
  onUpdate: (chunk: AssistantReply) => void;
  onSuccess: (chunks: AssistantReply[]) => void;
  onError: (error: Error) => void;
  onStream?: (abortController: AbortController) => void;
}

export interface AgentDeps {
  api: Pick<ApiClient, 'complete' | 'callMcp'>;
  /** Name of the "AI Route" record in the model gateway. */
  route: string;
  locale?: MessageLocale;
  /** Maximum number of tool rounds in one reply. */
  maxToolRounds?: number;
  /** Maximum number of output tokens requested for one reply. */
  outputLimit?: number;
  /** Conversation ID. The server stores only its hash. */
  conversationId?: () => string | undefined;
}

const MAX_GATEWAY_TOOLS = 12;
const MAX_UI_BLOCKS = 20;
const MAX_TOOL_RESULT_CHARS = 16_000;
const TOOL_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;

const SYSTEM_PROMPT = [
  'You are the Atonota assistant. Answer in the language of the user.',
  'Reply only with JSON that matches the given schema: { text, steps, ui }.',
  'Use tools to read data. Never invent records. Write tools only open a proposal; a human approves it.',
  'Do not put confirm blocks into ui. The client adds them.',
  'ui block types: kpis, chart, table, form, choices.',
].join(' ');

const REPLY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'steps', 'ui'],
  properties: {
    text: { type: 'string' },
    steps: { type: 'array', items: { type: 'string' } },
    ui: {
      type: 'array',
      maxItems: MAX_UI_BLOCKS,
      items: { type: 'object', required: ['type'], properties: { type: { type: 'string' } } },
    },
  },
};

interface GatewayTool {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

function truncate(text: string): string {
  return text.length > MAX_TOOL_RESULT_CHARS ? `${text.slice(0, MAX_TOOL_RESULT_CHARS)}…` : text;
}

/** Converts the MCP tool list to the model gateway's tool format. Read tools come first. */
function toGatewayTools(result: unknown): GatewayTool[] {
  if (!isRecord(result) || !Array.isArray(result.tools)) return [];
  const tools = result.tools.filter(
    (
      tool,
    ): tool is Record<string, unknown> & { name: string; inputSchema: Record<string, unknown> } =>
      isRecord(tool) &&
      typeof tool.name === 'string' &&
      TOOL_NAME_PATTERN.test(tool.name) &&
      isRecord(tool.inputSchema),
  );
  const readOnly = (tool: Record<string, unknown>) =>
    isRecord(tool.annotations) && tool.annotations.readOnlyHint === true;
  return [...tools.filter(readOnly), ...tools.filter((tool) => !readOnly(tool))]
    .slice(0, MAX_GATEWAY_TOOLS)
    .map((tool) => ({
      name: tool.name,
      ...(typeof tool.description === 'string' ? { description: tool.description } : {}),
      parameters: tool.inputSchema,
    }));
}

/** Treats model output as untrusted (AX-3). If the format does not match, returns the text as plain text. */
function parseReply(text: string): AssistantReply {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { text, steps: [], ui: [] };
  }
  if (!isRecord(parsed) || typeof parsed.text !== 'string') return { text, steps: [], ui: [] };
  const ui = Array.isArray(parsed.ui)
    ? parsed.ui
        .filter((block): block is UiBlock => isRecord(block) && typeof block.type === 'string')
        // Only the adapter adds the approval block. Approvals and form submissions written by the model are untrusted.
        .filter((block) => block.type !== 'confirm')
        .slice(0, MAX_UI_BLOCKS)
    : [];
  return { text: parsed.text, steps: [], ui };
}

function lastUserHistory(input: AgentInput): ChatMessage[] {
  if (input.messages && input.messages.length > 0) return input.messages;
  return input.message ? [input.message] : [];
}

export function createAgentRequest(deps: AgentDeps) {
  if (deps.route.trim().length === 0) {
    throw new Error('AI route is not configured. Set VITE_AI_ROUTE.');
  }
  const text = messages[deps.locale ?? 'tr'];
  const maxRounds = deps.maxToolRounds ?? 4;
  let toolsCache: Promise<GatewayTool[]> | undefined;
  let rpcId = 0;

  function conversationOptions(signal: AbortSignal) {
    const conversationId = deps.conversationId?.();
    return conversationId ? { signal, conversationId } : { signal };
  }

  function loadTools(signal: AbortSignal): Promise<GatewayTool[]> {
    toolsCache ??= deps.api
      .callMcp({ jsonrpc: '2.0', id: ++rpcId, method: 'tools/list' }, conversationOptions(signal))
      .then((outcome) =>
        toGatewayTools(outcome.status === 'ok' ? outcome.response.result : undefined),
      )
      .catch((error: unknown) => {
        toolsCache = undefined;
        throw error;
      });
    return toolsCache;
  }

  async function run(input: AgentInput, callbacks: AgentCallbacks, signal: AbortSignal) {
    const steps: string[] = [];
    const confirms: ConfirmBlock[] = [];
    const history = lastUserHistory(input).map((item) => ({
      role: item.role,
      content: item.content,
    }));
    const conversation: CompletionRequest['messages'] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
    ];
    const tools = await loadTools(signal);

    for (let round = 0; round <= maxRounds; round += 1) {
      const result = await deps.api.complete(
        {
          route: deps.route,
          messages: conversation,
          ...(tools.length > 0 && round < maxRounds ? { tools } : {}),
          schema: REPLY_SCHEMA,
          limit: deps.outputLimit ?? 1024,
        },
        { signal },
      );

      if (result.tool_calls.length === 0) {
        const reply = parseReply(result.text);
        return { ...reply, steps: [...steps], ui: [...reply.ui, ...confirms] };
      }

      const outputs: { id: string; name: string; result: unknown }[] = [];
      for (const call of result.tool_calls) {
        const outcome = await deps.api.callMcp(
          {
            jsonrpc: '2.0',
            id: ++rpcId,
            method: 'tools/call',
            params: { name: call.name, arguments: call.arguments },
          },
          conversationOptions(signal),
        );
        // `tools/call` always expects a response with a body. An empty accepted response is not the tool's result.
        const response =
          outcome.status === 'ok'
            ? outcome.response
            : {
                jsonrpc: '2.0' as const,
                error: { code: -32603, message: 'accepted_without_result' },
              };
        const toolResult = isRecord(response.result) ? response.result : undefined;
        const structured = isRecord(toolResult?.structuredContent)
          ? toolResult.structuredContent
          : undefined;
        const failed = response.error !== undefined || toolResult?.isError === true;

        if (
          !failed &&
          structured?.status === 'approval_required' &&
          typeof structured.proposal_id === 'string' &&
          isPreview(structured.preview)
        ) {
          const preview = structured.preview as Record<string, unknown>;
          confirms.push({
            type: 'confirm',
            proposalId: structured.proposal_id,
            tool: call.name,
            action: String(preview.action),
            summary: String(preview.summary),
            changes: Array.isArray(preview.changes) ? preview.changes : [],
            expiresAt: typeof structured.expires_at === 'string' ? structured.expires_at : '',
          });
          steps.push(format(text.step_approval_required, { tool: call.name }));
        } else {
          steps.push(
            format(failed ? text.step_tool_failed : text.step_tool_done, { tool: call.name }),
          );
        }
        callbacks.onUpdate({ text: '', steps: [...steps], ui: [] });
        outputs.push({
          id: call.id,
          name: call.name,
          result: response.error ?? structured ?? toolResult?.content ?? null,
        });
      }

      conversation.push({
        role: 'assistant',
        content: JSON.stringify({ tool_calls: result.tool_calls }),
      });
      conversation.push({
        role: 'user',
        content: TOOL_RESULT_PREFIX + truncate(JSON.stringify(outputs)),
      });
    }

    return { text: text.tool_round_limit, steps: [...steps], ui: [...confirms] };
  }

  /** Request function for `useXAgent({ request })`. */
  return function request(input: AgentInput, callbacks: AgentCallbacks): void {
    const controller = new AbortController();
    callbacks.onStream?.(controller);
    run(input, callbacks, controller.signal).then(
      (reply) => callbacks.onSuccess([reply]),
      (error: unknown) =>
        callbacks.onError(error instanceof Error ? error : new Error(String(error))),
    );
  };
}

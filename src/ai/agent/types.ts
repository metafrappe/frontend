import type { GenUIAction, GenUIBlock } from '@/genui';

/**
 * A tool run reported by the server. The UI does not invent steps.
 * Only tools in the `tools.ts` list are shown.
 * The model's inner thought does not enter this list.
 */
export interface AgentStep {
  key: string;
  /** Allowed tool ID. Example: `orders.read`. */
  tool: string;
  title: string;
  status: 'pending' | 'success' | 'error';
}

export interface UserMessage {
  role: 'user';
  text: string;
  files?: string[];
  /** User decision from a GenUI block (U4). */
  action?: GenUIAction;
  /**
   * ID of the operation asked about in a status query message.
   * If the query also drops, a retry asks for the status again with this ID.
   */
  statusOf?: string;
}

export type AssistantPhase = 'waiting' | 'streaming' | 'done' | 'cancelled' | 'error';

/** Assistant reply (U1): `{ text, steps, ui[] }` and the stream state. */
export interface AssistantMessage {
  role: 'assistant';
  text: string;
  steps: AgentStep[];
  ui: GenUIBlock[];
  phase: AssistantPhase;
  error?: string;
}

export type ChatMessage = UserMessage | AssistantMessage;

/**
 * Request kind.
 * - `message`: a new message. Approval data is sent only with this kind.
 * - `regenerate`: asks for the last reply's text again. Carries no approval data.
 * - `status`: if the connection dropped, asks for the approved operation's status. Does not redo it.
 */
export type AgentIntent = 'message' | 'regenerate' | 'status';

/**
 * Request sent to the server. The history contains only completed messages.
 *
 * Approval contract:
 * - The server processes approval only from the `message.action` field.
 * - The server does not treat history messages as approval. The UI sends no approval data in history.
 * - The server creates a new approval ID for each new operation.
 * - The server rejects a second use of the same approval ID.
 * - On a `status` request the server does not redo the operation. It only reports its status.
 */
export interface AgentRequest {
  intent: AgentIntent;
  message: UserMessage;
  history: ChatMessage[];
  /** ID of the operation asked about in a `status` request. It is the approval block's ID. */
  actionId?: string;
}

/**
 * Stream events. Each event arrives as JSON in an SSE `data:` line.
 * Example: `data: {"type":"text","delta":"Merhaba "}`
 */
export type AgentEvent =
  | { type: 'tool'; key: string; tool: string; title: string; status: AgentStep['status'] }
  | { type: 'text'; delta: string }
  | { type: 'ui'; blocks: unknown }
  | { type: 'done' }
  | { type: 'error'; message: string };

/**
 * Transport: takes the request and returns an SSE byte stream.
 * The mock server and the real adapter follow the same contract.
 */
export type AgentTransport = (
  request: AgentRequest,
  signal: AbortSignal,
) => Promise<ReadableStream<Uint8Array>>;

/** Connection info shown on screen (AX-7). */
export interface AgentSource {
  /** Example: the mock server or the model gateway label. */
  label: string;
  /** `true` for the mock server. The UI states this clearly. */
  simulated: boolean;
}

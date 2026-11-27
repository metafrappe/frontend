import { useXAgent, useXChat } from '@ant-design/x';
import { useCallback, useRef } from 'react';

import type { GenUIAction, GenUIActionResult, GenUIDecisions } from '@/genui';

import { emptyAssistant, runAgent } from '../agent';
import type { AgentIntent, AgentTransport, ChatMessage, UserMessage } from '../agent';

interface AgentInput {
  message: ChatMessage;
  messages: ChatMessage[];
  intent?: AgentIntent;
  actionId?: string;
}

/** User message shown for a regenerate request. Carries no approval data. */
export const REGENERATE_TEXT = 'Son yanıtı yeniden yaz.';
/** User message shown for a status query. Carries no approval data. */
export const STATUS_TEXT = 'İşlemin durumunu sor.';

/** Turns a user decision into a new message shown in the conversation (U4). */
export function actionToMessage(action: GenUIAction): UserMessage {
  switch (action.kind) {
    case 'ask':
      return { role: 'user', text: action.text };
    case 'confirm':
    case 'form':
      return {
        role: 'user',
        text:
          action.decision === 'approved'
            ? `Onaylıyorum: ${action.title}`
            : `Vazgeçiyorum: ${action.title}`,
        action,
      };
  }
}

/**
 * ID of the operation the message is tied to.
 * For an approval or form decision it is the block ID. For a status query it is the queried ID.
 * A question action has no ID.
 */
export function actionIdOf(message: ChatMessage | undefined): string | undefined {
  if (message?.role !== 'user') return undefined;
  if (message.statusOf) return message.statusOf;
  if (!message.action || message.action.kind === 'ask') return undefined;
  return message.action.blockId;
}

/** Collects approval and form decisions from the conversation history by block ID. */
export function decisionsOf(messages: readonly ChatMessage[]): GenUIDecisions {
  const decisions: Record<string, 'approved' | 'rejected'> = {};
  for (const message of messages) {
    if (message.role !== 'user' || !message.action || message.action.kind === 'ask') continue;
    decisions[message.action.blockId] = message.action.decision;
  }
  return decisions;
}

/** Strips approval data from messages sent as history. Approval goes only in its own request. */
function withoutAction(message: ChatMessage): ChatMessage {
  if (message.role !== 'user' || !message.action) return message;
  const { action: _action, ...rest } = message;
  return rest;
}

function isFinished(message: ChatMessage): boolean {
  return message.role === 'user' || message.phase !== 'waiting';
}

/**
 * Conversation state. useXAgent runs the request, useXChat holds the messages.
 *
 * Approval rules (AX-6):
 * - Approval data is single-use. The same operation ID is not sent twice.
 * - Regenerate asks only for the reply text. It does not send approval data.
 * - If an approved request drops, a retry asks for the operation's status.
 */
export function useStudioChat(transport: AgentTransport) {
  const abortRef = useRef<AbortController | null>(null);
  const usedActions = useRef(new Set<string>());

  const [agent] = useXAgent<ChatMessage, AgentInput, ChatMessage>({
    request: (
      { message, messages, intent = 'message', actionId },
      { onUpdate, onSuccess, onStream },
    ) => {
      const controller = new AbortController();
      abortRef.current = controller;
      onStream?.(controller);
      void runAgent({
        transport,
        request: {
          intent,
          message: message as UserMessage,
          history: messages.filter((m) => m !== message && isFinished(m)).map(withoutAction),
          ...(actionId ? { actionId } : {}),
        },
        signal: controller.signal,
        onUpdate: (update) => onUpdate(update),
      }).then((final) => {
        if (abortRef.current === controller) abortRef.current = null;
        onSuccess([final]);
      });
    },
  });

  const { onRequest, messages, setMessages } = useXChat<
    ChatMessage,
    ChatMessage,
    AgentInput,
    ChatMessage
  >({
    agent,
    requestPlaceholder: () => emptyAssistant(),
    transformMessage: ({ chunk, chunks, originMessage }) =>
      chunk ?? chunks[chunks.length - 1] ?? originMessage ?? emptyAssistant(),
  });

  const last = messages[messages.length - 1];
  const busy = last?.status === 'loading' || last?.status === 'updating';

  /** Sends the message. The result is passed to the block. */
  const send = useCallback(
    (message: UserMessage): GenUIActionResult => {
      if (busy) return 'busy';
      const actionId = actionIdOf(message);
      if (actionId) {
        if (usedActions.current.has(actionId)) return 'used';
        usedActions.current.add(actionId);
      }
      onRequest({ message, intent: 'message' });
      return 'accepted';
    },
    [busy, onRequest],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /**
   * Asks for the reply again.
   * - If the previous message is not an approval: removes the reply and question, asks again.
   * - If the previous message is an approval: the approval message stays. Approval is not resent.
   *   If the reply ended in an error, the operation's status is queried. Otherwise only text is requested.
   */
  const regenerate = useCallback(
    (assistantId: string | number) => {
      if (busy) return;
      const index = messages.findIndex((m) => m.id === assistantId);
      const answer = messages[index];
      const prompt = messages[index - 1];
      if (index < 1 || !answer || prompt?.message.role !== 'user') return;

      const actionId = actionIdOf(prompt.message);
      if (actionId) {
        const failed = answer.message.role === 'assistant' && answer.message.phase === 'error';
        setMessages((all) => all.filter((m) => m.id !== assistantId));
        onRequest(
          failed
            ? {
                message: { role: 'user', text: STATUS_TEXT, statusOf: actionId },
                intent: 'status',
                actionId,
              }
            : { message: { role: 'user', text: REGENERATE_TEXT }, intent: 'regenerate' },
        );
        return;
      }

      const user = prompt.message;
      setMessages((all) => all.filter((m) => m.id !== assistantId && m.id !== prompt.id));
      onRequest({ message: user, intent: 'regenerate' });
    },
    [busy, messages, onRequest, setMessages],
  );

  /** What the reply's retry button does: a status query or a retry. */
  const retryKind = useCallback(
    (assistantId: string | number): 'status' | 'retry' => {
      const index = messages.findIndex((m) => m.id === assistantId);
      return actionIdOf(messages[index - 1]?.message) ? 'status' : 'retry';
    },
    [messages],
  );

  return { messages, setMessages, send, cancel, regenerate, retryKind, busy };
}

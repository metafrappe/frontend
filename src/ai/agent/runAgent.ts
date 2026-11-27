import { XStream } from '@ant-design/x';

import { parseBlocks } from '@/genui';

import { parseAgentEvent } from './events';
import type { AgentEvent, AgentRequest, AgentTransport, AssistantMessage } from './types';

export interface RunAgentOptions {
  transport: AgentTransport;
  request: AgentRequest;
  signal: AbortSignal;
  /** Called with the current reply after each valid event. */
  onUpdate: (message: AssistantMessage) => void;
  /** Maximum wait between two chunks. */
  idleTimeoutMs?: number;
}

export const DEFAULT_IDLE_TIMEOUT_MS = 30_000;

export function emptyAssistant(): AssistantMessage {
  return { role: 'assistant', text: '', steps: [], ui: [], phase: 'waiting' };
}

function reduce(message: AssistantMessage, event: AgentEvent): AssistantMessage {
  switch (event.type) {
    case 'tool': {
      const exists = message.steps.some((step) => step.key === event.key);
      const step = { key: event.key, tool: event.tool, title: event.title, status: event.status };
      const steps = exists
        ? message.steps.map((s) => (s.key === event.key ? step : s))
        : [...message.steps, step];
      return { ...message, steps };
    }
    case 'text':
      return { ...message, text: message.text + event.delta, phase: 'streaming' };
    case 'ui':
      return { ...message, ui: parseBlocks(event.blocks) };
    case 'done':
      return { ...message, phase: 'done' };
    case 'error':
      return { ...message, phase: 'error', error: event.message };
  }
}

class IdleTimeout extends Error {}

/**
 * Reads the server stream and builds the reply step by step (U5).
 *
 * - Cancel works at any time. After cancel, `onUpdate` is not called again.
 * - An invalid chunk is ignored (AX-5).
 * - If the stream ends without `done`, the reply becomes an error. The UI shows it.
 */
export async function runAgent({
  transport,
  request,
  signal,
  onUpdate,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
}: RunAgentOptions): Promise<AssistantMessage> {
  let message = emptyAssistant();
  const finish = (phase: AssistantMessage['phase'], error?: string): AssistantMessage => {
    message = { ...message, phase, ...(error ? { error } : {}) };
    // Blocks that arrive before the stream ends are not shown (U5).
    if (phase !== 'done') message = { ...message, ui: [] };
    return message;
  };

  if (signal.aborted) return finish('cancelled');

  let reader: ReadableStreamDefaultReader<{ data?: unknown }> | null = null;
  const onAbort = () => {
    void reader?.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', onAbort);

  try {
    const body = await transport(request, signal);
    if (signal.aborted) return finish('cancelled');
    reader = XStream({ readableStream: body }).getReader();

    for (;;) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new IdleTimeout()), idleTimeoutMs);
      });
      let result: ReadableStreamReadResult<{ data?: unknown }>;
      try {
        result = await Promise.race([reader.read(), timeout]);
      } finally {
        clearTimeout(timer);
      }
      if (signal.aborted) return finish('cancelled');
      if (result.done) break;

      const event = parseAgentEvent(result.value.data);
      if (!event) continue;
      message = reduce(message, event);
      if (message.phase === 'error') {
        const failed = finish('error', message.error);
        onUpdate(failed);
        return failed;
      }
      onUpdate(message);
      if (message.phase === 'done') return message;
    }
    return finish('error', 'Bağlantı yanıt bitmeden koptu.');
  } catch (error) {
    if (signal.aborted) return finish('cancelled');
    if (error instanceof IdleTimeout) {
      void reader?.cancel().catch(() => undefined);
      return finish('error', 'Sunucu zamanında yanıt vermedi.');
    }
    return finish('error', 'Sunucuya bağlanılamadı.');
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

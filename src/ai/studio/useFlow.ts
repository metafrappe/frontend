import { XStream } from '@ant-design/x';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { approveFlow, createFlow, receiveServerEvent } from '../agent';
import type { AgentMode, AgentRequest, AgentTransport, FlowState } from '../agent';
import type { ModedRequest } from './flowDemo';

/**
 * Reads a second copy of the server stream. Passes each `data` line to the given function.
 * Reading stops when the request stops. A read error does not affect the conversation.
 */
async function watch(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  onData: (data: string) => void,
) {
  const reader = XStream({ readableStream: body }).getReader();
  const stop = () => void reader.cancel().catch(() => undefined);
  signal.addEventListener('abort', stop, { once: true });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done || signal.aborted) return;
      if (typeof value.data === 'string') onData(value.data);
    }
  } catch {
    // The conversation shows the same error in its own copy.
  } finally {
    signal.removeEventListener('abort', stop);
  }
}

/**
 * Binds the six-step flow to the conversation (AJA-1159).
 *
 * - The mode is added to the request. The server reads the mode.
 * - Steps and tool events come only from server lines. The screen does not invent steps.
 * - Each conversation has its own flow. When the conversation changes, the flow changes too.
 */
export function useFlow(transport: AgentTransport, conversation: string) {
  const [flows, setFlows] = useState<Record<string, FlowState>>({});
  const flow = flows[conversation] ?? createFlow();
  // Conversation and mode current at request time. Read without waiting for a state update.
  const current = useRef({ conversation, flow });
  useLayoutEffect(() => {
    current.current = { conversation, flow };
  }, [conversation, flow]);

  const update = useCallback((key: string, next: (state: FlowState) => FlowState) => {
    setFlows((all) => {
      const before = all[key] ?? createFlow();
      const after = next(before);
      return after === before ? all : { ...all, [key]: after };
    });
  }, []);

  const flowTransport = useMemo<AgentTransport>(
    () => async (request: AgentRequest, signal: AbortSignal) => {
      const { conversation: key, flow: state } = current.current;
      const moded: ModedRequest = { ...request, mode: state.mode };
      const body = await transport(moded, signal);
      const [chat, steps] = body.tee();
      void watch(steps, signal, (data) => {
        if (!signal.aborted) update(key, (s) => receiveServerEvent(s, data));
      });
      return chat;
    },
    [transport, update],
  );

  /** A new task opens a new flow. The mode does not change during this flow. */
  const start = useCallback(
    (mode: AgentMode) => {
      const fresh = createFlow(mode);
      current.current = { ...current.current, flow: fresh };
      update(current.current.conversation, () => fresh);
    },
    [update],
  );

  /** User approval. Valid only at the approval step and in `act` mode. */
  const approve = useCallback(() => {
    const next = approveFlow(current.current.flow);
    current.current = { ...current.current, flow: next };
    update(current.current.conversation, approveFlow);
  }, [update]);

  const forget = useCallback((key: string) => {
    setFlows((all) => Object.fromEntries(Object.entries(all).filter(([k]) => k !== key)));
  }, []);

  return { flow, flowTransport, start, approve, forget };
}

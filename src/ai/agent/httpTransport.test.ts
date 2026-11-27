import { describe, expect, it } from 'vitest';

import { createHttpTransport } from './httpTransport';
import type { AgentRequest } from './types';

function capture() {
  const calls: { headers: Record<string, string>; body: unknown }[] = [];
  const fetchFn = ((_url: string, init: RequestInit) => {
    calls.push({
      headers: init.headers as Record<string, string>,
      body: JSON.parse(init.body as string),
    });
    return Promise.resolve(new Response(new ReadableStream(), { status: 200 }));
  }) as typeof fetch;
  return { calls, fetchFn };
}

const base: AgentRequest = {
  intent: 'message',
  message: { role: 'user', text: 'Onaylıyorum: Planı satın al' },
  history: [],
};

describe('createHttpTransport iş anahtarı', () => {
  it('ticari eylemin iş anahtarını Idempotency-Key başlığında gönderir', async () => {
    const { calls, fetchFn } = capture();
    const transport = createHttpTransport({ url: '/api/agent', fetch: fetchFn });
    const key = '3f2b8c1e-6d4a-4f0b-9a7e-2c5d8e1f0a3b';
    await transport({ ...base, idempotencyKey: key }, new AbortController().signal);
    expect(calls[0]?.headers['Idempotency-Key']).toBe(key);
  });

  it('iş anahtarı yoksa başlık eklemez', async () => {
    const { calls, fetchFn } = capture();
    const transport = createHttpTransport({ url: '/api/agent', fetch: fetchFn });
    await transport(base, new AbortController().signal);
    expect(calls[0]?.headers['Idempotency-Key']).toBeUndefined();
  });
});

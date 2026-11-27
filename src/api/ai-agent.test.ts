import type { useXAgent } from '@ant-design/x';
import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { SAMPLE_CSRF_TOKEN, SAMPLE_KEYCLOAK_URL, sampleCompletion } from '@/mocks/fixtures';
import { mockState, resetMockState } from '@/mocks/handlers';
import { mockServer } from '@/mocks/node';

import {
  type AgentInput,
  type AssistantReply,
  type ChatMessage,
  createAgentRequest,
} from './ai-agent';
import { createApiClient } from './client';
import type { ApiConfig } from './config';
import { createCsrfStore } from './csrf';

const config: ApiConfig = {
  siteUrl: 'https://kiraci.example.test',
  credentials: 'same-origin',
  timeoutMs: 1_000,
  modelTimeoutMs: 2_000,
  keycloakUrl: SAMPLE_KEYCLOAK_URL,
  keycloakRealm: 'platform',
  aiRoute: 'ornek-rota',
  csrfMetaName: 'csrf-token',
};

function setup() {
  const api = createApiClient({ config, csrf: createCsrfStore(SAMPLE_CSRF_TOKEN) });
  const request = createAgentRequest({ api, route: config.aiRoute });
  // Type check: the adapter can be passed straight to the `useXAgent` config.
  const agentConfig: Parameters<typeof useXAgent<ChatMessage, AgentInput, AssistantReply>>[0] = {
    request,
  };
  const agent = { request: agentConfig.request ?? request };

  function ask(text: string) {
    const updates: AssistantReply[] = [];
    const controllers: AbortController[] = [];
    const done = new Promise<AssistantReply[]>((resolve, reject) => {
      agent.request(
        { messages: [{ role: 'user', content: text }] },
        {
          onUpdate: (chunk) => updates.push(chunk),
          onSuccess: resolve,
          onError: reject,
          onStream: (controller) => controllers.push(controller),
        },
      );
    });
    return { done, updates, controllers };
  }
  return { ask };
}

const seen: string[] = [];
beforeAll(() => {
  mockServer.listen({ onUnhandledFrame: 'error' });
  mockServer.events.on('request:start', ({ request }) => {
    seen.push(new URL(request.url).pathname.replace('/api/method/', ''));
  });
});
afterEach(() => {
  mockServer.resetHandlers();
  resetMockState();
  seen.length = 0;
});
afterAll(() => mockServer.close());

describe('createAgentRequest', () => {
  it('model geçidini çağırır ve { text, steps, ui } döner', async () => {
    const { ask } = setup();
    const [reply] = await ask('merhaba').done;
    expect(reply).toEqual({ text: 'Örnek veri: merhaba.', steps: [], ui: [] });
    expect(seen).toContain('platform_core.api.model.complete');
  });

  it('modelin istediği okuma aracını MCP ile çalıştırır ve gerçek adımı bildirir', async () => {
    const { ask } = setup();
    const { done, updates } = ask('kayıtları listele');
    const [reply] = await done;

    expect(seen.filter((path) => path === 'platform_core.api.ai.mcp')).toHaveLength(2);
    expect(reply?.ui[0]).toMatchObject({ type: 'table' });
    expect(reply?.steps).toHaveLength(1);
    expect(reply?.steps[0]).toContain('plt_list_documents');
    expect(updates.at(-1)?.steps).toEqual(reply?.steps);
  });

  it('yazma aracında onay bloğu ekler ve onayı kendisi vermez', async () => {
    const { ask } = setup();
    const [reply] = await ask('yeni kayıt oluştur').done;

    const confirm = reply?.ui.find((block) => block.type === 'confirm');
    expect(confirm).toMatchObject({
      type: 'confirm',
      proposalId: 'ornek-oneri-1',
      action: 'create',
      summary: 'Yeni bir örnek kayıt açılacak.',
    });
    expect(seen).not.toContain('platform_core.api.ai.approve_proposal');
  });

  it('modelin kendi yazdığı onay bloğunu atar', async () => {
    mockServer.use(
      http.post('*/api/method/platform_core.api.model.complete', () =>
        HttpResponse.json({
          message: sampleCompletion({
            text: JSON.stringify({
              text: 'Onaylayın.',
              steps: [],
              ui: [
                { type: 'confirm', proposalId: 'uydurma' },
                { type: 'kpis', items: [] },
              ],
            }),
          }),
        }),
      ),
    );
    const { ask } = setup();
    const [reply] = await ask('merhaba').done;
    expect(reply?.ui).toEqual([{ type: 'kpis', items: [] }]);
  });

  it('bilinmeyen blok türünü korur, çizim katmanı güvenli görünüme düşürür', async () => {
    mockServer.use(
      http.post('*/api/method/platform_core.api.model.complete', () =>
        HttpResponse.json({
          message: sampleCompletion({
            text: JSON.stringify({ text: 'Örnek.', steps: [], ui: [{ type: 'harita', x: 1 }] }),
          }),
        }),
      ),
    );
    const { ask } = setup();
    const [reply] = await ask('merhaba').done;
    expect(reply?.ui).toEqual([{ type: 'harita', x: 1 }]);
  });

  it('JSON olmayan model yanıtını düz metin sayar', async () => {
    mockServer.use(
      http.post('*/api/method/platform_core.api.model.complete', () =>
        HttpResponse.json({ message: sampleCompletion({ text: '<b>düz</b> metin' }) }),
      ),
    );
    const { ask } = setup();
    const [reply] = await ask('merhaba').done;
    expect(reply).toEqual({ text: '<b>düz</b> metin', steps: [], ui: [] });
  });

  it('geçit hatasını ortak hata türüyle bildirir', async () => {
    mockServer.use(
      http.post('*/api/method/platform_core.api.model.complete', () =>
        HttpResponse.json({ message: { error: 'quota_exceeded' } }, { status: 429 }),
      ),
    );
    const { ask } = setup();
    await expect(ask('merhaba').done).rejects.toMatchObject({
      kind: 'rate_limited',
      code: 'quota_exceeded',
    });
  });

  it('iptal edilebilir ve iptalde başka istek göndermez', async () => {
    mockServer.use(
      http.post(
        '*/api/method/platform_core.api.model.complete',
        () => new Promise<Response>(() => undefined),
      ),
    );
    const { ask } = setup();
    const { done, controllers } = ask('merhaba');
    await vi.waitFor(() => expect(seen).toContain('platform_core.api.model.complete'));
    expect(controllers).toHaveLength(1);

    controllers[0]?.abort();

    await expect(done).rejects.toMatchObject({ name: 'AbortError' });
    expect(seen.filter((path) => path === 'platform_core.api.model.complete')).toHaveLength(1);
  });

  it('rota adı boşsa kurulmaz', () => {
    const api = createApiClient({ config, csrf: createCsrfStore() });
    expect(() => createAgentRequest({ api, route: '' })).toThrow(/route/);
  });

  it.each([
    ['quota_exceeded', 429, 'rate_limited'],
    ['gateway_busy', 429, 'rate_limited'],
    ['provider_unavailable', 503, 'unavailable'],
    ['provider_timeout', 503, 'unavailable'],
    ['gateway_unavailable', 503, 'unavailable'],
    ['data_policy_denied', 403, 'forbidden'],
    ['transaction_active', 409, 'conflict'],
    ['invalid_route', 400, 'invalid_request'],
  ] as const)('sahte geçit %s hatasını sözleşmedeki durumla verir', async (code, status, kind) => {
    mockState.gatewayFailure = code;
    const { ask } = setup();
    await expect(ask('merhaba').done).rejects.toMatchObject({ kind, code, status });
  });
});

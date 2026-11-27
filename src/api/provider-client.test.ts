// Provider client (lazy chunk). Requests go through the shared client's `frappeDocument` path.
import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { SAMPLE_CSRF_TOKEN } from '@/mocks/fixtures';
import { resetMockState } from '@/mocks/handlers';
import { mockServer } from '@/mocks/node';

import { createApiClient } from './client';
import { createProviderClient } from './provider-client';
import type { ApiConfig } from './config';
import { createCsrfStore } from './csrf';

const SITE = 'https://kiraci.example.test';

const config: ApiConfig = {
  siteUrl: SITE,
  credentials: 'same-origin',
  timeoutMs: 1_000,
  modelTimeoutMs: 2_000,
  keycloakUrl: 'https://kimlik.example.test',
  keycloakRealm: 'platform',
  aiRoute: 'ornek-rota',
  csrfMetaName: 'csrf-token',
};

function setup(options: { csrf?: string; timeoutMs?: number } = {}) {
  const onSessionExpired = vi.fn();
  const csrf = createCsrfStore(options.csrf ?? SAMPLE_CSRF_TOKEN);
  const api = createApiClient({
    config: { ...config, timeoutMs: options.timeoutMs ?? config.timeoutMs },
    csrf,
    onSessionExpired,
  });
  return { api: { ...api, ...createProviderClient(api) }, csrf, onSessionExpired };
}

beforeAll(() => mockServer.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  mockServer.resetHandlers();
  resetMockState();
});
afterAll(() => mockServer.close());

describe('yapay zekâ sağlayıcı bağlantıları (model geçidi)', () => {
  const newConnection = {
    provider: 'anthropic',
    account_name: 'Yeni hesap',
    api_name: 'Yeni bağlantı',
    fields: { api_key: 'ornek-anahtar' },
  };

  it('sağlayıcı kataloğunu POST ile ve CSRF başlığıyla okur', async () => {
    const seen: { method: string; path: string; csrf: string | null }[] = [];
    mockServer.events.on('request:start', ({ request }) => {
      seen.push({
        method: request.method,
        path: new URL(request.url).pathname,
        csrf: request.headers.get('X-Frappe-CSRF-Token'),
      });
    });
    const { api } = setup();

    const catalog = await api.listProviderCatalog();

    expect(catalog.categories.map((c) => c.id)).toEqual(['ai_llm']);
    expect(catalog.providers.map((p) => p.id)).toContain('openai');
    expect(seen).toEqual([
      {
        method: 'POST',
        path: '/api/method/platform_core.api.model.provider_catalog',
        csrf: SAMPLE_CSRF_TOKEN,
      },
    ]);
    mockServer.events.removeAllListeners();
  });

  it('bozuk kataloğu reddeder', async () => {
    mockServer.use(
      http.post('*/api/method/platform_core.api.model.provider_catalog', () =>
        HttpResponse.json({ message: { version: 1, categories: [], providers: [{ id: 'x' }] } }),
      ),
    );
    const { api } = setup();
    await expect(api.listProviderCatalog()).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('bağlantıyı kaydeder; yanıtta sır yoktur ve durum not_checked olur', async () => {
    const { api } = setup();

    const saved = await api.saveProviderConnection(newConnection);

    expect(saved).toEqual({
      provider: expect.any(String),
      account: expect.any(String),
      api: expect.any(String),
      connection_status: 'not_checked',
    });
    expect(JSON.stringify(saved)).not.toContain('ornek-anahtar');
  });

  it('hatalı alan yanıtında (400 invalid_fields) alan adlarını hataya taşır', async () => {
    const { api } = setup();

    await expect(
      api.saveProviderConnection({ ...newConnection, fields: { api_key: '' } }),
    ).rejects.toMatchObject({
      kind: 'invalid_request',
      status: 400,
      code: 'invalid_fields',
      fields: ['api_key'],
    });
  });

  it('hesap ve hesap adı birlikte verilirse istek göndermeden reddeder', async () => {
    const seen: string[] = [];
    mockServer.events.on('request:start', ({ request }) => seen.push(request.url));
    const { api } = setup();

    await expect(
      api.saveProviderConnection({ ...newConnection, account: 'ORNEK-HESAP-0001' }),
    ).rejects.toMatchObject({ kind: 'invalid_request', code: 'account' });
    expect(seen).toEqual([]);
    mockServer.events.removeAllListeners();
  });

  it('kayıtlı bağlantıyı canlı dener ve sonucu döner', async () => {
    const { api } = setup();
    const saved = await api.saveProviderConnection(newConnection);

    const check = await api.checkProviderConnection(saved.api);

    expect(check).toEqual({
      api: saved.api,
      status: 'connected',
      checked_at: expect.any(String),
      models_visible: expect.any(Number),
    });
  });

  it('geçersiz anahtar denemesi HTTP 200 ile invalid_credentials döner', async () => {
    const { api } = setup();
    const saved = await api.saveProviderConnection({
      ...newConnection,
      fields: { api_key: 'gecersiz-anahtar' },
    });

    const check = await api.checkProviderConnection(saved.api);

    expect(check.status).toBe('invalid_credentials');
    expect(check.models_visible).toBeNull();
  });

  it('hız sınırı aşılınca 429 gateway_busy hatasını rate_limited türüne çevirir', async () => {
    const { api } = setup();
    for (let i = 0; i < 10; i += 1) {
      await api.saveProviderConnection({ ...newConnection, api_name: `Bağlantı ${i}` });
    }

    await expect(api.saveProviderConnection(newConnection)).rejects.toMatchObject({
      kind: 'rate_limited',
      status: 429,
      code: 'gateway_busy',
    });
  });

  it('bağlantı listesini Frappe API v2 ile okur ve parola alanı dönmez', async () => {
    const { api } = setup();

    const listing = await api.listAiConnections();

    expect(listing.apis.map((row) => row.name)).toContain('ORNEK-API-0001');
    expect(JSON.stringify(listing)).not.toContain('api_key');
  });

  it('kayıtta 503 yanıtını unavailable türüne çevirir', async () => {
    mockServer.use(
      http.post('*/api/method/platform_core.api.model.save_connection', () =>
        HttpResponse.json({}, { status: 503 }),
      ),
    );
    const { api } = setup();
    await expect(api.saveProviderConnection(newConnection)).rejects.toMatchObject({
      kind: 'unavailable',
      status: 503,
    });
  });

  it('model geçidinin süresini kullanır; genel süreden uzun deneme kesilmez', async () => {
    mockServer.use(
      http.post('*/api/method/platform_core.api.model.check_connection', async () => {
        await new Promise((resolve) => setTimeout(resolve, 1_300));
        return HttpResponse.json({
          message: { api: 'A', status: 'connected', checked_at: 'x', models_visible: 1 },
        });
      }),
    );
    const { api } = setup();
    await expect(api.checkProviderConnection('A')).resolves.toMatchObject({ status: 'connected' });
  });
});

import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  SAMPLE_CSRF_TOKEN,
  SAMPLE_KEYCLOAK_URL,
  SAMPLE_USER,
  sampleBootstrap,
} from '@/mocks/fixtures';
import { mockState, resetMockState } from '@/mocks/handlers';
import { mockServer } from '@/mocks/node';

import { createApiClient } from './client';
import type { ApiConfig } from './config';
import { createCsrfStore } from './csrf';
import { ApiError } from './errors';

const SITE = 'https://kiraci.example.test';

/** Sends the headers and the first chunk, and never finishes the body. */
function partialBody(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"message": '));
    },
  });
}

const config: ApiConfig = {
  siteUrl: SITE,
  credentials: 'same-origin',
  timeoutMs: 1_000,
  modelTimeoutMs: 2_000,
  keycloakUrl: SAMPLE_KEYCLOAK_URL,
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
  return { api, csrf, onSessionExpired };
}

beforeAll(() => mockServer.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  mockServer.resetHandlers();
  resetMockState();
});
afterAll(() => mockServer.close());

describe('API istemcisi', () => {
  it('giriş adresini sözleşmedeki yoldan ister', async () => {
    const seen: string[] = [];
    mockServer.events.on('request:start', ({ request }) => {
      seen.push(`${request.method} ${new URL(request.url).pathname}`);
    });
    const { api } = setup();

    const result = await api.getLoginUrl('/panel');

    expect(result.login_url).toMatch(/^https:\/\/api\.login\.atonota\.net\/realms\/platform\//);
    expect(seen).toContain('POST /api/method/platform_core.api.auth.get_login_url');
    mockServer.events.removeAllListeners();
  });

  it('yazan istekte CSRF başlığını ekler, okuyan istekte eklemez', async () => {
    const headers: Record<string, string | null> = {};
    mockServer.events.on('request:start', ({ request }) => {
      headers[request.method] = request.headers.get('X-Frappe-CSRF-Token');
    });
    const { api } = setup();

    await api.getBootstrap();
    await api.logout();

    expect(headers.GET).toBeNull();
    expect(headers.POST).toBe(SAMPLE_CSRF_TOKEN);
    mockServer.events.removeAllListeners();
  });

  it('hiçbir istekte Authorization başlığı göndermez', async () => {
    let authorization: string | null = 'yok';
    mockServer.events.on('request:start', ({ request }) => {
      authorization = request.headers.get('Authorization');
    });
    const { api } = setup();

    await api.getLoggedUser();

    expect(authorization).toBeNull();
    mockServer.events.removeAllListeners();
  });

  it('CSRF belirteci yanlışsa csrf hatası verir', async () => {
    const { api } = setup({ csrf: 'yanlis' });
    await expect(api.logout()).rejects.toMatchObject({ kind: 'csrf' });
  });

  it('oturum bitince session_expired verir ve bir kez haber verir', async () => {
    mockState.signedIn = false;
    const { api, onSessionExpired } = setup();

    await expect(api.getBootstrap()).rejects.toMatchObject({ kind: 'session_expired' });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('belirsiz 403 sonrası oturum kapalıysa session_expired verir', async () => {
    mockServer.use(
      http.get('*/api/method/platform_core.api.shell.get_bootstrap', () =>
        HttpResponse.json({ exc_type: 'PermissionError' }, { status: 403 }),
      ),
      http.get('*/api/method/frappe.auth.get_logged_user', () =>
        HttpResponse.json({ exc_type: 'PermissionError' }, { status: 403 }),
      ),
    );
    const { api, onSessionExpired } = setup();

    await expect(api.getBootstrap()).rejects.toMatchObject({ kind: 'session_expired' });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('belirsiz 403 sonrası oturum açıksa yetki reddi verir', async () => {
    const realFetch = globalThis.fetch;
    const caches: string[] = [];
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (input instanceof Request && input.url.includes('get_logged_user'))
        caches.push(input.cache);
      return realFetch(input, init);
    });
    const { api, onSessionExpired } = setup();

    await expect(api.getDocType('Başka Kayıt')).rejects.toMatchObject({ kind: 'forbidden' });
    expect(onSessionExpired).not.toHaveBeenCalled();
    expect(caches).toEqual(['no-store']);
    spy.mockRestore();
  });

  it.each([
    [
      '503',
      () => HttpResponse.json({ message: { error: 'gateway_unavailable' } }, { status: 503 }),
    ],
    [
      'bozuk yanıt',
      () => HttpResponse.text('<html>', { headers: { 'Content-Type': 'text/html' } }),
    ],
    ['ağ hatası', () => HttpResponse.error()],
  ])(
    'oturum denetimi %s verirse yetki reddini korur ve girişe yönlendirmez',
    async (_label, check) => {
      mockServer.use(
        http.get('*/api/method/platform_core.api.shell.get_bootstrap', () =>
          HttpResponse.json({ exc_type: 'PermissionError' }, { status: 403 }),
        ),
        http.get('*/api/method/frappe.auth.get_logged_user', check),
      );
      const { api, onSessionExpired } = setup();

      await expect(api.getBootstrap()).rejects.toMatchObject({ kind: 'forbidden' });
      expect(onSessionExpired).not.toHaveBeenCalled();
    },
  );

  it('CSRF belirteci yoksa yazan istek csrf hatası alır', async () => {
    const { api, csrf } = setup();
    csrf.clear();
    await expect(api.logout()).rejects.toMatchObject({ kind: 'csrf' });
  });

  it('MCP bildiriminin boş 202 yanıtını kabul eder', async () => {
    const { api } = setup();
    const result = await api.callMcp({ jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(result).toEqual({ status: 'accepted' });
  });

  it('MCP isteğinin gövdeli yanıtını ayrı döner', async () => {
    const { api } = setup();
    const result = await api.callMcp({ jsonrpc: '2.0', id: 1, method: 'ping' });
    expect(result).toMatchObject({ status: 'ok', response: { jsonrpc: '2.0', id: 1 } });
  });

  it('gövde okunurken zaman aşımını timeout türüne çevirir', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const signal = input instanceof Request ? input.signal : undefined;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"message": '));
          signal?.addEventListener('abort', () => controller.error(signal.reason));
        },
      });
      return Promise.resolve(
        new Response(body, { headers: { 'Content-Type': 'application/json' } }),
      );
    });
    const { api } = setup({ timeoutMs: 30 });
    await expect(api.getLoggedUser()).rejects.toMatchObject({ kind: 'timeout' });
    spy.mockRestore();
  });

  it('bozuk JSON gövdesini invalid_response türüne çevirir', async () => {
    mockServer.use(
      http.get('*/api/method/frappe.auth.get_logged_user', () =>
        HttpResponse.text('{"message": ', { headers: { 'Content-Type': 'application/json' } }),
      ),
    );
    const { api } = setup();
    await expect(api.getLoggedUser()).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('gövde okunurken kullanıcı iptal ederse iptali iletir', async () => {
    let headersSent = false;
    mockServer.use(
      http.get('*/api/method/frappe.auth.get_logged_user', () => {
        headersSent = true;
        return new HttpResponse(partialBody(), {
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    const { api } = setup();
    const controller = new AbortController();
    const pending = api.getLoggedUser({ signal: controller.signal });
    await vi.waitFor(() => expect(headersSent).toBe(true));
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('503 yanıtı oturum işareti taşısa da girişe yönlendirmez', async () => {
    mockServer.use(
      http.get('*/api/method/platform_core.api.shell.get_bootstrap', () =>
        HttpResponse.json({ exc_type: 'SessionExpired', session_expired: 1 }, { status: 503 }),
      ),
    );
    const { api, onSessionExpired } = setup();
    await expect(api.getBootstrap()).rejects.toMatchObject({ kind: 'unavailable' });
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('oturum sorgusunun 401 yanıtı girişe yönlendirme başlatmaz', async () => {
    mockState.signedIn = false;
    const { api, onSessionExpired } = setup();
    await expect(api.getLoggedUser()).rejects.toMatchObject({ kind: 'session_expired' });
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it.each([
    ['boş menü öğesi', { sidebars: [null] }],
    ['adsız menü', { sidebars: [{ data: {} }] }],
    ['bozuk menü kaydı', { sidebars: [{ name: 'Örnek', data: { items: [null] } }] }],
    ['bozuk menü etiketi', { sidebars: [{ name: 'Örnek', data: { items: [{ label: 3 }] } }] }],
    ['bozuk çalışma alanı', { workspaces: [{ name: 1 }] }],
    ['bozuk biçim ayarı', { formatting: { time_zone: 'Europe/Istanbul' } }],
  ])('açılış verisinde %s varsa yanıtı reddeder', async (_label, patch) => {
    mockServer.use(
      http.get('*/api/method/platform_core.api.shell.get_bootstrap', () =>
        HttpResponse.json({ message: { ...sampleBootstrap, ...patch } }),
      ),
    );
    const { api } = setup();
    await expect(api.getBootstrap()).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('menü kayıtları sözleşmeye uyan açılış verisini kabul eder', async () => {
    mockServer.use(
      http.get('*/api/method/platform_core.api.shell.get_bootstrap', () =>
        HttpResponse.json({
          message: {
            ...sampleBootstrap,
            sidebars: [
              {
                name: 'Örnek',
                data: {
                  label: 'Örnek',
                  items: [{ label: 'Örnek kayıt', type: 'Link', link_to: 'Örnek Kayıt', child: 0 }],
                },
              },
            ],
          },
        }),
      ),
    );
    const { api } = setup();
    await expect(api.getBootstrap()).resolves.toMatchObject({ sidebars: [{ name: 'Örnek' }] });
  });

  it.each([
    ['negatif başlangıç', { start: -1 }],
    ['kesirli başlangıç', { start: 0.5 }],
    ['sınır dışı sayfa boyu', { limit: 0 }],
    ['çok büyük sayfa boyu', { limit: 101 }],
  ])('öneri listesinde %s için istek göndermez', async (_label, query) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { api } = setup();
    await expect(api.listProposals(query)).rejects.toMatchObject({ kind: 'invalid_request' });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('DocType tanımını ETag ile okur ve 304 yanıtını ayırır', async () => {
    const { api } = setup();

    const first = await api.getDocType('Örnek Kayıt');
    expect(first.status).toBe('fresh');
    if (first.status !== 'fresh') return;
    expect(first.meta.schema.name).toBe('Örnek Kayıt');

    const second = await api.getDocType('Örnek Kayıt', first.etag);
    expect(second.status).toBe('not_modified');
  });

  it('oturumdaki kullanıcıyı okur', async () => {
    const { api } = setup();
    await expect(api.getLoggedUser()).resolves.toBe(SAMPLE_USER);
  });

  it('JSON olmayan başarılı yanıtı reddeder', async () => {
    mockServer.use(
      http.get('*/api/method/platform_core.api.shell.get_bootstrap', () =>
        HttpResponse.text('<html></html>', { headers: { 'Content-Type': 'text/html' } }),
      ),
    );
    const { api } = setup();
    await expect(api.getBootstrap()).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('şemaya uymayan yanıtı reddeder', async () => {
    mockServer.use(
      http.post('*/api/method/platform_core.api.auth.get_login_url', () =>
        HttpResponse.json({ message: { login_url: 42 } }),
      ),
    );
    const { api } = setup();
    await expect(api.getLoginUrl()).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('ağ hatasını network türüne çevirir', async () => {
    mockServer.use(
      http.get('*/api/method/frappe.auth.get_logged_user', () => HttpResponse.error()),
    );
    const { api } = setup();
    const error = await api.getLoggedUser().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'network' });
  });

  it('zaman aşımını timeout türüne çevirir', async () => {
    // On abort, the MSW socket throws a separate error inside Node, so we set up the network with a fetch mock.
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      (input) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = input instanceof Request ? input.signal : undefined;
          signal?.addEventListener('abort', () => reject(signal.reason));
        }),
    );
    const { api } = setup({ timeoutMs: 20 });
    await expect(api.getLoggedUser()).rejects.toMatchObject({ kind: 'timeout' });
    spy.mockRestore();
  });

  it('kullanıcının iptalini hata türüne çevirmeden iletir', async () => {
    mockServer.use(
      http.get(
        '*/api/method/frappe.auth.get_logged_user',
        () => new Promise<Response>(() => undefined),
      ),
    );
    const { api } = setup();
    const controller = new AbortController();
    const pending = api.getLoggedUser({ signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('kayıt uçları (frappeDocument)', () => {
  const RECORD_PATH = `/api/resource/${encodeURIComponent('Örnek Kayıt')}/ORNEK-0001`;

  it('site kökünü, çerez ayarını ve CSRF deposundaki güncel belirteci kullanır', async () => {
    const seen: { url?: string; csrf?: string | null; auth?: boolean; type?: string | null } = {};
    mockServer.use(
      http.put(`${SITE}${RECORD_PATH}`, async ({ request }) => {
        seen.url = request.url;
        seen.csrf = request.headers.get('X-Frappe-CSRF-Token');
        seen.auth = request.headers.has('Authorization');
        seen.type = request.headers.get('Content-Type');
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: { name: 'ORNEK-0001', ...body } });
      }),
    );
    const { api, csrf } = setup();
    // The token is refreshed later. The request carries the current value in the store, not the old one.
    csrf.set('yenilenmis-belirtec');

    const result = await api.frappeDocument({
      method: 'PUT',
      path: RECORD_PATH,
      body: { title: 'Yeni başlık' },
    });

    expect(seen).toEqual({
      url: `${SITE}${RECORD_PATH}`,
      csrf: 'yenilenmis-belirtec',
      auth: false,
      type: 'application/json',
    });
    expect(result).toEqual({
      ok: true,
      status: 200,
      etag: undefined,
      body: { data: { name: 'ORNEK-0001', title: 'Yeni başlık' } },
    });
  });

  it('okuyan istekte CSRF başlığı göndermez, sorgu ve ETag ekler, 304 yanıtını gövdesiz döner', async () => {
    const seen: { csrf?: string | null; match?: string | null; doctype?: string | null } = {};
    mockServer.use(
      http.get(`${SITE}/api/method/platform_core.api.meta.get_doctype`, ({ request }) => {
        seen.csrf = request.headers.get('X-Frappe-CSRF-Token');
        seen.match = request.headers.get('If-None-Match');
        seen.doctype = new URL(request.url).searchParams.get('doctype');
        return new HttpResponse(null, { status: 304, headers: { ETag: '"e1"' } });
      }),
    );
    const { api } = setup();

    const result = await api.frappeDocument({
      method: 'GET',
      path: '/api/method/platform_core.api.meta.get_doctype',
      query: { doctype: 'Örnek Kayıt' },
      etag: '"e1"',
    });

    expect(seen).toEqual({ csrf: null, match: '"e1"', doctype: 'Örnek Kayıt' });
    expect(result).toEqual({ ok: true, status: 304, etag: '"e1"', body: undefined });
  });

  it('hata yanıtında ortak hatayı ve gövdeyi döner; oturum bitince oturum işini bir kez çağırır', async () => {
    mockState.signedIn = false;
    const { api, onSessionExpired } = setup();

    const first = await api.frappeDocument({ method: 'GET', path: RECORD_PATH });
    const second = await api.frappeDocument({ method: 'GET', path: RECORD_PATH });

    expect(first.ok).toBe(false);
    if (first.ok) throw new Error('beklenmeyen başarı');
    expect(first.error).toBeInstanceOf(ApiError);
    expect(first.error.kind).toBe('session_expired');
    expect(first.body).toMatchObject({ exc_type: 'SessionExpired' });
    expect(second.ok).toBe(false);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('sahte sunucu tanımadığı kayıt türüne yetki reddi verir; okuma ve kaydetme sahte veriyle çalışır', async () => {
    const { api } = setup();
    const denied = await api.frappeDocument({
      method: 'GET',
      path: '/api/resource/Teklif/TEK-0003',
    });
    expect(denied.ok ? 'ok' : denied.error.kind).toBe('forbidden');

    const read = await api.frappeDocument({ method: 'GET', path: RECORD_PATH });
    if (!read.ok) throw new Error('okuma başarısız');
    const record = (read.body as { data: { title: string; modified: string } }).data;
    expect(record.title).toBe('Örnek veri 1');
    const saved = await api.frappeDocument({
      method: 'PUT',
      path: RECORD_PATH,
      body: { title: 'Yeni', modified: record.modified },
    });
    expect(saved.ok && (saved.body as { data: { title: string } }).data.title).toBe('Yeni');
  });

  it('başarılı yanıt JSON değilse geçersiz yanıt hatası verir', async () => {
    mockServer.use(http.get(`${SITE}${RECORD_PATH}`, () => HttpResponse.text('<html></html>')));
    const { api } = setup();
    await expect(api.frappeDocument({ method: 'GET', path: RECORD_PATH })).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });

  it.each([
    'https://baska.example.test/api/resource/User/x',
    '//baska.example.test/api/resource/User/x',
    '/files/rapor.pdf',
    '/api/resource/../method/x',
    '/api/resource/User/x?baska=1',
    // The browser's URL parser decodes encoded dots as `..` (review 3, K1).
    '/api/resource/%2e%2e/%2e%2e/files/x',
    '/api/resource/%2E%2E/%2E%2E/files/x',
    '/api/resource/.%2e/.%2e/files/x',
    '/api/resource/User/%2e%2e/%2e%2e/method/x',
    '/api/resource/User/%2e/x',
  ])('izinli kayıt yolu dışındaki adrese istek göndermez: %s', async (path) => {
    const seen: string[] = [];
    mockServer.events.on('request:start', ({ request }) => seen.push(request.url));
    const { api } = setup();
    await expect(api.frappeDocument({ method: 'GET', path })).rejects.toMatchObject({
      kind: 'invalid_request',
      code: 'path',
    });
    expect(seen).toEqual([]);
    mockServer.events.removeAllListeners();
  });

  it('kodlanmış ama nokta parçası olmayan kayıt adını kabul eder', async () => {
    const path = `/api/resource/User/${encodeURIComponent('örnek.kişi%')}`;
    mockServer.use(http.get(`${SITE}${path}`, () => HttpResponse.json({ data: { name: 'x' } })));
    const { api } = setup();
    await expect(api.frappeDocument({ method: 'GET', path })).resolves.toMatchObject({ ok: true });
  });
});

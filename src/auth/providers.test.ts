// AtonotA Login: platform list, sign-in URL and account linking (G-159, G-160).
import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApiClient } from '@/api/client';
import type { ApiConfig } from '@/api/config';
import { createCsrfStore } from '@/api/csrf';
import {
  createLoginClient,
  isLinkedAccounts,
  isLoginProviderList,
  startLinkUrl,
} from '@/api/login-client';
import { SAMPLE_CSRF_TOKEN, SAMPLE_KEYCLOAK_URL, sampleLoginProviders } from '@/mocks/fixtures';
import { mockState, resetMockState } from '@/mocks/handlers';
import { mockServer } from '@/mocks/node';

import { createAuth, startLoginUrl } from './auth';

const SITE = 'https://kiraci.example.test';
const config: ApiConfig = {
  siteUrl: SITE,
  credentials: 'same-origin',
  timeoutMs: 1_000,
  modelTimeoutMs: 2_000,
  keycloakUrl: SAMPLE_KEYCLOAK_URL,
  keycloakRealm: 'platform',
  aiRoute: '',
  csrfMetaName: 'csrf-token',
};

function client() {
  return createLoginClient(createApiClient({ config, csrf: createCsrfStore(SAMPLE_CSRF_TOKEN) }));
}

beforeAll(() => mockServer.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  mockServer.resetHandlers();
  resetMockState();
});
afterAll(() => mockServer.close());

describe('startLoginUrl', () => {
  it('platform verilince adrese platform adını ekler', () => {
    expect(startLoginUrl(SITE, '/panel', 'google')).toBe(
      `${SITE}/api/method/platform_core.api.auth.start_login?redirect_to=%2Fpanel&provider=google`,
    );
  });

  it('platform adı kurala uymuyorsa adrese eklemez', () => {
    for (const bad of ['Google', '../x', 'a b', '', 'x'.repeat(65), 'google?x=1']) {
      expect(startLoginUrl(SITE, '/panel', bad)).toBe(
        `${SITE}/api/method/platform_core.api.auth.start_login?redirect_to=%2Fpanel`,
      );
    }
  });

  it('platformla girişte tarayıcı start_login yoluna gider', () => {
    const navigate = vi.fn<(url: string) => void>();
    const csrf = createCsrfStore(SAMPLE_CSRF_TOKEN);
    const auth = createAuth({
      api: createApiClient({ config, csrf }),
      config,
      csrf,
      navigate,
      currentPath: () => '/panel',
    });
    auth.signIn(undefined, 'linkedin');
    expect(navigate).toHaveBeenCalledWith(
      `${SITE}/api/method/platform_core.api.auth.start_login?redirect_to=%2Fpanel&provider=linkedin`,
    );
  });
});

describe('startLinkUrl', () => {
  it('bağlama adresini platform adı ve hesap sayfası dönüşüyle kurar', () => {
    expect(startLinkUrl(SITE, 'facebook', '/account')).toBe(
      `${SITE}/api/method/platform_core.api.auth.start_link?provider=facebook&redirect_to=%2Faccount`,
    );
  });

  it('platform adı kurala uymuyorsa adres kurulmaz', () => {
    expect(startLinkUrl(SITE, 'Face Book', '/account')).toBeUndefined();
  });

  it('dönüş yolu kurala uymuyorsa adres kurulmaz', () => {
    for (const bad of ['//kotu.example.test', 'account', '/Account', '/a?b=1', '/../x']) {
      expect(startLinkUrl(SITE, 'facebook', bad)).toBeUndefined();
    }
  });
});

describe('platform listesi sözleşmesi', () => {
  it('geçerli listeyi kabul eder', () => {
    expect(isLoginProviderList({ providers: [{ alias: 'google', display_name: 'Google' }] })).toBe(
      true,
    );
    expect(isLoginProviderList({ providers: [] })).toBe(true);
  });

  it('bozuk kaydı, yinelenen adı ve boş görünen adı reddeder', () => {
    expect(isLoginProviderList({ providers: [{ alias: 'Google', display_name: 'G' }] })).toBe(
      false,
    );
    expect(
      isLoginProviderList({
        providers: [
          { alias: 'x', display_name: 'X' },
          { alias: 'x', display_name: 'X' },
        ],
      }),
    ).toBe(false);
    expect(isLoginProviderList({ providers: [{ alias: 'x', display_name: ' ' }] })).toBe(false);
    expect(isLoginProviderList({})).toBe(false);
  });

  it('bağlı hesaplar yanıtını denetler', () => {
    expect(
      isLinkedAccounts({
        providers: [{ alias: 'google', display_name: 'Google', linked: true }],
        local_sign_in_methods: 0,
      }),
    ).toBe(true);
    expect(
      isLinkedAccounts({
        providers: [{ alias: 'google', display_name: 'Google', linked: 'evet' }],
        local_sign_in_methods: 0,
      }),
    ).toBe(false);
    expect(isLinkedAccounts({ providers: [], local_sign_in_methods: -1 })).toBe(false);
  });
});

describe('sahte sunucu ve istemci', () => {
  it('yalnız açık platformlar gelir, kapalı platform gelmez', async () => {
    const list = await client().listLoginProviders();
    expect(list.map((p) => p.display_name)).toEqual(['Google', 'Facebook', 'LinkedIn', 'X']);
    // The sample data has a disabled entry. That entry is not in the response.
    expect(sampleLoginProviders.some((p) => !p.enabled)).toBe(true);
  });

  it('platform listesi oturum istemez', async () => {
    mockState.signedIn = false;
    await expect(client().listLoginProviders()).resolves.toHaveLength(4);
  });

  it('liste boşsa boş dizi döner', async () => {
    mockState.loginProviders = [];
    await expect(client().listLoginProviders()).resolves.toEqual([]);
  });

  it('bozuk yanıt invalid_response hatası verir', async () => {
    mockServer.use(
      http.get('*/api/method/platform_core.api.auth.list_login_providers', () =>
        HttpResponse.json({ message: { providers: [{ alias: '../x', display_name: 'X' }] } }),
      ),
    );
    await expect(client().listLoginProviders()).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });

  it('bağlı hesapları okur', async () => {
    const accounts = await client().listLinkedAccounts();
    expect(accounts.providers.filter((p) => p.linked).map((p) => p.alias)).toEqual([
      'google',
      'linkedin',
    ]);
    expect(accounts.local_sign_in_methods).toBe(0);
  });

  it('bağı kaldırma isteği CSRF belirteci taşır ve yeni listeyi döner', async () => {
    let token: string | null = null;
    mockServer.events.on('request:start', ({ request }) => {
      if (request.url.includes('unlink_account'))
        token = request.headers.get('X-Frappe-CSRF-Token');
    });
    const accounts = await client().unlinkAccount('linkedin');
    expect(token).toBe(SAMPLE_CSRF_TOKEN);
    expect(accounts.providers.find((p) => p.alias === 'linkedin')?.linked).toBe(false);
    mockServer.events.removeAllListeners();
  });

  it('son giriş yolu kaldırılamaz: sunucu 409 LastSignInMethod döner', async () => {
    const api = client();
    await api.unlinkAccount('linkedin');
    await expect(api.unlinkAccount('google')).rejects.toMatchObject({
      kind: 'conflict',
      code: 'LastSignInMethod',
    });
    expect(mockState.linkedAccounts.has('google')).toBe(true);
  });

  it('kurala uymayan platform adıyla istek gönderilmez', async () => {
    await expect(client().unlinkAccount('../google')).rejects.toMatchObject({
      kind: 'invalid_request',
    });
  });
});

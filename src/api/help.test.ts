import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { SAMPLE_CSRF_TOKEN, SAMPLE_KEYCLOAK_URL } from '@/mocks/fixtures';
import { resetMockState } from '@/mocks/handlers';
import { mockServer } from '@/mocks/node';

import { createApiClient } from './client';
import type { ApiConfig } from './config';
import { createCsrfStore } from './csrf';
import { ApiError } from './errors';

const SITE = 'https://kiraci.example.test';

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

const api = () => createApiClient({ config, csrf: createCsrfStore(SAMPLE_CSRF_TOKEN) });

/** Sözleşmedeki (platform_core-help 0.2.0) bileşen yardımı örneği. */
const component = {
  component_id: 'record-form',
  source: 'tenant',
  topic: 'HT-00002',
  title: 'Kayıt formu',
  content: 'Kaydı bu formda düzenlersiniz.',
  message: null,
  actions: [],
  tour_url: '/tours/record',
  doc_url: 'https://docs.example.test/record',
  support_url: null,
};

const field = {
  doctype: 'Örnek Kayıt',
  fieldname: 'title',
  source: 'app',
  topic: 'HT-00001',
  title: 'Başlık',
  content: 'Kaydın kısa adı.',
  message: null,
  actions: [],
  tour_url: null,
  doc_url: 'https://docs.example.test/title',
  support_url: '/helpdesk/new',
};

beforeAll(() => mockServer.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  mockServer.resetHandlers();
  resetMockState();
});
afterAll(() => mockServer.close());

describe('yardım istemcisi (G-138)', () => {
  it('bileşen yardımını sözleşmedeki yoldan ve component_id ile okur', async () => {
    let seen: URL | null = null;
    mockServer.use(
      http.get('*/api/method/platform_core.api.help.get_component_help', ({ request }) => {
        seen = new URL(request.url);
        return HttpResponse.json({ message: component });
      }),
    );
    await expect(api().getComponentHelp('record-form')).resolves.toEqual(component);
    expect(seen!.origin).toBe(SITE);
    expect(seen!.searchParams.get('component_id')).toBe('record-form');
  });

  it('bileşen için yardım yoksa null döner', async () => {
    mockServer.use(
      http.get('*/api/method/platform_core.api.help.get_component_help', () =>
        HttpResponse.json({ message: null }),
      ),
    );
    await expect(api().getComponentHelp('yok')).resolves.toBeNull();
  });

  it('alan yardımını doctype ve fieldname ile okur', async () => {
    let seen: URL | null = null;
    mockServer.use(
      http.get('*/api/method/platform_core.api.help.get_field_help', ({ request }) => {
        seen = new URL(request.url);
        return HttpResponse.json({ message: field });
      }),
    );
    await expect(
      api().getFieldHelp({ doctype: 'Örnek Kayıt', fieldname: 'title' }),
    ).resolves.toEqual(field);
    expect(seen!.searchParams.get('doctype')).toBe('Örnek Kayıt');
    expect(seen!.searchParams.get('fieldname')).toBe('title');
  });

  it('bağlantı alanı eksik yanıtı reddeder', async () => {
    const { support_url: _drop, ...broken } = component;
    mockServer.use(
      http.get('*/api/method/platform_core.api.help.get_component_help', () =>
        HttpResponse.json({ message: broken }),
      ),
    );
    const error = await api()
      .getComponentHelp('record-form')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe('invalid_response');
  });

  it('bağlantı alanı metin değilse yanıtı reddeder', async () => {
    mockServer.use(
      http.get('*/api/method/platform_core.api.help.get_field_help', () =>
        HttpResponse.json({ message: { ...field, tour_url: 42 } }),
      ),
    );
    await expect(
      api().getFieldHelp({ doctype: 'Örnek Kayıt', fieldname: 'title' }),
    ).rejects.toMatchObject({ kind: 'invalid_response' });
  });
});

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { requiredDocTypes } from '@/shell/nav';

import {
  MENU_READABLE_DOCTYPES,
  RESELLER_READABLE_DOCTYPES,
  RESTRICTED_SAMPLE_DOCTYPE,
} from './fixtures';
import { resetMockState } from './handlers';
import { mockServer } from './node';

const SITE = 'https://kiraci.example.test';

function metaUrl(doctype: string): string {
  const url = new URL(`${SITE}/api/method/platform_core.api.meta.get_doctype`);
  url.searchParams.set('doctype', doctype);
  url.searchParams.set('surface', 'web');
  return url.toString();
}

beforeAll(() => mockServer.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  mockServer.resetHandlers();
  resetMockState();
});
afterAll(() => mockServer.close());

describe('sahte sunucu: menü yetkisi (G-94)', () => {
  it('örnek kullanıcı modül sayfalarının okuduğu türleri okuyabilir', async () => {
    expect(requiredDocTypes.length).toBeGreaterThan(0);
    // The menu asks the definition endpoint about module types. The reseller link type is not asked
    // (AJA-945).
    expect([...MENU_READABLE_DOCTYPES].sort()).toEqual([...requiredDocTypes].sort());
    expect(RESELLER_READABLE_DOCTYPES).toEqual([]);
    // Like the real server, the definition endpoint returns 403 for the link type.
    expect((await fetch(metaUrl('Reseller Customer Link'))).status).toBe(403);
    for (const doctype of MENU_READABLE_DOCTYPES) {
      const response = await fetch(metaUrl(doctype));
      expect(response.status, doctype).toBe(200);
      const body = (await response.json()) as { message: { schema: { name: string } } };
      expect(body.message.schema.name).toBe(doctype);
    }
  });

  it('kısıtlı türde yine 403 verir', async () => {
    expect((await fetch(metaUrl(RESTRICTED_SAMPLE_DOCTYPE))).status).toBe(403);
  });
});

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { FOREIGN_LOGOUT_URL, SAMPLE_CSRF_TOKEN, sampleLoginUrl, sampleLogoutUrl } from './fixtures';
import { mockState, resetMockState } from './handlers';
import { mockServer } from './node';
import { applyMockScenario, MOCK_SCENARIO_KEY, readMockScenario } from './scenarios';

const LOGOUT = 'https://kiraci.example.test/api/method/platform_core.api.auth.logout';

function logout() {
  return fetch(LOGOUT, {
    method: 'POST',
    headers: { 'X-Frappe-CSRF-Token': SAMPLE_CSRF_TOKEN },
  });
}

beforeAll(() => mockServer.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  mockServer.resetHandlers();
  resetMockState();
  sessionStorage.clear();
});
afterAll(() => mockServer.close());

describe('sahte sunucu senaryoları', () => {
  it('senaryo yoksa çıkış örnek adresi verir', async () => {
    expect(applyMockScenario(null)).toBe(false);
    const response = await logout();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: sampleLogoutUrl });
  });

  it('"cikis-hatasi" senaryosunda çıkış sunucu hatası verir ve oturum açık kalır', async () => {
    expect(applyMockScenario('cikis-hatasi')).toBe(true);
    const response = await logout();
    expect(response.status).toBe(500);
    expect(mockState.signedIn).toBe(true);
  });

  it('"cikis-yabanci-adres" senaryosunda çıkış başka kökenli bir adres verir', async () => {
    expect(applyMockScenario('cikis-yabanci-adres')).toBe(true);
    const response = await logout();
    expect(await response.json()).toEqual({ message: { logout_url: FOREIGN_LOGOUT_URL } });
    expect(new URL(FOREIGN_LOGOUT_URL).hostname).toBe('baska.example.test');
  });

  it('"oturum-kapali" senaryosunda oturum kapalı başlar', async () => {
    expect(applyMockScenario('oturum-kapali')).toBe(true);
    const response = await fetch(
      'https://kiraci.example.test/api/method/frappe.auth.get_logged_user',
    );
    expect(response.status).toBe(401);
    expect(mockState.signedIn).toBe(false);
  });

  it('start_login isteği AtonotA Login giriş adresine yönlendirir', async () => {
    const response = await fetch(
      'https://kiraci.example.test/api/method/platform_core.api.auth.start_login?redirect_to=%2Fpanel',
      { redirect: 'manual' },
    );
    expect(response.status).toBe(302);
    const location = response.headers.get('location') ?? '';
    expect(location).toBe(sampleLoginUrl.login_url);
    expect(new URL(location).origin).toBe('https://api.login.atonota.net');
  });

  it('start_login güvensiz dönüş yolunu reddeder', async () => {
    const response = await fetch(
      'https://kiraci.example.test/api/method/platform_core.api.auth.start_login?redirect_to=%2F%2Fkotu.example.test',
      { redirect: 'manual' },
    );
    expect(response.status).toBe(400);
  });

  it('bilinmeyen senaryo yok sayılır', () => {
    expect(applyMockScenario('bilinmeyen')).toBe(false);
    expect(mockState.logoutOutcome).toBe('ok');
  });

  it('senaryo adı oturum deposundan okunur', () => {
    expect(readMockScenario()).toBeNull();
    sessionStorage.setItem(MOCK_SCENARIO_KEY, 'cikis-hatasi');
    expect(readMockScenario()).toBe('cikis-hatasi');
  });

  it('sıfırlama çıkışı olağan yanıta döndürür', () => {
    applyMockScenario('cikis-hatasi');
    resetMockState();
    expect(mockState.logoutOutcome).toBe('ok');
  });

  describe('ana sayfa', () => {
    const SUMMARY = 'https://kiraci.example.test/api/method/hrms_tr.api.get_home_summary';
    const REJECT = 'https://kiraci.example.test/api/method/hrms_tr.api.reject_leave';
    const APPROVE = 'https://kiraci.example.test/api/method/hrms_tr.api.approve_leave';

    async function summary() {
      const response = await fetch(SUMMARY);
      return {
        status: response.status,
        body: (await response.json()) as {
          message: {
            pending_approvals: { name: string; version: string }[];
            counts: { pending_approvals: number };
          };
        },
      };
    }

    function decide(url: string, name: string, version: string) {
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': SAMPLE_CSRF_TOKEN },
        body: JSON.stringify({ name, version }),
      });
    }

    it('"ana-sayfa-iki-bekleyen" senaryosunda iki bekleyen talep vardır', async () => {
      expect(applyMockScenario('ana-sayfa-iki-bekleyen')).toBe(true);
      const { status, body } = await summary();
      expect(status).toBe(200);
      expect(body.message.pending_approvals).toHaveLength(2);
      expect(body.message.counts.pending_approvals).toBe(2);
    });

    it('"ana-sayfa-bos" senaryosunda bekleyen talep yoktur', async () => {
      expect(applyMockScenario('ana-sayfa-bos')).toBe(true);
      const { status, body } = await summary();
      expect(status).toBe(200);
      expect(body.message.pending_approvals).toEqual([]);
      expect(body.message.counts.pending_approvals).toBe(0);
    });

    it('"ana-sayfa-hata" senaryosunda özet ucu sunucu hatası verir', async () => {
      expect(applyMockScenario('ana-sayfa-hata')).toBe(true);
      expect((await summary()).status).toBe(500);
    });

    it.each([
      ['ret', REJECT],
      ['onay', APPROVE],
    ])(
      '"ana-sayfa-eski-surum" senaryosunda özetteki sürümle gelen %s isteği çakışma verir',
      async (_label, url) => {
        expect(applyMockScenario('ana-sayfa-eski-surum')).toBe(true);
        const { body } = await summary();
        const item = body.message.pending_approvals[0];
        if (!item) throw new Error('Bekleyen talep yok.');
        const response = await decide(url, item.name, item.version);
        expect(response.status).toBe(417);
        expect(await response.json()).toMatchObject({ exc_type: 'TimestampMismatchError' });
        expect(mockState.leaves.get(item.name)?.status).toBe('Open');
      },
    );
  });
});

describe('sahte sunucu: dört panel rolü (AJA-831, AJA-834)', () => {
  const SITE = 'https://kiraci.example.test';
  const RESELLER = `${SITE}/api/method/platform_core.api.reseller.`;
  const bootstrapRoles = async () => {
    const response = await fetch(`${SITE}/api/method/platform_core.api.shell.get_bootstrap`);
    return ((await response.json()) as { message: { user: { roles: string[] } } }).message.user
      .roles;
  };
  const metaStatus = async (doctype: string) => {
    const url = new URL(`${SITE}/api/method/platform_core.api.meta.get_doctype`);
    url.searchParams.set('doctype', doctype);
    return (await fetch(url)).status;
  };
  const requestCustomer = () =>
    fetch(`${RESELLER}request_customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': SAMPLE_CSRF_TOKEN },
      body: JSON.stringify({ customer_name: 'Örnek', contact_email: 'yeni@example.test' }),
    });

  it.each([
    ['rol-tenant-admin', 'Tenant Admin'],
    ['rol-tenant-admin-assistant', 'Tenant Admin Assistant'],
    ['rol-reseller-admin', 'Reseller Admin'],
    ['rol-reseller-assistant', 'Reseller Assistant'],
  ])('"%s" senaryosu açılış verisine "%s" rolünü yazar', async (scenario, role) => {
    expect(applyMockScenario(scenario)).toBe(true);
    expect(await bootstrapRoles()).toEqual(['Website User', role]);
  });

  it('bayi müşteri listesini okur, kiracının iş verisini okuyamaz', async () => {
    applyMockScenario('rol-reseller-admin');
    // Like the real server: the definition endpoint returns 403 for the link type, also to
    // resellers (AJA-945).
    expect(await metaStatus('Reseller Customer Link')).toBe(403);
    expect((await fetch(`${RESELLER}list_customers`)).status).toBe(200);
    expect(await metaStatus('Leave Application')).toBe(403);
    expect(await metaStatus('PLT AI API')).toBe(403);
  });

  it('kiracı yöneticisi bağ kaydını okuyamaz', async () => {
    applyMockScenario('rol-tenant-admin');
    expect(await metaStatus('Reseller Customer Link')).toBe(403);
    expect(await metaStatus('Leave Application')).toBe(200);
  });

  it('bayi uçları müşteri listesini ve site durumunu verir', async () => {
    applyMockScenario('rol-reseller-assistant');
    const list = (await (await fetch(`${RESELLER}list_customers`)).json()) as {
      message: { customer_tenant: string }[];
    };
    expect(list.message.length).toBeGreaterThan(0);
    const tenant = list.message[0]!.customer_tenant;
    expect(tenant).toMatch(/\.example\.test$/);
    const status = await fetch(`${RESELLER}customer_status?customer_tenant=${tenant}`);
    expect(await status.json()).toEqual({
      message: { customer_tenant: tenant, status: expect.any(String) },
    });
    expect(
      (await fetch(`${RESELLER}customer_status?customer_tenant=baska.example.test`)).status,
    ).toBe(403);
  });

  it('yeni müşteri isteğini yalnız "Reseller Admin" gönderir', async () => {
    applyMockScenario('rol-reseller-assistant');
    expect((await requestCustomer()).status).toBe(403);
    resetMockState();
    applyMockScenario('rol-reseller-admin');
    const response = await requestCustomer();
    expect(response.status).toBe(200);
    expect(((await response.json()) as { message: { name: string } }).message.name).toBeTruthy();
  });

  it('kiracı rolü bayi uçlarını kullanamaz', async () => {
    applyMockScenario('rol-tenant-admin');
    expect((await fetch(`${RESELLER}list_customers`)).status).toBe(403);
  });
});

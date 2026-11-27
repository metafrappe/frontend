import { http, HttpResponse, type JsonBodyType } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  SAMPLE_CSRF_TOKEN,
  SAMPLE_KEYCLOAK_URL,
  SAMPLE_PRESS_URL,
  sampleInstallations,
  sampleLeaves,
} from '@/mocks/fixtures';
import { mockState, resetMockState } from '@/mocks/handlers';
import { mockServer } from '@/mocks/node';

import { createApiClient } from './client';
import type { ApiConfig } from './config';
import { createCsrfStore } from './csrf';
import { pressAccountDeletionUrl, readPressConfig } from './press';

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

function api() {
  return createApiClient({ config, csrf: createCsrfStore(SAMPLE_CSRF_TOKEN) });
}

const requests: { method: string; url: URL; csrf: string | null }[] = [];
beforeAll(() => {
  mockServer.listen({ onUnhandledFrame: 'error' });
  mockServer.events.on('request:start', ({ request }) => {
    requests.push({
      method: request.method,
      url: new URL(request.url),
      csrf: request.headers.get('X-Frappe-CSRF-Token'),
    });
  });
});
afterEach(() => {
  // The panel calls no Press endpoint in any test. Press is reached only through a full-page redirect.
  expect(requests.filter((item) => item.url.origin === SAMPLE_PRESS_URL)).toEqual([]);
  mockServer.resetHandlers();
  resetMockState();
  requests.length = 0;
});
afterAll(() => mockServer.close());

describe('HRMS izin başvuruları', () => {
  it('listeyi sözleşmedeki yoldan, JSON süzgeç ve alanlarla ister', async () => {
    const items = await api().listLeaveApplications({
      fields: ['name', 'status', 'modified'],
      filters: { status: 'Open', docstatus: 0 },
      orderBy: 'modified desc, name asc',
      start: 0,
      pageLength: 20,
    });

    const sent = requests.at(-1)?.url;
    expect(sent?.pathname).toBe('/api/resource/Leave%20Application');
    expect(JSON.parse(sent?.searchParams.get('fields') ?? '')).toEqual([
      'name',
      'status',
      'modified',
    ]);
    expect(JSON.parse(sent?.searchParams.get('filters') ?? '')).toEqual({
      status: 'Open',
      docstatus: 0,
    });
    expect(sent?.searchParams.get('order_by')).toBe('modified desc, name asc');
    expect(sent?.searchParams.get('limit_page_length')).toBe('20');
    expect(items).toEqual([
      { name: sampleLeaves[0]?.name, status: 'Open', modified: sampleLeaves[0]?.modified },
    ]);
  });

  it.each([
    ['negatif başlangıç', { start: -20 }],
    ['kesirli başlangıç', { start: 1.5 }],
    ['kesirli sayfa boyu', { pageLength: 2.5 }],
    ['çok büyük sayfa boyu', { pageLength: 101 }],
  ])('%s için istek göndermez', async (_label, query) => {
    await expect(api().listLeaveApplications(query)).rejects.toMatchObject({
      kind: 'invalid_request',
    });
    expect(requests).toHaveLength(0);
  });

  it('sahte sunucu yalnız izin başvurusu kayıtlarını karşılar', async () => {
    const response = await fetch(`${SITE}/api/resource/Customer`).catch(() => undefined);
    // There is no mock endpoint for another DocType. The request is not handled and does not get 403.
    expect(response?.status).not.toBe(403);
  });

  it('ad üyeliği süzgecini dizi biçiminde gönderir', async () => {
    const names = sampleLeaves.map((leave) => leave.name);
    const items = await api().listLeaveApplications({ filters: [['name', 'in', names]] });
    expect(items.map((item) => item.name).sort()).toEqual([...names].sort());
  });

  it('sayfa sınırı 1 ile 100 arasında değilse istek göndermez', async () => {
    await expect(api().listLeaveApplications({ pageLength: 0 })).rejects.toMatchObject({
      kind: 'invalid_request',
    });
    expect(requests).toHaveLength(0);
  });

  it('tek başvuruyu okur', async () => {
    const leave = await api().getLeaveApplication(sampleLeaves[0]?.name ?? '');
    expect(leave).toMatchObject({ name: sampleLeaves[0]?.name, status: 'Open', docstatus: 0 });
  });

  it('olmayan başvuru not_found verir', async () => {
    await expect(api().getLeaveApplication('YOK')).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('onayı sürümle ve CSRF başlığıyla gönderir', async () => {
    const leave = sampleLeaves[0];
    const result = await api().approveLeave(leave?.name ?? '', leave?.modified ?? '');
    expect(result).toEqual({ name: leave?.name });
    const sent = requests.at(-1);
    expect(sent?.url.pathname).toBe('/api/method/hrms_tr.api.approve_leave');
    expect(sent?.csrf).toBe(SAMPLE_CSRF_TOKEN);
  });

  it('eski sürümle onay çakışma verir', async () => {
    await expect(
      api().approveLeave(sampleLeaves[0]?.name ?? '', '2000-01-01 00:00:00.000000'),
    ).rejects.toMatchObject({ kind: 'conflict', code: 'TimestampMismatchError' });
  });

  it('onaylanmış başvuruyu iptal eder', async () => {
    const leave = sampleLeaves[1];
    await expect(api().cancelLeave(leave?.name ?? '', leave?.modified ?? '')).resolves.toEqual({
      name: leave?.name,
    });
    expect(requests.at(-1)?.url.pathname).toBe('/api/method/hrms_tr.api.cancel_leave');
  });

  it('taslak başvuru iptal edilemez', async () => {
    const leave = sampleLeaves[0];
    await expect(api().cancelLeave(leave?.name ?? '', leave?.modified ?? '')).rejects.toMatchObject(
      { kind: 'invalid_request' },
    );
  });

  it('reddi sürümle ve CSRF başlığıyla gönderir ve başvuru "Rejected" olur', async () => {
    const leave = sampleLeaves[0];
    const result = await api().rejectLeave(leave?.name ?? '', leave?.modified ?? '');
    expect(result).toEqual({ name: leave?.name });
    const sent = requests.at(-1);
    expect(sent?.method).toBe('POST');
    expect(sent?.url.pathname).toBe('/api/method/hrms_tr.api.reject_leave');
    expect(sent?.csrf).toBe(SAMPLE_CSRF_TOKEN);
    expect(mockState.leaves.get(leave?.name ?? '')).toMatchObject({
      status: 'Rejected',
      docstatus: 1,
    });
  });

  it('eski sürümle ret çakışma verir ve başvuru açık kalır', async () => {
    const leave = sampleLeaves[0];
    await expect(
      api().rejectLeave(leave?.name ?? '', '2000-01-01 00:00:00.000000'),
    ).rejects.toMatchObject({ kind: 'conflict', code: 'TimestampMismatchError' });
    expect(mockState.leaves.get(leave?.name ?? '')).toMatchObject({ status: 'Open' });
  });

  it('onaylanmış başvuru reddedilemez', async () => {
    const leave = sampleLeaves[1];
    await expect(api().rejectLeave(leave?.name ?? '', leave?.modified ?? '')).rejects.toMatchObject(
      { kind: 'invalid_request' },
    );
  });

  it('şemaya uymayan liste yanıtını reddeder', async () => {
    mockServer.use(
      http.get('*/api/resource/:doctype', () => HttpResponse.json({ data: [{ status: 'Open' }] })),
    );
    await expect(api().listLeaveApplications()).rejects.toMatchObject({ kind: 'invalid_response' });
  });
});

describe('erişim açıklaması', () => {
  it('izin kararını ve nedenini okur', async () => {
    const result = await api().explainPermission({ doctype: 'Örnek Kayıt', name: 'ORNEK-0001' });
    expect(result).toMatchObject({ allowed: true, reason: 'allowed', ptype: 'read' });
    expect(requests.at(-1)?.url.pathname).toBe(
      '/api/method/platform_core.api.access.explain_permission',
    );
  });

  it('başka kaydın reddini tek nedenle döner', async () => {
    const result = await api().explainPermission({
      doctype: 'Örnek Kayıt',
      name: 'BASKASI',
      ptype: 'write',
    });
    expect(result).toMatchObject({ allowed: false, reason: 'not_permitted_or_missing', rules: [] });
  });

  it('başka kullanıcıyı sormak yetki reddidir', async () => {
    await expect(
      api().explainPermission({
        doctype: 'Örnek Kayıt',
        name: 'ORNEK-0001',
        user: 'baska@example.test',
      }),
    ).rejects.toMatchObject({ kind: 'forbidden' });
  });

  it('erişim özetini okur', async () => {
    const summary = await api().getAccessSummary('Örnek Kayıt');
    expect(summary).toMatchObject({ governed: true, operations: { read: ['own', 'team'] } });
  });

  it('bilinmeyen kapsam taşıyan özeti reddeder', async () => {
    mockServer.use(
      http.get('*/api/method/platform_core.api.access.get_access_summary', () =>
        HttpResponse.json({
          message: {
            doctype: 'Örnek Kayıt',
            governed: true,
            operations: {
              read: ['herkes'],
              write: [],
              create: [],
              delete: [],
              submit: [],
              cancel: [],
            },
          },
        }),
      ),
    );
    await expect(api().getAccessSummary('Örnek Kayıt')).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });
});

describe('cihaz kurulumları (oturumlar)', () => {
  it('kurulumları sayfa sayfa okur', async () => {
    const first = await api().listInstallations();
    expect(first.installations).toHaveLength(2);
    expect(first.nextAfter).toBe(sampleInstallations[1]?.installation_id);
    const sent = requests.at(-1);
    expect(sent?.url.pathname).toBe(
      '/api/method/platform_core.api.mobile_pwa.v1_list_installations',
    );
    expect(sent?.csrf).toBe(SAMPLE_CSRF_TOKEN);

    const second = await api().listInstallations(first.nextAfter ?? undefined);
    expect(second.installations.map((item) => item.installation_id)).toEqual([
      sampleInstallations[2]?.installation_id,
    ]);
    expect(second.nextAfter).toBeNull();
  });

  it('kurulumu iptal eder', async () => {
    const id = sampleInstallations[0]?.installation_id ?? '';
    await expect(api().revokeInstallation(id)).resolves.toEqual({ revoked: 1 });
    const page = await api().listInstallations();
    expect(page.installations.find((item) => item.installation_id === id)?.revoked).toBe(true);
  });

  it('kimliği UUID olmayan kurulum için istek göndermez', async () => {
    await expect(api().revokeInstallation('ORNEK')).rejects.toMatchObject({
      kind: 'invalid_request',
    });
    expect(requests).toHaveLength(0);
  });

  it('bilinmeyen kurulum not_found verir', async () => {
    await expect(
      api().revokeInstallation('99999999-0000-4000-8000-000000000001'),
    ).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('PWA oturumu yoksa session_expired verir', async () => {
    mockState.signedIn = false;
    await expect(api().listInstallations()).rejects.toMatchObject({
      kind: 'session_expired',
      code: 'pwa_session_required',
    });
  });

  it('UUID olmayan sayfa anahtarı için istek göndermez', async () => {
    await expect(api().listInstallations('ORNEK')).rejects.toMatchObject({
      kind: 'invalid_request',
      code: 'invalid_uuid',
    });
    expect(requests).toHaveLength(0);
  });

  describe('sahte sunucu PWA isteğini sözleşmeye göre denetler', () => {
    const path = `${SITE}/api/method/platform_core.api.mobile_pwa.v1_list_installations`;
    const validHeaders = {
      'Content-Type': 'application/json',
      Origin: SITE,
      'X-Frappe-CSRF-Token': SAMPLE_CSRF_TOKEN,
      'X-Mobile-App-Version': '0.1.0',
      'X-Mobile-Contract-Version': '1',
    };

    async function send(headers: Record<string, string>, body: unknown = {}) {
      const response = await fetch(path, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      return { status: response.status, body: (await response.json()) as { code?: string } };
    }

    it('geçerli istek 200 alır', async () => {
      expect((await send(validHeaders)).status).toBe(200);
    });

    it('sürüm başlığı eksikse reddeder', async () => {
      const { 'X-Mobile-App-Version': _omit, ...headers } = validHeaders;
      expect(await send(headers)).toMatchObject({
        status: 400,
        body: { code: 'invalid_client_version' },
      });
    });

    it('sözleşme sürümü başlığı eksikse reddeder', async () => {
      const { 'X-Mobile-Contract-Version': _omit, ...headers } = validHeaders;
      expect(await send(headers)).toMatchObject({
        status: 400,
        body: { code: 'unsupported_contract_version' },
      });
    });

    it('farklı kökten gelen isteği reddeder', async () => {
      expect(await send({ ...validHeaders, Origin: 'https://kotu.example.test' })).toMatchObject({
        status: 403,
        body: { code: 'pwa_request_forbidden' },
      });
    });

    it('UUID olmayan sayfa anahtarını reddeder', async () => {
      expect(await send(validHeaders, { after: 'ORNEK' })).toMatchObject({
        status: 400,
        body: { code: 'invalid_uuid' },
      });
    });

    it('bilinmeyen gövde alanını reddeder', async () => {
      expect(await send(validHeaders, { sonraki: 'x' })).toMatchObject({
        status: 400,
        body: { code: 'invalid_request' },
      });
    });
  });

  it('bozuk kurulum kaydını reddeder', async () => {
    mockServer.use(
      http.post('*/api/method/platform_core.api.mobile_pwa.v1_list_installations', () =>
        HttpResponse.json({
          server_time: 1,
          message: {
            installations: [{ installation_id: 'x', scope: 'masaustu', revoked: false }],
            next_after: null,
          },
        }),
      ),
    );
    await expect(api().listInstallations()).rejects.toMatchObject({ kind: 'invalid_response' });
  });
});

describe('Press hesap silme sayfası', () => {
  it('Press ayarı yoksa adres yoktur', () => {
    expect(readPressConfig({})).toBeUndefined();
  });

  it('adres Press kökü ve /account-deletion yoludur', () => {
    const pressConfig = readPressConfig({ VITE_PRESS_URL: `${SAMPLE_PRESS_URL}/` });
    expect(pressConfig).toEqual({ pressUrl: SAMPLE_PRESS_URL });
    if (!pressConfig) return;
    expect(pressAccountDeletionUrl(pressConfig)).toBe(`${SAMPLE_PRESS_URL}/account-deletion`);
  });

  it.each([
    ['düz HTTP', 'http://press.example.test'],
    ['yol taşıyan kök', 'https://press.example.test/baska'],
    ['sorgu taşıyan kök', 'https://press.example.test/?x=1'],
    ['kullanıcı bilgisi taşıyan kök', 'https://kisi@press.example.test'],
    ['adres olmayan değer', 'press'],
    ['başka protokol', 'javascript:alert(1)'],
  ])('%s kabul edilmez', (_label, value) => {
    expect(() => readPressConfig({ VITE_PRESS_URL: value })).toThrow(/VITE_PRESS_URL/);
  });

  it('yerel geliştirmede HTTP localhost kabul edilir', () => {
    expect(readPressConfig({ VITE_PRESS_URL: 'http://localhost:8001', DEV: true })).toEqual({
      pressUrl: 'http://localhost:8001',
    });
  });

  it('üretimde HTTP localhost kabul edilmez', () => {
    expect(() => readPressConfig({ VITE_PRESS_URL: 'http://localhost:8001', DEV: false })).toThrow(
      /VITE_PRESS_URL/,
    );
    expect(() => readPressConfig({ VITE_PRESS_URL: 'http://localhost:8001' })).toThrow(
      /VITE_PRESS_URL/,
    );
  });

  it('panel istemcisinde Press adresine giden metot yoktur', () => {
    const client = api() as Record<string, unknown>;
    expect(Object.keys(client).some((key) => /press|deletion/i.test(key))).toBe(false);
  });
});

describe('ana sayfa özeti', () => {
  it('dört parçayı sözleşmedeki yoldan okur', async () => {
    const summary = await api().getHomeSummary();
    const sent = requests.at(-1);
    expect(sent?.method).toBe('GET');
    expect(sent?.url.pathname).toBe('/api/method/hrms_tr.api.get_home_summary');
    expect(Object.keys(summary).sort()).toEqual([
      'counts',
      'pending_approvals',
      'problems',
      'recent_changes',
    ]);
    expect(summary.pending_approvals.map((item) => item.name)).toEqual([sampleLeaves[0]?.name]);
    expect(summary.pending_approvals[0]?.version).toBe(sampleLeaves[0]?.modified);
    expect(summary.counts.pending_approvals).toBe(1);
    expect(summary.counts.problems).toBe(summary.problems.length);
    expect(summary.problems.length).toBeGreaterThan(0);
    expect(summary.recent_changes.length).toBeGreaterThan(0);
  });

  it('özetteki sürümle ret yapılınca bekleyen talep listeden düşer', async () => {
    const before = await api().getHomeSummary();
    const item = before.pending_approvals[0];
    await api().rejectLeave(item?.name ?? '', item?.version ?? '');
    const after = await api().getHomeSummary();
    expect(after.pending_approvals).toEqual([]);
    expect(after.counts.pending_approvals).toBe(0);
    expect(after.recent_changes[0]).toMatchObject({ name: item?.name, action: 'rejected' });
  });

  it('sahte veride yalnız "Örnek Kişi" adları vardır', async () => {
    const summary = await api().getHomeSummary();
    const names = [
      ...summary.pending_approvals.map((item) => item.employee_name),
      ...summary.recent_changes.flatMap((item) => [item.employee_name, item.actor]),
      ...summary.problems.flatMap((item) =>
        item.kind === 'overlap'
          ? item.leaves.map((leave) => leave.employee_name)
          : [item.employee_name],
      ),
    ];
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(name).toMatch(/^Örnek Kişi( \d+)?$/);
  });

  const broken: [string, JsonBodyType][] = [
    ['message yok', {}],
    ['bir parça eksik', { pending_approvals: [], problems: [], recent_changes: [] }],
    [
      'sayı eksi',
      {
        pending_approvals: [],
        problems: [],
        recent_changes: [],
        counts: { pending_approvals: -1, on_leave_today: 0, opened_this_month: 0, problems: 0 },
      },
    ],
    [
      'bilinmeyen sorun türü',
      {
        pending_approvals: [],
        problems: [{ kind: 'baska', employee: 'X', employee_name: null }],
        recent_changes: [],
        counts: { pending_approvals: 0, on_leave_today: 0, opened_this_month: 0, problems: 1 },
      },
    ],
    [
      'bekleyen talepte sürüm yok',
      {
        pending_approvals: [
          {
            name: 'X',
            employee_name: null,
            leave_type: null,
            from_date: null,
            to_date: null,
            total_leave_days: null,
            leave_balance: null,
          },
        ],
        problems: [],
        recent_changes: [],
        counts: { pending_approvals: 1, on_leave_today: 0, opened_this_month: 0, problems: 0 },
      },
    ],
    [
      'bilinmeyen değişiklik türü',
      {
        pending_approvals: [],
        problems: [],
        recent_changes: [
          { name: 'X', employee_name: null, actor: 'Örnek Kişi', action: 'silindi', at: 'x' },
        ],
        counts: { pending_approvals: 0, on_leave_today: 0, opened_this_month: 0, problems: 0 },
      },
    ],
    [
      'çakışmada tek başvuru var',
      {
        pending_approvals: [],
        problems: [
          {
            kind: 'overlap',
            department: 'Örnek Ekip',
            leaves: [
              { name: 'X', employee_name: null, from_date: '2026-12-01', to_date: '2026-12-02' },
            ],
          },
        ],
        recent_changes: [],
        counts: { pending_approvals: 0, on_leave_today: 0, opened_this_month: 0, problems: 1 },
      },
    ],
  ];

  it.each(broken)('bozuk yanıtta açık hata verir: %s', async (_label, body) => {
    mockServer.use(
      http.get('*/api/method/hrms_tr.api.get_home_summary', () =>
        HttpResponse.json(_label === 'message yok' ? body : { message: body }),
      ),
    );
    await expect(api().getHomeSummary()).rejects.toMatchObject({ kind: 'invalid_response' });
  });
});

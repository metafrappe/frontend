import { render, screen } from '@testing-library/react';
import { createElement, Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/api';
import { sampleDocTypeMeta as sampleMeta } from '@/mocks/fixtures';
import { navFromSidebars } from '@/shell/nav';

vi.mock('./RecordRoute', () => ({
  default: (props: { api: unknown; doctype: string; name: string }) =>
    createElement('p', null, `${props.doctype}|${props.name}|${String(props.api === recordApi)}`),
}));

const recordApi = { listDocuments: vi.fn(), getDocType: vi.fn(), frappeDocument: vi.fn() };

import { createShellViewData, doctypeFromSlug, loadShellAccount, moduleSlug } from './view-data';

describe('doctypeFromSlug', () => {
  it('adres parçasını DocType adına çevirir', () => {
    expect(doctypeFromSlug('sales-invoice')).toBe('Sales Invoice');
    expect(doctypeFromSlug('user')).toBe('User');
    expect(doctypeFromSlug('Leave%20Application')).toBe('Leave Application');
  });
});

describe('createShellViewData', () => {
  it('kayıt rotasını kayıt görünümüne bağlar', () => {
    const data = createShellViewData({ listDocuments: vi.fn(), getDocType: vi.fn() } as never);
    expect(data.record?.Component).toBeDefined();
  });

  it('kayıt rotasına oturumun ortak API istemcisini verir (inceleme 2, Ö3)', async () => {
    const data = createShellViewData(recordApi as never);
    const Record = data.record?.Component;
    if (!Record) throw new Error('kayıt bağlantısı yok');
    render(
      createElement(
        Suspense,
        { fallback: null },
        createElement(Record, { module: 'ornek', doctype: 'örnek-kayıt', name: 'ORNEK-0001' }),
      ),
    );
    expect(await screen.findByText('örnek-kayıt|ORNEK-0001|true')).toBeInTheDocument();
  });

  it('liste isteğini API v2 sorgusuna çevirir', async () => {
    const listDocuments = vi.fn().mockResolvedValue({ data: [{ name: 'A' }], hasNextPage: true });
    const data = createShellViewData({ listDocuments, getDocType: vi.fn() } as never);
    const signal = new AbortController().signal;
    const page = await data.collection?.source.list(
      {
        doctype: 'User',
        fields: ['name', 'full_name'],
        filters: [['enabled', '=', '1']],
        order_by: 'modified desc',
        limit_start: 20,
        limit_page_length: 20,
      },
      signal,
    );
    expect(listDocuments).toHaveBeenCalledWith(
      'User',
      {
        fields: ['name', 'full_name'],
        filters: [['enabled', '=', '1']],
        orderBy: 'modified desc',
        start: 20,
        limit: 20,
      },
      { signal },
    );
    expect(page).toEqual({ data: [{ name: 'A' }], hasNextPage: true });
  });

  it('liste başlığı DocType adını gösterir, "Kayıtlar" yazmaz', async () => {
    const getDocType = vi.fn().mockResolvedValue({ status: 'fresh', meta: sampleMeta });
    const data = createShellViewData({ listDocuments: vi.fn(), getDocType } as never);
    const definition = await data.collection?.loadDefinition(
      { module: 'ornek', doctype: encodeURIComponent('örnek-kayıt') },
      new AbortController().signal,
    );
    expect(definition?.label).toBe('Örnek Kayıt');
  });

  it('tanım gelmeden de sayfa başlığını adresten verir', () => {
    const data = createShellViewData({ listDocuments: vi.fn(), getDocType: vi.fn() } as never);
    expect(data.collection?.title?.({ module: 'satis', doctype: 'teklif' })).toBe('Teklif');
    expect(data.collection?.title?.({ module: 'm', doctype: 'sales-invoice' })).toBe(
      'Sales Invoice',
    );
  });

  it('tanımı sunucunun DocType bilgisinden kurar', async () => {
    const getDocType = vi.fn().mockResolvedValue({ status: 'not_modified' });
    const data = createShellViewData({ listDocuments: vi.fn(), getDocType } as never);
    await expect(
      data.collection?.loadDefinition(
        { module: 'core', doctype: 'user' },
        new AbortController().signal,
      ),
    ).rejects.toThrow();
    expect(getDocType).toHaveBeenCalledWith('User', undefined, expect.objectContaining({}));
  });
});

describe('menü verisi (navigation)', () => {
  const sidebar = (name: string, data: Record<string, unknown>) => ({ name, data });

  it('açılış verisindeki sidebar satırlarından yalnız DocType bağlantılarını alır', async () => {
    const getBootstrap = vi.fn().mockResolvedValue({
      sidebars: [
        sidebar('Satış', {
          label: 'Satış',
          module: 'Selling',
          items: [
            { label: 'Teklifler', link_type: 'DocType', link_to: 'Quotation' },
            { label: 'Rapor', link_type: 'Report', link_to: 'Sales Register' },
            { label: 'Gizli', link_type: 'DocType', link_to: 'Customer', hidden: 1 },
            { label: null, link_type: 'DocType', link_to: 'Sales Order' },
            // A name that cannot be converted back from the URL is left out of the menu: clicking it would open another type.
            { label: 'Fiyat', link_type: 'DocType', link_to: 'Item-Price' },
            { label: 'Ayraç', type: 'Section Break' },
          ],
        }),
        sidebar('Boş', { label: 'Boş', items: [{ link_type: 'Workspace', link_to: 'Boş' }] }),
      ],
    });
    const data = createShellViewData({
      listDocuments: vi.fn(),
      getDocType: vi.fn(),
      getBootstrap,
    } as never);
    const signal = new AbortController().signal;
    await expect(data.navigation?.loadSidebars(signal)).resolves.toEqual([
      {
        id: 'Satış',
        label: 'Satış',
        module: 'selling',
        links: [
          { label: 'Teklifler', doctype: 'Quotation' },
          { label: 'Sales Order', doctype: 'Sales Order' },
        ],
      },
    ]);
    expect(getBootstrap).toHaveBeenCalledWith({ signal });
  });

  // G-132: The module name is lowercased independently of locale. The Turkish rule would turn "I" into a dotless i (U+0131).
  it('"I" ile başlayan modül adını "i" ile başlayan adrese çevirir', () => {
    expect(moduleSlug('Integrations')).toBe('integrations');
    expect(moduleSlug('Item Info')).toBe('item-info');
    expect(moduleSlug('Selling')).toBe('selling');
  });

  it('Entegrasyonlar grubunun adresinde noktasız ı yoktur, görünen ad değişmez', async () => {
    const getBootstrap = vi.fn().mockResolvedValue({
      sidebars: [
        sidebar('Integrations', {
          label: 'Entegrasyonlar',
          module: 'Integrations',
          items: [{ label: 'Bağlı Uyulamalar', link_type: 'DocType', link_to: 'Connected App' }],
        }),
      ],
    });
    const data = createShellViewData({ getBootstrap } as never);
    const sidebars = await data.navigation?.loadSidebars(new AbortController().signal);
    expect(sidebars).toEqual([
      {
        id: 'Integrations',
        label: 'Entegrasyonlar',
        module: 'integrations',
        links: [{ label: 'Bağlı Uyulamalar', doctype: 'Connected App' }],
      },
    ]);
    const [group] = navFromSidebars(sidebars ?? []);
    expect(group?.label).toBe('Entegrasyonlar');
    expect(group?.children[0]?.label).toBe('Bağlı Uyulamalar');
    expect(group?.children[0]?.to).toBe('/integrations/Connected%20App');
    expect(group?.children[0]?.to).not.toMatch(/%C4%B1|ı/);
  });

  it('sahte sunucunun açılış verisinde sidebar yoksa menüye grup eklemez', async () => {
    const getBootstrap = vi.fn().mockResolvedValue({ sidebars: [] });
    const data = createShellViewData({ getBootstrap } as never);
    await expect(data.navigation?.loadSidebars(new AbortController().signal)).resolves.toEqual([]);
  });

  it('istek başarısızsa uydurma grup göstermez', async () => {
    const getBootstrap = vi.fn().mockRejectedValue(new Error('ağ'));
    const data = createShellViewData({ getBootstrap } as never);
    await expect(data.navigation?.loadSidebars(new AbortController().signal)).resolves.toEqual([]);
  });
});

describe('menü yetkisi (G-94)', () => {
  it('sunucunun okumaya izin verdiği DocType adlarını döner', async () => {
    const getDocType = vi.fn((doctype: string) =>
      doctype === 'Leave Application'
        ? Promise.resolve({ status: 'fresh', meta: sampleMeta })
        : Promise.reject(new Error('403')),
    );
    const data = createShellViewData({ getDocType } as never);
    const signal = new AbortController().signal;
    const readable = await data.navigation?.loadReadable?.(
      ['Leave Application', 'PLT AI API'],
      signal,
    );
    expect(readable).toEqual(new Set(['Leave Application']));
    expect(getDocType).toHaveBeenCalledWith('Leave Application', undefined, { signal });
    expect(getDocType).toHaveBeenCalledWith('PLT AI API', undefined, { signal });
  });

  it('istek başarısızsa hiçbir DocType okunabilir sayılmaz', async () => {
    const getDocType = vi.fn().mockRejectedValue(new Error('ağ'));
    const data = createShellViewData({ getDocType } as never);
    await expect(
      data.navigation?.loadReadable?.(['Leave Application'], new AbortController().signal),
    ).resolves.toEqual(new Set());
  });
});

describe('bayi hesabını tanıma (AJA-945, G-169, G-170)', () => {
  const PATH = '/api/method/platform_core.api.reseller.list_customers';
  const kindWith = (frappeDocument: (...args: never[]) => unknown) =>
    createShellViewData({ frappeDocument } as never).navigation?.loadAccountKind?.(
      new AbortController().signal,
    );

  it('müşteri listesi ucu 200 dönerse hesap bayi hesabıdır', async () => {
    const frappeDocument = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      etag: undefined,
      body: { message: [{ customer_tenant: 'musteri-a.example.test' }] },
    });
    await expect(kindWith(frappeDocument)).resolves.toBe('reseller');
    expect(frappeDocument).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: PATH, signal: expect.any(AbortSignal) }),
    );
  });

  it('boş müşteri listesi de bayi hesabı sayılır', async () => {
    const frappeDocument = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, etag: undefined, body: { message: [] } });
    await expect(kindWith(frappeDocument)).resolves.toBe('reseller');
  });

  it('uç 403 dönerse hesap bayi hesabı değildir', async () => {
    const error = new ApiError({ kind: 'forbidden', status: 403 });
    const frappeDocument = vi.fn().mockResolvedValue({ ok: false, error, body: undefined });
    await expect(kindWith(frappeDocument)).resolves.toBe('tenant');
  });

  it('başka bir hata gelirse karar verilmez ve hata iletilir', async () => {
    const error = new ApiError({ kind: 'unavailable', status: 500 });
    const frappeDocument = vi.fn().mockResolvedValue({ ok: false, error, body: undefined });
    await expect(kindWith(frappeDocument)).rejects.toBe(error);
  });

  it('ağ hatası da karar vermez', async () => {
    const frappeDocument = vi.fn().mockRejectedValue(new Error('ağ'));
    await expect(kindWith(frappeDocument)).rejects.toThrow('ağ');
  });
});

describe('loadShellAccount', () => {
  it('görünen adı açılış verisinden alır', async () => {
    const getBootstrap = vi
      .fn()
      .mockResolvedValue({ user: { name: 'a@example.test', full_name: 'Ada Kaya' } });
    await expect(loadShellAccount({ getBootstrap } as never, 'a@example.test')).resolves.toEqual({
      user: 'a@example.test',
      fullName: 'Ada Kaya',
    });
  });

  it('açılış verisi başka kullanıcıya aitse adı kullanmaz', async () => {
    const getBootstrap = vi
      .fn()
      .mockResolvedValue({ user: { name: 'b@example.test', full_name: 'Başka' } });
    await expect(loadShellAccount({ getBootstrap } as never, 'a@example.test')).resolves.toEqual({
      user: 'a@example.test',
    });
  });

  it('istek başarısızsa yalnız kullanıcı kimliğini döner', async () => {
    const getBootstrap = vi.fn().mockRejectedValue(new Error('ağ'));
    await expect(loadShellAccount({ getBootstrap } as never, 'a@example.test')).resolves.toEqual({
      user: 'a@example.test',
    });
  });
});

/** MVP audit: the workspace switcher shows the session's site, not a sample company. */
describe('workspaceFromSite', () => {
  it('site adresinin alan adını tek çalışma alanı yapar', async () => {
    const { workspaceFromSite } = await import('./view-data');
    expect(workspaceFromSite('https://acme.example.test')).toEqual({
      items: [{ id: 'acme.example.test', name: 'acme.example.test' }],
      current: 'acme.example.test',
    });
  });

  it('adres çözülemezse veri vermez; seçici yalnız logoyu gösterir', async () => {
    const { workspaceFromSite } = await import('./view-data');
    expect(workspaceFromSite('')).toBeUndefined();
    expect(workspaceFromSite('bozuk adres')).toBeUndefined();
  });
});

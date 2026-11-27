import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError, type ApiClient } from '@/api';
import { LanguageProvider } from '@/app/locale';
import type * as RecordModule from '@/views/record';
import type { RecordDataAdapter, RecordViewProps } from '@/views/record';

const seen: { adapter?: RecordDataAdapter; renderLink?: RecordViewProps['renderRecordLink'] } = {};

vi.mock('@/views/record', async (importOriginal) => ({
  ...(await importOriginal<typeof RecordModule>()),
  RecordView: (props: RecordViewProps) => {
    seen.adapter = props.adapter;
    seen.renderLink = props.renderRecordLink;
    return <p>{`${props.doctype}|${props.name ?? ''}|${props.locale ?? ''}`}</p>;
  },
}));

const { default: RecordRoute } = await import('./RecordRoute');

const META_PATH = '/api/method/platform_core.api.meta.get_doctype';

/** Server-side module of each record type. The schema of a type not in the list returns 403. */
const MODULES: Record<string, string> = {
  'Örnek Kayıt': 'Ornek',
  'Leave Application': 'HR',
  Company: 'Setup',
};

function metaBody(doctype: string, module: string) {
  return {
    message: {
      schema: {
        name: doctype,
        module,
        sensitivity: 'standard',
        fields: [],
        title_field: null,
        search_fields: '',
        sort_field: null,
      },
      meta_hash: `hash-${doctype}`,
      perm_version: 'perm-1',
      child_tables: {},
      catalog_version: 1,
      mobile_cache_allowed: false,
    },
  };
}

function fakeApi(modules: Record<string, string> = MODULES) {
  const frappeDocument = vi.fn<ApiClient['frappeDocument']>(async (request) => {
    if (request.path === META_PATH) {
      const doctype = request.query?.['doctype'] ?? '';
      const module = modules[doctype];
      if (module === undefined) {
        return {
          ok: false,
          error: new ApiError({ kind: 'forbidden', status: 403, code: 'PermissionError' }),
          body: {},
        };
      }
      return { ok: true, status: 200, etag: undefined, body: metaBody(doctype, module) };
    }
    return {
      ok: true,
      status: 200,
      etag: undefined,
      body: { data: { name: 'ORNEK-0001', modified: '2026-11-23 10:00:00' } },
    };
  });
  return { api: { frappeDocument } as Pick<ApiClient, 'frappeDocument'>, frappeDocument };
}

describe('RecordRoute', () => {
  it('adresteki DocType ve kayıt adını kayıt görünümüne verir', () => {
    const { api } = fakeApi();
    render(
      <RecordRoute api={api} module="hr" doctype="leave-application" name="HR-LAP-2026-00001" />,
    );
    // Without a language provider the fallback language applies. The fallback is British English (AJA-1407).
    expect(screen.getByText('Leave Application|HR-LAP-2026-00001|en')).toBeInTheDocument();
  });

  it('kodlanmış kayıt adını çözer ve kullanıcının dilini verir', () => {
    const { api } = fakeApi();
    render(
      <LanguageProvider initialLanguage="tr">
        <RecordRoute api={api} module="core" doctype="user" name="kisi%40example.test" />
      </LanguageProvider>,
    );
    expect(screen.getByText('User|kisi@example.test|tr')).toBeInTheDocument();
  });

  it('kayıt isteklerini ortak API istemcisiyle gönderir (inceleme 2, Ö3)', async () => {
    const { api, frappeDocument } = fakeApi();
    render(<RecordRoute api={api} module="ornek" doctype="örnek-kayıt" name="ORNEK-0001" />);
    const record = await seen.adapter?.getRecord({ doctype: 'Örnek Kayıt', name: 'ORNEK-0001' });
    expect(record?.name).toBe('ORNEK-0001');
    expect(frappeDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: `/api/resource/${encodeURIComponent('Örnek Kayıt')}/ORNEK-0001`,
      }),
    );
  });

  it('kabuğun sayfa çerçevesini çizmez; yalnız içeriği verir (inceleme 2, K3)', () => {
    const { api } = fakeApi();
    const { container } = render(
      <RecordRoute api={api} module="ornek" doctype="örnek-kayıt" name="ORNEK-0001" />,
    );
    expect(container.querySelector('[class*="shell-"]')).toBeNull();
  });
});

describe('RecordRoute: bağlantı alanı', () => {
  async function renderLinkFrom(
    page: { module: string; doctype: string; name: string },
    target: { doctype: string; name: string },
    modules?: Record<string, string>,
  ) {
    const { MemoryRouter } = await import('react-router-dom');
    const { api, frappeDocument } = fakeApi(modules);
    render(<RecordRoute api={api} {...page} />);
    expect(seen.renderLink).toBeDefined();
    render(
      <MemoryRouter basename="/panel" initialEntries={['/panel/']}>
        <div data-testid="hedef">{seen.renderLink?.(target, target.name)}</div>
      </MemoryRouter>,
    );
    return { frappeDocument };
  }

  it('aynı modüldeki hedef kayda bağlantı çizer; yönlendirici panel yolunu ekler', async () => {
    await renderLinkFrom(
      { module: 'ornek', doctype: 'örnek-kayıt', name: 'ORNEK-0003' },
      { doctype: 'Örnek Kayıt', name: 'ORNEK-0002' },
    );
    expect((await screen.findByRole('link', { name: 'ORNEK-0002' })).getAttribute('href')).toBe(
      `/panel/ornek/${encodeURIComponent('örnek-kayıt')}/ORNEK-0002`,
    );
  });

  it('başka modüldeki hedef kayda kendi modül yolunda bağlantı çizer (Şirket: Setup)', async () => {
    const { frappeDocument } = await renderLinkFrom(
      { module: 'hr', doctype: 'leave-application', name: 'HR-LAP-2026-00001' },
      { doctype: 'Company', name: 'Örnek İnceleme Şirketi' },
    );
    expect(
      (await screen.findByRole('link', { name: 'Örnek İnceleme Şirketi' })).getAttribute('href'),
    ).toBe(`/panel/setup/company/${encodeURIComponent('Örnek İnceleme Şirketi')}`);
    expect(frappeDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        path: META_PATH,
        query: expect.objectContaining({ doctype: 'Company' }),
      }),
    );
  });

  it('hedef türün modülü okunamazsa yanlış modüle bağlantı çizmez; ad düz metin kalır', async () => {
    const { frappeDocument } = await renderLinkFrom(
      { module: 'hr', doctype: 'leave-application', name: 'HR-LAP-2026-00001' },
      { doctype: 'Company', name: 'Örnek İnceleme Şirketi' },
      { 'Leave Application': 'HR' },
    );
    await waitFor(() =>
      expect(frappeDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          path: META_PATH,
          query: expect.objectContaining({ doctype: 'Company' }),
        }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByTestId('hedef').textContent).toBe('Örnek İnceleme Şirketi'),
    );
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('modül sunucudan gelmeden yanlış yola bağlantı çizmez', async () => {
    await renderLinkFrom(
      { module: 'hr', doctype: 'leave-application', name: 'HR-LAP-2026-00001' },
      { doctype: 'Company', name: 'Örnek İnceleme Şirketi' },
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByTestId('hedef').textContent).toBe('Örnek İnceleme Şirketi');
    await screen.findByRole('link', { name: 'Örnek İnceleme Şirketi' });
  });

  it('adrese geri çevrilemeyen türde bağlantı çizmez', async () => {
    const { slugFromDoctype } = await import('./record-slug');
    expect(slugFromDoctype('Örnek Kayıt')).toBe('örnek-kayıt');
    expect(slugFromDoctype('Sales Invoice')).toBe('sales-invoice');
    expect(slugFromDoctype('ToDo')).toBeUndefined();
  });
});

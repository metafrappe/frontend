import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@ant-design/x', () => import('../testing/antdXMock'));

import type { AccountKind, ShellViewData } from '../view-data';
import { ViewDataProvider } from '../view-data';
import { AppShell } from './AppShell';

const original = window.matchMedia;
beforeEach(() => {
  // jsdom has no layout observer. Real strip measurements are covered in Playwright.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
});

function mockCompact(compact: boolean) {
  window.matchMedia = (query: string) =>
    ({
      matches: compact,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

afterEach(() => {
  window.matchMedia = original;
  localStorage.clear();
  vi.unstubAllGlobals();
});

function renderShell(viewData: ShellViewData | null = null) {
  render(
    <MemoryRouter>
      <ViewDataProvider value={viewData}>
        <AppShell>
          <p>İçerik</p>
        </AppShell>
      </ViewDataProvider>
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  it.each([
    ['example', 'Deneme'],
    ['live', 'Canlı'],
  ] as const)('labels the supplied %s environment', (mode, label) => {
    mockCompact(false);
    renderShell({ modules: { tenant: 'example.test', user: 'example', mode } });
    expect(screen.getByRole('banner', { name: 'Kimlik şeridi' })).toHaveTextContent(label);
  });
  it.each([true, false])('shows tenant, environment and command mode (compact: %s)', (compact) => {
    mockCompact(compact);
    renderShell({
      workspaces: { current: 'example', items: [{ id: 'example', name: 'Örnek Şirket' }] },
    });
    const identity = screen.getByRole('banner', { name: 'Kimlik şeridi' });
    expect(identity).toHaveTextContent('KiracıÖrnek Şirket');
    expect(identity).toHaveTextContent('OrtamDoğrulanıyor');
    expect(identity).toHaveTextContent('KipSor');
  });

  it('updates the identity mode from the actual command selection', async () => {
    mockCompact(false);
    renderShell();
    const user = userEvent.setup();
    await user.click(screen.getByText('Ara', { selector: '.ant-segmented-item-label' }));
    expect(screen.getByRole('banner', { name: 'Kimlik şeridi' })).toHaveTextContent('KipAra');
    await user.click(screen.getByRole('button', { name: 'Dar görünüme geç' }));
    expect(screen.getByRole('banner', { name: 'Kimlik şeridi' })).toHaveTextContent('KipAra');
  });

  it('renders only nonempty task headings and keeps permitted links keyboard reachable', async () => {
    mockCompact(false);
    renderShell({
      navigation: {
        loadSidebars: vi.fn().mockResolvedValue([]),
        loadReadable: vi.fn().mockResolvedValue(new Set(['Leave Application'])),
      },
    });
    const navigation = screen.getByRole('navigation', { name: 'Ana gezinme' });
    expect(
      await within(navigation).findByRole('heading', { name: 'İnsan kaynakları' }),
    ).toBeInTheDocument();
    expect(
      within(navigation).getByRole('heading', { name: 'Bakmak ve onaylamak' }),
    ).toBeInTheDocument();
    expect(within(navigation).getByRole('heading', { name: 'Yönetim' })).toBeInTheDocument();
    const user = userEvent.setup();
    const menuLinks = within(navigation).getAllByRole('link');
    act(() => menuLinks[0]?.focus());
    for (const link of menuLinks.slice(1)) {
      await user.tab();
      expect(link).toHaveFocus();
    }
    for (const link of menuLinks.slice(0, -1).reverse()) {
      await user.tab({ shift: true });
      expect(link).toHaveFocus();
    }
  });

  it('omits the people heading when every people page is denied', () => {
    mockCompact(false);
    renderShell();
    expect(screen.queryByRole('heading', { name: 'İnsan kaynakları' })).not.toBeInTheDocument();
  });
  it('menüde örnek grup, uydurma sayı ve örnek ajan yoktur (Ö2)', () => {
    mockCompact(false);
    renderShell();
    expect(screen.getByRole('link', { name: 'Ana sayfa' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Satış' })).not.toBeInTheDocument();
    expect(screen.queryByText('12')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'AI ajanları' })).not.toBeInTheDocument();
  });

  it('sunucunun sidebar verisinden liste grubu çizer (Ö2)', async () => {
    mockCompact(false);
    const loadSidebars = vi.fn().mockResolvedValue([
      {
        id: 'Satış',
        label: 'Satış',
        module: 'selling',
        links: [{ label: 'Teklifler', doctype: 'Quotation' }],
      },
    ]);
    renderShell({ navigation: { loadSidebars } });
    expect(await screen.findByRole('link', { name: 'Teklifler' })).toBeInTheDocument();
    expect(loadSidebars).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('menü yalnız sunucunun okumaya izin verdiği sayfaları gösterir (G-94)', async () => {
    mockCompact(false);
    const loadReadable = vi.fn().mockResolvedValue(new Set(['Leave Application']));
    renderShell({ navigation: { loadSidebars: vi.fn().mockResolvedValue([]), loadReadable } });
    expect(await screen.findByRole('link', { name: 'İzin talepleri' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Yapay zekâ sağlayıcıları' }),
    ).not.toBeInTheDocument();
    expect(loadReadable).toHaveBeenCalledWith(
      expect.arrayContaining(['Leave Application', 'PLT AI API']),
      expect.any(AbortSignal),
    );
  });

  describe('bayi hesabı (AJA-945, G-169, G-170)', () => {
    const TENANT_READABLE = new Set([
      'Leave Application',
      'PLT AI API',
      'PLT AI Account',
      'PLT AI Provider',
    ]);
    const navigationWith = (loadAccountKind: (signal: AbortSignal) => Promise<AccountKind>) => ({
      navigation: {
        loadSidebars: vi.fn().mockResolvedValue([]),
        loadReadable: vi.fn().mockResolvedValue(new Set<string>()),
        loadAccountKind,
      },
    });

    it('bayi hesabı "Müşteriler" grubunu görür, kiracı gruplarını görmez', async () => {
      mockCompact(false);
      renderShell(navigationWith(vi.fn().mockResolvedValue('reseller')));
      expect(await screen.findByRole('link', { name: 'Müşteriler' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Yönetim' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Yapay zekâ işlemleri' })).not.toBeInTheDocument();
    });

    it('kiracı hesabının menüsü değişmez', async () => {
      mockCompact(false);
      const loadReadable = vi.fn().mockResolvedValue(TENANT_READABLE);
      renderShell({
        navigation: {
          loadSidebars: vi.fn().mockResolvedValue([]),
          loadReadable,
          loadAccountKind: vi.fn().mockResolvedValue('tenant'),
        },
      });
      expect(await screen.findByRole('link', { name: 'İzin talepleri' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Yönetim' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Yapay zekâ işlemleri' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Müşteriler' })).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('hesap türü anlaşılamazsa bayi sayılmaz ve hata görünür', async () => {
      mockCompact(false);
      renderShell(navigationWith(vi.fn().mockRejectedValue(new Error('500'))));
      expect(await screen.findByRole('alert')).toHaveTextContent('Hesap türü denetlenemedi');
      expect(screen.queryByRole('link', { name: 'Müşteriler' })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Yönetim' })).toBeInTheDocument();
    });
  });

  it('yetki bilgisi gelmezse yetki isteyen sayfa menüde görünmez (G-94)', async () => {
    mockCompact(false);
    const loadReadable = vi.fn().mockRejectedValue(new Error('ağ'));
    renderShell({ navigation: { loadSidebars: vi.fn().mockResolvedValue([]), loadReadable } });
    await act(async () => Promise.resolve());
    expect(screen.getByRole('link', { name: 'Hesap' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'İzin talepleri' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Yapay zekâ sağlayıcıları' }),
    ).not.toBeInTheDocument();
  });

  it('veri bağlantısı yoksa yetki isteyen sayfa menüde görünmez (G-94)', () => {
    mockCompact(false);
    renderShell();
    expect(screen.getByRole('link', { name: 'Hesap' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'İzin talepleri' })).not.toBeInTheDocument();
  });

  it('geniş ekranda sidebar görünür, menü düğmesi yoktur', () => {
    mockCompact(false);
    renderShell();
    expect(screen.getByRole('navigation', { name: 'Ana gezinme' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Menüyü aç' })).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('İçerik');
  });

  it('telefonda sidebar çekmecedir; açılır ve Escape ile kapanır', async () => {
    mockCompact(true);
    renderShell();
    const user = userEvent.setup();
    const menu = screen.getByRole('button', { name: 'Menüyü aç' });
    const drawer = screen.getByRole('dialog', { hidden: true, name: 'Menü' });
    expect(drawer).toHaveAttribute('data-open', 'false');

    await user.click(menu);
    expect(drawer).toHaveAttribute('data-open', 'true');
    expect(drawer).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('main')).toHaveAttribute('inert');

    await user.keyboard('{Escape}');
    expect(drawer).toHaveAttribute('data-open', 'false');
    expect(menu).toHaveFocus();
  });

  it('telefonda sayfa bağlantısına dokununca çekmece kapanır', async () => {
    mockCompact(true);
    renderShell();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Menüyü aç' }));
    await user.click(screen.getByRole('link', { name: 'Ana sayfa' }));
    expect(screen.getByRole('dialog', { hidden: true, name: 'Menü' })).toHaveAttribute(
      'data-open',
      'false',
    );
  });

  it('yardımcı panel geniş ekranda sağ sütundur; tıklamayla açılır, Escape kapatır', async () => {
    mockCompact(false);
    renderShell();
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'Asistan' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('complementary', { name: 'Asistan' })).not.toBeInTheDocument();

    await user.click(trigger);
    const panel = screen.getByRole('complementary', { name: 'Asistan' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('main')).not.toHaveAttribute('inert');
    expect(within(panel).getByRole('button', { name: 'Asistanı kapat' })).toHaveFocus();
    expect(document.body).not.toHaveAttribute('data-focus-dim');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('complementary', { name: 'Asistan' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('yardımcı panel telefonda tam boy iletişim kutusudur; kapanınca odak döner', async () => {
    mockCompact(true);
    renderShell();
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'Asistan' });
    await user.click(trigger);
    const sheet = screen.getByRole('dialog', { name: 'Asistan' });
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    expect(sheet).toHaveAttribute('data-open', 'true');
    expect(screen.getByRole('main')).toHaveAttribute('inert');
    expect(document.body).not.toHaveAttribute('data-focus-dim');

    await user.click(within(sheet).getByRole('button', { name: 'Asistanı kapat' }));
    expect(sheet).toHaveAttribute('data-open', 'false');
    expect(trigger).toHaveFocus();
  });

  it('fare üstüne gelince panel açılmaz', async () => {
    mockCompact(false);
    renderShell();
    const trigger = screen.getByRole('button', { name: 'Asistan' });
    await userEvent.setup().hover(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('rail tercihi saklanır', async () => {
    mockCompact(false);
    renderShell();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dar görünüme geç' }));
    expect(localStorage.getItem('atonota.shell.sidebar')).toBe('rail');
    act(() => undefined);
  });
});

/**
 * MVP audit: no sample data remains in the panel (23 November 2026).
 * Workspace, quick actions and AI credit come only from server data.
 */
describe('AppShell örnek veri yok', () => {
  const sidebars = [
    {
      id: 'Satış',
      label: 'Satış',
      module: 'selling',
      links: [
        { label: 'Teklifler', doctype: 'Quotation' },
        { label: 'Siparişler', doctype: 'Sales Order' },
      ],
    },
  ];

  it('çalışma alanı verisi yoksa örnek şirket görünmez', () => {
    mockCompact(false);
    renderShell({});
    expect(screen.queryByText(/Örnek Şirket/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Çalışma alanı/ })).not.toBeInTheDocument();
  });

  it('tek çalışma alanı açılır liste olmadan sade görünür', () => {
    mockCompact(false);
    renderShell({
      workspaces: { items: [{ id: 'site', name: 'site.example.test' }], current: 'site' },
    });
    expect(document.querySelector('.shell-ws')).toHaveTextContent('site.example.test');
    expect(screen.getByRole('banner', { name: 'Kimlik şeridi' })).toHaveTextContent(
      'site.example.test',
    );
    expect(screen.queryByRole('button', { name: /site\.example\.test/ })).not.toBeInTheDocument();
    expect(document.querySelector('[aria-haspopup="menu"]')).toBeNull();
  });

  it('birden çok çalışma alanı varsa seçici açılır liste olur', async () => {
    mockCompact(false);
    renderShell({
      workspaces: {
        items: [
          { id: 'a', name: 'birinci.example.test' },
          { id: 'b', name: 'ikinci.example.test' },
        ],
        current: 'a',
      },
    });
    const button = screen.getByRole('button', { name: /birinci\.example\.test/ });
    await userEvent.setup().click(button);
    expect(
      await screen.findByRole('menuitem', { name: /ikinci\.example\.test/ }),
    ).toBeInTheDocument();
  });

  it('sunucu menüsü yoksa hızlı eylem görünmez, örnek öneri görünmez', () => {
    mockCompact(false);
    renderShell({});
    expect(screen.queryByRole('group', { name: 'Hızlı eylemler' })).not.toBeInTheDocument();
    expect(screen.queryByText('Günün özeti')).not.toBeInTheDocument();
  });

  it('hızlı eylemler sunucunun izin süzgecinden geçmiş sayfalarından gelir', async () => {
    mockCompact(false);
    renderShell({ navigation: { loadSidebars: vi.fn().mockResolvedValue(sidebars) } });
    const group = await screen.findByRole('group', { name: 'Hızlı eylemler' });
    const chips = Array.from(group.querySelectorAll('button')).map((b) => b.textContent);
    expect(chips).toEqual(['Teklifler', 'Siparişler']);
  });

  it('kredi ucu yoksa sayaç görünmez', () => {
    mockCompact(false);
    renderShell({});
    expect(screen.queryByText('AI kredisi')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Kredinin/ })).not.toBeInTheDocument();
  });

  it('kredi ucu boş yanıt verirse sayaç görünmez', async () => {
    mockCompact(false);
    const load = vi.fn().mockResolvedValue(null);
    renderShell({ credit: { load } });
    await act(async () => Promise.resolve());
    expect(load).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(screen.queryByText('AI kredisi')).not.toBeInTheDocument();
  });

  it('kredi ucundan gelen sayıyı gösterir', async () => {
    mockCompact(false);
    renderShell({ credit: { load: vi.fn().mockResolvedValue({ used: 250, total: 1000 }) } });
    expect(await screen.findByText('AI kredisi')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Kredinin yüzde 25 kısmı kullanıldı' })).toBeVisible();
  });
});

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { HomeSummary } from '@/api';
import { LanguageProvider } from '@/app/locale';

import { sampleAgents } from '../sampleData';
import type { ShellHomeData, ShellViewData } from '../view-data';
import { HomeDataError, ViewDataProvider } from '../view-data';
import HomePage from './HomePage';

function summary(overrides: Partial<HomeSummary> = {}): HomeSummary {
  return {
    pending_approvals: [
      {
        name: 'ORNEK-IZIN-0003',
        version: 'v3',
        employee_name: 'Örnek Kişi 3',
        leave_type: 'Örnek Yıllık İzin',
        from_date: '2026-12-08',
        to_date: '2026-12-12',
        total_leave_days: 5,
        leave_balance: 11,
      },
      {
        name: 'ORNEK-IZIN-0005',
        version: 'v5',
        employee_name: 'Örnek Kişi 5',
        leave_type: 'Örnek Mazeret İzni',
        from_date: '2026-12-01',
        to_date: '2026-12-01',
        total_leave_days: 1,
        leave_balance: null,
      },
    ],
    problems: [
      { kind: 'missing_joining_date', employee: 'ORNEK-CALISAN-08', employee_name: 'Örnek Kişi 8' },
      {
        kind: 'overlap',
        department: 'Örnek Ekip A',
        leaves: [
          {
            name: 'ORNEK-IZIN-0038',
            employee_name: 'Örnek Kişi 4',
            from_date: '2026-12-14',
            to_date: '2026-12-15',
          },
          {
            name: 'ORNEK-IZIN-0039',
            employee_name: 'Örnek Kişi 6',
            from_date: '2026-12-15',
            to_date: '2026-12-16',
          },
        ],
      },
    ],
    recent_changes: [
      {
        name: 'ORNEK-IZIN-0002',
        employee_name: 'Örnek Kişi 2',
        actor: 'Örnek Kişi 1',
        action: 'approved',
        at: '2026-11-22 09:05:00.000001',
      },
    ],
    counts: { pending_approvals: 2, on_leave_today: 3, opened_this_month: 14, problems: 2 },
    ...overrides,
  };
}

function fakeHome(over: Partial<ShellHomeData> = {}): ShellHomeData {
  return {
    load: vi.fn(() => Promise.resolve(summary())),
    approve: vi.fn(() => Promise.resolve()),
    reject: vi.fn(() => Promise.resolve()),
    ...over,
  };
}

function mount(data: ShellViewData | null) {
  // Dates and numbers are tested in Turkish format. The fallback locale is en-GB, so the locale is passed explicitly.
  return render(
    <LanguageProvider initialLanguage="tr">
      <MemoryRouter initialEntries={['/']}>
        <ViewDataProvider value={data}>
          <HomePage />
        </ViewDataProvider>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

const pendingList = () => screen.getByRole('list', { name: /Onayınızı bekleyen/ });

describe('HomePage: Bekleyenler', () => {
  it('başlık "Bekleyenler" olur ve "Yeni izin talebi" düğmesi vardır', async () => {
    mount({ home: fakeHome() });
    expect(screen.getByRole('heading', { level: 1, name: 'Bekleyenler' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Yeni izin talebi' })).toBeVisible();
    await screen.findByText('Örnek Kişi 3: Örnek Yıllık İzin');
  });

  it('bölümler sırayla gelir: bekleyen onaylar, sorunlu kayıtlar, son değişiklikler, özet sayılar', async () => {
    mount({ home: fakeHome() });
    await screen.findByText('Örnek Kişi 3: Örnek Yıllık İzin');
    const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(names).toEqual([
      'Onayınızı bekleyen 2 izin talebi var',
      'Sorunlu kayıtlar',
      'Son değişiklikler',
      'Özet sayılar',
    ]);
  });

  it('talebin tarihini, gün sayısını ve kalan izni açık yazar', async () => {
    mount({ home: fakeHome() });
    expect(
      await screen.findByText(
        '8 Aralık 2026 Salı gününden 12 Aralık 2026 Cumartesi gününe kadar. 5 gün. Kalan izni 11 gün.',
      ),
    ).toBeVisible();
    expect(screen.getByText('1 Aralık 2026 Salı günü. 1 gün.')).toBeVisible();
  });

  it('sorunlu kayıtları, son değişiklikleri ve sayıları gösterir', async () => {
    mount({ home: fakeHome() });
    expect(
      await screen.findByText('Örnek Kişi 8 personel kaydında işe giriş tarihi yok.'),
    ).toBeVisible();
    expect(
      screen.getByText(
        'Örnek Ekip A ekibinde iki izin talebi aynı günlere düşüyor: ORNEK-IZIN-0038 ve ORNEK-IZIN-0039.',
      ),
    ).toBeVisible();
    expect(screen.getByText('Örnek Kişi 1, ORNEK-IZIN-0002 talebini onayladı.')).toBeVisible();
    const kpis = screen.getByRole('list', { name: 'Özet sayılar' });
    expect(within(kpis).getByText('Bugün izinli kişi')).toBeVisible();
    expect(within(kpis).getByText('14')).toBeVisible();
  });

  it('kullanıcı talebi onaylar ve aynı ekranda "Onaylandı" sonucunu görür', async () => {
    const user = userEvent.setup();
    const home = fakeHome();
    mount({ home });
    await screen.findByText('Örnek Kişi 3: Örnek Yıllık İzin');
    const row = within(pendingList()).getAllByRole('listitem')[0]!;
    await user.click(within(row).getByRole('button', { name: /Onayla/ }));
    expect(home.approve).toHaveBeenCalledWith({ name: 'ORNEK-IZIN-0003', version: 'v3' });
    expect(await within(row).findByText('Onaylandı')).toBeVisible();
    expect(within(row).queryByRole('button')).toBeNull();
    expect(screen.getByRole('status', { name: 'Karar sonucu' })).toHaveTextContent(
      'Örnek Kişi 3: Örnek Yıllık İzin onaylandı.',
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Onayınızı bekleyen 1 izin talebi var' }),
    ).toBeVisible();
  });

  it('kullanıcı talebi reddeder ve "Reddedildi" sonucunu görür', async () => {
    const user = userEvent.setup();
    const home = fakeHome();
    mount({ home });
    await screen.findByText('Örnek Kişi 5: Örnek Mazeret İzni');
    const row = within(pendingList()).getAllByRole('listitem')[1]!;
    await user.click(within(row).getByRole('button', { name: /Reddet/ }));
    expect(home.reject).toHaveBeenCalledWith({ name: 'ORNEK-IZIN-0005', version: 'v5' });
    expect(await within(row).findByText('Reddedildi')).toBeVisible();
    expect(screen.getByRole('status', { name: 'Karar sonucu' })).toHaveTextContent(
      'Örnek Kişi 5: Örnek Mazeret İzni reddedildi.',
    );
  });

  it('düğme klavyeyle de çalışır', async () => {
    const user = userEvent.setup();
    const home = fakeHome();
    mount({ home });
    await screen.findByText('Örnek Kişi 3: Örnek Yıllık İzin');
    const approve = within(pendingList()).getAllByRole('button', { name: /Onayla/ })[0]!;
    approve.focus();
    await user.keyboard('{Enter}');
    expect(home.approve).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Onaylandı')).toBeVisible();
  });

  it('son talep bitince boş durum cümlesi görünür', async () => {
    const user = userEvent.setup();
    mount({ home: fakeHome() });
    await screen.findByText('Örnek Kişi 3: Örnek Yıllık İzin');
    for (const b of within(pendingList()).getAllByRole('button', { name: /Onayla/ })) {
      await user.click(b);
    }
    expect(
      await screen.findByText('Onayınızı bekleyen iş yok. Yeni talep gelince burada görünür.'),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Onayınızı bekleyen iş kalmadı' }),
    ).toBeVisible();
  });

  it('onay hata verirse talep listede kalır ve ekran hatayı yazar', async () => {
    const user = userEvent.setup();
    const home = fakeHome({
      approve: vi.fn(() => Promise.reject(new HomeDataError('Bu kaydı başka biri değiştirdi.'))),
    });
    mount({ home });
    await screen.findByText('Örnek Kişi 3: Örnek Yıllık İzin');
    const row = within(pendingList()).getAllByRole('listitem')[0]!;
    await user.click(within(row).getByRole('button', { name: /Onayla/ }));
    expect(await within(row).findByRole('alert')).toHaveTextContent(
      'Bu kaydı başka biri değiştirdi.',
    );
    expect(within(row).getByRole('button', { name: /Onayla/ })).toBeVisible();
    expect(within(row).getByRole('button', { name: /Reddet/ })).toBeVisible();
    expect(within(row).queryByText('Onaylandı')).toBeNull();
  });

  it('bekleyen talep yoksa ekran bunu açıkça yazar, "Kayıt yok" demez', async () => {
    const empty = summary({
      pending_approvals: [],
      counts: { pending_approvals: 0, on_leave_today: 0, opened_this_month: 0, problems: 2 },
    });
    mount({ home: fakeHome({ load: vi.fn(() => Promise.resolve(empty)) }) });
    expect(
      await screen.findByText('Onayınızı bekleyen iş yok. Yeni talep gelince burada görünür.'),
    ).toBeVisible();
    expect(screen.queryByText('Kayıt yok')).toBeNull();
  });

  it('yüklenirken sahte ilerleme göstermez', () => {
    mount({ home: fakeHome({ load: vi.fn(() => new Promise<HomeSummary>(() => undefined)) }) });
    expect(screen.getByText('Bekleyen işler yükleniyor.')).toBeVisible();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(document.body.textContent).not.toMatch(/%|\d{1,2}[:.]\d{2}/);
    expect(screen.queryByText('Kayıt yok')).toBeNull();
  });

  it('sunucu hata verirse hatayı yazar ve kullanıcı yeniden dener', async () => {
    const user = userEvent.setup();
    const load = vi
      .fn<ShellHomeData['load']>()
      .mockRejectedValueOnce(new HomeDataError('Hizmet şu an çalışmıyor.'))
      .mockResolvedValueOnce(summary());
    mount({ home: fakeHome({ load }) });
    expect(await screen.findByText('Hizmet şu an çalışmıyor.')).toBeVisible();
    expect(screen.queryByText('Kayıt yok')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Yeniden dene' }));
    expect(await screen.findByText('Örnek Kişi 3: Örnek Yıllık İzin')).toBeVisible();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('bağlantı yoksa örnek ajan ve uydurma saat göstermez, "Kayıt yok" demez', async () => {
    mount(null);
    expect(screen.getByRole('heading', { level: 1, name: 'Bekleyenler' })).toBeVisible();
    for (const agent of sampleAgents) expect(screen.queryByText(agent.name)).toBeNull();
    expect(screen.queryByText(/10:42/)).toBeNull();
    expect(screen.queryByText('Bu sayfadaki veriler örnektir.')).toBeNull();
    expect(screen.queryByText('Kayıt yok')).toBeNull();
    await act(() => Promise.resolve());
    expect(
      screen.getByText('Ana sayfa bağlantısı kurulmadı. Uygulama girişi kabuğa bağlantı vermeli.'),
    ).toBeVisible();
  });

  it('modül ortamı gelince ana sayfa onun istemcisini kullanır', async () => {
    const { homeDataForModules, registerHomeData } = await import('../view-data/home-data');
    const env = { tenant: 'ornek.test', user: 'kisi@example.test', mode: 'live' as const };
    const home = fakeHome();
    registerHomeData(env, home);
    expect(homeDataForModules(env)).toBe(home);
    mount({ modules: env });
    await waitFor(() => expect(home.load).toHaveBeenCalled());
  });

  it('"Sorunlu kayıtlar" başlığında süs olan uyarı simgesi vardır', async () => {
    mount({ home: fakeHome() });
    await screen.findByText('Örnek Kişi 8 personel kaydında işe giriş tarihi yok.');
    const heading = screen.getByRole('heading', { level: 2, name: 'Sorunlu kayıtlar' });
    const icons = heading.querySelectorAll('svg');
    expect(icons).toHaveLength(1);
    expect(icons[0]).toHaveAttribute('aria-hidden', 'true');
    expect(icons[0]).toHaveClass('shell-home-ic');
    expect(icons[0]).toHaveAttribute('data-tone', 'warn');
  });

  it('"Son değişiklikler" satırlarında süs olan saat simgesi vardır', async () => {
    mount({ home: fakeHome() });
    const text = await screen.findByText('Örnek Kişi 1, ORNEK-IZIN-0002 talebini onayladı.');
    const item = text.closest('li');
    expect(item).not.toBeNull();
    const icons = item?.querySelectorAll('svg') ?? [];
    expect(icons).toHaveLength(1);
    expect(icons[0]).toHaveAttribute('aria-hidden', 'true');
    expect(icons[0]).toHaveClass('shell-home-ic');
    // The icon is the row's first element. In the mock-up the icon sits before the text.
    expect(item?.firstElementChild).toBe(icons[0]);
    const heading = screen.getByRole('heading', { level: 2, name: 'Son değişiklikler' });
    expect(heading.querySelector('svg')).toBeNull();
  });
});

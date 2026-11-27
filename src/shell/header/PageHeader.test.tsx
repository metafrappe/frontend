import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { LanguageProvider } from '@/app/locale';

import type { PageHeaderProps } from './PageHeader';
import { PageHeader } from './PageHeader';

function renderHeader(p: Partial<PageHeaderProps> = {}) {
  const props: PageHeaderProps = {
    title: 'Teklifler',
    crumbs: [{ label: 'Satış', to: '/satis' }, { label: 'Teklifler' }],
    count: 1284,
    view: 'table',
    onViewChange: vi.fn(),
    state: { kind: 'normal', syncedAt: '10:42' },
    primaryAction: { label: 'Yeni teklif', onClick: vi.fn() },
    ...p,
  };
  // The counter is tested with Turkish formatting. The fallback locale is en-GB, so the locale is passed explicitly.
  render(
    <LanguageProvider initialLanguage="tr">
      <MemoryRouter>
        <PageHeader {...props} />
      </MemoryRouter>
    </LanguageProvider>,
  );
  return props;
}

describe('PageHeader', () => {
  it('HD3: başlık birinci düzey başlıktır', () => {
    renderHeader();
    expect(screen.getByRole('heading', { level: 1, name: 'Teklifler' })).toBeInTheDocument();
  });

  it('breadcrumb gezinmesi vardır ve son öğe geçerli sayfadır', () => {
    renderHeader();
    const nav = screen.getByRole('navigation', { name: 'Konum' });
    expect(within(nav).getByRole('link', { name: 'Satış' })).toBeInTheDocument();
    expect(within(nav).getByText('Teklifler')).toHaveAttribute('aria-current', 'page');
  });

  it('HD5: sayaç Türkçe biçimlidir', () => {
    renderHeader();
    expect(screen.getByText('1.284')).toBeInTheDocument();
  });

  it('HD4: tek birincil eylem vardır', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: 'Yeni teklif' })).toHaveClass('ant-btn-primary');
  });

  it('VT2: görünüm seçici yedi türü sunar', () => {
    renderHeader();
    const group = screen.getByRole('radiogroup', { name: 'Görünüm türü' });
    for (const n of ['Tablo', 'Kanban', 'Pivot', 'Rapor', 'Gantt', 'Timesheet', 'Form']) {
      expect(within(group).getByRole('radio', { name: n })).toBeInTheDocument();
    }
  });

  it('VT2: görünüm seçimi bildirilir', async () => {
    const props = renderHeader();
    const radio = screen.getByRole('radio', { name: 'Kanban' });
    await userEvent.setup().click(radio.closest('label') as HTMLElement);
    expect(props.onViewChange).toHaveBeenCalledWith('kanban');
  });

  it('VT3: koleksiyon görünümünde arama ve filtre vardır', () => {
    renderHeader();
    expect(screen.getByRole('searchbox', { name: 'Kayıtlarda ara' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filtre/ })).toBeInTheDocument();
  });

  it('VT2: Form görünümünde kayıt gezgini vardır, arama yoktur', () => {
    renderHeader({ view: 'form', record: { index: 3, total: 1284 } });
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.getByText('3 / 1.284')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Önceki kayıt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sonraki kayıt' })).toBeInTheDocument();
  });

  it('HD2: normal durum son senkron zamanını gösterir', () => {
    renderHeader();
    expect(screen.getByRole('status')).toHaveTextContent('Güncel');
    expect(screen.getByRole('status')).toHaveTextContent('10:42');
  });

  it('HD2: canlı durum saniye sayacını gösterir', () => {
    renderHeader({ state: { kind: 'live', secondsAgo: 4 } });
    expect(screen.getByRole('status')).toHaveTextContent('Canlı');
    expect(screen.getByRole('status')).toHaveTextContent('4 sn önce');
  });

  it('HD2: yükleniyor durumu metinle bildirilir', () => {
    renderHeader({ state: { kind: 'loading' } });
    expect(screen.getByRole('status')).toHaveTextContent('Yükleniyor');
    expect(document.querySelector('.shell-hd')).toHaveAttribute('aria-busy', 'true');
  });

  it('HD2: boş durumda sayaç 0 ve birincil eylem görünür', () => {
    renderHeader({ state: { kind: 'empty' }, count: 0 });
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yeni teklif' })).toBeInTheDocument();
  });

  it('HD2: hata durumunda uyarı ve yeniden dene vardır', async () => {
    const onRetry = vi.fn();
    renderHeader({ state: { kind: 'error', message: 'Bağlantı koptu.', onRetry } });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Bağlantı koptu.');
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Yeniden dene' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('HD2: seçim durumunda toplu işlem çubuğu eylemlerin yerine geçer', () => {
    renderHeader({ state: { kind: 'selection', count: 3, onClear: vi.fn() } });
    expect(screen.getByText('3 kayıt seçildi')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Yeni teklif' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seçimi kaldır' })).toBeInTheDocument();
  });

  it('HD2: kaydedilmemiş durumda değişiklik sayısı ve Vazgeç / Kaydet vardır', () => {
    renderHeader({
      state: { kind: 'dirty', changes: 2, onDiscard: vi.fn(), onSave: vi.fn() },
    });
    expect(screen.getByText('2 değişiklik kaydedilmedi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vazgeç' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kaydet' })).toHaveClass('ant-btn-primary');
    expect(screen.queryByRole('button', { name: 'Yeni teklif' })).not.toBeInTheDocument();
  });
});

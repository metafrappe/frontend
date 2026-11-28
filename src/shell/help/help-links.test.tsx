import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from '../layout/AppShell';
import type { ShellHelpAnswer, ShellHelpData, ShellViewData } from '../view-data';
import { ViewDataProvider } from '../view-data';
import { HelpDoctype, HelpMarker, SELF_HELP_KEY } from './index';

const original = window.matchMedia;

function mockMedia() {
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes('max-') ? false : query.includes('min-width'),
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
});

const answer = (over: Partial<ShellHelpAnswer> = {}): ShellHelpAnswer => ({
  title: 'Kayıt formu',
  content: 'Kaydı bu formda düzenlersiniz.',
  tour_url: '/tours/record',
  doc_url: 'https://docs.example.test/record',
  support_url: '/helpdesk/new',
  ...over,
});

function renderShell(help: ShellHelpData | undefined) {
  const viewData: ShellViewData = help ? { help } : {};
  render(
    <MemoryRouter>
      <ViewDataProvider value={viewData}>
        <AppShell>
          <HelpMarker
            target={{ kind: 'component', componentId: 'record-form', label: 'Kayıt formu' }}
          />
          <HelpDoctype.Provider value="Örnek Kayıt">
            <HelpMarker
              target={{
                kind: 'field',
                label: 'Başlık',
                fieldname: 'title',
                description: 'Kısa ad.',
              }}
            />
          </HelpDoctype.Provider>
        </AppShell>
      </ViewDataProvider>
    </MemoryRouter>,
  );
}

async function panelReady() {
  await waitFor(() =>
    expect(document.getElementById('shell-help')).toContainElement(
      document.activeElement as HTMLElement,
    ),
  );
  return document.getElementById('shell-help') as HTMLElement;
}

const compMark = () => screen.getByRole('button', { name: 'Kayıt formu bileşeninin yardımı' });

function fakeHelp(over: Partial<ShellHelpData> = {}): ShellHelpData {
  return {
    loadComponent: vi.fn(async () => answer()),
    loadField: vi.fn(async () => answer({ title: 'Başlık', content: 'Kaydın kısa adı.' })),
    ...over,
  };
}

describe('bileşen yardımı ve bağlantılar (G-137, G-138)', () => {
  it('mod kapalıyken bileşen işareti çizilmez', () => {
    mockMedia();
    renderShell(fakeHelp());
    expect(screen.queryByRole('button', { name: 'Kayıt formu bileşeninin yardımı' })).toBeNull();
  });

  it('mod açıkken bileşen işareti bileşen adıyla duyurulur', () => {
    localStorage.setItem(SELF_HELP_KEY, 'on');
    mockMedia();
    renderShell(fakeHelp());
    expect(compMark()).toBeInTheDocument();
  });

  it('bileşen işareti sunucu yardımını ve üç bağlantıyı gösterir', async () => {
    localStorage.setItem(SELF_HELP_KEY, 'on');
    mockMedia();
    const help = fakeHelp();
    renderShell(help);
    await userEvent.click(compMark());
    const p = within(await panelReady());
    expect(help.loadComponent).toHaveBeenCalledWith('record-form', expect.any(AbortSignal));
    expect(p.getByRole('heading', { name: 'Kayıt formu' })).toBeInTheDocument();
    expect(await p.findByText('Kaydı bu formda düzenlersiniz.')).toBeInTheDocument();
    expect(p.getByRole('link', { name: 'Tur' })).toHaveAttribute('href', '/tours/record');
    expect(p.getByRole('link', { name: 'Belge' })).toHaveAttribute(
      'href',
      'https://docs.example.test/record',
    );
    expect(p.getByRole('link', { name: 'Destek talebi' })).toHaveAttribute('href', '/helpdesk/new');
  });

  it('sunucu vermeyen ve güvensiz bağlantı çizilmez', async () => {
    localStorage.setItem(SELF_HELP_KEY, 'on');
    mockMedia();
    renderShell(
      fakeHelp({
        loadComponent: vi.fn(async () =>
          answer({ tour_url: null, support_url: 'javascript:alert(1)' }),
        ),
      }),
    );
    await userEvent.click(compMark());
    const p = within(await panelReady());
    expect(await p.findByRole('link', { name: 'Belge' })).toBeInTheDocument();
    expect(p.queryByRole('link', { name: 'Tur' })).toBeNull();
    expect(p.queryByRole('link', { name: 'Destek talebi' })).toBeNull();
  });

  it('bileşen için yardım yoksa bağlantı bölümü çizilmez', async () => {
    localStorage.setItem(SELF_HELP_KEY, 'on');
    mockMedia();
    renderShell(fakeHelp({ loadComponent: vi.fn(async () => null) }));
    await userEvent.click(compMark());
    const p = within(await panelReady());
    expect(await p.findByText('Bu bileşen için yardım metni yok.')).toBeInTheDocument();
    expect(p.queryByRole('link', { name: /Tur|Belge|Destek talebi/ })).toBeNull();
  });

  it('istek başarısız olursa bağlantı çizilmez ve panel açık kalır', async () => {
    localStorage.setItem(SELF_HELP_KEY, 'on');
    mockMedia();
    renderShell(fakeHelp({ loadComponent: vi.fn(async () => Promise.reject(new Error('x'))) }));
    await userEvent.click(compMark());
    const p = within(await panelReady());
    expect(await p.findByText('Bu bileşen için yardım metni yok.')).toBeInTheDocument();
    expect(p.queryAllByRole('link', { name: /Tur|Belge|Destek talebi/ })).toHaveLength(0);
  });

  it('alan işareti belge türüyle sunucu yardımını okur', async () => {
    localStorage.setItem(SELF_HELP_KEY, 'on');
    mockMedia();
    const help = fakeHelp();
    renderShell(help);
    await userEvent.click(screen.getByRole('button', { name: 'Başlık alanının yardımı' }));
    const p = within(await panelReady());
    expect(help.loadField).toHaveBeenCalledWith(
      { doctype: 'Örnek Kayıt', fieldname: 'title' },
      expect.any(AbortSignal),
    );
    expect(await p.findByText('Kaydın kısa adı.')).toBeInTheDocument();
    expect(p.getByRole('link', { name: 'Tur' })).toHaveAttribute('href', '/tours/record');
  });

  it('sunucu bağlantısı yoksa alan yardımı açıklamadan gelir ve bağlantı çizilmez', async () => {
    localStorage.setItem(SELF_HELP_KEY, 'on');
    mockMedia();
    renderShell(undefined);
    await userEvent.click(screen.getByRole('button', { name: 'Başlık alanının yardımı' }));
    const p = within(await panelReady());
    expect(p.getByText('Kısa ad.')).toBeInTheDocument();
    expect(p.queryAllByRole('link', { name: /Tur|Belge|Destek talebi/ })).toHaveLength(0);
  });

  it('Escape paneli kapatır; odak bileşen işaretine döner', async () => {
    localStorage.setItem(SELF_HELP_KEY, 'on');
    mockMedia();
    renderShell(fakeHelp());
    const mark = compMark();
    await userEvent.click(mark);
    await panelReady();
    await userEvent.keyboard('{Escape}');
    expect(document.getElementById('shell-help')).toHaveAttribute('hidden');
    expect(mark).toHaveFocus();
  });
});

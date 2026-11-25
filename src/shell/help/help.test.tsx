import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { AppShell } from '../layout/AppShell';
import { HelpMarker, SELF_HELP_KEY } from './index';

const original = window.matchMedia;

/** `wide` geniş kabuğu, `dock` yan yana yerleşimi açar. */
function mockMedia({ compact, dock }: { compact: boolean; dock: boolean }) {
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes('max-') ? compact : query.includes('min-width') ? dock : false,
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

function renderShell() {
  render(
    <MemoryRouter>
      <AppShell>
        <label htmlFor="baslik">Başlık</label>
        <input id="baslik" />
        <HelpMarker
          target={{ kind: 'field', label: 'Başlık', fieldname: 'title', description: 'Kısa ad.' }}
        />
      </AppShell>
    </MemoryRouter>,
  );
}

const tab = () => screen.getByRole('button', { name: 'Yardım' });

describe('yardım kulakçığı (G-137)', () => {
  it('kulakçık aria-expanded taşır; panel bölümleri ve anahtar görünür', async () => {
    mockMedia({ compact: false, dock: true });
    renderShell();
    expect(tab()).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(tab());
    expect(tab()).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById('shell-help');
    expect(panel).not.toBeNull();
    const p = within(panel as HTMLElement);
    expect(p.getByRole('heading', { name: 'Sayfa yardımı' })).toBeInTheDocument();
    expect(p.getByRole('heading', { name: 'Sık görevler' })).toBeInTheDocument();
    expect(p.getByRole('switch', { name: 'Kendi kendine destek modu' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('Escape paneli kapatır; odak kulakçığa döner', async () => {
    mockMedia({ compact: false, dock: true });
    renderShell();
    await userEvent.click(tab());
    expect(document.getElementById('shell-help')).toContainElement(
      document.activeElement as HTMLElement,
    );
    await userEvent.keyboard('{Escape}');
    expect(document.getElementById('shell-help')).toHaveAttribute('hidden');
    expect(tab()).toHaveFocus();
  });

  it('mod kapalıyken alan işareti yoktur; açılınca alan adıyla görünür ve saklanır', async () => {
    mockMedia({ compact: false, dock: true });
    renderShell();
    expect(screen.queryByRole('button', { name: 'Başlık alanının yardımı' })).toBeNull();
    await userEvent.click(tab());
    await userEvent.click(screen.getByRole('switch', { name: 'Kendi kendine destek modu' }));
    expect(screen.getByRole('button', { name: 'Başlık alanının yardımı' })).toBeInTheDocument();
    expect(localStorage.getItem(SELF_HELP_KEY)).toBe('on');
  });

  it('alan işareti alan yardımını açar; Escape odağı işarete döndürür', async () => {
    localStorage.setItem(SELF_HELP_KEY, 'on');
    mockMedia({ compact: false, dock: true });
    renderShell();
    const mark = screen.getByRole('button', { name: 'Başlık alanının yardımı' });
    await userEvent.click(mark);
    const p = within(document.getElementById('shell-help') as HTMLElement);
    expect(p.getByRole('heading', { name: 'Başlık' })).toBeInTheDocument();
    expect(p.getByText('Kısa ad.')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(mark).toHaveFocus();
  });

  it('yan yana sığınca panel tamamlayıcı bölgedir, sayfa etkileşime açıktır', async () => {
    mockMedia({ compact: false, dock: true });
    renderShell();
    await userEvent.click(tab());
    const panel = document.getElementById('shell-help') as HTMLElement;
    expect(panel).not.toHaveAttribute('role', 'dialog');
    expect(panel.tagName).toBe('ASIDE');
    expect(screen.getByRole('main')).not.toHaveAttribute('inert');
  });

  it('yer yetmezse panel modal çekmecedir; sayfa etkileşime kapanır', async () => {
    mockMedia({ compact: true, dock: false });
    renderShell();
    await userEvent.click(tab());
    const panel = screen.getByRole('dialog', { name: 'Yardım' });
    expect(panel).toHaveAttribute('aria-modal', 'true');
    expect(panel).toHaveAttribute('data-mode', 'drawer');
    expect(screen.getByRole('main', { hidden: true })).toHaveAttribute('inert');
  });
});

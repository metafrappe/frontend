import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ViewDataProvider } from '../view-data';
import { AppShell } from './AppShell';

const original = window.matchMedia;
const originalViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');

/** Fake visual viewport. The virtual keyboard reduces the visual viewport's height. */
class FakeViewport extends EventTarget {
  height = window.innerHeight;
  scale = 1;
}

let viewport: FakeViewport;

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
  viewport = new FakeViewport();
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
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
  if (originalViewport) Object.defineProperty(window, 'visualViewport', originalViewport);
  localStorage.clear();
  vi.unstubAllGlobals();
});

function renderShell() {
  render(
    <MemoryRouter>
      <ViewDataProvider value={null}>
        <AppShell>
          <p>İçerik</p>
        </AppShell>
      </ViewDataProvider>
    </MemoryRouter>,
  );
}

const bar = () => screen.getByRole('navigation', { name: 'Alt menü' });

describe('telefon alt çubuğu', () => {
  it('telefonda dört düğme sırayla durur', () => {
    mockCompact(true);
    renderShell();
    const names = Array.from(bar().querySelectorAll('a, button')).map((el) => el.textContent);
    expect(names).toEqual(['Bekleyenler', 'Ara', 'Asistan', 'Menü']);
    expect(within(bar()).getByRole('link', { name: 'Bekleyenler' })).toHaveAttribute('href', '/');
    expect(within(bar()).getByRole('link', { name: 'Asistan' })).toHaveAttribute(
      'href',
      '/asistan',
    );
  });

  it('geniş ekranda alt çubuk yoktur', () => {
    mockCompact(false);
    renderShell();
    expect(screen.queryByRole('navigation', { name: 'Alt menü' })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Ana gezinme' })).toBeVisible();
  });

  it('"Menü" menüyü açar; kapanınca odak "Menü" düğmesine döner', async () => {
    mockCompact(true);
    renderShell();
    const user = userEvent.setup();
    const menu = within(bar()).getByRole('button', { name: 'Menü' });
    const drawer = screen.getByRole('dialog', { hidden: true, name: 'Menü' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');

    await user.click(menu);
    expect(drawer).toHaveAttribute('data-open', 'true');
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(bar()).toHaveAttribute('inert');
    await user.keyboard('{Escape}');
    expect(drawer).toHaveAttribute('data-open', 'false');
    expect(menu).toHaveFocus();

    await user.click(menu);
    await user.click(screen.getByRole('button', { name: 'Menüyü kapat' }));
    expect(drawer).toHaveAttribute('data-open', 'false');
    expect(menu).toHaveFocus();
  });

  it('"Ara" menüyü arama kipinde açar; kapanınca odak "Ara" düğmesine döner', async () => {
    mockCompact(true);
    renderShell();
    const user = userEvent.setup();
    const search = within(bar()).getByRole('button', { name: 'Ara' });
    await user.click(search);
    expect(screen.getByRole('dialog', { hidden: true, name: 'Menü' })).toHaveAttribute(
      'data-open',
      'true',
    );
    expect(screen.getByRole('banner', { name: 'Kimlik şeridi' })).toHaveTextContent('KipAra');
    await user.keyboard('{Escape}');
    expect(search).toHaveFocus();
  });

  it('sanal klavye açılınca gizlenir, kapanınca geri gelir', () => {
    mockCompact(true);
    renderShell();
    expect(bar()).not.toHaveAttribute('data-keyboard', 'open');
    act(() => {
      viewport.height = Math.round(window.innerHeight * 0.55);
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByRole('navigation', { hidden: true, name: 'Alt menü' })).toHaveAttribute(
      'data-keyboard',
      'open',
    );
    act(() => {
      viewport.height = window.innerHeight;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(bar()).not.toHaveAttribute('data-keyboard', 'open');
  });

  it('yakınlaştırma klavye sayılmaz', () => {
    mockCompact(true);
    renderShell();
    act(() => {
      viewport.scale = 2;
      viewport.height = window.innerHeight / 2;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(bar()).not.toHaveAttribute('data-keyboard', 'open');
  });

  it('kaydırmada yalnız yatay telefonda ve yalnız üst kenar ölçülür', () => {
    const run = (landscape: boolean) => {
      window.matchMedia = (query: string) =>
        ({
          matches: query.includes('orientation') ? landscape : true,
          media: query,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => false,
        }) as MediaQueryList;
      const { unmount } = render(
        <MemoryRouter>
          <ViewDataProvider value={null}>
            <AppShell>
              <p>İçerik</p>
            </AppShell>
          </ViewDataProvider>
        </MemoryRouter>,
      );
      const spy = vi.spyOn(document.documentElement.style, 'setProperty');
      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });
      const names = spy.mock.calls.map(([name]) => name);
      spy.mockRestore();
      unmount();
      return names;
    };
    expect(run(false)).toEqual([]);
    expect(run(true)).toEqual(['--shell-bar-top']);
  });
});

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/api';
import { LanguageProvider, useLocale } from '@/app/locale';

import { LanguageSelect } from './LanguageSelect';

function LocaleProbe() {
  return <output aria-label="Yerel ayar">{useLocale()}</output>;
}

/** A page with a half-filled form, an open filter and a draft. The language switch sits next to it. */
function renderPage(save: (tag: string, signal: AbortSignal) => Promise<void>) {
  return render(
    <LanguageProvider initialLanguage="tr-TR">
      <form aria-label="Talep">
        <input aria-label="Konu" defaultValue="" />
        <textarea aria-label="Taslak" defaultValue="" />
      </form>
      <input aria-label="Süzgeç" defaultValue="" />
      <LanguageSelect save={save} />
      <LocaleProbe />
    </LanguageProvider>,
  );
}

function fillPage() {
  fireEvent.change(screen.getByLabelText('Konu'), { target: { value: 'Yarım kalan talep' } });
  fireEvent.change(screen.getByLabelText('Taslak'), { target: { value: 'İlk satır' } });
  fireEvent.change(screen.getByLabelText('Süzgeç'), { target: { value: 'vida' } });
}

function expectPageKept() {
  expect(screen.getByLabelText('Konu')).toHaveValue('Yarım kalan talep');
  expect(screen.getByLabelText('Taslak')).toHaveValue('İlk satır');
  expect(screen.getByLabelText('Süzgeç')).toHaveValue('vida');
}

/** The label follows the UI language: Turkish "Dil", English "Language". */
const LANGUAGE = /^(Dil|Language)$/;

/** Opens the branded list and picks an option. */
async function choose(option: string) {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: LANGUAGE }));
  const items = await screen.findAllByText(option, {
    selector: '.ant-select-item-option-content *, .ant-select-item-option-content',
  });
  fireEvent.click(items[items.length - 1]!);
}

afterEach(() => {
  cleanup();
  document.documentElement.lang = 'tr';
});

describe('LanguageSelect: dil seçimi profile yazılır (AJA-1772)', () => {
  it('markalı açılır listedir, yerel <select> kullanılmaz', () => {
    const { container } = renderPage(() => Promise.resolve());
    expect(container.querySelector('select')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Dil' })).toBeInTheDocument();
  });

  it('seçenekler kendi dilindeki adıyla ve kendi lang değeriyle görünür', async () => {
    renderPage(() => Promise.resolve());
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Dil' }));
    for (const [name, lang] of [
      ['English (UK)', 'en-GB'],
      ['Türkçe', 'tr-TR'],
      ['Deutsch', 'de-DE'],
    ] as const) {
      const option = (await screen.findAllByText(name)).find((node) =>
        node.closest('.ant-select-item-option'),
      );
      expect(option, name).toBeDefined();
      expect(option!.closest('[lang]')).toHaveAttribute('lang', lang);
    }
  });

  it('dil değişince seçim profile yazılır, form, süzgeç ve taslak korunur', async () => {
    const save = vi.fn(() => Promise.resolve());
    renderPage(save);
    fillPage();
    await choose('Deutsch');
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Yerel ayar' })).toHaveTextContent('de-DE'),
    );
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('de-DE', expect.any(AbortSignal));
    expect(document.documentElement.lang).toBe('de-DE');
    expectPageKept();
  });

  it('aynı seçim iki kez yapılırsa ikinci istek gitmez, sonuç değişmez', async () => {
    const save = vi.fn(() => Promise.resolve());
    renderPage(save);
    await choose('Deutsch');
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Yerel ayar' })).toHaveTextContent('de-DE'),
    );
    await choose('Deutsch');
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status', { name: 'Yerel ayar' })).toHaveTextContent('de-DE');
  });

  it('kayıt sürerken liste kilitlidir, ikinci seçim yeni istek göndermez', async () => {
    let finish: () => void = () => undefined;
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    renderPage(save);
    await choose('Deutsch');
    expect(screen.getByRole('combobox', { name: 'Dil' })).toBeDisabled();
    expect(screen.getByRole('status', { name: 'Yerel ayar' })).toHaveTextContent('tr-TR');
    await act(async () => finish());
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Yerel ayar' })).toHaveTextContent('de-DE'),
    );
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('profil kaydı reddedilirse eski dil ve neden görünür, form korunur', async () => {
    const save = vi.fn(() =>
      Promise.reject(new ApiError({ kind: 'forbidden', status: 403, code: 'PermissionError' })),
    );
    renderPage(save);
    fillPage();
    await choose('Deutsch');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Dil değişmedi.');
    expect(alert).toHaveTextContent('Bu işlem için izniniz yok.');
    expect(screen.getByRole('status', { name: 'Yerel ayar' })).toHaveTextContent('tr-TR');
    expect(document.documentElement.lang).toBe('tr-TR');
    expect(screen.getByRole('combobox', { name: 'Dil' })).not.toBeDisabled();
    expect(
      screen.getByText('Türkçe', {
        selector: '.ant-select-selection-item, .ant-select-selection-item *',
      }),
    ).toBeInTheDocument();
    expectPageKept();
  });
});

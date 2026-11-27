import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LanguageProvider, useSetLanguage } from '@/app/locale';

import { ConfirmView } from './blocks/ConfirmView';
import { FormView } from './blocks/FormView';
import { GENUI_FALLBACK_STRINGS, GENUI_TRANSLATIONS, resolveGenuiStrings } from './strings';
import type { ConfirmBlock, FormBlock, GenUIActionResult } from './types';

/**
 * GenUI cards speak the UI language (AJA-1859).
 * Button text, screen reader names and notes come from the same table as `antd` and `XProvider`.
 */
const confirm: ConfirmBlock = {
  type: 'confirm',
  id: 'order-42-cancel',
  title: 'Order 42',
  summary: 'Order 42 is cancelled.',
  changes: [{ field: 'Status', before: 'Open', after: 'Cancelled' }],
  // The server may still send labels in its own language. The card does not show them.
  confirmLabel: 'Gönder',
  cancelLabel: 'Vazgeç',
};

const r3: ConfirmBlock = {
  ...confirm,
  risk: 'R3',
  target: { label: 'User: Sample 7', name: 'Sample 7' },
};

const form: FormBlock = {
  type: 'form',
  id: 'f1',
  title: 'Stock rule',
  submitLabel: 'Kaydet',
  fields: [{ name: 'name', label: 'Rule name', kind: 'text', value: 'Low stock' }],
};

const accept = () => vi.fn((): GenUIActionResult => 'accepted');

function LanguageSwitch() {
  const setLanguage = useSetLanguage();
  return (
    <>
      <button type="button" onClick={() => setLanguage('en')}>
        to-en
      </button>
      <button type="button" onClick={() => setLanguage('tr')}>
        to-tr
      </button>
    </>
  );
}

function renderIn(language: string, ui: React.ReactNode) {
  return render(
    <LanguageProvider initialLanguage={language}>
      <LanguageSwitch />
      {ui}
    </LanguageProvider>,
  );
}

describe('GenUI kartı arayüz dilinde konuşur', () => {
  it('arayüz dili İngilizceyken onay kartının düğmeleri İngilizcedir', () => {
    renderIn('en', <ConfirmView block={confirm} onAction={accept()} />);
    const card = document.querySelector<HTMLElement>('[data-genui="confirm"]')!;
    expect(within(card).getByRole('button', { name: 'Approve' })).toBeEnabled();
    expect(within(card).getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(within(card).queryByRole('button', { name: 'Gönder' })).toBeNull();
    expect(within(card).queryByRole('button', { name: 'Vazgeç' })).toBeNull();
    expect(within(card).getByText('Risk level')).toBeInTheDocument();
    expect(within(card).getByText('R1 Low')).toBeInTheDocument();
    expect(within(card).getByRole('table', { name: 'Fields to change' })).toBeInTheDocument();
  });

  it('dil değişince kart metni ve ekran okuyucu adı aynı dile geçer', async () => {
    const user = userEvent.setup();
    renderIn('tr', <ConfirmView block={r3} onAction={accept()} />);
    const card = () => document.querySelector<HTMLElement>('[data-genui="confirm"]')!;

    expect(within(card()).getByRole('button', { name: 'Onayla' })).toBeDisabled();
    expect(within(card()).getByRole('table', { name: 'Değişecek alanlar' })).toBeInTheDocument();
    expect(
      within(card()).getByRole('textbox', { name: /Onaylamak için hedefin adını yazın/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'to-en' }));

    expect(within(card()).getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(within(card()).getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(within(card()).getByRole('table', { name: 'Fields to change' })).toBeInTheDocument();
    expect(
      within(card()).getByRole('textbox', { name: /Type the target's name to approve/ }),
    ).toBeInTheDocument();
    expect(within(card()).getByText('R3 High')).toBeInTheDocument();
    expect(within(card()).queryByText(/Onayla|Vazgeç|Değişecek/)).toBeNull();
  });

  it('dil değişse de iş anahtarı ve eylemin türü değişmez', async () => {
    const user = userEvent.setup();
    const onAction = accept();
    renderIn('tr', <ConfirmView block={confirm} onAction={onAction} />);
    await user.click(screen.getByRole('button', { name: 'to-en' }));
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onAction).toHaveBeenCalledWith({
      kind: 'confirm',
      blockId: 'order-42-cancel',
      decision: 'approved',
      title: 'Order 42',
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your approval was sent. The assistant will report the result in a new message.',
    );
  });

  it('form kartının düğmeleri de arayüz dilindedir', async () => {
    const user = userEvent.setup();
    renderIn('en', <FormView block={form} onAction={accept()} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kaydet' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Approve and send' })).toBeInTheDocument();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'to-tr' }));
    });
    expect(screen.getByRole('button', { name: 'Onayla ve gönder' })).toBeInTheDocument();
  });
});

describe('dilde metin yoksa en-GB metni görünür', () => {
  it('eksik ya da boş metin yerine İngilizce metin gelir, boş düğme olmaz', () => {
    const strings = resolveGenuiStrings({
      approve: '',
      // `reject` is missing on purpose.
      riskLabels: { R0: 'R0 Okuma', R1: 'R1 Düşük', R2: '', R3: 'R3 Yüksek' },
    });
    expect(strings.approve).toBe('Approve');
    expect(strings.reject).toBe('Cancel');
    expect(strings.riskLabels.R1).toBe('R1 Düşük');
    expect(strings.riskLabels.R2).toBe('R2 Medium');
    expect(GENUI_FALLBACK_STRINGS.approve).toBe('Approve');
  });

  it('her dilin tablosu tamdır: hiçbir metin boş değildir', () => {
    const walk = (value: unknown, path: string): string[] => {
      if (typeof value === 'string') return value.trim() === '' ? [path] : [];
      if (typeof value === 'function') return [];
      if (value && typeof value === 'object') {
        return Object.entries(value).flatMap(([key, item]) => walk(item, `${path}.${key}`));
      }
      return [path];
    };
    for (const language of ['tr', 'en'] as const) {
      // The raw table is checked, not the merged one. The fallback is only a safety net.
      const table = GENUI_TRANSLATIONS[language];
      expect(walk(table, language)).toEqual([]);
      expect(Object.keys(table).sort()).toEqual(Object.keys(GENUI_FALLBACK_STRINGS).sort());
    }
  });
});

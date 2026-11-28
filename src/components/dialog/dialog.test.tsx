import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { moduleMessages } from '@/modules/messages';
import { userMessages } from '@/modules/administration/users-messages';

import { ActionDialog, ConfirmPopover, isVagueActionLabel } from '.';

describe('confirm labels say the result', () => {
  it.each(['Tamam', 'OK', 'Ok', 'Evet', 'Yes', 'İptal', 'Cancel', 'Onayla', 'Confirm', ' tamam '])(
    '"%s" alone does not say the result',
    (label) => {
      expect(isVagueActionLabel(label)).toBe(true);
    },
  );

  it.each(['Taslağı sil', 'Delete permission', 'Değişiklikleri kaydet', 'Profili ata'])(
    '"%s" says the result',
    (label) => {
      expect(isVagueActionLabel(label)).toBe(false);
    },
  );

  it('a dialog with a vague confirm label fails in development', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      render(
        <ActionDialog
          open
          title="Taslak silinsin mi?"
          confirmLabel="Tamam"
          cancelLabel="Vazgeç"
          onConfirm={() => undefined}
          onCancel={() => undefined}
        />,
      ),
    ).toThrow(/does not say the result/);
    error.mockRestore();
  });

  it('a popconfirm with a vague confirm label fails in development', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      render(
        <ConfirmPopover
          title="Bağlantı kaldırılsın mı?"
          confirmLabel="OK"
          cancelLabel="Vazgeç"
          onConfirm={() => undefined}
        >
          <button type="button">Bağlantıyı kaldır</button>
        </ConfirmPopover>,
      ),
    ).toThrow(/does not say the result/);
    error.mockRestore();
  });

  it.each(['en', 'tr'] as const)('module confirm labels say the result (%s)', (lang) => {
    const copy = moduleMessages[lang];
    const users = userMessages[lang];
    for (const label of [copy.removePermission, copy.saveChanges, users.roleProfileAssign]) {
      expect(isVagueActionLabel(label), label).toBe(false);
    }
  });

  it('the review dialog cancel says it keeps editing in both catalogues', () => {
    // Closing the review keeps the changes, so "Discard" would mislead. Texts already exist in
    // the record view catalogue and are reused word for word.
    expect(moduleMessages.en.keepEditing).toBe('Keep editing');
    expect(moduleMessages.tr.keepEditing).toBe('Düzenlemeye devam et');
  });
});

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { SiteFormatting } from '@/app/locale';

import { RecordApiError } from '../adapter';
import { RecordView } from '../RecordView';
import type { DocTypeMeta, RecordDataAdapter, RecordDocument } from '../types';

/**
 * Locale number entry in the record form (AJA-1765, G-73).
 * The region comes from the boot data. The boot data field does not exist yet (AJA-1732).
 * So the test gives a fake boot data value.
 */
const META: DocTypeMeta = {
  schema: {
    name: 'Expense Claim',
    module: 'HRMS TR',
    sensitivity: 'standard',
    title_field: 'name',
    search_fields: 'name',
    sort_field: 'modified',
    fields: [
      {
        fieldname: 'amount',
        fieldtype: 'Currency',
        label: 'Amount',
        component: 'currency',
        read_only: false,
        sensitivity: 'standard',
        options: 'EUR',
        precision: '2',
      },
    ],
  },
  child_tables: {},
  catalog_version: 2,
  meta_hash: 'locale-number',
  perm_version: 'locale-number',
  mobile_cache_allowed: false,
};

const FRANCE: SiteFormatting = { currency: 'EUR', format_locale: 'fr-FR' };
const GERMANY: SiteFormatting = { currency: 'EUR', format_locale: 'de-DE' };

/** The amount as the French region writes it. The group sign is a narrow space. */
const FRENCH_AMOUNT = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(1234.56);

function adapterWith(saved: RecordDocument | Error): RecordDataAdapter {
  return {
    getDocTypeMeta: vi.fn(async () => META),
    getRecord: vi.fn(async () => ({
      name: 'EXP-0001',
      modified: '2026-11-27 10:00:00',
      amount: 1234.56,
    })),
    saveRecord: vi.fn(async () => {
      if (saved instanceof Error) throw saved;
      return saved;
    }),
    searchLink: vi.fn(async () => []),
  };
}

const SAVED: RecordDocument = {
  name: 'EXP-0001',
  modified: '2026-11-27 10:00:00',
  amount: 1234.56,
};

async function amountInput() {
  return screen.findByRole('textbox', { name: /Amount/ });
}

describe('locale number entry in the record form (AJA-1765)', () => {
  it('fr-FR: 1 234,56 is saved as 1234.56 and reopens as the same text', async () => {
    const user = userEvent.setup();
    const adapter = adapterWith(SAVED);
    const view = render(
      <RecordView
        doctype="Expense Claim"
        createMode
        adapter={adapter}
        locale="en"
        formatting={FRANCE}
      />,
    );
    await user.type(await amountInput(), FRENCH_AMOUNT);
    await user.tab();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(adapter.saveRecord).toHaveBeenCalledTimes(1));
    const request = vi.mocked(adapter.saveRecord).mock.calls[0]![0];
    // The server gets a value that does not depend on the language.
    expect(request.data['amount']).toBe(1234.56);
    expect(JSON.stringify(request.data)).toBe('{"amount":1234.56}');
    view.unmount();

    render(
      <RecordView
        doctype="Expense Claim"
        name="EXP-0001"
        adapter={adapter}
        locale="en"
        formatting={FRANCE}
      />,
    );
    await waitFor(async () => expect(await amountInput()).toHaveValue(FRENCH_AMOUNT));
  });

  it('fr-FR: a plain space reads the same value', async () => {
    const user = userEvent.setup();
    const adapter = adapterWith(SAVED);
    render(
      <RecordView
        doctype="Expense Claim"
        createMode
        adapter={adapter}
        locale="en"
        formatting={FRANCE}
      />,
    );
    await user.type(await amountInput(), '1 234,56');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(adapter.saveRecord).toHaveBeenCalledTimes(1));
    expect(vi.mocked(adapter.saveRecord).mock.calls[0]![0].data['amount']).toBe(1234.56);
  });

  it('de-DE: 1.234,56 gives the same value', async () => {
    const user = userEvent.setup();
    const adapter = adapterWith(SAVED);
    render(
      <RecordView
        doctype="Expense Claim"
        createMode
        adapter={adapter}
        locale="en"
        formatting={GERMANY}
      />,
    );
    await user.type(await amountInput(), '1.234,56');
    await user.tab();
    expect(await amountInput()).toHaveValue('1.234,56');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(adapter.saveRecord).toHaveBeenCalledTimes(1));
    expect(vi.mocked(adapter.saveRecord).mock.calls[0]![0].data['amount']).toBe(1234.56);
  });

  it('an ambiguous value is not saved and the screen asks the user', async () => {
    const user = userEvent.setup();
    const adapter = adapterWith(SAVED);
    render(
      <RecordView
        doctype="Expense Claim"
        createMode
        adapter={adapter}
        locale="en"
        formatting={GERMANY}
      />,
    );
    const input = await amountInput();
    await user.type(input, '1.234');
    await user.tab();

    const question = await screen.findByRole('group', { name: /which number/i });
    expect(question).toBeVisible();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(question.id);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(adapter.saveRecord).not.toHaveBeenCalled();
    expect(input).toHaveValue('1.234');

    // The user picks the value. Then the form saves it.
    await user.click(within(question).getByRole('button', { name: '1.234,00' }));
    expect(input).toHaveValue('1.234,00');
    expect(screen.queryByRole('group', { name: /which number/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(adapter.saveRecord).toHaveBeenCalledTimes(1));
    expect(vi.mocked(adapter.saveRecord).mock.calls[0]![0].data['amount']).toBe(1234);
  });

  it('an invalid value is not saved and shows a clear message', async () => {
    const user = userEvent.setup();
    const adapter = adapterWith(SAVED);
    render(
      <RecordView
        doctype="Expense Claim"
        createMode
        adapter={adapter}
        locale="en"
        formatting={GERMANY}
      />,
    );
    const input = await amountInput();
    await user.type(input, '12.34,5');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(adapter.saveRecord).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveValue('12.34,5');
  });

  it('keeps the draft after a save error', async () => {
    const user = userEvent.setup();
    const adapter = adapterWith(
      new RecordApiError({ code: 'network', message: 'Server could not be reached' }),
    );
    render(
      <RecordView
        doctype="Expense Claim"
        createMode
        adapter={adapter}
        locale="en"
        formatting={FRANCE}
      />,
    );
    const input = await amountInput();
    await user.type(input, FRENCH_AMOUNT);
    await user.tab();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(adapter.saveRecord).toHaveBeenCalledTimes(1));
    await screen.findByRole('alert');
    expect(await amountInput()).toHaveValue(FRENCH_AMOUNT);
    // The second try sends the same value.
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(adapter.saveRecord).toHaveBeenCalledTimes(2));
    expect(vi.mocked(adapter.saveRecord).mock.calls[1]![0].data['amount']).toBe(1234.56);
  });
});

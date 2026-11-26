import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RecordView } from '../RecordView';
import { LEAVE_META } from '../harness/leaveFixture';
import { CHECKBOX_META } from '../harness/checkboxFixture';
import type { DocTypeMeta, RecordDataAdapter } from '../types';

function renderForm(meta: DocTypeMeta = LEAVE_META) {
  const adapter: RecordDataAdapter = {
    getDocTypeMeta: vi.fn(async () => meta),
    getRecord: vi.fn(async () => ({ name: 'SAMPLE-LEAVE-1' })),
    saveRecord: vi.fn(async () => ({ name: 'SAMPLE-LEAVE-1' })),
    searchLink: vi.fn(async () => []),
  };
  const view = render(<RecordView doctype={meta.schema.name} createMode adapter={adapter} />);
  return { ...view, adapter };
}

describe('record sections and field validation', () => {
  it('marks an unchecked required checkbox invalid and clears only its error when checked', async () => {
    const user = userEvent.setup();
    const { adapter } = renderForm(CHECKBOX_META);
    const checkbox = await screen.findByRole('checkbox', { name: 'Bilgileri kontrol ettim' });
    expect(checkbox).not.toHaveAttribute('aria-invalid');
    expect(checkbox).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(checkbox).toHaveAttribute('aria-invalid', 'true');
    const error = checkbox.closest('.rv-field')!.querySelector('.rv-field-error')!;
    expect(error).toBeVisible();
    expect(checkbox.getAttribute('aria-describedby')?.split(' ')).toContain(error.id);
    expect(adapter.saveRecord).not.toHaveBeenCalled();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(checkbox).not.toHaveAttribute('aria-invalid');
    expect(error).not.toBeInTheDocument();
    expect(checkbox).toHaveAccessibleDescription('Göndermeden önce bilgileri kontrol edin.');
    expect(screen.getByRole('textbox', { name: /Başlık/ })).toHaveAttribute('aria-invalid', 'true');
  });

  it('focuses the first invalid checkbox, then the next invalid field after correction', async () => {
    const user = userEvent.setup();
    const { adapter } = renderForm(CHECKBOX_META);
    const checkbox = await screen.findByRole('checkbox', { name: 'Bilgileri kontrol ettim' });
    const save = screen.getByRole('button', { name: 'Kaydet' });
    await user.click(save);
    expect(checkbox).toHaveFocus();
    await user.click(save);
    expect(checkbox).toHaveFocus();

    await user.keyboard(' ');
    expect(checkbox).toBeChecked();
    await user.click(save);
    expect(screen.getByRole('textbox', { name: /Başlık/ })).toHaveFocus();
    expect(adapter.saveRecord).not.toHaveBeenCalled();
  });

  it('does not submit a read-only form through native form submission', async () => {
    const meta: DocTypeMeta = {
      ...LEAVE_META,
      schema: {
        ...LEAVE_META.schema,
        fields: LEAVE_META.schema.fields.filter((field) => field.read_only),
      },
    };
    const { container, adapter } = renderForm(meta);
    await screen.findByLabelText('Ad');
    fireEvent.submit(container.querySelector('form')!);
    expect(adapter.saveRecord).not.toHaveBeenCalled();
  });

  it('names each section with its visible heading', async () => {
    renderForm();
    for (const name of ['Kişi bilgisi', 'İzin bilgisi']) {
      const section = await screen.findByRole('region', { name });
      const heading = within(section).getByRole('heading', { level: 2, name });
      expect(heading).toBeVisible();
      expect(heading.id).not.toBe('');
      expect(section).toHaveAttribute('aria-labelledby', heading.id);
    }
  });

  it.each([undefined, '', '   '])(
    'renders an unnamed section without an empty heading (%s)',
    async (label) => {
      const meta: DocTypeMeta = {
        ...LEAVE_META,
        schema: {
          ...LEAVE_META.schema,
          fields: LEAVE_META.schema.fields.map((field) =>
            field.fieldtype === 'Section Break' ? { ...field, label } : field,
          ),
        },
      };
      const { container } = renderForm(meta);
      await screen.findByRole('combobox', { name: /İzin türü/ });
      expect(container.querySelectorAll('.rv-section-card')).toHaveLength(2);
      expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
      expect(container.querySelector('.rv-section-card[aria-labelledby]')).toBeNull();
    },
  );

  it('places each error immediately below its control and retains the help association', async () => {
    const user = userEvent.setup();
    const { adapter } = renderForm();
    await user.click(await screen.findByRole('button', { name: 'Kaydet' }));
    const section = screen.getByRole('region', { name: 'İzin bilgisi' });
    for (const name of ['İzin türü', 'Başlangıç tarihi', 'Bitiş tarihi']) {
      const control = within(section).getByLabelText(new RegExp(name), { selector: 'input' });
      expect(control).toHaveAttribute('aria-invalid', 'true');
      const field = control.closest('.rv-field')!;
      const error = field.querySelector<HTMLElement>('.rv-field-error')!;
      expect(error).toBeVisible();
      expect(control.getAttribute('aria-describedby')?.split(' ')).toContain(error.id);
      expect(field).toContainElement(error);
      expect(error.previousElementSibling?.contains(control)).toBe(true);
    }
    const date = within(section).getByLabelText(/Başlangıç tarihi/);
    expect(date.getAttribute('aria-describedby')?.split(' ')).toHaveLength(2);
    expect(adapter.saveRecord).not.toHaveBeenCalled();
  });

  it('announces the count on every rejected submit and clears only a corrected field', async () => {
    const user = userEvent.setup();
    renderForm();
    const save = await screen.findByRole('button', { name: 'Kaydet' });
    await user.click(save);
    const live = screen.getByRole('status');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveAttribute('aria-atomic', 'true');
    expect(live).toHaveTextContent('3 alanda hata var.');
    expect(screen.getByRole('combobox', { name: /İzin türü/ })).toHaveFocus();
    const firstAnnouncement = live.firstElementChild;
    await user.click(save);
    expect(live.firstElementChild).not.toBe(firstAnnouncement);
    const start = screen.getByLabelText(/Başlangıç tarihi/);
    fireEvent.change(start, { target: { value: '2026-11-27' } });
    expect(start).not.toHaveAttribute('aria-invalid', 'true');
    expect(start.closest('.rv-field')?.querySelector('.rv-field-error')).toBeNull();
    expect(screen.getByLabelText(/Bitiş tarihi/)).toHaveAttribute('aria-invalid', 'true');
    await user.click(save);
    expect(live).toHaveTextContent('2 alanda hata var.');
  });

  it('opens the first invalid field’s tab and collapsed section before focusing it', async () => {
    const user = userEvent.setup();
    const meta: DocTypeMeta = {
      ...LEAVE_META,
      schema: {
        ...LEAVE_META.schema,
        fields: [
          {
            fieldname: 'leave_tab',
            fieldtype: 'Tab Break',
            label: 'Talep',
            read_only: false,
            component: 'tab',
            sensitivity: 'standard',
          },
          ...LEAVE_META.schema.fields.map((field) =>
            field.fieldname === 'leave_section' ? { ...field, collapsible: true } : field,
          ),
          {
            fieldname: 'other_tab',
            fieldtype: 'Tab Break',
            label: 'Diğer',
            read_only: false,
            component: 'tab',
            sensitivity: 'standard',
          },
          {
            fieldname: 'note',
            fieldtype: 'Data',
            label: 'Not',
            read_only: false,
            component: 'input',
            sensitivity: 'standard',
          },
        ],
      },
    };
    renderForm(meta);
    await user.click(await screen.findByRole('button', { name: /İzin bilgisi/ }));
    await user.click(screen.getByRole('tab', { name: 'Diğer' }));
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: /İzin türü/ })).toHaveFocus());
    expect(screen.getByRole('tab', { name: 'Talep' })).toHaveAttribute('aria-selected', 'true');
  });
});

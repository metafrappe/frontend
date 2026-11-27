import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { components } from '@/api/generated/hrms_tr';
import type { DocumentRequest } from '@/api';
import { createFrappeRecordAdapter, RecordApiError } from '../adapter';
import { RecordView } from '../RecordView';
import { LEAVE_META } from '../harness/leaveFixture';
import type { DocTypeMeta, RecordDataAdapter, RecordErrorCode } from '../types';
import { typeDate } from './typeDate';

type Context = components['schemas']['LeaveRequestContextResponse']['message'];
const context: Context = {
  employee: 'HR-EMP-TEST-01',
  employee_name: 'Örnek Kişi 1',
  leave_type: 'Allocated Leave',
  leave_balance: 8.5,
  sources: {
    employee: 'Employee',
    employee_name: 'Employee',
    leave_type: 'Leave Type',
    leave_balance: 'Leave Ledger Entry',
  },
};
const emptyContext: Context = {
  employee: null,
  employee_name: null,
  leave_type: null,
  leave_balance: null,
  sources: { employee: null, employee_name: null, leave_type: null, leave_balance: null },
};
const meta: DocTypeMeta = {
  ...LEAVE_META,
  schema: {
    ...LEAVE_META.schema,
    fields: LEAVE_META.schema.fields.map((field) => ({
      ...field,
      default: undefined,
      description:
        field.fieldname === 'employee_name' || field.fieldname === 'leave_balance'
          ? undefined
          : field.description,
      // The context must protect calculated values even if metadata is writable.
      read_only: false,
    })),
  },
};
function setup(body: unknown = { message: context }) {
  const frappeDocument = vi.fn(async (_request: DocumentRequest) => ({
    ok: true as const,
    status: 200,
    body,
    etag: undefined,
  }));
  const real = createFrappeRecordAdapter({ api: { frappeDocument } });
  const adapter: RecordDataAdapter = {
    ...real,
    getDocTypeMeta: vi.fn(async () => meta),
    getRecord: vi.fn(async () => ({
      name: 'SAMPLE-LEAVE-1',
      employee_name: 'Örnek Kişi 2',
      leave_balance: '3',
    })),
    saveRecord: vi.fn(async (params) => ({ name: 'SAMPLE-LEAVE-1', ...params.data })),
    searchLink: vi.fn(async () => []),
  };
  return { adapter, frappeDocument };
}
function mount(adapter: RecordDataAdapter) {
  return render(<RecordView doctype="Leave Application" createMode adapter={adapter} />);
}

describe('new record prefill', () => {
  it.each([
    ['tr', 'Size ayrılan izin hakkından geldi.'],
    ['en', 'From your leave allocation.'],
  ] as const)(
    'fills the allocated leave type and explains its source (%s)',
    async (locale, note) => {
      const { adapter } = setup({
        message: {
          ...context,
          sources: { ...context.sources, leave_type: 'Leave Allocation' },
        },
      });
      render(
        <RecordView doctype="Leave Application" createMode locale={locale} adapter={adapter} />,
      );
      const type = await screen.findByRole('combobox', { name: /İzin türü/ });
      expect(type).toHaveAccessibleDescription(note);
      expect(
        within(type.closest('.rv-field') as HTMLElement).getByText('Yıllık izin'),
      ).toBeVisible();
      expect(screen.getByLabelText('Kalan yıllık izin')).toHaveValue(
        locale === 'tr' ? '8,5 gün' : '8.5 days',
      );
    },
  );

  it('leaves a null type and balance empty and submits the user choice', async () => {
    const { adapter } = setup({
      message: {
        ...context,
        leave_type: null,
        leave_balance: null,
        sources: { ...context.sources, leave_type: null, leave_balance: null },
      },
    });
    mount({
      ...adapter,
      getDocTypeMeta: async () => ({
        ...meta,
        schema: {
          ...meta.schema,
          fields: meta.schema.fields.map((field) => ({
            ...field,
            default: field.fieldname === 'leave_type' ? context.leave_type : field.default,
          })),
        },
      }),
    });
    expect(await screen.findByLabelText('Ad')).toHaveValue('Örnek Kişi 1');
    const type = screen.getByRole('combobox', { name: /İzin türü/ });
    expect(type).toHaveValue('');
    const typeField = within(type.closest('.rv-field') as HTMLElement);
    expect(typeField.queryByText('Yıllık izin')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Kalan yıllık izin')).toHaveValue('');
    expect(screen.queryByText('İzin kayıtlarından hesaplandı.')).not.toBeInTheDocument();
    await userEvent.click(type);
    await userEvent.click(await screen.findByText('Mazeret izni'));
    expect(typeField.getByTitle('Mazeret izni')).toBeVisible();
    expect(type).not.toHaveAccessibleDescription();
    typeDate(screen.getByLabelText(/Başlangıç tarihi/), '27.11.2026');
    typeDate(screen.getByLabelText(/Bitiş tarihi/), '28.11.2026');
    await userEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(adapter.saveRecord).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ leave_type: 'Casual Leave' }) }),
    );
    expect(vi.mocked(adapter.saveRecord).mock.calls[0]?.[0].data).not.toHaveProperty(
      'leave_balance',
    );
  });

  it('loads session defaults through the shared client and links both source notes', async () => {
    const { adapter, frappeDocument } = setup();
    mount(adapter);
    expect(await screen.findByLabelText('Ad')).toHaveValue('Örnek Kişi 1');
    expect(screen.getByLabelText('Ad')).toHaveAccessibleDescription('Personel kaydından geldi.');
    expect(screen.getByLabelText('Kalan yıllık izin')).toHaveValue('8,5 gün');
    expect(screen.getByLabelText('Kalan yıllık izin')).toHaveAccessibleDescription(
      'İzin kayıtlarından hesaplandı.',
    );
    expect(screen.getByLabelText('Kalan yıllık izin')).toHaveAttribute('readonly');
    expect(screen.getByRole('combobox', { name: /İzin türü/ })).toHaveAccessibleDescription(
      'İzin türü kaydından geldi.',
    );
    expect(frappeDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/api/method/hrms_tr.api.get_leave_request_context',
        signal: expect.any(AbortSignal),
      }),
    );
    expect(frappeDocument.mock.calls[0]?.[0]).not.toHaveProperty('query');
    expect(adapter.getRecord).not.toHaveBeenCalled();
  });

  it('removes provenance after a user edit, even when the user retypes the same value', async () => {
    const { adapter } = setup();
    mount(adapter);
    const name = await screen.findByLabelText('Ad');
    fireEvent.change(name, { target: { value: 'Örnek Kişi 2' } });
    expect(name).not.toHaveAccessibleDescription('Personel kaydından geldi.');
    fireEvent.change(name, { target: { value: 'Örnek Kişi 1' } });
    expect(screen.queryByText('Personel kaydından geldi.')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Açıklama'), { target: { value: 'Örnek açıklama' } });
    expect(screen.getByLabelText('Açıklama')).toHaveAccessibleDescription(
      'Yöneticiniz bu metni okur.',
    );
  });

  it.each([null, 0])('distinguishes a missing balance from zero (%s)', async (balance) => {
    const { adapter } = setup({
      message: {
        ...emptyContext,
        leave_balance: balance,
        sources: {
          ...emptyContext.sources,
          leave_balance: balance === null ? null : 'Leave Ledger Entry',
        },
      },
    });
    mount(adapter);
    expect(await screen.findByLabelText('Ad')).toHaveValue('');
    expect(screen.queryByText('Personel kaydından geldi.')).not.toBeInTheDocument();
    const control = screen.getByLabelText('Kalan yıllık izin');
    expect(control).toHaveValue(balance === null ? '' : '0 gün');
    if (balance === null)
      expect(screen.queryByText('İzin kayıtlarından hesaplandı.')).not.toBeInTheDocument();
    else expect(control).toHaveAccessibleDescription('İzin kayıtlarından hesaplandı.');
  });

  it('leaves fields empty when the adapter has no context operation', async () => {
    const { adapter } = setup();
    mount({ ...adapter, getNewRecordContext: undefined });
    expect(await screen.findByLabelText('Ad')).toHaveValue('');
    expect(screen.getByLabelText('Kalan yıllık izin')).toHaveValue('');
    expect(screen.queryByText('Personel kaydından geldi.')).not.toBeInTheDocument();
  });

  it.each<[RecordErrorCode, number | undefined]>([
    ['network', undefined],
    ['unauthorized', 401],
    ['unauthorized', 403],
    ['validation', 417],
  ])('opens an empty form after an optional context error (%s, %s)', async (code, status) => {
    const { adapter } = setup();
    mount({
      ...adapter,
      getDocTypeMeta: async () => LEAVE_META,
      getNewRecordContext: async () => {
        throw new RecordApiError({ code, status, message: 'Context request failed' });
      },
    });
    expect(await screen.findByLabelText('Ad')).toHaveValue('');
    expect(screen.getByLabelText('Kalan yıllık izin')).toHaveValue('');
    expect(screen.getByLabelText('Kalan yıllık izin')).toHaveAttribute('readonly');
    expect(document.querySelector('.rv-field-source')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Açıklama'), { target: { value: 'İzin talebim.' } });
    expect(screen.getByLabelText('Açıklama')).toHaveValue('İzin talebim.');
    expect(screen.getByRole('button', { name: 'Kaydet' })).toBeEnabled();
  });

  it('preserves the sign-in flow when the session expires during context loading', async () => {
    const { adapter } = setup();
    const onSignIn = vi.fn();
    render(
      <RecordView
        doctype="Leave Application"
        createMode
        onSignIn={onSignIn}
        adapter={{
          ...adapter,
          getNewRecordContext: async () => {
            throw new RecordApiError({ code: 'session_expired', status: 401, message: 'Expired' });
          },
        }}
      />,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Yeniden giriş yap' }));
    expect(onSignIn).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText('Ad')).not.toBeInTheDocument();
  });

  it('still rejects missing metadata permissions when optional context is unavailable', async () => {
    const { adapter } = setup();
    mount({
      ...adapter,
      getDocTypeMeta: async () => {
        throw new RecordApiError({ code: 'unauthorized', status: 403, message: 'Forbidden' });
      },
      getNewRecordContext: async () => {
        throw new RecordApiError({ code: 'network', message: 'Offline' });
      },
    });
    expect(await screen.findByText('Bu kaydı görüntüleme yetkiniz bulunmuyor.')).toBeVisible();
    expect(screen.queryByLabelText('Ad')).not.toBeInTheDocument();
  });

  it.each(['Data', 'Float'])(
    'formats a %s balance with the current language and day unit',
    async (fieldtype) => {
      const { adapter } = setup();
      const numericMeta = {
        ...meta,
        schema: {
          ...meta.schema,
          fields: meta.schema.fields.map((field) =>
            field.fieldname === 'leave_balance'
              ? { ...field, fieldtype, component: fieldtype === 'Float' ? 'float' : 'input' }
              : field,
          ),
        },
      };
      render(
        <RecordView
          doctype="Leave Application"
          createMode
          locale="en"
          adapter={{ ...adapter, getDocTypeMeta: async () => numericMeta }}
        />,
      );
      expect(await screen.findByLabelText('Kalan yıllık izin')).toHaveValue('8.5 days');
      expect(screen.getByLabelText('Kalan yıllık izin')).toHaveAttribute('readonly');
    },
  );

  it('does not prefill an existing record', async () => {
    const { adapter, frappeDocument } = setup();
    render(<RecordView doctype="Leave Application" name="SAMPLE-LEAVE-1" adapter={adapter} />);
    expect(await screen.findByLabelText('Ad')).toHaveValue('Örnek Kişi 2');
    expect(frappeDocument).not.toHaveBeenCalled();
    expect(screen.queryByText('Personel kaydından geldi.')).not.toBeInTheDocument();
  });

  it('ignores a late context response after switching records', async () => {
    const { adapter } = setup();
    let resolve!: (value: undefined) => void;
    const pending = new Promise<undefined>((done) => {
      resolve = done;
    });
    const getNewRecordContext = vi.fn(() => pending);
    const delayed = { ...adapter, getNewRecordContext };
    const view = mount(delayed);
    await waitFor(() => expect(getNewRecordContext).toHaveBeenCalled());
    view.rerender(
      <RecordView doctype="Leave Application" name="SAMPLE-LEAVE-1" adapter={delayed} />,
    );
    expect(await screen.findByLabelText('Ad')).toHaveValue('Örnek Kişi 2');
    await act(async () => resolve(undefined));
    expect(screen.getByLabelText('Ad')).toHaveValue('Örnek Kişi 2');
  });

  it('preserves values while submitting but never writes the computed balance', async () => {
    const { adapter } = setup();
    mount(adapter);
    await screen.findByLabelText('Ad');
    typeDate(screen.getByLabelText(/Başlangıç tarihi/), '27.11.2026');
    typeDate(screen.getByLabelText(/Bitiş tarihi/), '28.11.2026');
    await userEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(adapter.saveRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employee_name: 'Örnek Kişi 1',
          leave_type: 'Allocated Leave',
        }),
      }),
    );
    expect(vi.mocked(adapter.saveRecord).mock.calls[0]?.[0].data).not.toHaveProperty(
      'leave_balance',
    );
    expect(screen.queryByText('Personel kaydından geldi.')).not.toBeInTheDocument();
  });
});

describe('prefill response validation', () => {
  it.each([
    {},
    { message: { ...context, leave_balance: '8.5' } },
    { message: { ...context, leave_balance: Number.NaN } },
    { message: { ...context, sources: { ...context.sources, employee_name: 'Other' } } },
    { message: { ...context, sources: { ...context.sources, leave_type: 'Other' } } },
    { message: { ...context, sources: { ...context.sources, leave_balance: 'Leave Allocation' } } },
  ])('rejects invalid context without inventing defaults', async (body) => {
    const { adapter } = setup(body);
    mount(adapter);
    expect(await screen.findByText('Sunucu yanıtı beklenen sözleşmeyle uyuşmadı.')).toBeVisible();
    expect(screen.queryByLabelText('Ad')).not.toBeInTheDocument();
  });

  it('does not fill a value whose source is null', async () => {
    const { adapter } = setup({
      message: { ...context, sources: { ...context.sources, employee_name: null } },
    });
    mount(adapter);
    expect(await screen.findByLabelText('Ad')).toHaveValue('');
    expect(screen.queryByText('Personel kaydından geldi.')).not.toBeInTheDocument();
  });
});

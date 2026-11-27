import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/errors';
import type { DocTypeMeta } from '@/api';
import { ModuleProvider, type DataTransferClient, type ModuleClient } from '../runtime';
import DataTransferPage from './Page';
import * as download from './download';

const meta: DocTypeMeta = {
  catalog_version: 2,
  child_tables: {},
  meta_hash: 'a'.repeat(64),
  perm_version: 'b'.repeat(64),
  mobile_cache_allowed: false,
  schema: {
    name: 'Employee',
    module: 'HR',
    sensitivity: 'standard',
    title_field: null,
    search_fields: '',
    sort_field: null,
    fields: [
      {
        fieldname: 'employee_name',
        fieldtype: 'Data',
        label: 'Full name',
        component: null,
        read_only: false,
        sensitivity: 'standard',
      },
    ],
  },
};

function fake(overrides: Partial<DataTransferClient> = {}): DataTransferClient {
  return {
    listDoctypes: vi.fn().mockResolvedValue(['Employee']),
    getMeta: vi.fn().mockResolvedValue(meta),
    listRows: vi.fn().mockResolvedValue({
      rows: [{ name: 'E-1', employee_name: 'Örnek Kişi', salary: 99000 }],
      truncated: false,
    }),
    prepareImport: vi.fn().mockResolvedValue({
      name: 'IMP-1',
      preview: {
        columns: [
          { index: 0, header: 'Full name', field: 'employee_name' },
          { index: 1, header: 'Extra', field: null },
        ],
        rows: 2,
      },
    }),
    startImport: vi.fn().mockResolvedValue(undefined),
    importResult: vi.fn().mockResolvedValue({
      status: 'Partial Success',
      failures: [{ rows: [3], messages: ['Full name zorunludur'] }],
    }),
    requestPersonalData: vi.fn().mockResolvedValue({ name: 'PDR-1' }),
    ...overrides,
  };
}

function renderPage(client: DataTransferClient | undefined) {
  const moduleClient: ModuleClient = client ? { dataTransfer: () => Promise.resolve(client) } : {};
  return render(
    <ModuleProvider
      value={{
        tenant: 'example-site',
        user: 'user@example.invalid',
        mode: 'example',
        client: moduleClient,
      }}
    >
      <DataTransferPage />
    </ModuleProvider>,
  );
}

async function choose(label: string, option: string) {
  const select = screen.getByLabelText(label);
  fireEvent.mouseDown(select);
  const items = await screen.findAllByText(option, { selector: '.ant-select-item-option-content' });
  fireEvent.click(items[items.length - 1]!);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Veri aktarımı sayfası', () => {
  it('şablonu kayıt türünün yazılabilir alanlarıyla indirir', async () => {
    const save = vi.spyOn(download, 'saveTextFile').mockImplementation(() => undefined);
    renderPage(fake());
    const section = await screen.findByRole('region', { name: 'İçe aktar' });
    await choose('İçe aktarılacak kayıt türü', 'Employee');
    fireEvent.click(within(section).getByRole('button', { name: 'Şablonu indir' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith('Employee-sablon.csv', 'Full name'));
  });

  it('dosyayı yükler, sütunları eşler, aktarımı başlatır ve hatalı satırı gösterir', async () => {
    const client = fake();
    renderPage(client);
    const section = await screen.findByRole('region', { name: 'İçe aktar' });
    await choose('İçe aktarılacak kayıt türü', 'Employee');
    const file = new File(['Full name\nA'], 'veri.csv', { type: 'text/csv' });
    fireEvent.change(within(section).getByLabelText('Aktarım dosyası'), {
      target: { files: [file] },
    });
    fireEvent.click(within(section).getByRole('button', { name: 'Dosyayı yükle' }));
    expect(await within(section).findByText('Dosyada 2 satır var.')).toBeTruthy();
    expect(client.prepareImport).toHaveBeenCalledWith('Employee', file, expect.anything());
    // İkinci sütun "Aktarma" seçili gelir. Kullanıcı onu alana eşler.
    await choose('“Extra” sütununun alanı', 'Full name');
    fireEvent.click(within(section).getByRole('button', { name: 'Aktarımı başlat' }));
    await waitFor(() =>
      expect(client.startImport).toHaveBeenCalledWith(
        'IMP-1',
        { 0: 'employee_name', 1: 'employee_name' },
        expect.anything(),
      ),
    );
    fireEvent.click(await within(section).findByRole('button', { name: 'Sonucu göster' }));
    const report = await within(section).findByRole('list', { name: 'Hata raporu' });
    expect(within(report).getByText('Satır 3: Full name zorunludur')).toBeTruthy();
    expect(
      within(section).getByText('Aktarım kısmen bitti. Hatalı satırlar aşağıdadır.'),
    ).toBeTruthy();
  });

  it('dışa aktarımda yalnız okunabilir alanları dosyaya yazar', async () => {
    const save = vi.spyOn(download, 'saveTextFile').mockImplementation(() => undefined);
    const client = fake();
    renderPage(client);
    const section = await screen.findByRole('region', { name: 'Dışa aktar' });
    await choose('Dışa aktarılacak kayıt türü', 'Employee');
    fireEvent.click(within(section).getByRole('button', { name: 'CSV indir' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(client.listRows).toHaveBeenCalledWith(
      'Employee',
      ['name', 'employee_name'],
      expect.anything(),
    );
    const [name, content] = save.mock.calls[0]!;
    expect(name).toBe('Employee.csv');
    expect(content).toBe('ID,Full name\r\nE-1,Örnek Kişi');
    expect(content).not.toContain('99000');
    expect(within(section).getByText('1 kayıt indirildi.')).toBeTruthy();
  });

  it('kişisel veri talebini oturumdaki kullanıcı için bir kez açar', async () => {
    const client = fake();
    renderPage(client);
    const section = await screen.findByRole('region', { name: 'Kişisel verilerim' });
    const button = within(section).getByRole('button', { name: 'Verilerimi iste' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(
      await within(section).findByText(
        'Talebiniz alındı. Dosya hazır olunca e-posta adresinize bağlantı gelir.',
      ),
    ).toBeTruthy();
    expect(client.requestPersonalData).toHaveBeenCalledTimes(1);
    expect(client.requestPersonalData).toHaveBeenCalledWith(
      'user@example.invalid',
      expect.anything(),
    );
  });

  it('kayıt türü listesine yetki yoksa içe ve dışa aktarımı açmaz, kişisel veri talebi kalır', async () => {
    renderPage(
      fake({
        listDoctypes: vi.fn().mockRejectedValue(new ApiError({ kind: 'forbidden', status: 403 })),
      }),
    );
    const section = await screen.findByRole('region', { name: 'İçe aktar' });
    expect(await within(section).findByRole('alert')).toBeTruthy();
    expect(within(section).queryByRole('button', { name: 'Şablonu indir' })).toBeNull();
    const own = screen.getByRole('region', { name: 'Kişisel verilerim' });
    expect(within(own).getByRole('button', { name: 'Verilerimi iste' })).toBeTruthy();
  });
});

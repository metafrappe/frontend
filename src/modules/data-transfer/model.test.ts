import { describe, expect, it } from 'vitest';
import type { DocTypeMeta } from '@/api';
import {
  SKIP_COLUMN,
  exportColumns,
  parseImportLogs,
  parsePreview,
  templateColumns,
  templateOptions,
  toCsv,
} from './model';

type Field = DocTypeMeta['schema']['fields'][number];
const field = (fieldname: string, fieldtype: string, extra: Partial<Field> = {}): Field => ({
  fieldname,
  fieldtype,
  label: fieldname.toUpperCase(),
  component: null,
  read_only: false,
  sensitivity: 'standard',
  ...extra,
});

/** Sunucu tanımı yalnız kullanıcının okuyabildiği alanları verir. `salary` burada yoktur. */
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
    title_field: 'employee_name',
    search_fields: '',
    sort_field: null,
    fields: [
      field('details', 'Section Break'),
      field('employee_name', 'Data', { label: 'Full name', reqd: true }),
      field('col', 'Column Break'),
      field('status', 'Select', { label: 'Status' }),
      field('age', 'Int', { label: 'Age', read_only: true }),
      field('secret', 'Password', { label: 'Secret' }),
      field('items', 'Table', { label: 'Items' }),
    ],
  },
};

describe('dışa aktarım sütunları', () => {
  it('yalnız sunucunun okunabilir dediği değer alanlarını alır', () => {
    expect(exportColumns(meta).map((c) => c.fieldname)).toEqual([
      'name',
      'employee_name',
      'status',
      'age',
    ]);
  });

  it('yetkisi olmayan alan, sunucu satırda gönderse bile dosyaya yazılmaz', () => {
    const csv = toCsv(exportColumns(meta), [
      { name: 'E-1', employee_name: 'Örnek Kişi', status: 'Active', age: 30, salary: 99000 },
    ]);
    expect(csv).not.toMatch(/salary|99000/);
    expect(csv.split('\r\n')[0]).toBe('ID,Full name,Status,Age');
    expect(csv.split('\r\n')[1]).toBe('E-1,Örnek Kişi,Active,30');
  });

  it('virgül, tırnak ve satır sonunu kaçışlar; formül gibi başlayan metni etkisizleştirir', () => {
    const csv = toCsv(
      [
        { fieldname: 'a', label: 'A' },
        { fieldname: 'b', label: 'B' },
      ],
      [{ a: 'x, "y"\nz', b: '=HYPERLINK("http://example.invalid")' }],
    );
    expect(csv).toBe('A,B\r\n"x, ""y""\nz","\'=HYPERLINK(""http://example.invalid"")"');
  });

  it('boş ve eksik değer boş hücre olur, sayı olduğu gibi kalır', () => {
    expect(toCsv([{ fieldname: 'n', label: 'N' }], [{ n: -4 }, { n: null }, {}])).toBe(
      'N\r\n-4\r\n\r\n',
    );
  });
});

describe('aktarım şablonu', () => {
  it('yazılabilir değer alanlarını etiketle verir, salt okunur alanı almaz', () => {
    expect(templateColumns(meta)).toEqual([
      { fieldname: 'employee_name', label: 'Full name' },
      { fieldname: 'status', label: 'Status' },
    ]);
  });

  it('aynı etiketli iki alanda alan adını kullanır', () => {
    const twin: DocTypeMeta = {
      ...meta,
      schema: {
        ...meta.schema,
        fields: [field('a', 'Data', { label: 'Ad' }), field('b', 'Data', { label: 'Ad' })],
      },
    };
    expect(templateColumns(twin).map((c) => c.label)).toEqual(['a', 'b']);
  });
});

describe('önizleme ve eşleme', () => {
  it('Frappe önizlemesindeki sütunları ve satır sayısını okur', () => {
    expect(
      parsePreview({
        columns: [
          { header_title: 'Sr. No', skip_import: true },
          { header_title: 'Full name', df: { fieldname: 'employee_name' } },
          { header_title: 'Unknown', skip_import: true },
        ],
        data: [
          [1, 'A', 'x'],
          [2, 'B', 'y'],
        ],
        warnings: [],
      }),
    ).toEqual({
      columns: [
        { index: 0, header: 'Sr. No', field: null },
        { index: 1, header: 'Full name', field: 'employee_name' },
        { index: 2, header: 'Unknown', field: null },
      ],
      rows: 2,
    });
  });

  it('bozuk önizlemeyi reddeder', () => {
    expect(() => parsePreview({ columns: 'x' })).toThrow('invalid_response');
  });

  it('eşlemeyi Frappe template_options biçimine çevirir', () => {
    expect(JSON.parse(templateOptions({ 0: null, 1: 'employee_name' }))).toEqual({
      column_to_field_map: { 0: SKIP_COLUMN, 1: 'employee_name' },
    });
  });
});

describe('hata raporu', () => {
  it('yalnız başarısız satırları satır numarası ve düz metinle verir', () => {
    expect(
      parseImportLogs([
        { success: 1, docname: 'E-1', row_indexes: '[2]', messages: '[]' },
        {
          success: 0,
          row_indexes: '[3, 4]',
          messages: JSON.stringify([
            { title: 'Hata', message: '<b>Full name</b> zorunludur' },
            'İkinci hata',
          ]),
        },
      ]),
    ).toEqual([{ rows: [3, 4], messages: ['Full name zorunludur', 'İkinci hata'] }]);
  });

  it('bozuk günlük satırında genel ileti verir', () => {
    expect(parseImportLogs([{ success: 0, row_indexes: 'x', messages: 'y' }])).toEqual([
      { rows: [], messages: [] },
    ]);
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CatalogField } from '../catalog';
import { frappeToDisplayFormat, resolveDateFormats } from '../dateFormat';
import type { DocField, DocTypeMeta, RecordDataAdapter, SiteFormatting } from '../types';

// Panel sorunu 3: tarih alanı tarayıcının kendi kutusunu kullanıyordu ("11/27/2026").
// Biçim kullanıcının dil ayarından (açılış verisindeki `date_format`) gelmeli.

const META: DocTypeMeta = {
  schema: {
    name: 'Leave Application',
    module: 'HR',
    sensitivity: 'standard',
    fields: [],
    title_field: null,
    search_fields: '',
    sort_field: null,
  },
  child_tables: {},
  catalog_version: 2,
  meta_hash: 'aaaa',
  perm_version: 'bbbb',
  mobile_cache_allowed: false,
};

const adapter: RecordDataAdapter = {
  getDocTypeMeta: vi.fn(),
  getRecord: vi.fn(),
  saveRecord: vi.fn(),
  searchLink: vi.fn(async () => []),
};

const DATE_FIELD: DocField = {
  fieldname: 'from_date',
  fieldtype: 'Date',
  label: 'Başlangıç Tarihi',
  read_only: false,
  component: 'date',
  sensitivity: 'standard',
};

const DATETIME_FIELD: DocField = {
  fieldname: 'posting_time',
  fieldtype: 'Datetime',
  label: 'Kayıt Zamanı',
  read_only: false,
  component: 'datetime',
  sensitivity: 'standard',
};

const TR_FORMATTING: SiteFormatting = {
  time_zone: 'Europe/Istanbul',
  currency: 'TRY',
  number_format: '#.###,##',
  rounding_method: "Banker's Rounding",
  date_format: 'dd.mm.yyyy',
  time_format: 'HH:mm:ss',
  first_day_of_the_week: 'Monday',
};

function renderField(
  field: DocField,
  value: unknown,
  formatting: SiteFormatting | undefined,
  onChange = vi.fn(),
) {
  const view = render(
    <CatalogField
      field={field}
      value={value}
      doc={{ [field.fieldname]: value }}
      doctype="Leave Application"
      meta={META}
      adapter={adapter}
      locale="tr"
      formatting={formatting}
      onChange={onChange}
    />,
  );
  return { ...view, onChange };
}

describe('Frappe tarih kalıbı çevirisi', () => {
  it('Frappe kalıbını gösterim kalıbına çevirir', () => {
    expect(frappeToDisplayFormat('dd.mm.yyyy')).toBe('DD.MM.YYYY');
    expect(frappeToDisplayFormat('mm-dd-yyyy')).toBe('MM-DD-YYYY');
    expect(frappeToDisplayFormat('yyyy-mm-dd')).toBe('YYYY-MM-DD');
    expect(frappeToDisplayFormat('dd/mm/yyyy')).toBe('DD/MM/YYYY');
  });

  it('ayar yoksa Türkçe arayüzde gün önce gelir', () => {
    expect(resolveDateFormats(undefined, 'tr')).toEqual({
      date: 'DD.MM.YYYY',
      time: 'HH:mm:ss',
    });
  });

  it('tanınmayan kalıpta dil varsayılanına döner', () => {
    expect(resolveDateFormats({ ...TR_FORMATTING, date_format: 'garip' }, 'tr').date).toBe(
      'DD.MM.YYYY',
    );
  });
});

describe('Tarih alanı (panel sorunu 3)', () => {
  it('tarayıcının kendi tarih kutusunu kullanmaz', () => {
    const { container } = renderField(DATE_FIELD, '2026-11-27', TR_FORMATTING);
    expect(container.querySelector('input[type="date"]')).toBeNull();
  });

  it('tarihi kullanıcının biçimiyle gösterir: 27.11.2026', () => {
    renderField(DATE_FIELD, '2026-11-27', TR_FORMATTING);
    expect(screen.getByRole('textbox', { name: 'Başlangıç Tarihi' })).toHaveValue('27.11.2026');
  });

  it('ayar yoksa Türkçe varsayılanı kullanır', () => {
    renderField(DATE_FIELD, '2026-11-27', undefined);
    expect(screen.getByRole('textbox', { name: 'Başlangıç Tarihi' })).toHaveValue('27.11.2026');
  });

  it('kullanıcının dil ayarındaki kalıbı izler', () => {
    renderField(DATE_FIELD, '2026-11-27', { ...TR_FORMATTING, date_format: 'mm-dd-yyyy' });
    expect(screen.getByRole('textbox', { name: 'Başlangıç Tarihi' })).toHaveValue('11-27-2026');
  });

  it('klavyeyle yazılan tarihi sunucuya YYYY-MM-DD olarak verir', () => {
    const { onChange } = renderField(DATE_FIELD, '', TR_FORMATTING);
    const input = screen.getByRole('textbox', { name: 'Başlangıç Tarihi' });
    fireEvent.mouseDown(input);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '28.11.2026' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
    expect(onChange).toHaveBeenLastCalledWith('from_date', '2026-11-28');
  });

  it('boş değerde kutu boş kalır', () => {
    renderField(DATE_FIELD, '', TR_FORMATTING);
    expect(screen.getByRole('textbox', { name: 'Başlangıç Tarihi' })).toHaveValue('');
  });
});

describe('Tarih ve saat alanı (panel sorunu 3)', () => {
  it('tarayıcının kendi tarih-saat kutusunu kullanmaz', () => {
    const { container } = renderField(DATETIME_FIELD, '2026-11-27 14:05:00', TR_FORMATTING);
    expect(container.querySelector('input[type="datetime-local"]')).toBeNull();
  });

  it('tarih ve saati kullanıcının biçimiyle gösterir', () => {
    renderField(DATETIME_FIELD, '2026-11-27 14:05:00.000000', TR_FORMATTING);
    expect(screen.getByRole('textbox', { name: 'Kayıt Zamanı' })).toHaveValue(
      '27.11.2026 14:05:00',
    );
  });
});

// G-97 parça 2 (AJA-2492): özelleştirme ekranının kuralları. Test koddan önce yazıldı.
import { describe, expect, it, vi } from 'vitest';

import { moduleAllowed } from '@/shell/nav';
import type { DocTypeMeta, RecordDataAdapter, SaveRecordParams } from '@/views/record';
import { RecordApiError } from '@/views/record';

import {
  CUSTOMIZATION_DOCTYPES,
  CUSTOMIZATION_PATH,
  isSystemField,
  propertySetterName,
  scopedCustomizationAdapter,
  setFieldHidden,
} from './model';

function meta(name: string, fields: { fieldname: string; fieldtype?: string }[]): DocTypeMeta {
  return {
    catalog_version: 2,
    child_tables: {},
    meta_hash: 'd'.repeat(64),
    perm_version: 'e'.repeat(64),
    mobile_cache_allowed: false,
    truncated: false,
    schema: {
      name,
      module: 'Custom',
      title_field: null,
      search_fields: '',
      sort_field: null,
      sensitivity: 'standard',
      fields: fields.map((field) => ({
        fieldname: field.fieldname,
        fieldtype: field.fieldtype ?? 'Data',
        label: field.fieldname,
        read_only: false,
        component: 'input',
        sensitivity: 'standard',
      })),
    },
  } as DocTypeMeta;
}

function fakeAdapter(existing: Record<string, { name: string; modified: string }> = {}) {
  const saved: SaveRecordParams[] = [];
  const adapter: RecordDataAdapter = {
    getDocTypeMeta: vi.fn(async ({ doctype }) => {
      if (doctype === 'Custom Field')
        return meta('Custom Field', [
          { fieldname: 'dt', fieldtype: 'Link' },
          { fieldname: 'label' },
        ]);
      if (doctype === 'Property Setter')
        return meta('Property Setter', [
          { fieldname: 'doctype_or_field' },
          { fieldname: 'doc_type' },
          { fieldname: 'field_name' },
          { fieldname: 'property' },
          { fieldname: 'property_type' },
          { fieldname: 'value' },
        ]);
      return meta(doctype, [{ fieldname: 'label' }]);
    }),
    getRecord: vi.fn(async ({ name }) => {
      const record = existing[name];
      if (!record) throw new RecordApiError({ code: 'not_found', message: 'yok', status: 404 });
      return { ...record };
    }),
    saveRecord: vi.fn(async (params: SaveRecordParams) => {
      saved.push(params);
      return { name: params.name ?? 'YENI', modified: '2026-11-28 10:00:00', ...params.data };
    }),
    searchLink: vi.fn(async () => []),
  };
  return { adapter, saved };
}

const SCOPE = { doctype: 'Örnek Kayıt', protectedFields: new Set(['title']) };

describe('sistem alanları (kabul ölçütü 3)', () => {
  it('Frappe sistem sütunları sistem alanıdır', () => {
    for (const fieldname of [
      'name',
      'owner',
      'creation',
      'modified',
      'modified_by',
      'docstatus',
      'idx',
    ]) {
      expect(isSystemField({ fieldname }, new Set()), fieldname).toBe(true);
    }
  });

  it('zorunlu standart alan sistem alanıdır, zorunlu özel alan değildir', () => {
    expect(isSystemField({ fieldname: 'title', reqd: true }, new Set())).toBe(true);
    expect(isSystemField({ fieldname: 'ek_alan', reqd: true }, new Set(['ek_alan']))).toBe(false);
  });

  it('zorunlu olmayan standart alan değiştirilebilir', () => {
    expect(isSystemField({ fieldname: 'aciklama' }, new Set())).toBe(false);
  });

  it('sistem alanı için gizleme isteği sunucuya gitmez', async () => {
    const { adapter, saved } = fakeAdapter();
    const scoped = scopedCustomizationAdapter(adapter, SCOPE);
    await expect(setFieldHidden(scoped, SCOPE.doctype, 'title', true)).rejects.toBeInstanceOf(
      RecordApiError,
    );
    expect(saved).toEqual([]);
  });

  it('sistem alanı için yeniden adlandırma isteği sunucuya gitmez', async () => {
    const { adapter, saved } = fakeAdapter();
    const scoped = scopedCustomizationAdapter(adapter, { ...SCOPE, field: 'title' });
    await expect(
      scoped.saveRecord({
        doctype: 'Property Setter',
        data: { field_name: 'title', property: 'label', value: 'Yeni ad' },
      }),
    ).rejects.toBeInstanceOf(RecordApiError);
    expect(saved).toEqual([]);
  });

  it('özel alan sistem sütunu adını alamaz', async () => {
    const { adapter, saved } = fakeAdapter();
    const scoped = scopedCustomizationAdapter(adapter, SCOPE);
    await expect(
      scoped.saveRecord({
        doctype: 'Custom Field',
        data: { dt: SCOPE.doctype, label: 'Sahip', fieldname: 'owner', fieldtype: 'Data' },
      }),
    ).rejects.toBeInstanceOf(RecordApiError);
    expect(saved).toEqual([]);
  });

  it('yalnız etiket ve gizlilik değiştirilebilir', async () => {
    const { adapter, saved } = fakeAdapter();
    const scoped = scopedCustomizationAdapter(adapter, { ...SCOPE, field: 'aciklama' });
    await expect(
      scoped.saveRecord({
        doctype: 'Property Setter',
        data: { field_name: 'aciklama', property: 'reqd', value: '0' },
      }),
    ).rejects.toBeInstanceOf(RecordApiError);
    expect(saved).toEqual([]);
  });
});

describe('alan ekleme (kabul ölçütü 1)', () => {
  it('Custom Field formunda belge türü seçili türe kilitlenir', async () => {
    const { adapter } = fakeAdapter();
    const scoped = scopedCustomizationAdapter(adapter, SCOPE);
    const result = await scoped.getDocTypeMeta({ doctype: 'Custom Field' });
    const dt = result.schema.fields.find((field) => field.fieldname === 'dt');
    expect(dt?.default).toBe(SCOPE.doctype);
    expect(dt?.read_only).toBe(true);
  });

  it('kayıt isteği başka belge türüne yazamaz', async () => {
    const { adapter, saved } = fakeAdapter();
    const scoped = scopedCustomizationAdapter(adapter, SCOPE);
    await scoped.saveRecord({
      doctype: 'Custom Field',
      data: { dt: 'User', label: 'Ek alan', fieldtype: 'Data' },
    });
    expect(saved[0]?.data['dt']).toBe(SCOPE.doctype);
  });
});

describe('yeniden adlandırma ve gizleme (kabul ölçütü 2)', () => {
  it('Property Setter formunda yalnız yeni değer düzenlenir', async () => {
    const { adapter } = fakeAdapter();
    const scoped = scopedCustomizationAdapter(adapter, { ...SCOPE, field: 'aciklama' });
    const result = await scoped.getDocTypeMeta({ doctype: 'Property Setter' });
    const editable = result.schema.fields.filter((field) => !field.hidden && !field.read_only);
    expect(editable.map((field) => field.fieldname)).toEqual(['value']);
    const byName = Object.fromEntries(result.schema.fields.map((f) => [f.fieldname, f.default]));
    expect(byName).toMatchObject({
      doctype_or_field: 'DocField',
      doc_type: SCOPE.doctype,
      field_name: 'aciklama',
      property: 'label',
      property_type: 'Data',
    });
  });

  it('Property Setter adı Frappe biçimindedir', () => {
    expect(propertySetterName('Örnek Kayıt', 'aciklama', 'hidden')).toBe(
      'Örnek Kayıt-aciklama-hidden',
    );
  });

  it('gizleme yeni Property Setter kaydı açar', async () => {
    const { adapter, saved } = fakeAdapter();
    const scoped = scopedCustomizationAdapter(adapter, SCOPE);
    await setFieldHidden(scoped, SCOPE.doctype, 'aciklama', true);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.name).toBeUndefined();
    expect(saved[0]?.data).toMatchObject({
      doctype_or_field: 'DocField',
      doc_type: SCOPE.doctype,
      field_name: 'aciklama',
      property: 'hidden',
      property_type: 'Check',
      value: '1',
    });
  });

  it('kayıt zaten varsa sürümüyle günceller', async () => {
    const name = propertySetterName(SCOPE.doctype, 'aciklama', 'hidden');
    const { adapter, saved } = fakeAdapter({
      [name]: { name, modified: '2026-11-27 09:00:00' },
    });
    const scoped = scopedCustomizationAdapter(adapter, SCOPE);
    await setFieldHidden(scoped, SCOPE.doctype, 'aciklama', false);
    expect(saved[0]?.name).toBe(name);
    expect(saved[0]?.modified).toBe('2026-11-27 09:00:00');
    expect(saved[0]?.data['value']).toBe('0');
  });
});

describe('sayfa kapısı (kabul ölçütü 5)', () => {
  it('sayfa üç türün okuma yetkisini ister', () => {
    expect([...CUSTOMIZATION_DOCTYPES].sort()).toEqual(
      ['Custom Field', 'Property Setter', 'Workspace'].sort(),
    );
  });

  it('yetkisi olmayan kullanıcı sayfayı açamaz', () => {
    expect(moduleAllowed(CUSTOMIZATION_PATH, new Set(['Leave Application']))).toBe(false);
    expect(moduleAllowed(CUSTOMIZATION_PATH, new Set(['Custom Field', 'Property Setter']))).toBe(
      false,
    );
  });

  it('üç türü okuyabilen yönetici sayfayı açar', () => {
    expect(moduleAllowed(CUSTOMIZATION_PATH, new Set(CUSTOMIZATION_DOCTYPES))).toBe(true);
  });
});

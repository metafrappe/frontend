/**
 * Özelleştirme ekranının kuralları (G-97 parça 2, AJA-2492).
 * Alan ekleme `Custom Field`, gizleme ve yeniden adlandırma `Property Setter` kaydıyla yapılır.
 * Kenar menüsü `Workspace` kaydıyla düzenlenir. Formları kayıt katmanı türün tanımından çizer.
 * Bu dosya kayıt katmanının bağdaştırıcısını sarar. Sarmal iki iş yapar:
 * 1. Formdaki sabit alanları seçili türe ve alana kilitler.
 * 2. Sistem alanına giden yazma isteğini sunucuya göndermeden reddeder.
 * Yetkiyi sunucu yine her istekte denetler. Bu süzgeç yalnız ekranı korur.
 */
import type { DocField, DocTypeMeta, RecordDataAdapter, SaveRecordParams } from '@/views/record';
import { RecordApiError } from '@/views/record';

export const CUSTOMIZATION_PATH = '/administration/customization';
export const CUSTOM_FIELD_DOCTYPE = 'Custom Field';
export const PROPERTY_SETTER_DOCTYPE = 'Property Setter';
export const WORKSPACE_DOCTYPE = 'Workspace';
/** Sayfa bu üç türü okuyabilen kişiye açılır (G-94). Kodda rol adı yoktur. */
export const CUSTOMIZATION_DOCTYPES = [
  CUSTOM_FIELD_DOCTYPE,
  PROPERTY_SETTER_DOCTYPE,
  WORKSPACE_DOCTYPE,
] as const;

/** Frappe'nin her türe eklediği sütunlar. Örnek: `owner`, `modified`. */
const FRAPPE_SYSTEM_FIELDNAMES: ReadonlySet<string> = new Set([
  'name',
  'owner',
  'creation',
  'modified',
  'modified_by',
  'docstatus',
  'idx',
  'parent',
  'parentfield',
  'parenttype',
  'amended_from',
  'naming_series',
  'doctype',
]);

/** Yalnız bu iki özellik değişir: görünen ad ve gizlilik. */
const EDITABLE_PROPERTIES: Readonly<Record<string, string>> = { label: 'Data', hidden: 'Check' };

/**
 * Sistem alanı değiştirilemez. Sistem alanları şunlardır:
 * - Frappe'nin sistem sütunları. Örnek: `owner`.
 * - Türün kendi zorunlu alanları. Bu alan gizlenirse kayıt kaydedilemez.
 * Kiracının eklediği özel alan zorunlu olsa da değiştirilebilir.
 */
export function isSystemField(
  field: Pick<DocField, 'fieldname'> & { reqd?: boolean | undefined },
  customFieldnames: ReadonlySet<string>,
): boolean {
  if (FRAPPE_SYSTEM_FIELDNAMES.has(field.fieldname)) return true;
  if (customFieldnames.has(field.fieldname)) return false;
  return field.reqd === true;
}

/** Frappe `Property Setter` kaydına bu adı verir: tür, alan ve özellik. */
export function propertySetterName(doctype: string, fieldname: string, property: string): string {
  return `${doctype}-${fieldname}-${property}`;
}

export interface CustomizationScope {
  /** Değiştirilen belge türü. */
  doctype: string;
  /** Yeniden adlandırılan alan. Yalnız ad formunda verilir. */
  field?: string | undefined;
  /** Değiştirilemeyen alan adları. */
  protectedFields: ReadonlySet<string>;
  /** Ad formundaki değer alanının görünen adı. Örnek: "Yeni ad". */
  valueLabel?: string | undefined;
}

function refuse(message: string): never {
  throw new RecordApiError({ code: 'validation', message });
}

function withFields(meta: DocTypeMeta, change: (field: DocField) => DocField): DocTypeMeta {
  return { ...meta, schema: { ...meta.schema, fields: meta.schema.fields.map(change) } };
}

function lockField(field: DocField, value: string, hidden: boolean): DocField {
  return { ...field, default: value, read_only: true, reqd: false, hidden };
}

function lockedMeta(meta: DocTypeMeta, scope: CustomizationScope): DocTypeMeta {
  if (meta.schema.name === CUSTOM_FIELD_DOCTYPE) {
    return withFields(meta, (field) =>
      field.fieldname === 'dt' ? lockField(field, scope.doctype, false) : field,
    );
  }
  if (meta.schema.name === PROPERTY_SETTER_DOCTYPE) {
    const locked: Readonly<Record<string, string>> = {
      doctype_or_field: 'DocField',
      doc_type: scope.doctype,
      field_name: scope.field ?? '',
      property: 'label',
      property_type: 'Data',
    };
    return withFields(meta, (field) => {
      const value = locked[field.fieldname];
      if (value !== undefined) return lockField(field, value, true);
      if (field.fieldname === 'value') {
        return { ...field, reqd: true, ...(scope.valueLabel ? { label: scope.valueLabel } : {}) };
      }
      // Ad formunda yalnız yeni değer görünür. Öteki alanlar formdan çıkar.
      return { ...field, hidden: true, read_only: true, reqd: false };
    });
  }
  return meta;
}

async function existingVersion(
  adapter: RecordDataAdapter,
  name: string,
  signal: AbortSignal | undefined,
): Promise<string | undefined> {
  try {
    const record = await adapter.getRecord({ doctype: PROPERTY_SETTER_DOCTYPE, name, signal });
    return typeof record['modified'] === 'string' ? record['modified'] : undefined;
  } catch (error) {
    if (error instanceof RecordApiError && error.code === 'not_found') return undefined;
    throw error;
  }
}

async function savePropertySetter(
  adapter: RecordDataAdapter,
  scope: CustomizationScope,
  params: SaveRecordParams,
) {
  const fieldname = String(params.data['field_name'] ?? scope.field ?? '');
  const property = String(params.data['property'] ?? 'label');
  if (!fieldname || scope.protectedFields.has(fieldname) || FRAPPE_SYSTEM_FIELDNAMES.has(fieldname))
    refuse('Sistem alanı değiştirilemez.');
  const propertyType = EDITABLE_PROPERTIES[property];
  if (!propertyType) refuse('Bu özellik bu ekrandan değiştirilemez.');
  const data = {
    ...params.data,
    doctype_or_field: 'DocField',
    doc_type: scope.doctype,
    field_name: fieldname,
    property,
    property_type: propertyType,
  };
  // Aynı alanın aynı özelliği için tek kayıt vardır. Kayıt varsa sürümüyle güncellenir.
  const name = propertySetterName(scope.doctype, fieldname, property);
  const modified = await existingVersion(adapter, name, params.signal);
  return adapter.saveRecord({
    doctype: PROPERTY_SETTER_DOCTYPE,
    data,
    signal: params.signal,
    ...(modified ? { name, modified } : {}),
  });
}

/** Kayıt katmanının bağdaştırıcısını seçili türe ve alana kilitler. */
export function scopedCustomizationAdapter(
  adapter: RecordDataAdapter,
  scope: CustomizationScope,
): RecordDataAdapter {
  return {
    ...adapter,
    getNewRecordContext: undefined,
    async getDocTypeMeta(params) {
      return lockedMeta(await adapter.getDocTypeMeta(params), scope);
    },
    async saveRecord(params) {
      if (params.doctype === PROPERTY_SETTER_DOCTYPE)
        return savePropertySetter(adapter, scope, params);
      if (params.doctype === CUSTOM_FIELD_DOCTYPE && !params.name) {
        const fieldname = params.data['fieldname'];
        if (typeof fieldname === 'string' && FRAPPE_SYSTEM_FIELDNAMES.has(fieldname))
          refuse('Bu ad bir sistem alanına aittir.');
        return adapter.saveRecord({ ...params, data: { ...params.data, dt: scope.doctype } });
      }
      return adapter.saveRecord(params);
    },
  };
}

/** Alanı gizler ya da yeniden gösterir. Sistem alanında istek sunucuya gitmez. */
export function setFieldHidden(
  adapter: RecordDataAdapter,
  doctype: string,
  fieldname: string,
  hidden: boolean,
  signal?: AbortSignal,
) {
  return adapter.saveRecord({
    doctype: PROPERTY_SETTER_DOCTYPE,
    data: {
      doc_type: doctype,
      field_name: fieldname,
      property: 'hidden',
      value: hidden ? '1' : '0',
    },
    signal,
  });
}

/** Alan listesinde yerleşim satırları yoktur. Örnek: `Section Break`. */
const LAYOUT_TYPES = new Set(['Section Break', 'Column Break', 'Tab Break', 'Fold']);

export interface FieldRow {
  fieldname: string;
  label: string;
  fieldtype: string;
  hidden: boolean;
  system: boolean;
}

export function fieldRows(meta: DocTypeMeta, customFieldnames: ReadonlySet<string>): FieldRow[] {
  return meta.schema.fields
    .filter((field) => !LAYOUT_TYPES.has(field.fieldtype))
    .map((field) => ({
      fieldname: field.fieldname,
      label: field.label?.trim() || field.fieldname,
      fieldtype: field.fieldtype,
      hidden: field.hidden === true,
      system: isSystemField(field, customFieldnames),
    }));
}

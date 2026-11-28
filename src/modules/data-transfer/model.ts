// Veri aktarımı sayfasının saf işlevleri (G-97 parça 3, AJA-2493).
//
// Alan listesi sunucunun tanım ucundan gelir (`platform_core.api.meta.get_doctype`).
// Uç yalnız kullanıcının okuyabildiği alanları verir. Dışa aktarım yalnız bu alanları yazar.
// Sunucu satırda fazladan alan gönderse bile o alan dosyaya girmez.
import type { DocTypeMeta } from '@/api';

export interface DataColumn {
  fieldname: string;
  label: string;
}

/** Değer taşımayan ya da dışa aktarılmayan alan türleri. Parola hiçbir zaman yazılmaz. */
const NO_VALUE_TYPES = new Set([
  'Section Break',
  'Column Break',
  'Tab Break',
  'HTML',
  'Button',
  'Image',
  'Fold',
  'Heading',
  'Table',
  'Table MultiSelect',
  'Password',
]);

/** Frappe sütun eşlemesinde "bu sütunu aktarma" değeri. */
export const SKIP_COLUMN = "Don't Import";

type Field = DocTypeMeta['schema']['fields'][number];

const valueFields = (meta: DocTypeMeta): Field[] =>
  meta.schema.fields.filter((field) => !NO_VALUE_TYPES.has(field.fieldtype));

const labelOf = (field: Field) => field.label?.trim() || field.fieldname;

/** Dışa aktarım sütunları. İlk sütun kayıt kimliğidir. Kalanlar okunabilir değer alanlarıdır. */
export function exportColumns(meta: DocTypeMeta): DataColumn[] {
  return [
    { fieldname: 'name', label: 'ID' },
    ...valueFields(meta).map((field) => ({ fieldname: field.fieldname, label: labelOf(field) })),
  ];
}

/**
 * Aktarım şablonunun sütunları. Yalnız yazılabilir değer alanları girer.
 * Frappe sütun başlığını etiketle ya da alan adıyla eşler. Etiket iki alanda aynıysa alan adı yazılır.
 */
export function templateColumns(meta: DocTypeMeta): DataColumn[] {
  const fields = valueFields(meta).filter((field) => !field.read_only);
  const counts = new Map<string, number>();
  for (const field of fields) counts.set(labelOf(field), (counts.get(labelOf(field)) ?? 0) + 1);
  return fields.map((field) => ({
    fieldname: field.fieldname,
    label: counts.get(labelOf(field)) === 1 ? labelOf(field) : field.fieldname,
  }));
}

/** Tablo programında formül gibi çalışabilecek başlangıçlar. */
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  let text = typeof value === 'string' ? value : JSON.stringify(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV metni üretir. Satırdan yalnız verilen sütunlar okunur. Satır sonu CRLF olur. */
export function toCsv(columns: readonly DataColumn[], rows: readonly Record<string, unknown>[]) {
  const lines = [columns.map((column) => cell(column.label)).join(',')];
  for (const row of rows)
    lines.push(columns.map((column) => cell(row[column.fieldname])).join(','));
  return lines.join('\r\n');
}

export interface PreviewColumn {
  index: number;
  header: string;
  /** Frappe'nin önerdiği alan. Eşleşme yoksa `null` olur. */
  field: string | null;
}
export interface ImportPreview {
  columns: PreviewColumn[];
  rows: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `get_preview_from_template` yanıtını okur. Biçim bozuksa `invalid_response` hatası verir. */
export function parsePreview(value: unknown): ImportPreview {
  if (!isRecord(value) || !Array.isArray(value.columns) || !Array.isArray(value.data)) {
    throw new Error('invalid_response');
  }
  const columns = value.columns.map((column, index): PreviewColumn => {
    if (!isRecord(column)) throw new Error('invalid_response');
    const header = typeof column.header_title === 'string' ? column.header_title : '';
    const df = isRecord(column.df) ? column.df : undefined;
    const field =
      column.skip_import !== true && typeof df?.fieldname === 'string' ? df.fieldname : null;
    return { index, header, field };
  });
  return { columns, rows: value.data.length };
}

/** Eşlemeyi Frappe `template_options` alanının JSON metnine çevirir. */
export function templateOptions(map: Readonly<Record<number, string | null>>): string {
  const columnToField = Object.fromEntries(
    Object.entries(map).map(([index, field]) => [index, field ?? SKIP_COLUMN]),
  );
  return JSON.stringify({ column_to_field_map: columnToField });
}

export interface ImportFailure {
  /** Dosyadaki satır numaraları. Başlık satırı 1. satırdır. */
  rows: number[];
  messages: string[];
}

function parseJsonList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Sunucu iletisindeki HTML etiketlerini atar. Ekran iletiyi düz metin olarak yazar. */
const plain = (text: string) =>
  text
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** `get_import_logs` yanıtından yalnız başarısız satırları çıkarır. */
export function parseImportLogs(value: unknown): ImportFailure[] {
  if (!Array.isArray(value)) throw new Error('invalid_response');
  return value.filter(isRecord).flatMap((log) => {
    if (log.success === 1 || log.success === true) return [];
    const rows = parseJsonList(log.row_indexes).filter(
      (row): row is number => typeof row === 'number' && Number.isInteger(row),
    );
    const messages = parseJsonList(log.messages)
      .map((entry) =>
        typeof entry === 'string'
          ? entry
          : isRecord(entry) && typeof entry.message === 'string'
            ? entry.message
            : '',
      )
      .map(plain)
      .filter(Boolean);
    return [{ rows, messages }];
  });
}

/** Frappe Data Import durumları. Bilinmeyen değer "Pending" sayılır. */
export type ImportStatus = 'Pending' | 'Success' | 'Partial Success' | 'Error' | 'Timed Out';
const STATUSES = new Set<ImportStatus>([
  'Pending',
  'Success',
  'Partial Success',
  'Error',
  'Timed Out',
]);
export const importStatus = (value: unknown): ImportStatus =>
  typeof value === 'string' && STATUSES.has(value as ImportStatus)
    ? (value as ImportStatus)
    : 'Pending';

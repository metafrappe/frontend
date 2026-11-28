// Veri aktarımı istemcisi (G-97 parça 3, AJA-2493).
//
// Bu dosya ilk yüke girmez. Modül istemcisi onu yalnız "Veri aktarımı" sayfası açılınca yükler.
// İstekler ortak istemcinin `frappeDocument` yönteminden geçer: site kökü, CSRF, zaman aşımı
// ve oturum süresi işi oradadır (SZ-5). Yetkiyi her istekte sunucu denetler.
//
// Frappe uçları (Frappe 15 ve 16):
// - `Data Import` belgesi: aktarım kaydı, dosya, sütun eşlemesi (`template_options`) ve durum.
// - `File` belgesi: dosya içeriği base64 olarak JSON gövdesiyle yazılır (`decode: 1`).
// - `frappe.core.doctype.data_import.data_import.get_preview_from_template`: önizleme.
// - `frappe.core.doctype.data_import.data_import.form_start_import`: aktarımı başlatır.
// - `frappe.core.doctype.data_import.data_import.get_import_logs`: satır sonuçları.
// - `Personal Data Download Request` belgesi: KVKK kişisel veri indirme talebi.
import type { ApiClient, DocTypeMeta } from '@/api';
import type { DataTransferClient, RequestOptions } from '../runtime';
import { importStatus, parseImportLogs, parsePreview, templateOptions } from './model';

export const DATA_IMPORT_DOCTYPE = 'Data Import';
export const PERSONAL_DATA_DOCTYPE = 'Personal Data Download Request';
const METHOD = '/api/method/frappe.core.doctype.data_import.data_import';
/** Dışa aktarımda bir istekte okunan kayıt sayısı. Liste ucunun üst sınırıdır (SZ-10). */
const PAGE = 100;
/** Dışa aktarımın en çok kayıt sayısı. Fazlası için ekran "ilk kayıtlar indirildi" der. */
export const EXPORT_LIMIT = 5000;

const resource = (doctype: string, name?: string) =>
  `/api/resource/${encodeURIComponent(doctype)}${name === undefined ? '' : `/${encodeURIComponent(name)}`}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

async function call(
  api: ApiClient,
  request: Parameters<ApiClient['frappeDocument']>[0],
): Promise<unknown> {
  const response = await api.frappeDocument(request);
  if (!response.ok) throw response.error;
  const body = response.body;
  if (isRecord(body) && 'data' in body) return body.data;
  if (isRecord(body) && 'message' in body) return body.message;
  return body;
}

function nameOf(value: unknown): string {
  if (!isRecord(value) || typeof value.name !== 'string' || !value.name) {
    throw new Error('invalid_response');
  }
  return value.name;
}

async function base64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function createDataTransferClient(api: ApiClient): DataTransferClient {
  return {
    async listDoctypes(purpose, options: RequestOptions) {
      const filters: [string, '=', number][] = [
        ['istable', '=', 0],
        ['issingle', '=', 0],
      ];
      if (purpose === 'import') filters.push(['allow_import', '=', 1]);
      const page = await api.listDocuments(
        'DocType',
        { fields: ['name'], filters, orderBy: 'name asc', limit: 100 },
        options,
      );
      return page.data
        .map((row) => row.name)
        .filter((name): name is string => typeof name === 'string');
    },

    async getMeta(doctype, options: RequestOptions): Promise<DocTypeMeta> {
      const result = await api.getDocType(doctype, undefined, options);
      if (result.status !== 'fresh' || result.meta.truncated) throw new Error('invalid_response');
      return result.meta;
    },

    async listRows(doctype, fields, options: RequestOptions) {
      const rows: Record<string, unknown>[] = [];
      let hasNext = true;
      while (hasNext && rows.length < EXPORT_LIMIT) {
        const page = await api.listDocuments(
          doctype,
          { fields, orderBy: 'name asc', start: rows.length, limit: PAGE },
          options,
        );
        rows.push(...page.data);
        hasNext = page.hasNextPage;
      }
      return {
        rows: rows.slice(0, EXPORT_LIMIT),
        truncated: hasNext || rows.length > EXPORT_LIMIT,
      };
    },

    async prepareImport(doctype, file, options: RequestOptions) {
      const { signal } = options;
      const name = nameOf(
        await call(api, {
          method: 'POST',
          path: resource(DATA_IMPORT_DOCTYPE),
          body: { reference_doctype: doctype, import_type: 'Insert New Records' },
          signal,
        }),
      );
      const saved = await call(api, {
        method: 'POST',
        path: resource('File'),
        body: {
          file_name: file.name,
          content: await base64(file),
          decode: 1,
          is_private: 1,
          attached_to_doctype: DATA_IMPORT_DOCTYPE,
          attached_to_name: name,
          attached_to_field: 'import_file',
        },
        signal,
      });
      if (!isRecord(saved) || typeof saved.file_url !== 'string')
        throw new Error('invalid_response');
      await call(api, {
        method: 'PUT',
        path: resource(DATA_IMPORT_DOCTYPE, name),
        body: { import_file: saved.file_url },
        signal,
      });
      const preview = parsePreview(
        await call(api, {
          method: 'POST',
          path: `${METHOD}.get_preview_from_template`,
          body: { data_import: name, import_file: saved.file_url },
          signal,
        }),
      );
      return { name, preview };
    },

    async startImport(name, map, options: RequestOptions) {
      await call(api, {
        method: 'PUT',
        path: resource(DATA_IMPORT_DOCTYPE, name),
        body: { template_options: templateOptions(map) },
        signal: options.signal,
      });
      await call(api, {
        method: 'POST',
        path: `${METHOD}.form_start_import`,
        body: { data_import: name },
        signal: options.signal,
      });
    },

    async importResult(name, options: RequestOptions) {
      const record = await call(api, {
        method: 'GET',
        path: resource(DATA_IMPORT_DOCTYPE, name),
        signal: options.signal,
      });
      if (!isRecord(record)) throw new Error('invalid_response');
      const logs = await call(api, {
        method: 'POST',
        path: `${METHOD}.get_import_logs`,
        body: { data_import: name },
        signal: options.signal,
      });
      return { status: importStatus(record.status), failures: parseImportLogs(logs) };
    },

    async requestPersonalData(user, options: RequestOptions) {
      return {
        name: nameOf(
          await call(api, {
            method: 'POST',
            path: resource(PERSONAL_DATA_DOCTYPE),
            body: { user },
            signal: options.signal,
          }),
        ),
      };
    },
  };
}

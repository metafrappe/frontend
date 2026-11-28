// G-97 parça 3: "Veri aktarımı" sayfasının sahte uçları (AJA-2493).
// Biçimler Frappe'nin `Data Import`, `File` ve `Personal Data Download Request` belgelerini izler.
// Önizleme yüklenen CSV dosyasının ilk satırını okur. Başlığı boş satır hata raporuna düşer.
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { SAMPLE_COLLECTION_DOCTYPE, sampleDocTypeMeta } from './fixtures';

type Guard = (request: Request, options: { write: boolean }) => Response | undefined;
type Message = (body: JsonBodyType) => Response;
type FrappeError = (status: number, excType: string) => Response;

const METHOD = '*/api/method/frappe.core.doctype.data_import.data_import';
const IMPORT = 'Data Import';
const data = (body: JsonBodyType) => HttpResponse.json({ data: body });

interface SampleImport {
  name: string;
  file?: string;
  started: boolean;
}
const imports = new Map<string, SampleImport>();
const files = new Map<string, string>();
let counter = 0;

export function resetDataTransferState() {
  imports.clear();
  files.clear();
  counter = 0;
}

function csvRows(fileUrl: string | undefined) {
  const text = fileUrl ? (files.get(fileUrl) ?? '') : '';
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(Boolean);
  return {
    header: (lines[0] ?? '').split(','),
    rows: lines.slice(1).map((line) => line.split(',')),
  };
}

const labels = new Map(
  sampleDocTypeMeta.schema.fields.map((field) => [field.label ?? field.fieldname, field.fieldname]),
);

async function body(request: Request): Promise<Record<string, unknown>> {
  const value: unknown = await request.json().catch(() => ({}));
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export function dataTransferHandlers(guard: Guard, message: Message, frappeError: FrappeError) {
  return [
    // Kayıt türü listesi. Örnek kullanıcı yalnız örnek kayıt türünü aktarabilir.
    http.get('*/api/v2/document/DocType', ({ request }) => {
      const denied = guard(request, { write: false });
      if (denied) return denied;
      return HttpResponse.json({
        data: [{ name: SAMPLE_COLLECTION_DOCTYPE }],
        has_next_page: false,
      });
    }),

    http.post(`*/api/resource/${encodeURIComponent(IMPORT)}`, async ({ request }) => {
      const denied = guard(request, { write: true });
      if (denied) return denied;
      const values = await body(request);
      if (values.reference_doctype !== SAMPLE_COLLECTION_DOCTYPE) {
        return frappeError(403, 'PermissionError');
      }
      counter += 1;
      const name = `IMP-${String(counter).padStart(4, '0')}`;
      imports.set(name, { name, started: false });
      return data({ name, status: 'Pending', reference_doctype: values.reference_doctype });
    }),

    http.post('*/api/resource/File', async ({ request }) => {
      const denied = guard(request, { write: true });
      if (denied) return denied;
      const values = await body(request);
      if (values.attached_to_doctype !== IMPORT || typeof values.content !== 'string') {
        return frappeError(417, 'ValidationError');
      }
      const url = `/private/files/${counter}-${String(values.file_name)}`;
      const bytes = Uint8Array.from(atob(values.content), (char) => char.charCodeAt(0));
      files.set(url, new TextDecoder().decode(bytes));
      return data({ name: `FILE-${counter}`, file_url: url });
    }),

    http.put(`*/api/resource/${encodeURIComponent(IMPORT)}/:name`, async ({ request, params }) => {
      const denied = guard(request, { write: true });
      if (denied) return denied;
      const record = imports.get(String(params.name));
      if (!record) return frappeError(404, 'DoesNotExistError');
      const values = await body(request);
      if (typeof values.import_file === 'string') record.file = values.import_file;
      return data({ name: record.name });
    }),

    http.get(`*/api/resource/${encodeURIComponent(IMPORT)}/:name`, ({ request, params }) => {
      const denied = guard(request, { write: false });
      if (denied) return denied;
      const record = imports.get(String(params.name));
      if (!record) return frappeError(404, 'DoesNotExistError');
      const failed = csvRows(record.file).rows.some((row) => !row[0]);
      const status = !record.started ? 'Pending' : failed ? 'Partial Success' : 'Success';
      return data({ name: record.name, status });
    }),

    http.post(`${METHOD}.get_preview_from_template`, async ({ request }) => {
      const denied = guard(request, { write: true });
      if (denied) return denied;
      const record = imports.get(String((await body(request)).data_import));
      if (!record) return frappeError(404, 'DoesNotExistError');
      const { header, rows } = csvRows(record.file);
      return message({
        columns: header.map((title) => {
          const fieldname = labels.get(title);
          return fieldname
            ? { header_title: title, df: { fieldname } }
            : { header_title: title, skip_import: true };
        }),
        data: rows,
        warnings: [],
      });
    }),

    http.post(`${METHOD}.form_start_import`, async ({ request }) => {
      const denied = guard(request, { write: true });
      if (denied) return denied;
      const record = imports.get(String((await body(request)).data_import));
      if (!record) return frappeError(404, 'DoesNotExistError');
      record.started = true;
      return message(true);
    }),

    http.post(`${METHOD}.get_import_logs`, async ({ request }) => {
      const denied = guard(request, { write: true });
      if (denied) return denied;
      const record = imports.get(String((await body(request)).data_import));
      if (!record) return frappeError(404, 'DoesNotExistError');
      // Dosyada başlık 1. satırdır. İlk kayıt 2. satırdadır.
      return message(
        csvRows(record.file).rows.map((row, index) =>
          row[0]
            ? {
                success: 1,
                docname: `KAYIT-${index + 1}`,
                row_indexes: `[${index + 2}]`,
                messages: '[]',
              }
            : {
                success: 0,
                row_indexes: `[${index + 2}]`,
                messages: JSON.stringify([{ message: '<b>Örnek başlık</b> zorunludur.' }]),
              },
        ),
      );
    }),

    http.post(
      `*/api/resource/${encodeURIComponent('Personal Data Download Request')}`,
      async ({ request }) => {
        const denied = guard(request, { write: true });
        if (denied) return denied;
        const values = await body(request);
        if (typeof values.user !== 'string' || !values.user)
          return frappeError(417, 'ValidationError');
        return data({ name: 'PDR-0001', user: values.user });
      },
    ),
  ];
}

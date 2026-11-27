// G-97 parça 2 (AJA-2492) sahte uçları: "Özelleştirme" sayfası.
// Uçlar Frappe'nin kayıt uçlarını taklit eder: `Custom Field`, `Property Setter` ve `Workspace`.
// Tür tanımları `platform_core.api.meta.get_doctype` biçimindedir. Veri her sayfa yüklemesinde baştan kurulur.
import { http, HttpResponse, type JsonBodyType } from 'msw';

import type { components as ShellComponents } from '@/api/generated/platform_core-shell';

import { sampleDocTypeMeta } from './fixtures';

type Guard = (request: Request, options: { write: boolean }) => Response | undefined;
interface Helpers {
  guard: Guard;
  message: (body: JsonBodyType) => Response;
  frappeError: (status: number, excType: string) => Response;
  listRows: <T extends Record<string, unknown>>(rows: T[], url: URL) => Response | undefined;
  /** Tanım ucunun 200 verdiği türler. Rol senaryoları değiştirir. */
  readable: () => ReadonlySet<string>;
}

type Meta = ShellComponents['schemas']['Meta'];
type Row = Record<string, unknown> & { name: string; modified: string };

const TARGET = sampleDocTypeMeta.schema.name;
const field = (
  fieldname: string,
  fieldtype: string,
  label: string,
  component: string,
  extra: Record<string, unknown> = {},
) => ({
  fieldname,
  fieldtype,
  label,
  read_only: false,
  component,
  sensitivity: 'standard',
  ...extra,
});

function meta(name: string, fields: ReturnType<typeof field>[]): Meta {
  return {
    ...sampleDocTypeMeta,
    schema: {
      name,
      module: 'Custom',
      sensitivity: 'standard',
      title_field: null,
      search_fields: '',
      sort_field: null,
      fields,
    },
  } as Meta;
}

const FIELD_TYPES = ['Data', 'Int', 'Check', 'Date', 'Small Text'];

const METAS: Record<string, Meta> = {
  'Custom Field': meta('Custom Field', [
    field('dt', 'Link', 'Belge türü', 'link-select', { options: 'DocType', reqd: true }),
    field('label', 'Data', 'Etiket', 'input', { reqd: true }),
    field('fieldtype', 'Select', 'Alan türü', 'select', {
      reqd: true,
      default: 'Data',
      options: FIELD_TYPES.join('\n'),
      choices: FIELD_TYPES.map((value) => ({ value, label: value })),
    }),
  ]),
  'Property Setter': meta('Property Setter', [
    field('doctype_or_field', 'Data', 'Uygulandığı yer', 'input'),
    field('doc_type', 'Data', 'Belge türü', 'input'),
    field('field_name', 'Data', 'Alan adı', 'input'),
    field('property', 'Data', 'Özellik', 'input'),
    field('property_type', 'Data', 'Özellik türü', 'input'),
    field('value', 'Data', 'Değer', 'input'),
  ]),
  Workspace: meta('Workspace', [
    field('title', 'Data', 'Başlık', 'input', { reqd: true }),
    field('is_hidden', 'Check', 'Menüde gizle', 'check'),
    field('sequence_id', 'Int', 'Sıra', 'int'),
  ]),
};

const scrub = (label: string) =>
  label
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

let counter = 0;
const version = () => {
  counter += 1;
  return `2026-11-28 10:00:00.${String(counter).padStart(6, '0')}`;
};

function initialWorkspaces(): Map<string, Row> {
  const rows: Row[] = [
    { name: 'Ana Sayfa', title: 'Ana sayfa', public: 1, is_hidden: 0, sequence_id: 1 },
    { name: 'HR', title: 'İnsan kaynakları', public: 1, is_hidden: 0, sequence_id: 2 },
  ].map((row) => ({ ...row, modified: '2026-11-27 09:00:00' }));
  return new Map(rows.map((row) => [row.name, row]));
}

const state = {
  customFields: new Map<string, Row>(),
  propertySetters: new Map<string, Row>(),
  workspaces: initialWorkspaces(),
};

export function resetCustomizationState() {
  state.customFields.clear();
  state.propertySetters.clear();
  state.workspaces = initialWorkspaces();
}

/** Seçili türün tanımına özel alanları ve özellik değişikliklerini uygular. */
function customizedTarget(): Meta {
  const fields = [
    ...sampleDocTypeMeta.schema.fields,
    ...[...state.customFields.values()].map((row) =>
      field(String(row['fieldname']), String(row['fieldtype']), String(row['label']), 'input'),
    ),
  ].map((item) => {
    const label = state.propertySetters.get(`${TARGET}-${item.fieldname}-label`);
    const hidden = state.propertySetters.get(`${TARGET}-${item.fieldname}-hidden`);
    return {
      ...item,
      ...(label ? { label: String(label['value']) } : {}),
      ...(hidden ? { hidden: hidden['value'] === '1' } : {}),
    };
  });
  return { ...sampleDocTypeMeta, schema: { ...sampleDocTypeMeta.schema, fields } } as Meta;
}

const data = (row: Row) => HttpResponse.json({ data: row as JsonBodyType });

async function body(request: Request): Promise<Record<string, unknown> | null> {
  const value: unknown = await request.json().catch(() => null);
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

export function customizationHandlers({
  guard,
  message,
  frappeError,
  listRows,
  readable,
}: Helpers) {
  return [
    http.get('*/api/method/platform_core.api.meta.get_doctype', ({ request }) => {
      const doctype = new URL(request.url).searchParams.get('doctype') ?? '';
      const fixed = METAS[doctype];
      const changed =
        doctype === TARGET && (state.customFields.size > 0 || state.propertySetters.size > 0);
      if (!fixed && !changed) return undefined;
      if (fixed && !readable().has(doctype))
        return guard(request, { write: false }) ?? frappeError(403, 'PermissionError');
      return guard(request, { write: false }) ?? message(fixed ?? customizedTarget());
    }),
    http.get('*/api/v2/document/DocType', ({ request }) => {
      const denied = guard(request, { write: false });
      if (denied) return denied;
      const rows = [{ name: TARGET, istable: 0, issingle: 0 }];
      return listRows(rows, new URL(request.url)) ?? frappeError(417, 'ValidationError');
    }),
    http.get('*/api/v2/document/Custom%20Field', ({ request }) => {
      const denied = guard(request, { write: false });
      if (denied) return denied;
      const rows = [...state.customFields.values()];
      return listRows(rows, new URL(request.url)) ?? frappeError(417, 'ValidationError');
    }),
    http.get('*/api/v2/document/Workspace', ({ request }) => {
      const denied = guard(request, { write: false });
      if (denied) return denied;
      const rows = [...state.workspaces.values()];
      return listRows(rows, new URL(request.url)) ?? frappeError(417, 'ValidationError');
    }),
    http.post('*/api/resource/Custom%20Field', async ({ request }) => {
      const denied = guard(request, { write: true });
      if (denied) return denied;
      const values = await body(request);
      const label = typeof values?.['label'] === 'string' ? values['label'].trim() : '';
      if (!values || !label || values['dt'] !== TARGET) return frappeError(417, 'ValidationError');
      const fieldname = scrub(label);
      const name = `${TARGET}-${fieldname}`;
      if (state.customFields.has(name)) return frappeError(409, 'DuplicateEntryError');
      const row: Row = {
        name,
        dt: TARGET,
        label,
        fieldname,
        fieldtype: typeof values['fieldtype'] === 'string' ? values['fieldtype'] : 'Data',
        modified: version(),
      };
      state.customFields.set(name, row);
      return data(row);
    }),
    http.get('*/api/resource/Property%20Setter/:name', ({ request, params }) => {
      const denied = guard(request, { write: false });
      if (denied) return denied;
      const row = state.propertySetters.get(String(params['name']));
      return row ? data(row) : frappeError(404, 'DoesNotExistError');
    }),
    http.post('*/api/resource/Property%20Setter', async ({ request }) => {
      const denied = guard(request, { write: true });
      if (denied) return denied;
      const values = await body(request);
      if (!values || values['doc_type'] !== TARGET) return frappeError(417, 'ValidationError');
      const name = `${TARGET}-${String(values['field_name'])}-${String(values['property'])}`;
      if (state.propertySetters.has(name)) return frappeError(409, 'DuplicateEntryError');
      const row: Row = {
        ...values,
        name,
        value: String(values['value'] ?? ''),
        modified: version(),
      };
      state.propertySetters.set(name, row);
      return data(row);
    }),
    http.put('*/api/resource/Property%20Setter/:name', async ({ request, params }) => {
      const denied = guard(request, { write: true });
      if (denied) return denied;
      const row = state.propertySetters.get(String(params['name']));
      if (!row) return frappeError(404, 'DoesNotExistError');
      const values = await body(request);
      if (!values || values['modified'] !== row.modified)
        return frappeError(417, 'TimestampMismatchError');
      const next: Row = { ...row, value: String(values['value'] ?? ''), modified: version() };
      state.propertySetters.set(next.name, next);
      return data(next);
    }),
    http.get('*/api/resource/Workspace/:name', ({ request, params }) => {
      const denied = guard(request, { write: false });
      if (denied) return denied;
      const row = state.workspaces.get(String(params['name']));
      return row ? data(row) : frappeError(404, 'DoesNotExistError');
    }),
    http.put('*/api/resource/Workspace/:name', async ({ request, params }) => {
      const denied = guard(request, { write: true });
      if (denied) return denied;
      const row = state.workspaces.get(String(params['name']));
      if (!row) return frappeError(404, 'DoesNotExistError');
      const values = await body(request);
      if (!values || values['modified'] !== row.modified)
        return frappeError(417, 'TimestampMismatchError');
      const title = values['title'];
      if (title !== undefined && (typeof title !== 'string' || !title.trim()))
        return frappeError(417, 'MandatoryError');
      const next: Row = {
        ...row,
        ...(typeof title === 'string' ? { title: title.trim() } : {}),
        ...(values['is_hidden'] !== undefined ? { is_hidden: values['is_hidden'] ? 1 : 0 } : {}),
        ...(typeof values['sequence_id'] === 'number'
          ? { sequence_id: values['sequence_id'] }
          : {}),
        modified: version(),
      };
      state.workspaces.set(next.name, next);
      return data(next);
    }),
  ];
}

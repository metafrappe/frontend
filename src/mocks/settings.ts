// Ayar sayfalarının sahte sunucusu (G-97 parça 1, AJA-2491).
// Üç tek kayıtlı tür vardır: genel ayarlar, marka ve İK ayarları.
// Tür okunamıyorsa şema ve kayıt ucu 403 verir. Gerçek sunucu da öyle davranır.
import { http, type JsonBodyType } from 'msw';

import type { components as ShellComponents } from '@/api/generated/platform_core-shell';
import {
  HR_SETTINGS_DOCTYPE,
  TENANT_BRANDING_DOCTYPE,
  TENANT_SETTINGS_DOCTYPE,
} from '@/modules/settings/doctypes';

type Meta = ShellComponents['schemas']['Meta'];
type DocField = Meta['schema']['fields'][number];
type Guard = (request: Request, options: { write: boolean }) => Response | undefined;
type Message = (body: JsonBodyType) => Response;
type FrappeError = (status: number, excType: string) => Response;
type Json = (body: JsonBodyType) => Response;

function field(
  fieldname: string,
  fieldtype: string,
  label: string,
  component: string,
  extra: Partial<DocField> = {},
): DocField {
  return {
    fieldname,
    fieldtype,
    label,
    component,
    read_only: false,
    sensitivity: 'standard',
    ...extra,
  } as DocField;
}

function meta(name: string, module: string, fields: DocField[]): Meta {
  return {
    catalog_version: 2,
    child_tables: {},
    meta_hash: name.length.toString(16).padStart(64, 'a'),
    mobile_cache_allowed: false,
    perm_version: 'f'.repeat(64),
    schema: {
      name,
      module,
      sensitivity: 'standard',
      title_field: null,
      search_fields: '',
      sort_field: null,
      fields,
    },
  } as Meta;
}

/** Güvenli genel ayarlar. System Settings türünün yalnız bu alanları kiracıya açıktır. */
export const tenantSettingsMeta = meta(TENANT_SETTINGS_DOCTYPE, 'Platform Core', [
  field('regional_section', 'Section Break', 'Dil ve bölge', 'section'),
  field('language', 'Select', 'Dil', 'select', {
    reqd: true,
    choices: [
      { value: 'tr', label: 'Türkçe' },
      { value: 'en-GB', label: 'English (UK)' },
    ],
  } as Partial<DocField>),
  field('time_zone', 'Select', 'Saat dilimi', 'select', {
    reqd: true,
    choices: [
      { value: 'Europe/Istanbul', label: 'Europe/Istanbul' },
      { value: 'Europe/London', label: 'Europe/London' },
    ],
  } as Partial<DocField>),
  field('formats_section', 'Section Break', 'Biçimler', 'section'),
  field('date_format', 'Select', 'Tarih biçimi', 'select', {
    choices: [
      { value: 'dd.mm.yyyy', label: 'dd.mm.yyyy' },
      { value: 'dd/mm/yyyy', label: 'dd/mm/yyyy' },
    ],
  } as Partial<DocField>),
  field('time_format', 'Select', 'Saat biçimi', 'select', {
    choices: [
      { value: 'HH:mm', label: 'HH:mm' },
      { value: 'HH:mm:ss', label: 'HH:mm:ss' },
    ],
  } as Partial<DocField>),
  field('number_format', 'Select', 'Sayı biçimi', 'select', {
    choices: [
      { value: '#.###,##', label: '#.###,##' },
      { value: '#,###.##', label: '#,###.##' },
    ],
  } as Partial<DocField>),
  field('session_section', 'Section Break', 'Oturum', 'section'),
  field('session_expiry', 'Data', 'Oturum süresi (saat:dakika)', 'input', {
    reqd: true,
    description: 'Kullanıcı bu süre boyunca işlem yapmazsa oturum kapanır.',
  } as Partial<DocField>),
  field('email_section', 'Section Break', 'E-posta', 'section'),
  field('email_domain', 'Data', 'E-posta alan adı', 'input', { read_only: true }),
  field('email_account', 'Data', 'Giden e-posta hesabı', 'input', { read_only: true }),
]);

/** Kiracı markası: logo ve renk tokenları. */
export const tenantBrandingMeta = meta(TENANT_BRANDING_DOCTYPE, 'Platform Core', [
  field('logo_section', 'Section Break', 'Logo', 'section'),
  field('logo', 'Attach Image', 'Logo', 'attach-image'),
  field('colors_section', 'Section Break', 'Renkler', 'section'),
  field('primary_color', 'Color', 'Ana renk', 'color', { reqd: true } as Partial<DocField>),
  field('accent_color', 'Color', 'Vurgu rengi', 'color'),
]);

/** Uygulama ayar türü örneği. */
export const hrSettingsMeta = meta(HR_SETTINGS_DOCTYPE, 'HR', [
  field('leave_section', 'Section Break', 'İzin', 'section'),
  field('leave_approval_notification', 'Check', 'İzin onayında bildirim gönder', 'check'),
  field('send_birthday_reminders', 'Check', 'Doğum günü hatırlatması gönder', 'check'),
]);

const METAS: ReadonlyMap<string, Meta> = new Map([
  [TENANT_SETTINGS_DOCTYPE, tenantSettingsMeta],
  [TENANT_BRANDING_DOCTYPE, tenantBrandingMeta],
  [HR_SETTINGS_DOCTYPE, hrSettingsMeta],
]);

const INITIAL: Readonly<Record<string, Record<string, unknown>>> = {
  [TENANT_SETTINGS_DOCTYPE]: {
    language: 'tr',
    time_zone: 'Europe/Istanbul',
    date_format: 'dd.mm.yyyy',
    time_format: 'HH:mm',
    number_format: '#.###,##',
    session_expiry: '06:00',
    email_domain: 'kiraci.example.test',
    email_account: 'bildirim@kiraci.example.test',
  },
  [TENANT_BRANDING_DOCTYPE]: { logo: null, primary_color: '#1F6F5C', accent_color: '#B35C1E' },
  [HR_SETTINGS_DOCTYPE]: { leave_approval_notification: 1, send_birthday_reminders: 0 },
};

const settingsState = new Map<string, Record<string, unknown>>();
let version = 0;

export function resetSettingsState(): void {
  settingsState.clear();
  version = 0;
  for (const [doctype, values] of Object.entries(INITIAL)) {
    settingsState.set(doctype, {
      name: doctype,
      doctype,
      docstatus: 0,
      modified: '2026-11-28 09:00:00.000000',
      ...values,
    });
  }
}
resetSettingsState();

/** Salt okunur alanlar kayıtta değişmez. Örnek: e-posta alan adı. */
function writable(doctype: string): Set<string> {
  const fields = METAS.get(doctype)?.schema.fields ?? [];
  return new Set(fields.filter((f) => !f.read_only).map((f) => f.fieldname));
}

export function settingsHandlers(
  guard: Guard,
  message: Message,
  frappeError: FrappeError,
  json: Json,
  readable: () => ReadonlySet<string>,
) {
  return [
    http.get('*/api/method/platform_core.api.meta.get_doctype', ({ request }) => {
      const doctype = new URL(request.url).searchParams.get('doctype') ?? '';
      const found = METAS.get(doctype);
      if (!found) return undefined;
      const denied = guard(request, { write: false });
      if (denied) return denied;
      if (!readable().has(doctype)) return frappeError(403, 'PermissionError');
      return message(found as unknown as JsonBodyType);
    }),
    http.get('*/api/resource/:doctype/:name', ({ request, params }) => {
      const doctype = String(params.doctype);
      if (!METAS.has(doctype)) return undefined;
      const denied = guard(request, { write: false });
      if (denied) return denied;
      if (!readable().has(doctype)) return frappeError(403, 'PermissionError');
      if (String(params.name) !== doctype) return frappeError(404, 'DoesNotExistError');
      return json({ data: settingsState.get(doctype) as JsonBodyType });
    }),
    http.put('*/api/resource/:doctype/:name', async ({ request, params }) => {
      const doctype = String(params.doctype);
      if (!METAS.has(doctype)) return undefined;
      const denied = guard(request, { write: true });
      if (denied) return denied;
      if (!readable().has(doctype)) return frappeError(403, 'PermissionError');
      const row = settingsState.get(doctype);
      if (!row || String(params.name) !== doctype) return frappeError(404, 'DoesNotExistError');
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || body.modified !== row.modified)
        return frappeError(417, 'TimestampMismatchError');
      const allowed = writable(doctype);
      const changes = Object.fromEntries(Object.entries(body).filter(([key]) => allowed.has(key)));
      version += 1;
      const next = {
        ...row,
        ...changes,
        modified: `2026-11-28 09:${String(version).padStart(2, '0')}:00.000000`,
      };
      settingsState.set(doctype, next);
      return json({ data: next as JsonBodyType });
    }),
  ];
}

// G-62 and G-98 mock endpoints: role list, permission rows, user permissions, access rules and
// Permission Log. The shape comes from `contracts/openapi/platform_core-access.openapi.yaml`.
// The data is rebuilt on every page load. Person names are sample labels.
import { http, HttpResponse, type JsonBodyType } from 'msw';

type Guard = (request: Request, options: { write: boolean }) => Response | undefined;
interface Helpers {
  guard: Guard;
  message: (body: JsonBodyType) => Response;
  frappeError: (status: number, excType: string) => Response;
}

const RIGHTS = ['read', 'write', 'create', 'delete', 'submit', 'cancel', 'amend'] as const;
type Row = { role: string; permlevel: number; if_owner: 0 | 1 } & Record<string, number | string>;

/** Roles the server answers with 403 (`tenant_admin.CLOSED_ROLES`). */
const CLOSED_ROLES = new Set([
  'Administrator',
  'System Manager',
  'Script Manager',
  'All',
  'Guest',
  'Tenant Admin',
]);

function row(role: string, permlevel: number, rights: string[]): Row {
  return {
    role,
    permlevel,
    if_owner: 0,
    ...Object.fromEntries(RIGHTS.map((right) => [right, rights.includes(right) ? 1 : 0])),
  };
}

function initialState() {
  const permissions = new Map<string, Row[]>([
    [
      'Leave Application',
      [
        row('Örnek Satış Rolü', 0, ['read', 'write', 'create']),
        row('Örnek Satış Rolü', 1, ['read']),
        row('Employee', 0, ['read', 'create']),
      ],
    ],
  ]);
  const logs: Record<string, unknown>[] = Array.from({ length: 25 }, (_, index) => ({
    name: `PL-${String(index + 1).padStart(4, '0')}`,
    changed_at: `2026-11-${String(24 - Math.floor(index / 5)).padStart(2, '0')} 14:${String(30 - index).padStart(2, '0')}:00`,
    changed_by: index === 0 ? 'ornek.yonetici@example.invalid' : null,
    for_doctype: index === 0 ? 'Role Profile' : 'User',
    for_document: index === 0 ? 'Örnek Profil' : `ornek.kisi.${index}@example.invalid`,
    reference_type: null,
    reference: null,
    status: index === 0 ? 'Updated' : 'Added',
    changes: index === 0 ? { roles: { from: 'Employee', to: 'Employee, Örnek Satış Rolü' } } : {},
  }));
  return {
    roles: ['Administrator', 'System Manager', 'Employee', 'Tenant Admin', 'Örnek Satış Rolü'],
    permissions,
    userPermissions: [] as Record<string, unknown>[],
    accessRules: [] as Record<string, unknown>[],
    logs,
    counter: 0,
  };
}

export function adminHandlers({ guard, message, frappeError }: Helpers) {
  const state = initialState();
  const nextName = (prefix: string) => `${prefix}-${String(++state.counter).padStart(5, '0')}`;
  const page = (rows: Record<string, unknown>[]) =>
    HttpResponse.json({ data: rows as JsonBodyType, has_next_page: false });

  return [
    http.get('*/api/v2/document/Role', ({ request }) => {
      const denied = guard(request, { write: false });
      if (denied) return denied;
      return page(
        state.roles.map((name) => ({
          name,
          desk_access: name === 'System Manager' || name === 'Administrator' ? 1 : 0,
          disabled: 0,
        })),
      );
    }),

    http.get('*/api/method/platform_core.api.access.list_role_permissions', ({ request }) => {
      const denied = guard(request, { write: false });
      if (denied) return denied;
      const doctype = new URL(request.url).searchParams.get('doctype') ?? '';
      if (!doctype) return frappeError(417, 'ValidationError');
      const rows = state.permissions.get(doctype) ?? [];
      return message({ doctype, stored: state.permissions.has(doctype), rows });
    }),

    http.post('*/api/method/platform_core.api.access.set_role_permission', async ({ request }) => {
      const denied = guard(request, { write: true });
      if (denied) return denied;
      const body = (await request.json().catch(() => null)) as {
        doctype?: string;
        role?: string;
        permlevel?: number;
        permissions?: Record<string, boolean>;
      } | null;
      if (!body?.doctype || !body.role || !body.permissions)
        return frappeError(417, 'ValidationError');
      if (CLOSED_ROLES.has(body.role)) {
        return frappeError(403, 'PermissionError');
      }
      const level = body.permlevel ?? 0;
      const rows = state.permissions.get(body.doctype) ?? [];
      let target = rows.find((item) => item.role === body.role && item.permlevel === level);
      if (!target) {
        target = row(body.role, level, []);
        rows.push(target);
      }
      for (const [right, value] of Object.entries(body.permissions)) target[right] = value ? 1 : 0;
      state.permissions.set(body.doctype, rows);
      state.logs.unshift({
        name: `PL-Y${++state.counter}`,
        changed_at: '2026-11-25 10:00:00',
        changed_by: 'ornek.yonetici@example.invalid',
        for_doctype: 'DocType',
        for_document: body.doctype,
        reference_type: 'Custom DocPerm',
        reference: null,
        status: 'Updated',
        changes: {},
      });
      return message({ doctype: body.doctype, ...target });
    }),

    http.get('*/api/method/platform_core.api.access.list_permission_logs', ({ request }) => {
      const denied = guard(request, { write: false });
      if (denied) return denied;
      const url = new URL(request.url);
      const start = Number(url.searchParams.get('start') ?? 0);
      const length = Number(url.searchParams.get('page_length') ?? 20);
      const logs = state.logs.slice(start, start + length);
      return message({
        logs: logs as JsonBodyType,
        start,
        page_length: length,
        has_more: state.logs.length > start + length,
      });
    }),

    http.get('*/api/v2/document/User%20Permission', ({ request }) => {
      const denied = guard(request, { write: false });
      return denied ?? page(state.userPermissions);
    }),
    http.post('*/api/resource/User%20Permission', async ({ request }) => {
      const denied = guard(request, { write: true });
      if (denied) return denied;
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body?.['user'] || !body['allow'] || !body['for_value']) {
        return frappeError(417, 'MandatoryError');
      }
      const record = { ...body, name: nextName('UP') };
      state.userPermissions.unshift(record);
      return HttpResponse.json({ data: record as JsonBodyType });
    }),
    http.delete('*/api/resource/User%20Permission/:name', ({ request, params }) => {
      const denied = guard(request, { write: true });
      if (denied) return denied;
      const index = state.userPermissions.findIndex((item) => item['name'] === params['name']);
      if (index < 0) return frappeError(404, 'DoesNotExistError');
      state.userPermissions.splice(index, 1);
      return HttpResponse.json({ data: 'ok' });
    }),

    http.get('*/api/v2/document/PLT%20Access%20Rule', ({ request }) => {
      const denied = guard(request, { write: false });
      return denied ?? page(state.accessRules);
    }),
    http.post('*/api/resource/PLT%20Access%20Rule', async ({ request }) => {
      const denied = guard(request, { write: true });
      if (denied) return denied;
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body?.['title'] || !body['document_type'] || !body['role'] || !body['scope']) {
        return frappeError(417, 'MandatoryError');
      }
      const record = { ...body, name: nextName('AR') };
      state.accessRules.unshift(record);
      return HttpResponse.json({ data: record as JsonBodyType });
    }),
  ];
}

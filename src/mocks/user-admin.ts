// G-98: the sample user management endpoints of the admin page.
// Shapes follow `platform_core.api.identity.invite_user`, `set_user_role_profiles` and the
// Frappe record reads (`/api/v2/document`, `/api/resource`). The names are sample labels.
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { SAMPLE_USER } from './fixtures';

type Guard = (request: Request, options: { write: boolean }) => Response | undefined;
type Message = (body: JsonBodyType) => Response;
type FrappeError = (status: number, excType: string) => Response;
type ListRows = (rows: Record<string, unknown>[], url: URL) => Response | undefined;

interface SampleTenantUser {
  name: string;
  full_name: string;
  enabled: 0 | 1;
  last_login: string | null;
  role_profiles: string[];
}

const PROFILES: Record<string, string[]> = {
  'Satış Çalışanı': ['Website User', 'Sales User'],
  'İzin Onaycısı': ['Website User', 'Leave Approver'],
};
const DIGEST = 'e'.repeat(64);

function sampleUsers(): Map<string, SampleTenantUser> {
  const rows: SampleTenantUser[] = [
    {
      name: SAMPLE_USER,
      full_name: 'Örnek Kişi',
      enabled: 1,
      last_login: '2026-11-24 14:32:00',
      role_profiles: ['Satış Çalışanı'],
    },
    {
      name: 'ornek.calisan@example.test',
      full_name: 'Örnek Çalışan',
      enabled: 1,
      last_login: null,
      role_profiles: ['Satış Çalışanı'],
    },
    {
      name: 'ornek.eski.calisan.uzun.adres@example.test',
      full_name: 'Örnek Eski Çalışan',
      enabled: 0,
      last_login: null,
      role_profiles: [],
    },
  ];
  return new Map(rows.map((row) => [row.name, row]));
}

export const userAdminState = { users: sampleUsers() };

export function resetUserAdminState(): void {
  userAdminState.users = sampleUsers();
}

const roles = (profiles: string[]) =>
  [...new Set(profiles.flatMap((name) => PROFILES[name] ?? []))].sort();

function asRecord(user: SampleTenantUser) {
  return {
    name: user.name,
    full_name: user.full_name,
    enabled: user.enabled,
    last_login: user.last_login,
    role_profiles: user.role_profiles.map((role_profile) => ({ role_profile })),
    roles: roles(user.role_profiles).map((role) => ({ role })),
  };
}

export function userAdminHandlers(
  guard: Guard,
  message: Message,
  frappeError: FrappeError,
  listRows: ListRows,
) {
  return [
    http.get('*/api/v2/document/:doctype', ({ request, params }) => {
      const doctype = String(params.doctype);
      if (doctype !== 'User' && doctype !== 'Role Profile') return undefined;
      const denied = guard(request, { write: false });
      if (denied) return denied;
      const rows =
        doctype === 'User'
          ? [...userAdminState.users.values()].map(asRecord)
          : Object.keys(PROFILES).map((name) => ({ name }));
      return listRows(rows, new URL(request.url)) ?? frappeError(417, 'ValidationError');
    }),

    http.get('*/api/resource/User/:name', ({ request, params }) => {
      const denied = guard(request, { write: false });
      if (denied) return denied;
      const user = userAdminState.users.get(String(params.name));
      return user
        ? HttpResponse.json({ data: asRecord(user) })
        : frappeError(404, 'DoesNotExistError');
    }),

    http.get('*/api/resource/Role%20Profile/:name', ({ request, params }) => {
      const denied = guard(request, { write: false });
      if (denied) return denied;
      const name = String(params.name);
      const profile = PROFILES[name];
      return profile
        ? HttpResponse.json({ data: { name, roles: profile.map((role) => ({ role })) } })
        : frappeError(404, 'DoesNotExistError');
    }),

    http.post('*/api/method/platform_core.api.identity.invite_user', async ({ request }) => {
      const denied = guard(request, { write: true });
      if (denied) return denied;
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      const email = typeof body?.['email'] === 'string' ? body['email'] : '';
      if (!/^[^@\s]+@[^@\s]+$/.test(email)) return frappeError(400, 'InvalidInput');
      if (userAdminState.users.has(email)) return frappeError(409, 'IdentityConflict');
      if (body?.['dry_run'] === true)
        return message({
          dry_run: true,
          subject: null,
          preview_digest: DIGEST,
          previews: [{ operation: 'create_user', target: email, destructive: false }],
        });
      if (body?.['dry_run'] !== false || body['preview_digest'] !== DIGEST)
        return frappeError(400, 'InvalidInput');
      // The Website User is made at the first sign-in, so the list does not change here.
      return message({ dry_run: false, subject: 'ornek-konu', previews: [] });
    }),

    http.post(
      '*/api/method/platform_core.api.identity.set_user_role_profiles',
      async ({ request }) => {
        const denied = guard(request, { write: true });
        if (denied) return denied;
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const user = userAdminState.users.get(String(body?.['user']));
        const profiles = body?.['role_profiles'];
        if (!user) return frappeError(403, 'PermissionError');
        if (user.name === SAMPLE_USER) return frappeError(403, 'PermissionError');
        if (!Array.isArray(profiles) || !profiles.every((name) => String(name) in PROFILES))
          return frappeError(400, 'InvalidInput');
        user.role_profiles = profiles.map(String);
        return message({
          user: user.name,
          role_profiles: user.role_profiles,
          roles: roles(user.role_profiles),
        });
      },
    ),
  ];
}

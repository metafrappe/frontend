import type { ApiClient } from '../api';
import type { AdminClient, ModuleClient } from './runtime';

export const USER_PERMISSION_DOCTYPE = 'User Permission';
export const ACCESS_RULE_DOCTYPE = 'PLT Access Rule';
const resource = (doctype: string, name?: string) =>
  `/api/resource/${encodeURIComponent(doctype)}${name === undefined ? '' : `/${encodeURIComponent(name)}`}`;

/** Kayıt ucunun yanıtını açar. Hata ortak istemcinin hata türüyle fırlatılır. */
async function documentData(
  api: ApiClient,
  request: Parameters<ApiClient['frappeDocument']>[0],
): Promise<unknown> {
  const response = await api.frappeDocument(request);
  if (!response.ok) throw response.error;
  const body = response.body;
  return typeof body === 'object' && body !== null && 'data' in body ? body.data : body;
}

function createAdminClient(api: ApiClient): AdminClient {
  return {
    listRoles: (options) =>
      api.listDocuments(
        'Role',
        { fields: ['name', 'desk_access', 'disabled'], orderBy: 'name asc', limit: 100 },
        options,
      ),
    listRolePermissions: (doctype, options) => api.listRolePermissions(doctype, options),
    setRolePermission: (body, options) => api.setRolePermission(body, options),
    listPermissionLogs: (query, options) => api.listPermissionLogs(query, options),
    listUserPermissions: (options) =>
      api.listDocuments(
        USER_PERMISSION_DOCTYPE,
        {
          fields: ['name', 'user', 'allow', 'for_value', 'apply_to_all_doctypes', 'applicable_for'],
          orderBy: 'modified desc',
          limit: 100,
        },
        options,
      ),
    createUserPermission: (values, options) =>
      documentData(api, {
        method: 'POST',
        path: resource(USER_PERMISSION_DOCTYPE),
        body: values,
        signal: options.signal,
      }),
    deleteUserPermission: (name, options) =>
      documentData(api, {
        method: 'DELETE',
        path: resource(USER_PERMISSION_DOCTYPE, name),
        signal: options.signal,
      }),
    listAccessRules: (options) =>
      api.listDocuments(
        ACCESS_RULE_DOCTYPE,
        {
          fields: ['name', 'title', 'document_type', 'role', 'scope', 'is_active'],
          orderBy: 'modified desc',
          limit: 100,
        },
        options,
      ),
    createAccessRule: (values, options) =>
      documentData(api, {
        method: 'POST',
        path: resource(ACCESS_RULE_DOCTYPE),
        body: values,
        signal: options.signal,
      }),
  };
}

/** The shared client owns transport, CSRF, authentication, validation and error translation. */
export function createModuleClient(api: ApiClient): ModuleClient {
  return {
    getProfile: async (options) => {
      const { user, truncated } = await api.getBootstrap(options);
      return { name: user.name, fullName: user.full_name, roles: user.roles, truncated };
    },
    listLeaveApplications: (query, options) =>
      api.listLeaveApplications(
        {
          fields: [
            'name',
            'employee_name',
            'leave_type',
            'from_date',
            'to_date',
            'status',
            'docstatus',
            'modified',
            'total_leave_days',
          ],
          start: query.limit_start,
          pageLength: query.limit_page_length,
          orderBy: query.order_by,
        },
        options,
      ),
    getLeaveApplication: (name, options) => api.getLeaveApplication(name, options),
    approveLeaveApplication: (body, options) => api.approveLeave(body.name, body.version, options),
    cancelLeaveApplication: (body, options) => api.cancelLeave(body.name, body.version, options),
    explainPermission: (query, options) => api.explainPermission(query, options),
    admin: createAdminClient(api),
    listProposals: (query, options) => api.listProposals(query, options),
    getProposal: (id, options) => api.getProposal(id, options),
    approveProposal: (id, digest, options) => api.approveProposal(id, digest, options),
    rejectProposal: (id, options) => api.rejectProposal(id, options),
    // Bağlı hesap istemcisi ayrı parçadadır. Yalnız hesap sayfası açılınca yüklenir.
    linkedAccounts: () => import('../api/login-client').then((m) => m.createLoginClient(api)),
    // Sağlayıcı istemcisi ayrı parçadadır. Yalnız sayfa açılınca yüklenir (ilk yük bütçesi).
    aiProviders: () => import('../api/provider-client').then((m) => m.createProviderClient(api)),
    // Bayi istemcisi ayrı parçadadır. Yalnız "Müşteriler" sayfası açılınca yüklenir.
    resellers: () => import('../api/reseller-client').then((m) => m.createResellerClient(api)),
    // Kullanıcı yönetimi istemcisi ayrı parçadadır. Yalnız "Yönetim" sayfası açılınca yüklenir.
    userAdmin: () =>
      import('./administration/users-client').then((m) => m.createUserAdminClient(api)),
    // Özelleştirme istemcisi ayrı parçadadır. Yalnız "Özelleştirme" sayfası açılınca yüklenir.
    customization: () =>
      import('./customization/client').then((m) => m.createCustomizationClient(api)),
  };
}

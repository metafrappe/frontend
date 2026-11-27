// Sample data for the mock server. All values are samples (SZ-12).
// Types are generated from the contract. If the contract changes, type checking fails in this file.
import type { components as HrmsComponents } from '@/api/generated/hrms_tr';
import type { components as AccessComponents } from '@/api/generated/platform_core-access';
import type { components as AiComponents } from '@/api/generated/platform_core-ai';
import type { components as IdentityComponents } from '@/api/generated/platform_core-identity';
import type { components as GatewayComponents } from '@/api/generated/platform_core-model-gateway';
import type { components as ShellComponents } from '@/api/generated/platform_core-shell';

type Bootstrap = ShellComponents['schemas']['Bootstrap'];
type Meta = ShellComponents['schemas']['Meta'];
type LoginUrl = IdentityComponents['schemas']['LoginUrl'];
type LogoutUrl = IdentityComponents['schemas']['LogoutUrl'];
type Proposal = AiComponents['schemas']['Proposal'];
type GatewayResult = GatewayComponents['schemas']['Result'];
type ProviderCatalog = GatewayComponents['schemas']['ProviderCatalog'];
type ConnectionStatus = GatewayComponents['schemas']['ConnectionCheck']['status'];

export const SAMPLE_USER = 'ornek.kisi@example.test';
export const SAMPLE_CSRF_TOKEN = 'ornek-csrf-belirteci';
/**
 * The mock server's Keycloak origin. This origin is the AtonotA Login sign-in address.
 * Browser tests fake this address's response.
 */
export const SAMPLE_KEYCLOAK_URL = 'https://api.login.atonota.net';
export const SAMPLE_DIGEST = 'a'.repeat(64);

export const sampleLoginUrl: LoginUrl = {
  login_url:
    `${SAMPLE_KEYCLOAK_URL}/realms/platform/protocol/openid-connect/auth` +
    '?client_id=site-tenant1&response_type=code&scope=openid&state=ornek&nonce=ornek' +
    '&code_challenge=ornek&code_challenge_method=S256' +
    '&redirect_uri=https%3A%2F%2Fkiraci.example.test%2Fapi%2Fmethod%2Fplatform_core.api.auth.keycloak_callback',
  brand_name: 'AtonotA Login',
  label: 'AtonotA Login ile oturum aç',
};

/**
 * The mock server's sign-in platform records (G-159). On the real server they come from a data
 * file.
 * A record with `enabled: false` is disabled. Disabled records are not in the response.
 * The order is the response order.
 */
export const sampleLoginProviders: readonly {
  alias: string;
  display_name: string;
  enabled: boolean;
}[] = [
  { alias: 'google', display_name: 'Google', enabled: true },
  { alias: 'facebook', display_name: 'Facebook', enabled: true },
  { alias: 'linkedin', display_name: 'LinkedIn', enabled: true },
  { alias: 'x', display_name: 'X', enabled: true },
  // A platform with no secret stays disabled. It does not appear on the sign-in screen.
  { alias: 'github', display_name: 'GitHub', enabled: false },
];

/** The sample user's linked platforms. There is no password or passkey. */
export const sampleLinkedProviders: readonly string[] = ['google', 'linkedin'];
export const SAMPLE_LOCAL_SIGN_IN_METHODS = 0;

export const sampleLogoutUrl: LogoutUrl = {
  logout_url: `${SAMPLE_KEYCLOAK_URL}/realms/platform/protocol/openid-connect/logout?client_id=site-tenant1`,
};

/**
 * A sign-out address on another origin. The panel does not go there. Scenario `cikis-yabanci-adres`
 * returns it.
 */
export const FOREIGN_LOGOUT_URL =
  'https://baska.example.test/realms/platform/protocol/openid-connect/logout?client_id=site-tenant1';

export const sampleBootstrap: Bootstrap = {
  formatting: {
    currency: 'TRY',
    number_format: '#.###,##',
    rounding_method: "Banker's Rounding",
    time_zone: 'Europe/Istanbul',
    date_format: 'dd.mm.yyyy',
    time_format: 'HH:mm',
    first_day_of_the_week: 'Monday',
  },
  installed_apps: ['frappe', 'platform_core'],
  languages: [
    { code: 'en', name: 'English' },
    { code: 'tr', name: 'Türkçe' },
  ],
  meta_hash: 'b'.repeat(64),
  perm_version: 'c'.repeat(64),
  sidebars: [],
  user: {
    full_name: 'Örnek Kişi',
    language: 'tr',
    name: SAMPLE_USER,
    roles: ['Employee'],
  },
  workspaces: [
    {
      app: 'platform_core',
      icon: null,
      module: 'Örnek',
      name: 'Örnek Çalışma Alanı',
      parent_page: null,
      title: 'Örnek Çalışma Alanı',
    },
  ],
};

export const sampleDocTypeMeta: Meta = {
  catalog_version: 2,
  child_tables: {},
  meta_hash: 'd'.repeat(64),
  mobile_cache_allowed: false,
  perm_version: 'e'.repeat(64),
  schema: {
    name: 'Örnek Kayıt',
    module: 'Örnek',
    sensitivity: 'standard',
    title_field: 'title',
    search_fields: 'title',
    sort_field: null,
    fields: [
      {
        fieldname: 'title',
        fieldtype: 'Data',
        label: 'Örnek başlık',
        read_only: false,
        reqd: true,
        component: 'input',
        sensitivity: 'standard',
      },
      // Multi-line text. The backend gives a Small Text field the component name `text-area`
      // (frappesetup backend: platform_core/shell/catalog.py).
      {
        fieldname: 'aciklama',
        fieldtype: 'Small Text',
        label: 'Açıklama',
        read_only: false,
        component: 'text-area',
        sensitivity: 'standard',
      },
      // Link fields. The backend gives a Link field the component name `link-select`
      // (frappesetup backend: platform_core/shell/catalog.py).
      {
        fieldname: 'ilgili_kayit',
        fieldtype: 'Link',
        label: 'İlgili kayıt',
        options: 'Örnek Kayıt',
        read_only: false,
        component: 'link-select',
        sensitivity: 'standard',
      },
      {
        fieldname: 'kaynak_kayit',
        fieldtype: 'Link',
        label: 'Kaynak kayıt',
        options: 'Örnek Kayıt',
        read_only: true,
        component: 'link-select',
        sensitivity: 'standard',
      },
      // The mock server denies permission for the target type. The search shows no records.
      {
        fieldname: 'gizli_kayit',
        fieldtype: 'Link',
        label: 'Gizli kayıt',
        options: 'Gizli Örnek Kayıt',
        read_only: false,
        component: 'link-select',
        sensitivity: 'standard',
      },
    ],
  },
};

export const SAMPLE_DOCTYPE_ETAG = '"ornek-etag-1"';

export function sampleProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    proposal_id: 'ornek-oneri-1',
    source_proposal: null,
    status: 'pending',
    result: '',
    tool: 'plt_create_document',
    target_doctype: 'Örnek Kayıt',
    target_name: null,
    destructive: false,
    billable: false,
    preview: {
      action: 'create',
      summary: 'Yeni bir örnek kayıt açılacak.',
      changes: [{ fieldname: 'title', label: 'Örnek başlık', new: 'Örnek veri' }],
    },
    digest: SAMPLE_DIGEST,
    expires_at: '2026-11-23T12:00:00+00:00',
    created_at: '2026-11-23T11:50:00+00:00',
    result_document: null,
    error: null,
    first_approved_at: null,
    risk_level: 'R1',
    second_approved_at: null,
    second_approver: null,
    ...overrides,
  };
}

export const sampleDocuments = [
  { name: 'ORNEK-0001', title: 'Örnek veri 1' },
  { name: 'ORNEK-0002', title: 'Örnek veri 2' },
];

export const sampleTools = [
  {
    name: 'plt_list_documents',
    description: 'List documents the user may read.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['doctype'],
      properties: { doctype: { type: 'string', minLength: 1 } },
    },
  },
  {
    name: 'plt_create_document',
    description: 'Propose a new document. Nothing is written until a human approves the proposal.',
    annotations: { readOnlyHint: false, destructiveHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['doctype', 'data'],
      properties: { doctype: { type: 'string', minLength: 1 }, data: { type: 'object' } },
    },
  },
];

export function sampleCompletion(overrides: Partial<GatewayResult> = {}): GatewayResult {
  return {
    text: '',
    tool_calls: [],
    usage: { input: 12, output: 8 },
    model: 'ornek-model',
    api: 'ornek-api',
    ...overrides,
  };
}

// HRMS leave applications. All values are samples.
type LeaveApplication = HrmsComponents['schemas']['LeaveApplication'];
type AccessSummary = AccessComponents['schemas']['AccessSummary'];

export const sampleLeaves: LeaveApplication[] = [
  {
    name: 'ORNEK-IZIN-0001',
    employee: 'ORNEK-CALISAN-01',
    employee_name: 'Örnek Kişi',
    leave_type: 'Örnek Yıllık İzin',
    from_date: '2026-11-24',
    to_date: '2026-11-25',
    status: 'Open',
    docstatus: 0,
    modified: '2026-11-22 09:00:00.000001',
    total_leave_days: 2,
  },
  {
    name: 'ORNEK-IZIN-0002',
    employee: 'ORNEK-CALISAN-02',
    employee_name: 'Örnek Kişi 2',
    leave_type: 'Örnek Yıllık İzin',
    from_date: '2026-12-01',
    to_date: '2026-12-01',
    status: 'Approved',
    docstatus: 1,
    modified: '2026-11-22 09:05:00.000001',
    total_leave_days: 1,
  },
];

/**
 * The second open application of the "ana-sayfa-iki-bekleyen" scenario.
 * It is not in the default list, so the row count of other tests does not change.
 */
export const sampleSecondOpenLeave: LeaveApplication = {
  name: 'ORNEK-IZIN-0003',
  employee: 'ORNEK-CALISAN-03',
  employee_name: 'Örnek Kişi 3',
  leave_type: 'Örnek Yıllık İzin',
  from_date: '2026-12-08',
  to_date: '2026-12-12',
  status: 'Open',
  docstatus: 0,
  modified: '2026-11-22 09:10:00.000001',
  total_leave_days: 5,
};

type HomeProblem = HrmsComponents['schemas']['HomeProblem'];
type RecentChange = HrmsComponents['schemas']['RecentChange'];

/** The home page's problem records. Conflicts come first, then employee records. */
export const sampleHomeProblems: HomeProblem[] = [
  {
    kind: 'overlap',
    department: 'Örnek Ekip A',
    leaves: [
      {
        name: 'ORNEK-IZIN-0038',
        employee_name: 'Örnek Kişi 4',
        from_date: '2026-12-14',
        to_date: '2026-12-15',
      },
      {
        name: 'ORNEK-IZIN-0039',
        employee_name: 'Örnek Kişi 5',
        from_date: '2026-12-15',
        to_date: '2026-12-16',
      },
    ],
  },
  { kind: 'missing_joining_date', employee: 'ORNEK-CALISAN-08', employee_name: 'Örnek Kişi 8' },
];

/** The home page's recent changes. Newest first. */
export const sampleRecentChanges: RecentChange[] = [
  {
    name: 'ORNEK-IZIN-0002',
    employee_name: 'Örnek Kişi 2',
    actor: 'Örnek Kişi',
    action: 'approved',
    at: '2026-11-22 09:05:00.000001',
  },
  {
    name: 'ORNEK-IZIN-0001',
    employee_name: 'Örnek Kişi',
    actor: 'Örnek Kişi',
    action: 'created',
    at: '2026-11-22 09:00:00.000001',
  },
];

/** The home page's fixed counts. The pending and problem counts are computed in the mock server. */
export const sampleHomeCounts = { on_leave_today: 1, opened_this_month: 3 };

export const sampleAccessSummary: AccessSummary = {
  doctype: 'Örnek Kayıt',
  governed: true,
  operations: {
    read: ['own', 'team'],
    write: ['own'],
    create: ['own'],
    delete: [],
    submit: [],
    cancel: [],
  },
};

// Phone and PWA installations. The IDs are samples.
export const sampleInstallations = [
  {
    installation_id: '20000000-0000-4000-8000-000000000001',
    scope: 'mobile' as const,
    revoked: false,
  },
  {
    installation_id: '30000000-0000-4000-8000-000000000001',
    scope: 'pwa' as const,
    revoked: false,
  },
  {
    installation_id: '40000000-0000-4000-8000-000000000001',
    scope: 'mobile' as const,
    revoked: true,
  },
];

// Press is a separate origin. The panel only redirects to Press's account deletion page.
export const SAMPLE_PRESS_URL = 'https://press.example.test';

// Sample records for views-collection (Frappe API v2 list endpoint).
export const SAMPLE_COLLECTION_DOCTYPE = sampleDocTypeMeta.schema.name;
/** The mock server denies permission for this record type. */
export const RESTRICTED_SAMPLE_DOCTYPE = 'Gizli Örnek Kayıt';
/**
 * Module types the sample user can read. The menu probes them with the definition endpoint (G-94).
 * The mock server already serves leave applications and AI connections.
 * The list matches the `requires` fields in `src/modules/registry.ts`. A test checks this.
 */
export const MENU_READABLE_DOCTYPES: readonly string[] = [
  'PLT AI API',
  'PLT AI Account',
  'PLT AI Provider',
  'Leave Application',
];

/**
 * Module types the reseller account reads at the definition endpoint. The list is empty (AJA-945).
 * The real server returns 403 for the link type (`Reseller Customer Link`), also to resellers.
 * The panel recognises a reseller account by the customer list endpoint (`list_customers`).
 */
export const RESELLER_READABLE_DOCTYPES: readonly string[] = [];

/**
 * Mock server data for the four panel roles (AJA-831). The scenarios are in `scenarios.ts`.
 * `roles` goes into the boot data. `readable` lists the types the definition endpoint answers with
 * 200.
 */
export const PANEL_ROLE_PROFILES: Record<string, { roles: string[]; readable: readonly string[] }> =
  {
    'Tenant Admin': { roles: ['Website User', 'Tenant Admin'], readable: MENU_READABLE_DOCTYPES },
    // The assistant cannot see AI providers (G-168).
    'Tenant Admin Assistant': {
      roles: ['Website User', 'Tenant Admin Assistant'],
      readable: ['Leave Application'],
    },
    'Reseller Admin': {
      roles: ['Website User', 'Reseller Admin'],
      readable: RESELLER_READABLE_DOCTYPES,
    },
    'Reseller Assistant': {
      roles: ['Website User', 'Reseller Assistant'],
      readable: RESELLER_READABLE_DOCTYPES,
    },
  };

/** The reseller's linked sample customers. The names are made up and end with `example.test`. */
export const sampleResellerCustomers: readonly { customer_tenant: string; status: string }[] = [
  { customer_tenant: 'musteri-a.example.test', status: 'active' },
  { customer_tenant: 'musteri-b.example.test', status: 'pending' },
];

export const sampleCollection = Array.from({ length: 23 }, (_unused, index) => {
  const number = index + 1;
  return {
    name: `ORNEK-${String(number).padStart(4, '0')}`,
    title: `Örnek veri ${number}`,
    status: number % 3 === 0 ? 'Kapalı' : 'Açık',
    amount: number * 25,
    modified: `2026-11-${String(1 + (number % 22)).padStart(2, '0')} 09:00:00.000000`,
  };
});

// AI provider connections (model gateway contract: provider_catalog, save_connection,
// check_connection). The catalogue is the backend `provider_catalog.json`, filtered by the
// contract: the `adapter`, `default_url` and `target` fields are not sent to the browser. Labels
// arrive translated into the session language; the sample session is Turkish.
const secretField = {
  name: 'api_key',
  label: 'API anahtarı',
  kind: 'secret',
  required: true,
  scope: 'api',
  description: 'Sağlayıcı panelinden aldığınız gizli anahtar.',
} as const;
const serviceAddressField = (description: string) =>
  ({
    name: 'base_url',
    label: 'Hizmet adresi',
    kind: 'url',
    required: true,
    scope: 'api',
    description,
  }) as const;
const commonFields: ProviderCatalog['providers'][number]['common_fields'] = [
  {
    name: 'account_name',
    label: 'Hesap adı',
    kind: 'text',
    required: true,
    scope: 'account',
    description: 'Bu sitedeki sağlayıcı hesabının adı.',
  },
  {
    name: 'api_name',
    label: 'Bağlantı adı',
    kind: 'text',
    required: true,
    scope: 'api',
    description: 'Bu API bağlantısının adı.',
  },
];

export const sampleProviderCatalog: ProviderCatalog = {
  version: 1,
  categories: [{ id: 'ai_llm', label: 'AI LLM', description: 'Büyük dil modeli sağlayıcıları.' }],
  providers: [
    {
      id: 'openai',
      category: 'ai_llm',
      label: 'OpenAI',
      description: 'Kurum API anahtarıyla OpenAI API.',
      auth_type: 'api_key',
      fields: [
        secretField,
        {
          name: 'organization_id',
          label: 'Kurum kimliği',
          kind: 'text',
          required: false,
          scope: 'account',
          description: 'İsteğe bağlı kurum kimliği. Geçit bu hesabın her isteğinde gönderir.',
        },
        {
          name: 'project_id',
          label: 'Proje kimliği',
          kind: 'text',
          required: false,
          scope: 'account',
          description: 'İsteğe bağlı proje kimliği. Geçit bu hesabın her isteğinde gönderir.',
        },
      ],
      common_fields: commonFields,
    },
    {
      id: 'anthropic',
      category: 'ai_llm',
      label: 'Anthropic',
      description: 'Çalışma alanı API anahtarıyla Anthropic API.',
      auth_type: 'api_key',
      fields: [secretField],
      common_fields: commonFields,
    },
    {
      id: 'gemini',
      category: 'ai_llm',
      label: 'Google Gemini',
      description: 'Google AI Studio API anahtarıyla Gemini API.',
      auth_type: 'api_key',
      fields: [secretField],
      common_fields: commonFields,
    },
    {
      id: 'openai_compatible',
      category: 'ai_llm',
      label: 'OpenAI uyumlu hizmet',
      description: 'OpenAI istek biçimini kendi adresinde kabul eden hizmet.',
      auth_type: 'bearer',
      fields: [
        serviceAddressField('İşlem yolu olmadan hizmet adresi.'),
        { ...secretField, description: 'Hizmetin gizli taşıyıcı belirteci.' },
      ],
      common_fields: commonFields,
    },
    {
      id: 'ollama',
      category: 'ai_llm',
      label: 'Ollama',
      description: 'Platformun kendi ağındaki model sunucusu. Anahtar istemez.',
      auth_type: 'none',
      fields: [serviceAddressField('Platformun kendi ağındaki model sunucusunun adresi.')],
      common_fields: commonFields,
    },
  ],
};

/** Frappe record types. The names are the backend DocType names. */
export const AI_PROVIDER_DOCTYPE = 'PLT AI Provider';
export const AI_ACCOUNT_DOCTYPE = 'PLT AI Account';
export const AI_API_DOCTYPE = 'PLT AI API';

export interface SampleAiProvider {
  name: string;
  provider_name: string;
  catalog_provider: string;
  enabled: 0 | 1;
  modified: string;
}
export interface SampleAiAccount {
  name: string;
  account_name: string;
  provider: string;
  enabled: 0 | 1;
  modified: string;
}
/** The readable fields of the API record. The password field (`api_key`) is never in the list. */
export interface SampleAiConnection {
  name: string;
  api_name: string;
  account: string;
  connection_status: ConnectionStatus | 'not_checked';
  connection_checked_at: string | null;
  health_status: 'healthy' | 'unhealthy' | 'auth_failed';
  enabled: 0 | 1;
  modified: string;
}

export const sampleAiProviders: SampleAiProvider[] = [
  {
    name: 'OpenAI',
    provider_name: 'OpenAI',
    catalog_provider: 'openai',
    enabled: 1,
    modified: '2026-11-20 09:00:00.000001',
  },
];
export const sampleAiAccounts: SampleAiAccount[] = [
  {
    name: 'ORNEK-HESAP-0001',
    account_name: 'Örnek hesap',
    provider: 'OpenAI',
    enabled: 1,
    modified: '2026-11-20 09:00:00.000002',
  },
];
export const sampleAiConnections: SampleAiConnection[] = [
  {
    name: 'ORNEK-API-0001',
    api_name: 'Birincil bağlantı',
    account: 'ORNEK-HESAP-0001',
    connection_status: 'connected',
    connection_checked_at: '2026-11-20 09:05:00',
    health_status: 'healthy',
    enabled: 1,
    modified: '2026-11-20 09:05:00.000003',
  },
  {
    name: 'ORNEK-API-0002',
    api_name: 'Yedek bağlantı',
    account: 'ORNEK-HESAP-0001',
    connection_status: 'not_checked',
    connection_checked_at: null,
    health_status: 'healthy',
    enabled: 1,
    modified: '2026-11-21 09:00:00.000004',
  },
];

/**
 * The result of the mock live check comes from the secret key value, so tests can cover every
 * result with the mock server. No request goes to a real provider. The key is never in a response.
 */
export const SAMPLE_SECRET_RESULTS: Record<string, ConnectionStatus> = {
  'gecersiz-anahtar': 'invalid_credentials',
  'izin-yok': 'permission_denied',
  'kota-dolu': 'quota_exceeded',
  'ag-hatasi': 'network_error',
  'saglayici-hatasi': 'provider_error',
  'kayit-eksik': 'configuration_error',
};
/** This address is not on the approved address list. */
export const SAMPLE_UNAPPROVED_URL = 'https://onaysiz.example.test';

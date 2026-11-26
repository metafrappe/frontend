// Sahte sunucunun örnek verisi. Bütün değerler örnektir (SZ-12).
// Türler sözleşmeden üretilir. Sözleşme değişirse tür denetimi bu dosyada hata verir.
import type { components as HrmsComponents } from '@/api/generated/hrms_tr';
import type { components as AccessComponents } from '@/api/generated/platform_core-access';
import type { components as AiComponents } from '@/api/generated/platform_core-ai';
import type { components as HelpComponents } from '@/api/generated/platform_core-help';
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
 * Sahte sunucunun Keycloak kökü. Bu kök AtonotA Login giriş adresidir.
 * Tarayıcı testleri bu adresin yanıtını taklit eder.
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
 * Sahte sunucunun giriş platformu kayıtları (G-159). Gerçek sunucuda bu kayıtlar veri dosyasından gelir.
 * `enabled: false` olan kayıt kapalıdır. Kapalı kayıt yanıta girmez. Sıra yanıtın sırasıdır.
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
  // Sırrı olmayan platform kapalı kalır. Giriş ekranında görünmez.
  { alias: 'github', display_name: 'GitHub', enabled: false },
];

/** Örnek kullanıcının bağlı platformları. Parola ya da geçiş anahtarı yoktur. */
export const sampleLinkedProviders: readonly string[] = ['google', 'linkedin'];
export const SAMPLE_LOCAL_SIGN_IN_METHODS = 0;

export const sampleLogoutUrl: LogoutUrl = {
  logout_url: `${SAMPLE_KEYCLOAK_URL}/realms/platform/protocol/openid-connect/logout?client_id=site-tenant1`,
};

/** Başka kökenli çıkış adresi. Panel bu adrese gitmez. Senaryo `cikis-yabanci-adres` bunu verir. */
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
      // Çok satırlı metin. Arka uç Small Text alanına `text-area` bileşen adını verir
      // (frappesetup backend: platform_core/shell/catalog.py).
      {
        fieldname: 'aciklama',
        fieldtype: 'Small Text',
        label: 'Açıklama',
        read_only: false,
        component: 'text-area',
        sensitivity: 'standard',
      },
      // Bağlantı alanları. Arka uç Link alanına `link-select` bileşen adını verir
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
      // Hedef tür için sahte sunucu yetki reddi verir. Arama kayıt göstermez.
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

// HRMS izin başvuruları. Bütün değerler örnektir.
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
 * "ana-sayfa-iki-bekleyen" senaryosunun ikinci açık başvurusu.
 * Varsayılan listede yoktur. Böylece öteki testlerin satır sayısı değişmez.
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

/** Ana sayfanın sorunlu kayıtları. Çakışmalar önce, çalışan kayıtları sonra gelir. */
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

/** Ana sayfanın son değişiklikleri. En yeni önce gelir. */
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

/** Ana sayfanın sabit sayıları. Bekleyen ve sorunlu sayısı sahte sunucuda hesaplanır. */
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

// Telefon ve PWA kurulumları. Kimlikler örnektir.
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

// Press ayrı bir köktür. Panel yalnız Press'in hesap silme sayfasına yönlendirir.
export const SAMPLE_PRESS_URL = 'https://press.example.test';

// views-collection için örnek kayıtlar (Frappe API v2 liste ucu).
export const SAMPLE_COLLECTION_DOCTYPE = sampleDocTypeMeta.schema.name;
/** Bu kayıt türü için sahte sunucu yetki reddi verir. */
export const RESTRICTED_SAMPLE_DOCTYPE = 'Gizli Örnek Kayıt';
/**
 * Örnek kullanıcının okuyabildiği modül türleri. Menü bu türleri tanım ucuyla dener (G-94).
 * Sahte sunucu izin başvurularını ve yapay zekâ bağlantılarını zaten verir.
 * Liste `src/modules/registry.ts` içindeki `requires` alanlarıyla aynıdır. Test eşitliği denetler.
 */
export const MENU_READABLE_DOCTYPES: readonly string[] = [
  'PLT AI API',
  'PLT AI Account',
  'PLT AI Provider',
  'Leave Application',
];

/**
 * Bayi hesabının tanım ucunda okuduğu modül türleri. Liste boştur (AJA-945).
 * Gerçek sunucu bağ türüne (`Reseller Customer Link`) bayiye de 403 verir.
 * Panel bayi hesabını müşteri listesi ucuyla tanır (`list_customers`).
 */
export const RESELLER_READABLE_DOCTYPES: readonly string[] = [];

/**
 * Dört panel rolünün sahte sunucu verisi (AJA-831). Senaryolar `scenarios.ts` dosyasındadır.
 * `roles` açılış verisine yazılır. `readable` tanım ucunun 200 verdiği türlerdir.
 */
export const PANEL_ROLE_PROFILES: Record<string, { roles: string[]; readable: readonly string[] }> =
  {
    'Tenant Admin': { roles: ['Website User', 'Tenant Admin'], readable: MENU_READABLE_DOCTYPES },
    // Yardımcı yapay zekâ sağlayıcılarını göremez (G-168).
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

/** Bayinin bağlı örnek müşterileri. Adlar uydurmadır ve `example.test` ile biter. */
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

// Yapay zekâ sağlayıcı bağlantıları (model geçidi sözleşmesi: provider_catalog, save_connection,
// check_connection). Katalog, arka uçtaki `provider_catalog.json` dosyasının sözleşmeye göre
// süzülmüş hâlidir: `adapter`, `default_url` ve `target` alanları tarayıcıya gitmez. Etiketler
// oturum diline çevrilmiş gelir; örnek oturum Türkçedir.
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

/** Frappe kayıt türleri. Adlar arka uçtaki DocType adlarıdır. */
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
/** API kaydının okunan alanları. Parola alanı (`api_key`) listede hiç yoktur. */
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
 * Sahte canlı denemenin sonucu gizli anahtarın değerinden gelir. Böylece testler her sonucu
 * sahte sunucuyla sınar. Gerçek sağlayıcıya istek gitmez. Anahtar yanıta hiç yazılmaz.
 */
export const SAMPLE_SECRET_RESULTS: Record<string, ConnectionStatus> = {
  'gecersiz-anahtar': 'invalid_credentials',
  'izin-yok': 'permission_denied',
  'kota-dolu': 'quota_exceeded',
  'ag-hatasi': 'network_error',
  'saglayici-hatasi': 'provider_error',
  'kayit-eksik': 'configuration_error',
};
/** Bu adres onaylı adres listesinde değildir. */
export const SAMPLE_UNAPPROVED_URL = 'https://onaysiz.example.test';

// Yardım içeriği (platform_core-help sözleşmesi 0.2.0, G-138). Adresler örnektir.
// Kayıt formu üç bağlantı verir. "Örnek başlık" alanı destek bağlantısı vermez.
export const sampleComponentHelp: HelpComponents['schemas']['ComponentHelp'] = {
  component_id: 'record-form',
  source: 'tenant',
  topic: 'HT-ORNEK-2',
  title: 'Kayıt formu',
  content: 'Kaydı bu formda düzenlersiniz. Değişikliği "Kaydet" düğmesiyle saklarsınız.',
  message: null,
  actions: [],
  tour_url: '/tours/record-form',
  doc_url: 'https://docs.example.test/kayit-formu',
  support_url: '/helpdesk/new',
};

export const sampleFieldHelp: HelpComponents['schemas']['FieldHelp'] = {
  doctype: 'Örnek Kayıt',
  fieldname: 'title',
  source: 'app',
  topic: 'HT-ORNEK-1',
  title: 'Örnek başlık',
  content: 'Kaydın kısa adını yazın. Ad listede görünür.',
  message: null,
  actions: [],
  tour_url: '/tours/ornek-baslik',
  doc_url: 'https://docs.example.test/ornek-baslik',
  support_url: null,
};

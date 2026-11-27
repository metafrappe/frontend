// Contract-compliant mock endpoints (SZ-12). Development and tests do not connect to a real
// backend.
// Addresses have the form `*/api/method/...`, so they work on every origin.
import { http, HttpResponse, matchRequestUrl, type JsonBodyType } from 'msw';

import { TOOL_RESULT_PREFIX } from '@/api/ai-protocol';
import { resetUserAdminState, userAdminHandlers } from './user-admin';
import { GROUP_SUMMARY_PATH } from '@/api/group-summary';
import { adminHandlers } from './admin';
import type { components as CollectionComponents } from '@/api/generated/platform_core-collection';

import {
  AI_ACCOUNT_DOCTYPE,
  AI_API_DOCTYPE,
  AI_PROVIDER_DOCTYPE,
  SAMPLE_SECRET_RESULTS,
  SAMPLE_UNAPPROVED_URL,
  type SampleAiAccount,
  type SampleAiConnection,
  type SampleAiProvider,
  sampleAiAccounts,
  sampleAiConnections,
  sampleAiProviders,
  sampleProviderCatalog,
  SAMPLE_USER as SAMPLE_ACCOUNT,
  sampleAccessSummary,
  sampleInstallations,
  MENU_READABLE_DOCTYPES,
  RESTRICTED_SAMPLE_DOCTYPE,
  sampleResellerCustomers,
  SAMPLE_COLLECTION_DOCTYPE,
  sampleCollection,
  sampleHomeCounts,
  sampleHomeProblems,
  sampleLeaves,
  sampleRecentChanges,
  SAMPLE_CSRF_TOKEN,
  SAMPLE_DOCTYPE_ETAG,
  SAMPLE_USER,
  sampleBootstrap,
  sampleCompletion,
  sampleDocTypeMeta,
  sampleDocuments,
  sampleLoginUrl,
  sampleLoginProviders,
  sampleLinkedProviders,
  SAMPLE_LOCAL_SIGN_IN_METHODS,
  FOREIGN_LOGOUT_URL,
  sampleLogoutUrl,
  sampleProposal,
  sampleTools,
} from './fixtures';
import { sampleCommunicationMeta, sampleCommunications } from './communication';

const COMMUNICATION_DOCTYPE = sampleCommunicationMeta.schema.name;

/** Mock server state. Tests can change these values. Reset with `resetMockState`. */
/**
 * Errors and HTTP statuses the mock model gateway can return.
 * The codes come from the `Error` list in the model gateway contract.
 * The statuses come from the response names in the contract: BadRequest 400, PermissionError 403,
 * Conflict 409, QuotaError 429, Unavailable 503.
 */
export const GATEWAY_FAILURES = {
  invalid_route: 400,
  data_policy_denied: 403,
  transaction_active: 409,
  quota_exceeded: 429,
  gateway_busy: 429,
  provider_unavailable: 503,
  provider_timeout: 503,
  gateway_unavailable: 503,
} as const;

export type GatewayFailure = keyof typeof GATEWAY_FAILURES;

/**
 * The mock `start_login` address is written to session storage under this key. A browser test reads
 * it.
 */
export const MOCK_START_LOGIN_KEY = 'atonota.mock-start-login';
/**
 * The mock `start_link` address is written to session storage under this key. A browser test reads
 * it.
 */
export const MOCK_START_LINK_KEY = 'atonota.mock-start-link';

/**
 * Response of the mock sign-out endpoint.
 * `ok`: sample Keycloak sign-out address. `failure`: server error, the session stays open.
 * `foreign_url`: a sign-out address on another origin. The panel must not go there.
 */
export type LogoutOutcome = 'ok' | 'failure' | 'foreign_url';

export const mockState: {
  signedIn: boolean;
  proposals: Map<string, ReturnType<typeof sampleProposal>>;
  leaves: Map<string, (typeof sampleLeaves)[number]>;
  /** Home page summary. If `failure` is true, the summary endpoint returns 500. */
  home: {
    failure: boolean;
    /**
     * If true, the summary gives pending requests an old version. Approve and reject get a
     * conflict.
     */
    staleVersions: boolean;
    problems: (typeof sampleHomeProblems)[number][];
    recentChanges: (typeof sampleRecentChanges)[number][];
  };
  /** Records of the sample record DocType. List, read and save use the same data. */
  records: Map<string, CollectionRow>;
  installations: { installation_id: string; scope: 'mobile' | 'pwa'; revoked: boolean }[];
  /** If set, the model gateway returns this error. Tests use it to check the error screen. */
  gatewayFailure: GatewayFailure | undefined;
  /** Response of the sign-out endpoint. Tests use it to check the error path. */
  logoutOutcome: LogoutOutcome;
  /** Sign-in platform records. Only enabled ones are in the response (G-159). */
  loginProviders: { alias: string; display_name: string; enabled: boolean }[];
  /** The sample user's linked platforms (G-160). */
  linkedAccounts: Set<string>;
  /** Number of non-platform sign-in methods. Example: password. */
  localSignInMethods: number;
  /** AI provider, account and API connection records. The password field is not here. */
  aiProviders: Map<string, SampleAiProvider>;
  aiAccounts: Map<string, SampleAiAccount>;
  aiConnections: Map<string, SampleAiConnection>;
  /** If true, the save and check endpoints return a rate limit (429 `gateway_busy`). */
  providerBusy: boolean;
  /** User roles in the boot data. Role scenarios change them (AJA-831). */
  roles: string[];
  /** Module types the definition endpoint answers with 200 (G-94). Other types get 403. */
  readableDocTypes: Set<string>;
  /** Submitted new customer requests (G-169). */
  customerRequests: { name: string; customer_name: string; contact_email: string }[];
} = {
  roles: [...sampleBootstrap.user.roles],
  readableDocTypes: new Set(MENU_READABLE_DOCTYPES),
  customerRequests: [],
  loginProviders: sampleLoginProviders.map((item) => ({ ...item })),
  linkedAccounts: new Set(sampleLinkedProviders),
  localSignInMethods: SAMPLE_LOCAL_SIGN_IN_METHODS,
  gatewayFailure: undefined,
  logoutOutcome: 'ok',
  aiProviders: new Map(sampleAiProviders.map((item) => [item.name, { ...item }])),
  aiAccounts: new Map(sampleAiAccounts.map((item) => [item.name, { ...item }])),
  aiConnections: new Map(sampleAiConnections.map((item) => [item.name, { ...item }])),
  providerBusy: false,
  signedIn: true,
  proposals: new Map<string, ReturnType<typeof sampleProposal>>(),
  leaves: new Map(sampleLeaves.map((leave) => [leave.name, { ...leave }])),
  home: sampleHome(),
  records: sampleRecords(),
  installations: sampleInstallations.map((item) => ({ ...item })),
};

function enabledProviders(): { alias: string; display_name: string }[] {
  return mockState.loginProviders
    .filter((item) => item.enabled)
    .map(({ alias, display_name }) => ({ alias, display_name }));
}

/** Enabled platforms, plus linked platforms that are now disabled. */
function linkedAccounts() {
  const providers = mockState.loginProviders
    .filter((item) => item.enabled || mockState.linkedAccounts.has(item.alias))
    .map(({ alias, display_name }) => ({
      alias,
      display_name,
      linked: mockState.linkedAccounts.has(alias),
    }));
  return { providers, local_sign_in_methods: mockState.localSignInMethods };
}

function sampleHome(): (typeof mockState)['home'] {
  return {
    failure: false,
    staleVersions: false,
    problems: structuredClone(sampleHomeProblems),
    recentChanges: structuredClone(sampleRecentChanges),
  };
}

const STALE_VERSION = '2000-01-01 00:00:00.000000';

/**
 * Adds the decision to the top of recent changes. As in the contract, the list holds at most 5
 * items.
 */
function recordLeaveChange(
  leave: (typeof sampleLeaves)[number],
  action: 'approved' | 'rejected' | 'cancelled',
  at: string,
): void {
  mockState.home.recentChanges = [
    {
      name: leave.name,
      employee_name: leave.employee_name ?? null,
      actor: 'Örnek Kişi',
      action,
      at,
    },
    ...mockState.home.recentChanges.filter((item) => item.name !== leave.name),
  ].slice(0, 5);
}

function homeSummary() {
  const pending = [...mockState.leaves.values()]
    .filter((leave) => leave.status === 'Open' && leave.docstatus === 0)
    .sort((a, b) => (a.from_date ?? '').localeCompare(b.from_date ?? ''))
    .map((leave) => ({
      name: leave.name,
      version: mockState.home.staleVersions ? STALE_VERSION : (leave.modified ?? ''),
      employee_name: leave.employee_name ?? null,
      leave_type: leave.leave_type ?? null,
      from_date: leave.from_date ?? null,
      to_date: leave.to_date ?? null,
      total_leave_days: leave.total_leave_days ?? null,
      leave_balance: leave.leave_balance ?? null,
    }));
  return {
    pending_approvals: pending,
    problems: mockState.home.problems,
    recent_changes: mockState.home.recentChanges,
    counts: {
      pending_approvals: pending.length,
      on_leave_today: sampleHomeCounts.on_leave_today,
      opened_this_month: sampleHomeCounts.opened_this_month,
      problems: mockState.home.problems.length,
    },
  };
}

function sampleRecords(): Map<string, CollectionRow> {
  return new Map(sampleCollection.map((row) => [row.name, { ...row }]));
}

export function resetMockState(): void {
  mockState.signedIn = true;
  mockState.gatewayFailure = undefined;
  mockState.logoutOutcome = 'ok';
  mockState.loginProviders = sampleLoginProviders.map((item) => ({ ...item }));
  mockState.linkedAccounts = new Set(sampleLinkedProviders);
  mockState.localSignInMethods = SAMPLE_LOCAL_SIGN_IN_METHODS;
  mockState.proposals.clear();
  mockState.leaves = new Map(sampleLeaves.map((leave) => [leave.name, { ...leave }]));
  mockState.home = sampleHome();
  mockState.records = sampleRecords();
  recordLinks.clear();
  mockState.installations = sampleInstallations.map((item) => ({ ...item }));
  mockState.aiProviders = new Map(sampleAiProviders.map((item) => [item.name, { ...item }]));
  mockState.aiAccounts = new Map(sampleAiAccounts.map((item) => [item.name, { ...item }]));
  mockState.aiConnections = new Map(sampleAiConnections.map((item) => [item.name, { ...item }]));
  mockState.providerBusy = false;
  mockState.roles = [...sampleBootstrap.user.roles];
  mockState.readableDocTypes = new Set(MENU_READABLE_DOCTYPES);
  mockState.customerRequests = [];
  resetUserAdminState();
  connectionSecrets.clear();
  gatewayCalls.save = [];
  gatewayCalls.check = [];
}

/**
 * Saved secrets. Kept only to choose the result of the mock live check.
 * Not exported, and never written to any response or record list.
 */
const connectionSecrets = new Map<string, string>();
/** Per-user rate limit counter: request times per endpoint (ms). */
const gatewayCalls: { save: number[]; check: number[] } = { save: [], check: [] };
const GATEWAY_RATE_LIMIT = 10;
const GATEWAY_RATE_WINDOW_MS = 60_000;

/**
 * Contract: each user calls each endpoint at most 10 times in 60 seconds. Beyond that, 429
 * `gateway_busy`.
 */
function gatewayBusy(endpoint: keyof typeof gatewayCalls): boolean {
  if (mockState.providerBusy) return true;
  const now = Date.now();
  const recent = gatewayCalls[endpoint].filter((time) => now - time < GATEWAY_RATE_WINDOW_MS);
  gatewayCalls[endpoint] = recent;
  if (recent.length >= GATEWAY_RATE_LIMIT) return true;
  recent.push(now);
  return false;
}

function gatewayError(status: number, error: string, extra: Record<string, unknown> = {}) {
  return HttpResponse.json({ message: { error, ...extra } }, { status });
}

function catalogProvider(id: unknown) {
  return sampleProviderCatalog.providers.find((provider) => provider.id === id);
}

const URL_FIELD_PATTERN = /^https?:\/\/[^\s/?#]+[^\s]*$/;

interface ConnectionBody {
  provider?: unknown;
  account?: unknown;
  account_name?: unknown;
  api_name?: unknown;
  fields?: unknown;
}

/**
 * Checks a save request against the contract. Returns the error response, or `undefined` if valid.
 */
function validateConnection(body: ConnectionBody): Response | undefined {
  const provider = catalogProvider(body.provider);
  if (!provider) return gatewayError(400, 'unknown_provider');
  const hasAccount = body.account !== undefined;
  const hasAccountName = body.account_name !== undefined;
  if (hasAccount === hasAccountName)
    return gatewayError(400, 'invalid_fields', { fields: ['account'] });
  const name = (value: unknown) =>
    typeof value === 'string' && value.trim().length > 0 && value.length <= 140;
  const invalid: string[] = [];
  if (hasAccountName && !name(body.account_name)) invalid.push('account_name');
  if (!name(body.api_name)) invalid.push('api_name');
  const fields =
    typeof body.fields === 'object' && body.fields !== null && !Array.isArray(body.fields)
      ? (body.fields as Record<string, unknown>)
      : undefined;
  if (!fields) return gatewayError(400, 'invalid_fields', { fields: ['fields'] });
  if (hasAccount) {
    const account = mockState.aiAccounts.get(String(body.account));
    const record = account ? mockState.aiProviders.get(account.provider) : undefined;
    if (!account || record?.catalog_provider !== provider.id) invalid.push('account');
  }
  const known = new Set(provider.fields.map((field) => field.name));
  for (const key of Object.keys(fields)) if (!known.has(key)) invalid.push(key);
  for (const field of provider.fields) {
    const value = fields[field.name];
    if (value === undefined) {
      if (field.required) invalid.push(field.name);
      continue;
    }
    if (typeof value !== 'string' || value.length > 4096) {
      invalid.push(field.name);
      continue;
    }
    if (field.required && value.trim().length === 0) invalid.push(field.name);
    else if (field.kind === 'url' && value.length > 0 && !URL_FIELD_PATTERN.test(value))
      invalid.push(field.name);
    // The account field is written only with a new account (contract: ConnectionInput.fields).
    else if (field.scope === 'account' && hasAccount && value.length > 0) invalid.push(field.name);
  }
  if (invalid.length > 0) {
    return gatewayError(400, 'invalid_fields', { fields: [...new Set(invalid)] });
  }
  return undefined;
}

function nextAiName(prefix: string, size: number): string {
  return `${prefix}-${String(size + 1).padStart(4, '0')}`;
}

/** Result of the mock live check. No request goes to a real provider. */
function sampleCheckStatus(api: SampleAiConnection): SampleAiConnection['connection_status'] {
  const secret = connectionSecrets.get(api.name);
  if (secret !== undefined) {
    const forced = SAMPLE_SECRET_RESULTS[secret];
    if (forced) return forced;
  }
  if (connectionSecrets.get(`${api.name}:base_url`)?.startsWith(SAMPLE_UNAPPROVED_URL)) {
    return 'endpoint_not_approved';
  }
  return 'connected';
}

/** Converts a record to the generic row shape. */
const asRow = (row: object): Record<string, unknown> => ({ ...row });

/** Generic field selection and sorting for the Frappe API v2 list. */
function listRows<T extends Record<string, unknown>>(rows: T[], url: URL) {
  const fields = parseJsonParam(url, 'fields') ?? ['name'];
  const filters = parseJsonParam(url, 'filters');
  if (!Array.isArray(fields) || typeof filters === 'symbol') return undefined;
  const start = Number(url.searchParams.get('start') ?? 0);
  const limit = Number(url.searchParams.get('limit') ?? 20);
  const sorted = rows
    .filter((row) => rowMatches(row, filters))
    .sort(rowOrder(url.searchParams.get('order_by')));
  const page = sorted
    .slice(start, start + limit)
    .map((row) => Object.fromEntries(fields.map((field) => [String(field), row[String(field)]])));
  return HttpResponse.json({
    data: page as JsonBodyType,
    has_next_page: sorted.length > start + limit,
  });
}

let versionCounter = 0;
function nextVersion(): string {
  versionCounter += 1;
  return `2026-11-23 10:00:00.${String(versionCounter).padStart(6, '0')}`;
}

function parseJsonParam(url: URL, key: string): unknown {
  const raw = url.searchParams.get(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return Symbol.for('invalid');
  }
}

type Leave = (typeof sampleLeaves)[number];

function leaveMatches(leave: Leave, filters: unknown): boolean {
  if (filters === undefined) return true;
  if (Array.isArray(filters)) {
    return filters.every(
      (item) =>
        Array.isArray(item) &&
        item[0] === 'name' &&
        item[1] === 'in' &&
        Array.isArray(item[2]) &&
        (item[2] as unknown[]).includes(leave.name),
    );
  }
  if (typeof filters !== 'object' || filters === null) return false;
  return Object.entries(filters).every(
    ([key, value]) => (leave as Record<string, unknown>)[key] === value,
  );
}

const SERVER_TIME = 1795340000;
const MOCK_INSTALLATION_PAGE = 2;

/** PWA endpoints require a session and CSRF. The error body carries a `code` field. */
function pwaError(status: number, code: string) {
  return HttpResponse.json({ server_time: SERVER_TIME, code }, { status });
}

const APP_VERSION_PATTERN = /^[0-9]{1,5}\.[0-9]{1,5}\.[0-9]{1,5}$/;

/**
 * Contract check for PWA endpoints: session, CSRF, origin and two version headers.
 * The worker in the browser may not see the `Origin` header, so a missing header passes.
 * If the header is present, it must match the request's own origin.
 */
function pwaGuard(request: Request): Response | undefined {
  if (request.headers.has('Authorization')) return pwaError(403, 'mixed_authentication');
  if (!mockState.signedIn) return pwaError(401, 'pwa_session_required');
  if (request.headers.get('X-Frappe-CSRF-Token') !== SAMPLE_CSRF_TOKEN) {
    return pwaError(403, 'pwa_request_forbidden');
  }
  const origin = request.headers.get('Origin');
  if (origin !== null && origin !== new URL(request.url).origin) {
    return pwaError(403, 'pwa_request_forbidden');
  }
  if (request.headers.get('X-Mobile-Contract-Version') !== '1') {
    return pwaError(400, 'unsupported_contract_version');
  }
  if (!APP_VERSION_PATTERN.test(request.headers.get('X-Mobile-App-Version') ?? '')) {
    return pwaError(400, 'invalid_client_version');
  }
  return undefined;
}

const INSTALLATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type CollectionRow = (typeof sampleCollection)[number];

const COMPARE: Record<string, (left: unknown, right: unknown) => boolean> = {
  '=': (left, right) => left === right,
  '!=': (left, right) => left !== right,
  '>': (left, right) => Number(left) > Number(right),
  '<': (left, right) => Number(left) < Number(right),
  '>=': (left, right) => Number(left) >= Number(right),
  '<=': (left, right) => Number(left) <= Number(right),
  in: (left, right) => Array.isArray(right) && right.includes(left),
  'not in': (left, right) => Array.isArray(right) && !right.includes(left),
};

function rowMatches(row: Record<string, unknown>, filters: unknown): boolean {
  if (filters === undefined || filters === null) return true;
  const value = (field: unknown) => row[String(field)];
  const test = (field: unknown, operator: unknown, expected: unknown) =>
    COMPARE[String(operator)]?.(value(field), expected) ?? false;
  if (Array.isArray(filters)) {
    return filters.every((item) => Array.isArray(item) && test(item[0], item[1], item[2]));
  }
  if (typeof filters !== 'object') return false;
  return Object.entries(filters).every(([field, expected]) =>
    Array.isArray(expected) ? test(field, expected[0], expected[1]) : test(field, '=', expected),
  );
}

function rowOrder(orderBy: string | null) {
  const [field = 'modified', direction = 'desc'] = (orderBy ?? 'modified desc').split(/\s+/);
  const sign = direction.toLowerCase() === 'asc' ? 1 : -1;
  return (a: Record<string, unknown>, b: Record<string, unknown>) =>
    sign * String(a[field]).localeCompare(String(b[field]), 'tr', { numeric: true });
}
const collectionMatches = (row: CollectionRow, filters: unknown) => rowMatches(row, filters);
const collectionOrder = rowOrder;

const SUMMARY_FILTER_OPERATORS = {
  ...COMPARE,
  between: (left: unknown, right: unknown) =>
    Array.isArray(right) &&
    right.length === 2 &&
    COMPARE['>=']?.(left, right[0]) &&
    COMPARE['<=']?.(left, right[1]),
  like: (left: unknown, right: unknown) =>
    typeof right === 'string' &&
    new RegExp(
      '^' +
        right
          .split(/([%_])/)
          .map((part) => {
            if (part === '%') return '.*';
            if (part === '_') return '.';
            return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          })
          .join('') +
        '$',
      'isu',
    ).test(String(left)),
  'not like': (left: unknown, right: unknown) => !SUMMARY_FILTER_OPERATORS.like(left, right),
  is: (left: unknown, right: unknown) =>
    (right === 'set' && left != null && left !== '') ||
    (right === 'not set' && (left == null || left === '')),
};

function isCollectionField(value: unknown): value is keyof CollectionRow {
  const sample = sampleCollection[0];
  return typeof value === 'string' && sample !== undefined && Object.hasOwn(sample, value);
}

function summaryFilters(filters: unknown): ((row: CollectionRow) => boolean)[] | undefined {
  if (filters === undefined) return [];
  if (filters === null || typeof filters !== 'object') return undefined;

  const conditions: unknown[] = Array.isArray(filters)
    ? filters
    : Object.entries(filters).map(([field, value]) =>
        Array.isArray(value) ? [field, ...value] : [field, '=', value],
      );
  if (conditions.length > 100) return undefined;

  const predicates: ((row: CollectionRow) => boolean)[] = [];
  for (const condition of conditions) {
    if (!Array.isArray(condition)) return undefined;
    const [field, operator, value] =
      condition.length === 4 && condition[0] === SAMPLE_COLLECTION_DOCTYPE
        ? condition.slice(1)
        : condition;
    if (
      (condition.length !== 3 &&
        !(condition.length === 4 && condition[0] === SAMPLE_COLLECTION_DOCTYPE)) ||
      !isCollectionField(field) ||
      typeof operator !== 'string' ||
      !Object.hasOwn(SUMMARY_FILTER_OPERATORS, operator) ||
      (Array.isArray(value) && value.length > 100)
    )
      return undefined;

    const compare = SUMMARY_FILTER_OPERATORS[operator as keyof typeof SUMMARY_FILTER_OPERATORS];
    if (!compare) return undefined;
    predicates.push((row) => Boolean(compare(row[field], value)));
  }
  return predicates;
}

const LEAVE_FIELDS = new Set([
  'name',
  'employee',
  'employee_name',
  'leave_type',
  'from_date',
  'to_date',
  'status',
  'docstatus',
  'modified',
  'total_leave_days',
  'leave_balance',
]);

const REDIRECT_PATTERN = /^\/(?!\/)[A-Za-z0-9\-._~/?#@!$&()*+,;=%:[\]]*$/;

/**
 * Link fields of the record. `kaynak_kayit` is the previous record and is read-only.
 * `ilgili_kayit` changes on save; the value is kept in `recordLinks`.
 */
function sampleRecordLinks(row: CollectionRow) {
  const number = Number(row.name.slice(-4));
  return {
    ilgili_kayit: recordLinks.get(row.name) ?? null,
    kaynak_kayit: number > 1 ? `ORNEK-${String(number - 1).padStart(4, '0')}` : null,
    gizli_kayit: null,
    aciklama: `${row.title} için açıklama.\nİkinci satır.`,
  };
}

function sampleRecordResponse(row: CollectionRow) {
  return HttpResponse.json({
    data: {
      doctype: SAMPLE_COLLECTION_DOCTYPE,
      docstatus: 0,
      ...row,
      ...sampleRecordLinks(row),
    } as JsonBodyType,
  });
}

/** `ilgili_kayit` values. `resetMockState` clears them. */
const recordLinks = new Map<string, string>();

function frappeError(status: number, excType: string, extra: Record<string, unknown> = {}) {
  return HttpResponse.json({ exc_type: excType, ...extra }, { status });
}

/** Only reseller roles use reseller endpoints. Other accounts get 403. */
function resellerGuard(): Response | undefined {
  const reseller = mockState.roles.some(
    (r) => r === 'Reseller Admin' || r === 'Reseller Assistant',
  );
  return reseller ? undefined : frappeError(403, 'PermissionError');
}

/** Checks the session and CSRF header as in the contract. Returns `undefined` if all is well. */
function guard(request: Request, { write }: { write: boolean }): Response | undefined {
  if (request.headers.has('Authorization')) return frappeError(403, 'PermissionError');
  if (!mockState.signedIn) return frappeError(401, 'SessionExpired', { session_expired: 1 });
  if (write && request.headers.get('X-Frappe-CSRF-Token') !== SAMPLE_CSRF_TOKEN) {
    return frappeError(400, 'CSRFTokenError');
  }
  return undefined;
}

function message(body: JsonBodyType, init?: ResponseInit) {
  return HttpResponse.json({ message: body }, init);
}

function rpcResult(id: unknown, result: JsonBodyType) {
  return HttpResponse.json({ jsonrpc: '2.0', id: id as string | number, result });
}

function toolCall(name: string, args: Record<string, unknown>) {
  if (name === 'plt_list_documents') {
    const structured = {
      documents: sampleDocuments,
      has_next_page: false,
      next_start: null,
      truncated: false,
      as_of: '2026-11-23T11:50:00+00:00',
      site: 'kiraci.example.test',
      source: String(args.doctype ?? ''),
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(structured) }],
      structuredContent: structured,
      isError: false,
    };
  }
  if (name === 'plt_create_document') {
    const proposal = sampleProposal({ proposal_id: `ornek-oneri-${mockState.proposals.size + 1}` });
    mockState.proposals.set(proposal.proposal_id, proposal);
    const structured = {
      status: 'approval_required',
      proposal_id: proposal.proposal_id,
      preview: proposal.preview,
      expires_at: proposal.expires_at,
      created_at: proposal.created_at,
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(structured) }],
      structuredContent: structured,
      isError: false,
    };
  }
  const denied = { error: { code: 'unknown_tool', message: 'Unknown tool.' } };
  return {
    content: [{ type: 'text', text: 'Unknown tool.' }],
    structuredContent: denied,
    isError: true,
  };
}

interface CompletionBody {
  messages?: { role: string; content: string }[];
}

/** Sample model, not a real one. Its behaviour is fixed and tests rely on it. */
function sampleModel(body: CompletionBody) {
  const messages = body.messages ?? [];
  const last = messages[messages.length - 1];
  const firstUser = messages.find((item) => item.role === 'user')?.content ?? '';
  if (last?.content.startsWith(TOOL_RESULT_PREFIX)) {
    return sampleCompletion({
      text: JSON.stringify({
        text: 'Örnek veri: istediğiniz kayıtlar hazır.',
        steps: [],
        ui: [{ type: 'table', columns: ['name', 'title'], rows: sampleDocuments }],
      }),
    });
  }
  if (firstUser.includes('oluştur')) {
    return sampleCompletion({
      tool_calls: [
        {
          id: 'cagri-1',
          name: 'plt_create_document',
          arguments: { doctype: 'Örnek Kayıt', data: { title: 'Örnek veri' } },
        },
      ],
    });
  }
  if (firstUser.includes('listele')) {
    return sampleCompletion({
      tool_calls: [
        { id: 'cagri-1', name: 'plt_list_documents', arguments: { doctype: 'Örnek Kayıt' } },
      ],
    });
  }
  return sampleCompletion({
    text: JSON.stringify({ text: 'Örnek veri: merhaba.', steps: [], ui: [] }),
  });
}

export const handlers = [
  // G-98 user management. Comes before the generic record endpoints.
  ...userAdminHandlers(guard, message, frappeError, listRows),
  // Communication list (AJA-812, G-63). Comes before the generic schema endpoint, which rejects
  // other types.
  http.get('*/api/method/platform_core.api.meta.get_doctype', ({ request }) => {
    if (new URL(request.url).searchParams.get('doctype') !== COMMUNICATION_DOCTYPE)
      return undefined;
    return guard(request, { write: false }) ?? message(sampleCommunicationMeta);
  }),
  http.get('*/api/v2/document/:doctype', ({ request, params }) => {
    if (String(params.doctype) !== COMMUNICATION_DOCTYPE) return undefined;
    if (!mockState.signedIn) {
      return HttpResponse.json({ errors: [{ type: 'SessionExpired' }] }, { status: 401 });
    }
    return (
      listRows(sampleCommunications, new URL(request.url)) ??
      HttpResponse.json({ errors: [{ type: 'ValidationError' }] }, { status: 417 })
    );
  }),
  // G-62 and G-98 admin endpoints (`./admin.ts`). They come before the generic record handlers.
  ...adminHandlers({ guard, message, frappeError }),
  http.get('*/api/method/frappe.auth.get_logged_user', () =>
    mockState.signedIn
      ? message(SAMPLE_USER)
      : frappeError(401, 'SessionExpired', { session_expired: 1 }),
  ),

  // The sign-in button is a page navigation. The backend redirects the browser to Keycloak sign-in.
  // On the mock server the target is the AtonotA Login origin: `https://api.login.atonota.net`.
  http.get('*/api/method/platform_core.api.auth.start_login', ({ request }) => {
    const redirectTo = new URL(request.url).searchParams.get('redirect_to');
    if (redirectTo !== null && !REDIRECT_PATTERN.test(redirectTo)) {
      return frappeError(400, 'InvalidRedirect');
    }
    try {
      globalThis.sessionStorage?.setItem(MOCK_START_LOGIN_KEY, request.url);
    } catch {
      // Without storage nothing is recorded. The redirect still happens.
    }
    return HttpResponse.redirect(sampleLoginUrl.login_url, 302);
  }),

  // Account linking is a page navigation. The backend starts Keycloak's linking flow.
  // The mock server records the address and sends the browser back to the return path. No link is
  // made.
  http.get('*/api/method/platform_core.api.auth.start_link', ({ request }) => {
    const url = new URL(request.url);
    const redirectTo = url.searchParams.get('redirect_to');
    if (redirectTo === null || !REDIRECT_PATTERN.test(redirectTo)) {
      return frappeError(400, 'InvalidRedirect');
    }
    try {
      globalThis.sessionStorage?.setItem(MOCK_START_LINK_KEY, request.url);
    } catch {
      // Without storage nothing is recorded. The redirect still happens.
    }
    return HttpResponse.redirect(new URL(redirectTo, url.origin).toString(), 302);
  }),

  http.post('*/api/method/platform_core.api.auth.get_login_url', async ({ request }) => {
    const text = await request.text();
    const body = (text ? JSON.parse(text) : {}) as { redirect_to?: unknown };
    if (body.redirect_to !== undefined) {
      if (typeof body.redirect_to !== 'string' || !REDIRECT_PATTERN.test(body.redirect_to)) {
        return frappeError(400, 'InvalidRedirect');
      }
    }
    return message(sampleLoginUrl);
  }),

  http.post('*/api/method/platform_core.api.auth.logout', ({ request }) => {
    const denied = guard(request, { write: true });
    if (denied) return denied;
    if (mockState.logoutOutcome === 'failure') return frappeError(500, 'Exception');
    mockState.signedIn = false;
    if (mockState.logoutOutcome === 'foreign_url') {
      return message({ logout_url: FOREIGN_LOGOUT_URL });
    }
    return message(sampleLogoutUrl);
  }),

  // AtonotA Login (G-159, G-160). The contract is in `src/auth/README.md`.
  http.get('*/api/method/platform_core.api.auth.list_login_providers', () =>
    message({ providers: enabledProviders() }),
  ),

  http.get('*/api/method/platform_core.api.auth.list_linked_accounts', ({ request }) => {
    return guard(request, { write: false }) ?? message(linkedAccounts());
  }),

  http.post('*/api/method/platform_core.api.auth.unlink_account', async ({ request }) => {
    const denied = guard(request, { write: true });
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as { provider?: unknown };
    const provider = typeof body.provider === 'string' ? body.provider : '';
    if (!mockState.linkedAccounts.has(provider)) return frappeError(404, 'DoesNotExistError');
    // The last sign-in method cannot be removed. The server decides; the panel only shows the
    // result.
    if (mockState.linkedAccounts.size + mockState.localSignInMethods <= 1) {
      return frappeError(409, 'LastSignInMethod');
    }
    mockState.linkedAccounts.delete(provider);
    return message(linkedAccounts());
  }),

  // Reseller endpoints (G-169, G-170). The shape is the contract of the AJA-831 backend tests.
  // Only reseller roles use them. Only "Reseller Admin" submits a new customer request.
  http.get('*/api/method/platform_core.api.reseller.list_customers', ({ request }) => {
    const denied = guard(request, { write: false }) ?? resellerGuard();
    if (denied) return denied;
    return message(sampleResellerCustomers.map(({ customer_tenant }) => ({ customer_tenant })));
  }),

  http.get('*/api/method/platform_core.api.reseller.customer_status', ({ request }) => {
    const denied = guard(request, { write: false }) ?? resellerGuard();
    if (denied) return denied;
    const tenant = new URL(request.url).searchParams.get('customer_tenant');
    const customer = sampleResellerCustomers.find((c) => c.customer_tenant === tenant);
    // Another reseller's customer and a missing customer get the same response.
    if (!customer) return frappeError(403, 'PermissionError');
    return message({ customer_tenant: customer.customer_tenant, status: customer.status });
  }),

  http.post('*/api/method/platform_core.api.reseller.request_customer', async ({ request }) => {
    const denied = guard(request, { write: true }) ?? resellerGuard();
    if (denied) return denied;
    if (!mockState.roles.includes('Reseller Admin')) return frappeError(403, 'PermissionError');
    const body = (await request.json().catch(() => null)) as {
      customer_name?: unknown;
      contact_email?: unknown;
    } | null;
    const name = typeof body?.customer_name === 'string' ? body.customer_name.trim() : '';
    const email = typeof body?.contact_email === 'string' ? body.contact_email.trim() : '';
    if (!name || !/^[^@\s]+@[^@\s]+$/.test(email)) return frappeError(417, 'ValidationError');
    const request_name = `RCR-${String(mockState.customerRequests.length + 1).padStart(4, '0')}`;
    mockState.customerRequests.push({
      name: request_name,
      customer_name: name,
      contact_email: email,
    });
    return message({ name: request_name });
  }),

  http.get('*/api/method/platform_core.api.shell.get_bootstrap', ({ request }) => {
    return (
      guard(request, { write: false }) ??
      message({ ...sampleBootstrap, user: { ...sampleBootstrap.user, roles: mockState.roles } })
    );
  }),

  http.get('*/api/method/platform_core.api.meta.get_doctype', ({ request }) => {
    const denied = guard(request, { write: false });
    if (denied) return denied;
    const doctype = new URL(request.url).searchParams.get('doctype');
    // Menu permission probe (G-94): for module types, only readability matters.
    if (doctype && mockState.readableDocTypes.has(doctype)) {
      return message({
        ...sampleDocTypeMeta,
        schema: { ...sampleDocTypeMeta.schema, name: doctype },
      });
    }
    if (doctype !== sampleDocTypeMeta.schema.name) return frappeError(403, 'PermissionError');
    if (request.headers.get('If-None-Match') === SAMPLE_DOCTYPE_ETAG) {
      return new HttpResponse(null, { status: 304, headers: { ETag: SAMPLE_DOCTYPE_ETAG } });
    }
    return message(sampleDocTypeMeta, { headers: { ETag: SAMPLE_DOCTYPE_ETAG } });
  }),

  http.post('*/api/method/platform_core.api.ai.mcp', async ({ request }) => {
    const denied = guard(request, { write: true });
    if (denied) return denied;
    const rpc = (await request.json()) as {
      id?: unknown;
      method?: string;
      params?: { name?: string; arguments?: Record<string, unknown> };
    };
    if (rpc.id === undefined) return new HttpResponse(null, { status: 202 });
    switch (rpc.method) {
      case 'tools/list':
        return rpcResult(rpc.id, { tools: sampleTools });
      case 'tools/call':
        return rpcResult(rpc.id, toolCall(rpc.params?.name ?? '', rpc.params?.arguments ?? {}));
      case 'ping':
        return rpcResult(rpc.id, {});
      default:
        return HttpResponse.json(
          {
            jsonrpc: '2.0',
            id: rpc.id as string | number,
            error: { code: -32601, message: 'Method not found' },
          },
          { status: 404 },
        );
    }
  }),

  http.get('*/api/method/platform_core.api.ai.list_proposals', ({ request }) => {
    const denied = guard(request, { write: false });
    if (denied) return denied;
    return message({
      proposals: [...mockState.proposals.values()].reverse(),
      has_next_page: false,
    });
  }),

  http.get('*/api/method/platform_core.api.ai.get_proposal', ({ request }) => {
    const denied = guard(request, { write: false });
    if (denied) return denied;
    const id = new URL(request.url).searchParams.get('proposal_id') ?? '';
    const proposal = mockState.proposals.get(id);
    return proposal ? message(proposal) : frappeError(404, 'DoesNotExistError');
  }),

  http.post('*/api/method/platform_core.api.ai.approve_proposal', async ({ request }) => {
    const denied = guard(request, { write: true });
    if (denied) return denied;
    const body = (await request.json()) as { proposal_id?: string; digest?: string };
    const proposal = mockState.proposals.get(body.proposal_id ?? '');
    if (!proposal) return frappeError(404, 'DoesNotExistError');
    if (proposal.status !== 'pending') {
      return message({ executed: false, deny_reason: 'not_pending', proposal });
    }
    if (body.digest !== proposal.digest) {
      return message({ executed: false, deny_reason: 'digest_mismatch', proposal });
    }
    const done = {
      ...proposal,
      status: 'consumed' as const,
      result: 'succeeded' as const,
      result_document: 'ORNEK-0003',
    };
    mockState.proposals.set(done.proposal_id, done);
    return message({ executed: true, deny_reason: null, proposal: done });
  }),

  http.post('*/api/method/platform_core.api.ai.reject_proposal', async ({ request }) => {
    const denied = guard(request, { write: true });
    if (denied) return denied;
    const body = (await request.json()) as { proposal_id?: string };
    const proposal = mockState.proposals.get(body.proposal_id ?? '');
    if (!proposal) return frappeError(404, 'DoesNotExistError');
    if (proposal.status !== 'pending') return frappeError(417, 'ValidationError');
    const rejected = { ...proposal, status: 'rejected' as const };
    mockState.proposals.set(rejected.proposal_id, rejected);
    return message(rejected);
  }),

  // HRMS leave applications (hrms_tr contract).
  // The route serves only leave applications. Other record types need their own mock endpoint.
  http.get('*/api/resource/Leave%20Application', ({ request }) => {
    const denied = guard(request, { write: false });
    if (denied) return denied;
    const url = new URL(request.url);
    const fields = parseJsonParam(url, 'fields') ?? ['name'];
    const filters = parseJsonParam(url, 'filters');
    if (!Array.isArray(fields) || !fields.every((field) => LEAVE_FIELDS.has(String(field)))) {
      return frappeError(417, 'ValidationError');
    }
    if (typeof filters === 'symbol') return frappeError(417, 'ValidationError');
    const start = Number(url.searchParams.get('limit_start') ?? 0);
    const length = Number(url.searchParams.get('limit_page_length') ?? 20);
    let rows = [...mockState.leaves.values()].filter((leave) => leaveMatches(leave, filters));
    rows =
      url.searchParams.get('order_by') === 'name asc'
        ? rows.sort((a, b) => a.name.localeCompare(b.name))
        : rows.sort(
            (a, b) =>
              (b.modified ?? '').localeCompare(a.modified ?? '') || a.name.localeCompare(b.name),
          );
    const page = rows
      .slice(start, start + length)
      .map((leave) =>
        Object.fromEntries(
          fields.map((field) => [field, (leave as Record<string, unknown>)[String(field)]]),
        ),
      );
    return HttpResponse.json({ data: page as JsonBodyType });
  }),

  http.get('*/api/resource/Leave%20Application/:name', ({ request, params }) => {
    const denied = guard(request, { write: false });
    if (denied) return denied;
    const leave = mockState.leaves.get(String(params.name));
    return leave
      ? HttpResponse.json({ data: leave as JsonBodyType })
      : frappeError(404, 'DoesNotExistError');
  }),

  http.post('*/api/method/hrms_tr.api.approve_leave', async ({ request }) => {
    const denied = guard(request, { write: true });
    if (denied) return denied;
    const body = (await request.json()) as { name?: string; version?: string };
    const leave = mockState.leaves.get(body.name ?? '');
    if (!leave) return frappeError(404, 'DoesNotExistError');
    if (body.version !== leave.modified) return frappeError(417, 'TimestampMismatchError');
    if (leave.docstatus !== 0 || leave.status !== 'Open')
      return frappeError(417, 'ValidationError');
    const modified = nextVersion();
    mockState.leaves.set(leave.name, { ...leave, status: 'Approved', docstatus: 1, modified });
    recordLeaveChange(leave, 'approved', modified);
    return message({ name: leave.name });
  }),

  // Reject follows the same rule as approve. HRMS sends a rejected application with status
  // "Rejected".
  http.post('*/api/method/hrms_tr.api.reject_leave', async ({ request }) => {
    const denied = guard(request, { write: true });
    if (denied) return denied;
    const body = (await request.json()) as { name?: string; version?: string };
    const leave = mockState.leaves.get(body.name ?? '');
    if (!leave) return frappeError(404, 'DoesNotExistError');
    if (body.version !== leave.modified) return frappeError(417, 'TimestampMismatchError');
    if (leave.docstatus !== 0 || leave.status !== 'Open')
      return frappeError(417, 'ValidationError');
    const modified = nextVersion();
    mockState.leaves.set(leave.name, { ...leave, status: 'Rejected', docstatus: 1, modified });
    recordLeaveChange(leave, 'rejected', modified);
    return message({ name: leave.name });
  }),

  http.get('*/api/method/hrms_tr.api.get_home_summary', ({ request }) => {
    const denied = guard(request, { write: false });
    if (denied) return denied;
    if (mockState.home.failure) return frappeError(500, 'Exception');
    return message(homeSummary() as JsonBodyType);
  }),

  http.post('*/api/method/hrms_tr.api.cancel_leave', async ({ request }) => {
    const denied = guard(request, { write: true });
    if (denied) return denied;
    const body = (await request.json()) as { name?: string; version?: string };
    const leave = mockState.leaves.get(body.name ?? '');
    if (!leave) return frappeError(404, 'DoesNotExistError');
    if (body.version !== leave.modified) return frappeError(417, 'TimestampMismatchError');
    if (leave.docstatus !== 1) return frappeError(417, 'ValidationError');
    const modified = nextVersion();
    mockState.leaves.set(leave.name, { ...leave, status: 'Cancelled', docstatus: 2, modified });
    recordLeaveChange(leave, 'cancelled', modified);
    return message({ name: leave.name });
  }),

  // Frappe API v2 record list. The shape was verified against Frappe 16.56.0 source
  // (src/api/README.md).
  // Only sample record types are served. Other types pass to the next handler.
  http.get('*/api/v2/document/:doctype', ({ request, params }) => {
    const doctype = String(params.doctype);
    if (doctype !== SAMPLE_COLLECTION_DOCTYPE && doctype !== RESTRICTED_SAMPLE_DOCTYPE) {
      return undefined;
    }
    if (!mockState.signedIn) {
      return HttpResponse.json({ errors: [{ type: 'SessionExpired' }] }, { status: 401 });
    }
    if (doctype === RESTRICTED_SAMPLE_DOCTYPE) {
      return HttpResponse.json({ errors: [{ type: 'PermissionError' }] }, { status: 403 });
    }
    const url = new URL(request.url);
    const fields = parseJsonParam(url, 'fields') ?? ['name'];
    const filters = parseJsonParam(url, 'filters');
    if (!Array.isArray(fields) || typeof filters === 'symbol') {
      return HttpResponse.json({ errors: [{ type: 'ValidationError' }] }, { status: 417 });
    }
    const start = Number(url.searchParams.get('start') ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const rows = [...mockState.records.values()]
      .filter((row) => collectionMatches(row, filters))
      .sort(collectionOrder(url.searchParams.get('order_by')));
    const page = rows
      .slice(start, start + limit)
      .map((row) =>
        Object.fromEntries(
          fields.map((field) => [String(field), (row as Record<string, unknown>)[String(field)]]),
        ),
      );
    return HttpResponse.json({
      data: page as JsonBodyType,
      has_next_page: rows.length > start + limit,
    });
  }),

  // Frappe link search. Only the sample record DocType is searched. Other types get a permission
  // denial; the response has no record names. The real server also does not search types without
  // permission.
  http.get('*/api/method/frappe.desk.search.search_link', ({ request }) => {
    const denied = guard(request, { write: false });
    if (denied) return denied;
    const url = new URL(request.url);
    if (url.searchParams.get('doctype') !== SAMPLE_COLLECTION_DOCTYPE) {
      return frappeError(403, 'PermissionError');
    }
    const txt = (url.searchParams.get('txt') ?? '').trim().toLocaleLowerCase('tr');
    const pageLength = Math.min(Math.max(Number(url.searchParams.get('page_length')) || 10, 1), 50);
    const rows = [...mockState.records.values()]
      .filter(
        (row) =>
          txt === '' ||
          row.name.toLocaleLowerCase('tr').includes(txt) ||
          row.title.toLocaleLowerCase('tr').includes(txt),
      )
      .slice(0, pageLength)
      .map((row) => ({ value: row.name, label: row.title }));
    return message(rows);
  }),

  // Frappe record endpoint (`/api/resource/<doctype>/<name>`). Only the sample record DocType is
  // served.
  // Leave applications have their own handler above. As with the type definition endpoint, other
  // types get a permission denial (403 `PermissionError`). Save checks the CSRF token and version.
  http.get('*/api/resource/:doctype/:name', ({ request, params }) => {
    const denied = guard(request, { write: false });
    if (denied) return denied;
    if (String(params.doctype) !== SAMPLE_COLLECTION_DOCTYPE) {
      return frappeError(403, 'PermissionError');
    }
    const row = mockState.records.get(String(params.name));
    return row ? sampleRecordResponse(row) : frappeError(404, 'DoesNotExistError');
  }),

  http.put('*/api/resource/:doctype/:name', async ({ request, params }) => {
    const denied = guard(request, { write: true });
    if (denied) return denied;
    if (String(params.doctype) !== SAMPLE_COLLECTION_DOCTYPE) {
      return frappeError(403, 'PermissionError');
    }
    const row = mockState.records.get(String(params.name));
    if (!row) return frappeError(404, 'DoesNotExistError');
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || body.modified !== row.modified) return frappeError(417, 'TimestampMismatchError');
    if (body.title !== undefined && (typeof body.title !== 'string' || !body.title.trim())) {
      return frappeError(417, 'MandatoryError');
    }
    if ('ilgili_kayit' in body) {
      const link = body.ilgili_kayit;
      if (link !== null && (typeof link !== 'string' || !mockState.records.has(link))) {
        return frappeError(417, 'LinkValidationError');
      }
      if (link === null) recordLinks.delete(row.name);
      else recordLinks.set(row.name, link);
    }
    const next: CollectionRow = {
      ...row,
      ...(typeof body.title === 'string' ? { title: body.title } : {}),
      modified: nextVersion(),
    };
    mockState.records.set(next.name, next);
    return sampleRecordResponse(next);
  }),

  http.get(
    ({ request }) => {
      const url = new URL(request.url);
      const doctype = url.searchParams.get('doctype');
      return (
        (doctype === SAMPLE_COLLECTION_DOCTYPE || doctype === RESTRICTED_SAMPLE_DOCTYPE) &&
        matchRequestUrl(url, `*/api/method${GROUP_SUMMARY_PATH}`).matches
      );
    },
    ({ request }) => {
      const url = new URL(request.url);
      const doctype = url.searchParams.get('doctype');
      const denied = guard(request, { write: false });
      if (denied) return denied;
      if (doctype === RESTRICTED_SAMPLE_DOCTYPE) return frappeError(403, 'PermissionError');

      const groupBy = url.searchParams.get('group_by');
      const aggregate = url.searchParams.get('aggregate');
      const aggregateField = url.searchParams.get('aggregate_field');
      const limit = Number(url.searchParams.get('limit') ?? 100);
      const filters = summaryFilters(parseJsonParam(url, 'filters'));
      if (
        !isCollectionField(groupBy) ||
        (aggregate === null
          ? aggregateField !== null
          : (aggregate !== 'sum' && aggregate !== 'avg') || aggregateField !== 'amount') ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        (url.searchParams.get('filters')?.length ?? 0) > 8192 ||
        !filters
      ) {
        return frappeError(400, 'InvalidSummaryQuery');
      }

      const rows = [...mockState.records.values()].filter((row) =>
        filters.every((matches) => matches(row)),
      );
      const groups = new Map<CollectionRow[keyof CollectionRow], { count: number; sum: number }>();
      for (const row of rows.sort(collectionOrder(`${groupBy} asc`))) {
        const value = row[groupBy];
        const group = groups.get(value) ?? { count: 0, sum: 0 };
        group.count += 1;
        group.sum += row.amount;
        groups.set(value, group);
      }
      const summary: CollectionComponents['schemas']['Summary'] = {
        groups: Array.from(groups.entries())
          .slice(0, limit)
          .map(([value, { count, sum }]) => ({
            value,
            count,
            ...(aggregate === null ? {} : { aggregate: aggregate === 'sum' ? sum : sum / count }),
          })),
        total_count: rows.length,
        truncated: groups.size > limit,
      };
      return message(summary);
    },
  ),

  // Access rule engine (platform_core-access contract).
  http.get('*/api/method/platform_core.api.access.explain_permission', ({ request }) => {
    const denied = guard(request, { write: false });
    if (denied) return denied;
    const url = new URL(request.url);
    const doctype = url.searchParams.get('doctype');
    const name = url.searchParams.get('name') ?? '';
    const ptype = url.searchParams.get('ptype') ?? 'read';
    const user = url.searchParams.get('user') ?? SAMPLE_ACCOUNT;
    if (!['read', 'write', 'create', 'delete', 'submit', 'cancel'].includes(ptype)) {
      return frappeError(417, 'ValidationError');
    }
    if (doctype !== sampleAccessSummary.doctype || user !== SAMPLE_ACCOUNT) {
      return frappeError(403, 'PermissionError');
    }
    const allowed = name === 'ORNEK-0001';
    return message({
      doctype,
      name,
      ptype,
      user,
      allowed,
      reason: allowed ? 'allowed' : 'not_permitted_or_missing',
      governed: true,
      layers: { role: true, access_rule: allowed, share: false },
      rules: [],
    });
  }),

  http.get('*/api/method/platform_core.api.access.get_access_summary', ({ request }) => {
    const denied = guard(request, { write: false });
    if (denied) return denied;
    const doctype = new URL(request.url).searchParams.get('doctype');
    return doctype === sampleAccessSummary.doctype
      ? message(sampleAccessSummary)
      : frappeError(403, 'PermissionError');
  }),

  // Phone and PWA installations (platform_core-mobile contract, PWA session).
  // In the contract a page has at most 20 records. The mock server returns 2 to show paging.
  http.post(
    '*/api/method/platform_core.api.mobile_pwa.v1_list_installations',
    async ({ request }) => {
      const failure = pwaGuard(request);
      if (failure) return failure;
      const body = (await request.json()) as Record<string, unknown>;
      if (Object.keys(body).some((key) => key !== 'after')) return pwaError(400, 'invalid_request');
      if (body.after !== undefined) {
        if (typeof body.after !== 'string' || !INSTALLATION_ID_PATTERN.test(body.after)) {
          return pwaError(400, 'invalid_uuid');
        }
      }
      const after = typeof body.after === 'string' ? body.after : undefined;
      const sorted = [...mockState.installations].sort((a, b) =>
        a.installation_id.localeCompare(b.installation_id),
      );
      const rest = after ? sorted.filter((item) => item.installation_id > after) : sorted;
      const page = rest.slice(0, MOCK_INSTALLATION_PAGE);
      const nextAfter = rest.length > page.length ? (page.at(-1)?.installation_id ?? null) : null;
      return HttpResponse.json({
        server_time: SERVER_TIME,
        message: { installations: page, next_after: nextAfter },
      });
    },
  ),

  http.post(
    '*/api/method/platform_core.api.mobile_pwa.v1_revoke_installation',
    async ({ request }) => {
      const failure = pwaGuard(request);
      if (failure) return failure;
      const body = (await request.json()) as { installation_id?: string };
      const item = mockState.installations.find(
        (entry) => entry.installation_id === body.installation_id,
      );
      if (!item)
        return HttpResponse.json(
          { server_time: SERVER_TIME, code: 'installation_unavailable' },
          { status: 404 },
        );
      const revoked = item.revoked ? 0 : 1;
      item.revoked = true;
      return HttpResponse.json({ server_time: SERVER_TIME, message: { revoked } });
    },
  ),

  // AI provider records (Frappe API v2 list). The password field is not in the records.
  http.get('*/api/v2/document/:doctype', ({ request, params }) => {
    const doctype = String(params.doctype);
    const rows: Record<string, unknown>[] | undefined =
      doctype === AI_API_DOCTYPE
        ? [...mockState.aiConnections.values()].map(asRow)
        : doctype === AI_ACCOUNT_DOCTYPE
          ? [...mockState.aiAccounts.values()].map(asRow)
          : doctype === AI_PROVIDER_DOCTYPE
            ? [...mockState.aiProviders.values()].map(asRow)
            : undefined;
    if (!rows) return undefined;
    if (!mockState.signedIn) {
      return HttpResponse.json({ errors: [{ type: 'SessionExpired' }] }, { status: 401 });
    }
    return (
      listRows(rows, new URL(request.url)) ??
      HttpResponse.json({ errors: [{ type: 'ValidationError' }] }, { status: 417 })
    );
  }),

  // Provider catalogue, connection save and live check (model gateway contract).
  http.post('*/api/method/platform_core.api.model.provider_catalog', ({ request }) => {
    return guard(request, { write: true }) ?? message(sampleProviderCatalog);
  }),

  http.post('*/api/method/platform_core.api.model.save_connection', async ({ request }) => {
    const denied = guard(request, { write: true });
    if (denied) return denied;
    if (gatewayBusy('save')) return gatewayError(429, 'gateway_busy');
    const body = (await request.json().catch(() => null)) as ConnectionBody | null;
    if (!body) return gatewayError(400, 'invalid_fields', { fields: ['fields'] });
    const invalid = validateConnection(body);
    if (invalid) return invalid;
    const definition = catalogProvider(body.provider);
    if (!definition) return gatewayError(400, 'unknown_provider');
    const fields = body.fields as Record<string, string>;

    let provider = [...mockState.aiProviders.values()].find(
      (item) => item.catalog_provider === definition.id,
    );
    if (!provider) {
      provider = {
        name: definition.label,
        provider_name: definition.label,
        catalog_provider: definition.id,
        enabled: 1,
        modified: nextVersion(),
      };
      mockState.aiProviders.set(provider.name, provider);
    }
    let accountName = typeof body.account === 'string' ? body.account : undefined;
    if (accountName === undefined) {
      const account: SampleAiAccount = {
        name: nextAiName('ORNEK-HESAP', mockState.aiAccounts.size),
        account_name: String(body.account_name).trim(),
        provider: provider.name,
        enabled: 1,
        modified: nextVersion(),
      };
      mockState.aiAccounts.set(account.name, account);
      accountName = account.name;
    }
    const api: SampleAiConnection = {
      name: nextAiName('ORNEK-API', mockState.aiConnections.size),
      api_name: String(body.api_name).trim(),
      account: accountName,
      connection_status: 'not_checked',
      connection_checked_at: null,
      health_status: 'healthy',
      enabled: 1,
      modified: nextVersion(),
    };
    mockState.aiConnections.set(api.name, api);
    for (const field of definition.fields) {
      const value = fields[field.name];
      if (field.kind === 'secret' && value) connectionSecrets.set(api.name, value);
      if (field.name === 'base_url' && value) connectionSecrets.set(`${api.name}:base_url`, value);
    }
    return message({
      provider: provider.name,
      account: accountName,
      api: api.name,
      connection_status: 'not_checked',
    });
  }),

  http.post('*/api/method/platform_core.api.model.check_connection', async ({ request }) => {
    const denied = guard(request, { write: true });
    if (denied) return denied;
    if (gatewayBusy('check')) return gatewayError(429, 'gateway_busy');
    const body = (await request.json().catch(() => null)) as { api?: unknown } | null;
    const api = typeof body?.api === 'string' ? mockState.aiConnections.get(body.api) : undefined;
    if (!api) return gatewayError(400, 'invalid_route');
    const status = sampleCheckStatus(api);
    const checked = nextVersion().slice(0, 19);
    mockState.aiConnections.set(api.name, {
      ...api,
      connection_status: status,
      connection_checked_at: checked,
      health_status:
        status === 'connected'
          ? 'healthy'
          : status === 'invalid_credentials'
            ? 'auth_failed'
            : 'unhealthy',
      modified: nextVersion(),
    });
    return message({
      api: api.name,
      status,
      checked_at: checked,
      models_visible: status === 'connected' ? 3 : null,
    });
  }),

  http.post('*/api/method/platform_core.api.model.complete', async ({ request }) => {
    const denied = guard(request, { write: true });
    if (denied) return denied;
    if (mockState.gatewayFailure) {
      return HttpResponse.json(
        { message: { error: mockState.gatewayFailure } },
        { status: GATEWAY_FAILURES[mockState.gatewayFailure] },
      );
    }
    return message(sampleModel((await request.json()) as CompletionBody));
  }),
];

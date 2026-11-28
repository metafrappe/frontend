// Ortak API istemcisi (SZ-5). Bileşenler arka uca yalnız bu istemciyle bağlanır.
//
// Oturum aynı kökteki Frappe çereziyle yürür. Tarayıcı erişim belirteci tutmaz.
// Yazan istek `X-Frappe-CSRF-Token` başlığını taşır (SZ-7). `Authorization` başlığı hiç gönderilmez.
import createClient, { type Client, type Middleware } from 'openapi-fetch';

import { version as packageVersion } from '../../package.json';

import type { ApiConfig } from './config';
import type { CsrfStore } from './csrf';
import { ApiError, toApiError } from './errors';
import type { DocumentListQuery, DocumentPage, FrappeV2Paths } from './frappe-v2';
import type { paths as HrmsPaths } from './generated/hrms_tr';
import type { paths as AccessPaths } from './generated/platform_core-access';
import type { paths as AiPaths } from './generated/platform_core-ai';
import type { paths as CollectionPaths } from './generated/platform_core-collection';
import type { paths as HelpPaths } from './generated/platform_core-help';
import {
  GROUP_SUMMARY_PATH,
  isRawGroupSummary,
  type GroupSummary,
  type GroupSummaryQuery,
} from './group-summary';
import type { paths as IdentityPaths } from './generated/platform_core-identity';
import type { paths as MobilePaths } from './generated/platform_core-mobile';
import type { paths as GatewayPaths } from './generated/platform_core-model-gateway';
import type { paths as ShellPaths } from './generated/platform_core-shell';
import {
  isRawDocumentPage,
  type Installation,
  type Revoked,
  UUID_PATTERN,
  isInstallationPage,
  isRevoked,
  type AccessSummary,
  type LeaveApplication,
  type HomeSummary,
  type LeaveName,
  type PermissionExplanation,
  type PermissionType,
  isAccessSummary,
  isLeaveApplication,
  isLeaveList,
  isHomeSummary,
  isLeaveName,
  isPermissionExplanation,
  type ApprovalOutcome,
  type ComponentHelp,
  type FieldHelp,
  isComponentHelpOrNull,
  isFieldHelp,
  type Bootstrap,
  type CompletionRequest,
  type CompletionResult,
  type DocTypeMeta,
  type Guard,
  type JsonRpcResponse,
  type LoginUrl,
  type LogoutUrl,
  type Proposal,
  isApprovalOutcome,
  isBootstrap,
  isCompletionResult,
  isDocTypeMeta,
  isJsonRpcResponse,
  isLoginUrl,
  isLogoutUrl,
  isProposal,
  isProposalList,
  isRecord,
  isUserName,
  readMessage,
} from './guards';

export interface ApiClientDeps {
  config: ApiConfig;
  csrf: CsrfStore;
  /** Oturum bitince bir kez çağrılır. Örneğin kullanıcıyı girişe yönlendirir. */
  onSessionExpired?: (error: ApiError) => void;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export type DocTypeResult =
  | { status: 'fresh'; meta: DocTypeMeta; etag: string | undefined }
  | { status: 'not_modified'; etag: string | undefined };

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method:
    | 'initialize'
    | 'server/discover'
    | 'ping'
    | 'tools/list'
    | 'tools/call'
    | 'notifications/initialized';
  params?: Record<string, unknown>;
}

/** Uygulama sürümü. PWA uçları `X-Mobile-App-Version` başlığında `1.2.3` biçimini ister. */
const APP_VERSION = packageVersion;

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const EMPTY_BODY_STATUSES = new Set([202, 204, 304]);

function isJsonResponse(response: Response): boolean {
  const type = response.headers.get('Content-Type') ?? '';
  return /^application\/(.+\+)?json\b/i.test(type);
}

/** Zaman aşımı ve ağ hatasını ortak türe çeviren fetch. Kullanıcı iptali olduğu gibi iletilir. */
function timedFetch(timeoutMs: number) {
  return async (request: Request): Promise<Response> => {
    const timer = AbortSignal.timeout(timeoutMs);
    const signal = AbortSignal.any([request.signal, timer]);
    try {
      return await globalThis.fetch(new Request(request, { signal }));
    } catch (error) {
      if (request.signal.aborted) throw error;
      if (timer.aborted) throw new ApiError({ kind: 'timeout', status: 0 });
      throw new ApiError({ kind: 'network', status: 0 });
    }
  };
}

/**
 * Gövde okunurken çıkan hatayı ortak türe çevirir.
 * Kullanıcının iptali olduğu gibi iletilir. Böylece ekran iptali hata saymaz.
 */
function toReadError(error: unknown, userSignal: AbortSignal | undefined): unknown {
  if (error instanceof ApiError) return error;
  if (userSignal?.aborted) return error;
  const name = error instanceof Error || error instanceof DOMException ? error.name : '';
  if (name === 'TimeoutError' || name === 'AbortError')
    return new ApiError({ kind: 'timeout', status: 0 });
  if (error instanceof SyntaxError) return new ApiError({ kind: 'invalid_response', status: 0 });
  return new ApiError({ kind: 'network', status: 0 });
}

async function settle<T>(pending: Promise<T>, userSignal: AbortSignal | undefined): Promise<T> {
  try {
    return await pending;
  } catch (error) {
    throw toReadError(error, userSignal);
  }
}

export interface LeaveListQuery {
  /** Okunacak alanlar. Verilmezse Frappe yalnız `name` döner. */
  fields?: (
    | 'name'
    | 'employee'
    | 'employee_name'
    | 'leave_type'
    | 'from_date'
    | 'to_date'
    | 'status'
    | 'docstatus'
    | 'modified'
    | 'total_leave_days'
    | 'leave_balance'
  )[];
  /** Eşitlik süzgeci ya da ad üyeliği süzgeci. Örnek: `[['name', 'in', ['A', 'B']]]`. */
  filters?:
    | {
        name?: string;
        employee?: string;
        leave_type?: string;
        status?: 'Open' | 'Approved' | 'Rejected' | 'Cancelled';
        docstatus?: 0 | 1 | 2;
      }
    | ['name', 'in', string[]][];
  orderBy?: 'modified desc, name asc' | 'name asc';
  /** Atlanacak kayıt sayısı. */
  start?: number;
  /** Sayfa boyu. 1 ile 100 arasındadır. Varsayılan 20. */
  pageLength?: number;
}

/** `set_role_permission` gövdesi. `permissions` yalnız değişen hakları taşır. */
export interface RolePermissionChange {
  doctype: string;
  role: string;
  permlevel?: number;
  if_owner?: 0 | 1;
  permissions: Record<string, boolean>;
}

/** `list_permission_logs` süzgeçleri ve sayfası. */
export interface PermissionLogQuery {
  for_doctype?: string;
  for_document?: string;
  start?: number;
  page_length?: number;
}

/** Alan yardımı sorgusu. Dil verilmezse isteğin dili kullanılır. */
export interface FieldHelpQuery {
  doctype: string;
  fieldname: string;
  language?: string;
}

export interface ExplainPermissionQuery {
  doctype: string;
  name: string;
  /** Verilmezse `read` sayılır. */
  ptype?: PermissionType;
  /** Yalnız "System Manager" başka kullanıcıyı sorabilir. */
  user?: string;
}

/**
 * Sayfalama değerlerini sözleşme sınırlarıyla denetler.
 * Geçersiz değerde istek gönderilmez ve `invalid_request` hatası döner.
 */
function pagingError(
  start: number,
  limit: number,
  bounds: { maxStart?: number; maxLimit: number },
): ApiError | undefined {
  const startOk =
    Number.isInteger(start) &&
    start >= 0 &&
    (bounds.maxStart === undefined || start <= bounds.maxStart);
  if (!startOk) return new ApiError({ kind: 'invalid_request', status: 0, code: 'start' });
  if (!Number.isInteger(limit) || limit < 1 || limit > bounds.maxLimit) {
    return new ApiError({ kind: 'invalid_request', status: 0, code: 'page_length' });
  }
  return undefined;
}

export type McpResult = { status: 'accepted' } | { status: 'ok'; response: JsonRpcResponse };

/**
 * Frappe'nin standart kayıt uçlarına giden istek (kayıt görünümü).
 * Bu uçlar OpenAPI sözleşmelerimizde yoktur. İstek yine ortak istemciden geçer:
 * site kökü, çerez ayarı, CSRF deposu, zaman aşımı ve oturum süresi işi aynıdır (SZ-5).
 */
export interface DocumentRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /**
   * Site köküne göre yol. `/api/resource/`, `/api/method/` ya da `/api/v2/` ile başlar.
   * Yol parçaları çağıran tarafından kodlanır. Sorgu `query` alanıyla verilir.
   */
  path: string;
  query?: Record<string, string>;
  /** JSON olarak gönderilir. */
  body?: unknown;
  /** Verilirse `If-None-Match` başlığı olur. Sunucu 304 dönebilir. */
  etag?: string | undefined;
  signal?: AbortSignal | undefined;
  /** `model` seçilirse model geçidinin daha uzun süresi kullanılır. */
  timeout?: 'model' | undefined;
}

/**
 * Başarılı yanıt gövdesi ham JSON'dur. Doğrulama çağıran tarafındır.
 * Hata yanıtında ortak hata türü ve ham gövde döner. Oturum denetimi ve
 * oturum süresi işi (girişe dönüş) bu noktada yapılmış olur.
 * Ham gövde ekrana olduğu gibi konmaz; kayıt görünümü yalnız temizlenmiş iletiyi gösterir (SZ-8).
 */
export type DocumentResponse =
  | { ok: true; status: number; etag: string | undefined; body: unknown }
  | { ok: false; error: ApiError; body: unknown };

/** İzinli kayıt yolu. Kök, sorgu, parça, `.` ve `..` parçası yasaktır. */
const DOCUMENT_PATH = /^\/api\/(?:resource|method|v2)\/[^?#\\]+$/;

/** Nokta parçası mı? Tarayıcı `%2e` kodunu nokta gibi çözer; `%2e%2e` de `..` sayılır. */
function isDotSegment(segment: string): boolean {
  const plain = segment.replace(/%2e/gi, '.');
  return plain === '.' || plain === '..';
}

function isDocumentPath(path: string): boolean {
  if (!DOCUMENT_PATH.test(path) || path.includes('//')) return false;
  if (path.split('/').some(isDotSegment)) return false;
  // Son denetim: tarayıcının çözdüğü yol da izinli önekle başlamalıdır.
  const resolved = new URL(path, 'https://site.invalid').pathname;
  return DOCUMENT_PATH.test(resolved);
}

export function createApiClient({ config, csrf, onSessionExpired }: ApiClientDeps) {
  let sessionExpiredNotified = false;

  /** Her isteğin ortak başlıkları. Belirteç başlığı yok, CSRF belirteci her yazmada depodan okunur. */
  function prepare(request: Request): Request {
    request.headers.delete('Authorization');
    request.headers.set('Accept', 'application/json');
    if (!SAFE_METHODS.has(request.method)) {
      const token = csrf.get();
      if (token) request.headers.set('X-Frappe-CSRF-Token', token);
    }
    return request;
  }

  const headerMiddleware: Middleware = {
    onRequest({ request }) {
      return prepare(request);
    },
    onResponse({ response }) {
      // Başarılı yanıt JSON olmalıdır (SZ-5). Aksi hâlde yanıt okunmaz.
      if (response.ok && !EMPTY_BODY_STATUSES.has(response.status) && !isJsonResponse(response)) {
        throw new ApiError({ kind: 'invalid_response', status: response.status });
      }
      return response;
    },
  };

  function make<Paths extends object>(
    baseUrl: string,
    timeoutMs = config.timeoutMs,
  ): Client<Paths> {
    const client = createClient<Paths>({
      baseUrl,
      credentials: config.credentials,
      fetch: timedFetch(timeoutMs),
    });
    client.use(headerMiddleware);
    return client;
  }

  const methodRoot = `${config.siteUrl}/api/method`;
  const identity = make<IdentityPaths>(methodRoot);
  const ai = make<AiPaths>(methodRoot);
  const shell = make<ShellPaths>(config.siteUrl);
  const gateway = make<GatewayPaths>(config.siteUrl, config.modelTimeoutMs);
  const hrms = make<HrmsPaths>(`${config.siteUrl}/api`);
  const access = make<AccessPaths>(methodRoot);
  const mobile = make<MobilePaths>(methodRoot);
  const collection = make<CollectionPaths>(methodRoot);
  const help = make<HelpPaths>(methodRoot);
  const frappeV2 = make<FrappeV2Paths>(config.siteUrl);
  // PWA uçlarının zorunlu başlıkları. Tarayıcı `Origin` başlığını kendisi koyar ve bu değeri yok sayar.
  // Panel ve kiracı sitesi aynı köktedir. Bu yüzden değer site köküdür.
  const pwaHeaders = {
    Origin: new URL(config.siteUrl).origin,
    'X-Mobile-App-Version': APP_VERSION,
    'X-Mobile-Contract-Version': '1' as const,
  };

  /**
   * Belirsiz 403 için oturumu ayrı ve önbelleksiz istekle doğrular (SZ-8).
   * Oturum yalnız kesin kanıtla bitmiş sayılır: 401, misafir 403 ya da `Guest` kullanıcı.
   * Sunucu hatası, bozuk yanıt ya da ağ hatası `unknown` olur. O zaman ilk yetki hatası korunur.
   */
  async function checkSession(): Promise<'alive' | 'ended' | 'unknown'> {
    try {
      const response = await timedFetch(config.timeoutMs)(
        new Request(`${methodRoot}/frappe.auth.get_logged_user`, {
          method: 'GET',
          credentials: config.credentials,
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        }),
      );
      if (response.status === 401 || response.status === 403) return 'ended';
      if (!response.ok || !isJsonResponse(response)) return 'unknown';
      const user = readMessage(await response.json());
      if (!isUserName(user)) return 'unknown';
      return user === 'Guest' ? 'ended' : 'alive';
    } catch {
      return 'unknown';
    }
  }

  function sessionExpired(error: ApiError): ApiError {
    if (!sessionExpiredNotified) {
      sessionExpiredNotified = true;
      onSessionExpired?.(error);
    }
    return error;
  }

  async function fail(
    response: Response,
    body: unknown,
    { notify = true }: { notify?: boolean } = {},
  ): Promise<never> {
    let error = toApiError(response.status, body, response.headers);
    if (error.kind === 'forbidden' && error.needsSessionCheck) {
      error =
        (await checkSession()) === 'ended'
          ? new ApiError({ kind: 'session_expired', status: error.status, code: error.code })
          : new ApiError({ kind: 'forbidden', status: error.status, code: error.code });
    }
    if (error.kind === 'session_expired' && notify) throw sessionExpired(error);
    throw error;
  }

  interface FetchResult {
    data?: unknown;
    error?: unknown;
    response: Response;
  }

  /** Yanıtı denetler ve `message` alanını döner. */
  async function unwrap<T>(
    pending: Promise<FetchResult>,
    guard: Guard<T>,
    options: RequestOptions & {
      notifySessionExpired?: boolean;
      envelope?: 'message' | 'data';
    } = {},
  ): Promise<T> {
    const { data, error, response } = await settle(pending, options.signal);
    if (!response.ok) {
      return fail(response, error, { notify: options.notifySessionExpired ?? true });
    }
    // Frappe RPC yanıtı `message`, kayıt ucu (`/api/resource`) yanıtı `data` alanını taşır.
    const value =
      options.envelope === 'data' ? (isRecord(data) ? data.data : undefined) : readMessage(data);
    if (!guard(value)) throw new ApiError({ kind: 'invalid_response', status: response.status });
    sessionExpiredNotified = false;
    return value;
  }

  function signalOf(options: RequestOptions): { signal?: AbortSignal } {
    return options.signal ? { signal: options.signal } : {};
  }

  return {
    /**
     * Oturumdaki kullanıcının adını döner.
     * Bu uç oturumu yoklar. Oturum yoksa hata verir ama girişe yönlendirme başlatmaz.
     */
    getLoggedUser(options: RequestOptions = {}): Promise<string> {
      return unwrap(
        shell.GET('/api/method/frappe.auth.get_logged_user', {
          ...signalOf(options),
          cache: 'no-store',
        }),
        isUserName,
        { ...options, notifySessionExpired: false },
      );
    },

    /** Keycloak giriş adresini sunucudan ister. `state`, PKCE ve `nonce` sunucuda üretilir. */
    getLoginUrl(redirectTo?: string, options: RequestOptions = {}): Promise<LoginUrl> {
      return unwrap(
        identity.POST('/platform_core.api.auth.get_login_url', {
          ...signalOf(options),
          body: redirectTo === undefined ? {} : { redirect_to: redirectTo },
        }),
        isLoginUrl,
        options,
      );
    },

    /** Frappe oturumunu kapatır. Keycloak çıkış adresini döner. */
    logout(options: RequestOptions = {}): Promise<LogoutUrl> {
      return unwrap(
        identity.POST('/platform_core.api.auth.logout', signalOf(options)),
        isLogoutUrl,
        options,
      );
    },

    /** Kabuğun açılış verisini okur: kullanıcı, roller, uygulamalar ve kenar çubuğu. */
    getBootstrap(options: RequestOptions = {}): Promise<Bootstrap> {
      return unwrap(
        shell.GET('/api/method/platform_core.api.shell.get_bootstrap', signalOf(options)),
        isBootstrap,
        options,
      );
    },

    /**
     * Sunucunun DocType tanımından ürettiği sayfa tanımını okur (RE-11).
     * `etag` verilirse sunucu değişiklik yoksa 304 döner.
     */
    async getDocType(
      doctype: string,
      etag?: string,
      options: RequestOptions = {},
    ): Promise<DocTypeResult> {
      const result = await settle(
        shell.GET('/api/method/platform_core.api.meta.get_doctype', {
          ...signalOf(options),
          params: {
            query: { doctype, surface: 'web' },
            ...(etag ? { header: { 'If-None-Match': etag } } : {}),
          },
        }),
        options.signal,
      );
      const nextEtag = result.response.headers.get('ETag') ?? undefined;
      if (result.response.status === 304) return { status: 'not_modified', etag: nextEtag ?? etag };
      const meta = await unwrap(Promise.resolve(result), isDocTypeMeta, options);
      return { status: 'fresh', meta, etag: nextEtag };
    },

    /**
     * MCP ucuna tek JSON-RPC isteği gönderir. Oturum çereziyle çağrılır.
     * Bildirim (`id` yok) kabul edilince sunucu boş 202 döner. Sonuç `accepted` olur.
     */
    async callMcp(
      rpc: JsonRpcRequest,
      options: RequestOptions & { conversationId?: string } = {},
    ): Promise<McpResult> {
      const headers: Record<string, string> = { 'MCP-Protocol-Version': '2025-11-25' };
      if (options.conversationId) headers['Mcp-Conversation-Id'] = options.conversationId;
      const result = await settle(
        ai.POST('/platform_core.api.ai.mcp', { ...signalOf(options), body: rpc, headers }),
        options.signal,
      );
      if (!result.response.ok) return fail(result.response, result.error);
      if (result.response.status === 202) return { status: 'accepted' };
      if (!isJsonRpcResponse(result.data)) {
        throw new ApiError({ kind: 'invalid_response', status: result.response.status });
      }
      return { status: 'ok', response: result.data };
    },

    listProposals(
      query: { status?: Proposal['status']; limit?: number; start?: number } = {},
      options: RequestOptions = {},
    ) {
      // Sözleşme: limit 1 ile 100, start 0 ile 10000 arasındadır.
      const invalid = pagingError(query.start ?? 0, query.limit ?? 20, {
        maxStart: 10_000,
        maxLimit: 100,
      });
      if (invalid) return Promise.reject(invalid);
      return unwrap(
        ai.GET('/platform_core.api.ai.list_proposals', { ...signalOf(options), params: { query } }),
        isProposalList,
        options,
      );
    },

    getProposal(proposalId: string, options: RequestOptions = {}): Promise<Proposal> {
      return unwrap(
        ai.GET('/platform_core.api.ai.get_proposal', {
          ...signalOf(options),
          params: { query: { proposal_id: proposalId } },
        }),
        isProposal,
        options,
      );
    },

    /** İnsan onayı. Yalnız kullanıcı onay düğmesine bastığında çağrılır. Özet `getProposal` yanıtından gelir. */
    approveProposal(
      proposalId: string,
      digest: string,
      options: RequestOptions = {},
    ): Promise<ApprovalOutcome> {
      return unwrap(
        ai.POST('/platform_core.api.ai.approve_proposal', {
          ...signalOf(options),
          body: { proposal_id: proposalId, digest },
        }),
        isApprovalOutcome,
        options,
      );
    },

    rejectProposal(proposalId: string, options: RequestOptions = {}): Promise<Proposal> {
      return unwrap(
        ai.POST('/platform_core.api.ai.reject_proposal', {
          ...signalOf(options),
          body: { proposal_id: proposalId },
        }),
        isProposal,
        options,
      );
    },

    resolveProposal(
      proposalId: string,
      outcome: 'succeeded' | 'failed',
      options: RequestOptions = {},
    ): Promise<Proposal> {
      return unwrap(
        ai.POST('/platform_core.api.ai.resolve_proposal', {
          ...signalOf(options),
          body: { proposal_id: proposalId, outcome },
        }),
        isProposal,
        options,
      );
    },

    /** İzin başvurularını sayfa sayfa okur. Frappe kayıt ve alan iznini uygular. */
    listLeaveApplications(
      query: LeaveListQuery = {},
      options: RequestOptions = {},
    ): Promise<LeaveApplication[]> {
      const pageLength = query.pageLength ?? 20;
      // Sözleşme: limit_start en az 0, limit_page_length 1 ile 100 arasındadır.
      const invalid = pagingError(query.start ?? 0, pageLength, { maxLimit: 100 });
      if (invalid) return Promise.reject(invalid);
      return unwrap(
        hrms.GET('/resource/Leave%20Application', {
          ...signalOf(options),
          params: {
            query: {
              ...(query.fields ? { fields: JSON.stringify(query.fields) } : {}),
              ...(query.filters ? { filters: JSON.stringify(query.filters) } : {}),
              ...(query.orderBy ? { order_by: query.orderBy } : {}),
              limit_start: query.start ?? 0,
              limit_page_length: pageLength,
            },
          },
        }),
        isLeaveList,
        { ...options, envelope: 'data' },
      );
    },

    getLeaveApplication(name: string, options: RequestOptions = {}): Promise<LeaveApplication> {
      return unwrap(
        hrms.GET('/resource/Leave%20Application/{name}', {
          ...signalOf(options),
          params: { path: { name } },
        }),
        isLeaveApplication,
        { ...options, envelope: 'data' },
      );
    },

    /** Başvuruyu onaylar. `version`, okunan kaydın `modified` değeridir. Eski sürüm `conflict` verir. */
    approveLeave(name: string, version: string, options: RequestOptions = {}): Promise<LeaveName> {
      return unwrap(
        hrms.POST('/method/hrms_tr.api.approve_leave', {
          ...signalOf(options),
          body: { name, version },
        }),
        isLeaveName,
        options,
      );
    },

    /** Açık başvuruyu reddeder. `version`, okunan kaydın `modified` değeridir. Eski sürüm `conflict` verir. */
    rejectLeave(name: string, version: string, options: RequestOptions = {}): Promise<LeaveName> {
      return unwrap(
        hrms.POST('/method/hrms_tr.api.reject_leave', {
          ...signalOf(options),
          body: { name, version },
        }),
        isLeaveName,
        options,
      );
    },

    /**
     * Ana sayfanın dört parçasını okur: bekleyen onaylar, sorunlu kayıtlar,
     * son değişiklikler ve özet sayılar. Bozuk yanıt `invalid_response` verir.
     */
    getHomeSummary(options: RequestOptions = {}): Promise<HomeSummary> {
      return unwrap(
        hrms.GET('/method/hrms_tr.api.get_home_summary', signalOf(options)),
        isHomeSummary,
        options,
      );
    },

    /** Onaylanmış başvuruyu iptal eder. `version`, okunan kaydın `modified` değeridir. */
    cancelLeave(name: string, version: string, options: RequestOptions = {}): Promise<LeaveName> {
      return unwrap(
        hrms.POST('/method/hrms_tr.api.cancel_leave', {
          ...signalOf(options),
          body: { name, version },
        }),
        isLeaveName,
        options,
      );
    },

    /** Bir kayıt üzerindeki iznin kararını ve nedenini okur. Kayıt değişmez. */
    explainPermission(
      query: ExplainPermissionQuery,
      options: RequestOptions = {},
    ): Promise<PermissionExplanation> {
      return unwrap(
        access.GET('/platform_core.api.access.explain_permission', {
          ...signalOf(options),
          params: { query },
        }),
        isPermissionExplanation,
        options,
      );
    },

    /**
     * Bir alanın yardımını okur (G-138). Kullanıcının okuyamadığı alan `unavailable` döner.
     * Tur, belge ve destek bağlantısı yoksa ilgili alan `null` gelir.
     */
    getFieldHelp(query: FieldHelpQuery, options: RequestOptions = {}): Promise<FieldHelp> {
      return unwrap(
        help.GET('/platform_core.api.help.get_field_help', {
          ...signalOf(options),
          params: { query },
        }),
        isFieldHelp,
        options,
      );
    },

    /** Bir bileşenin yardımını okur (G-138). Bileşen için yardım yoksa `null` döner. */
    getComponentHelp(
      componentId: string,
      options: RequestOptions & { language?: string } = {},
    ): Promise<ComponentHelp | null> {
      const query: { component_id: string; language?: string } = { component_id: componentId };
      if (options.language) query.language = options.language;
      return unwrap(
        help.GET('/platform_core.api.help.get_component_help', {
          ...signalOf(options),
          params: { query },
        }),
        isComponentHelpOrNull,
        options,
      );
    },

    /** Oturum sahibine uyan erişim kurallarının özetini okur. */
    getAccessSummary(doctype: string, options: RequestOptions = {}): Promise<AccessSummary> {
      return unwrap(
        access.GET('/platform_core.api.access.get_access_summary', {
          ...signalOf(options),
          params: { query: { doctype } },
        }),
        isAccessSummary,
        options,
      );
    },

    /** Bir kayıt türünün bütün rol izni satırlarını okur (G-62). Kayıt değişmez. */
    listRolePermissions(doctype: string, options: RequestOptions = {}): Promise<unknown> {
      return unwrap(
        access.GET('/platform_core.api.access.list_role_permissions', {
          ...signalOf(options),
          params: { query: { doctype } },
        }),
        isRecord,
        options,
      );
    },

    /** Bir rolün bir kayıt türündeki izin satırını yazar (G-62). Yalnız verilen haklar değişir. */
    setRolePermission(body: RolePermissionChange, options: RequestOptions = {}): Promise<unknown> {
      return unwrap(
        access.POST('/platform_core.api.access.set_role_permission', {
          ...signalOf(options),
          body,
        }),
        isRecord,
        options,
      );
    },

    /** Permission Log satırlarını en yeniden başlayarak sayfa sayfa okur (G-98). */
    listPermissionLogs(query: PermissionLogQuery, options: RequestOptions = {}): Promise<unknown> {
      const invalid = pagingError(query.start ?? 0, query.page_length ?? 20, { maxLimit: 100 });
      if (invalid) return Promise.reject(invalid);
      return unwrap(
        access.GET('/platform_core.api.access.list_permission_logs', {
          ...signalOf(options),
          params: { query },
        }),
        isRecord,
        options,
      );
    },

    /**
     * Hesabın telefon ve PWA kurulumlarını sayfa sayfa okur. Bir sayfada en çok 20 kurulum olur.
     * `after`, önceki sayfanın `nextAfter` değeridir. Son sayfada `nextAfter` boştur.
     */
    async listInstallations(
      after?: string,
      options: RequestOptions = {},
    ): Promise<{ installations: Installation[]; nextAfter: string | null }> {
      if (after !== undefined && !UUID_PATTERN.test(after)) {
        throw new ApiError({ kind: 'invalid_request', status: 0, code: 'invalid_uuid' });
      }
      const page = await unwrap(
        mobile.POST('/platform_core.api.mobile_pwa.v1_list_installations', {
          ...signalOf(options),
          params: { header: pwaHeaders },
          body: after === undefined ? {} : { after },
        }),
        isInstallationPage,
        options,
      );
      return { installations: page.installations, nextAfter: page.next_after };
    },

    /** Hesaba ait bir kurulumu iptal eder. Tarayıcının Frappe oturumu açık kalır. */
    revokeInstallation(installationId: string, options: RequestOptions = {}): Promise<Revoked> {
      if (!UUID_PATTERN.test(installationId)) {
        return Promise.reject(
          new ApiError({ kind: 'invalid_request', status: 0, code: 'invalid_uuid' }),
        );
      }
      return unwrap(
        mobile.POST('/platform_core.api.mobile_pwa.v1_revoke_installation', {
          ...signalOf(options),
          params: { header: pwaHeaders },
          body: { installation_id: installationId },
        }),
        isRevoked,
        options,
      );
    },

    /**
     * Bir kayıt türünün kayıtlarını sayfa sayfa okur (Frappe API v2, `GET /api/v2/document/<doctype>`).
     * Frappe kayıt ve alan iznini uygular. Toplam sayı dönmez. `hasNextPage` sonraki sayfayı söyler.
     * Gruplu sayım ve toplam için `groupSummary` kullanılır.
     */
    async listDocuments(
      doctype: string,
      query: DocumentListQuery = {},
      options: RequestOptions = {},
    ): Promise<DocumentPage> {
      if (doctype.trim().length === 0) {
        throw new ApiError({ kind: 'invalid_request', status: 0, code: 'doctype' });
      }
      const limit = query.limit ?? 20;
      const invalid = pagingError(query.start ?? 0, limit, { maxLimit: 100 });
      if (invalid) throw invalid;
      const { data, error, response } = await settle(
        frappeV2.GET('/api/v2/document/{doctype}', {
          ...signalOf(options),
          params: {
            path: { doctype },
            query: {
              ...(query.fields ? { fields: JSON.stringify(query.fields) } : {}),
              ...(query.filters ? { filters: JSON.stringify(query.filters) } : {}),
              ...(query.orderBy ? { order_by: query.orderBy } : {}),
              start: query.start ?? 0,
              limit,
            },
          },
        }),
        options.signal,
      );
      if (!response.ok) return fail(response, error);
      // API v2 yanıtı `message` zarfı taşımaz. `data` ve `has_next_page` üst düzeydedir.
      if (!isRawDocumentPage(data)) {
        throw new ApiError({ kind: 'invalid_response', status: response.status });
      }
      sessionExpiredNotified = false;
      return { data: data.data, hasNextPage: data.has_next_page };
    },

    async groupSummary(
      doctype: string,
      query: GroupSummaryQuery,
      options: RequestOptions = {},
    ): Promise<GroupSummary> {
      const summary = await unwrap(
        collection.GET(GROUP_SUMMARY_PATH, {
          ...signalOf(options),
          params: {
            query: {
              doctype,
              group_by: query.groupBy,
              ...(query.aggregate === undefined
                ? {}
                : { aggregate: query.aggregate, aggregate_field: query.aggregateField }),
              ...(query.filters === undefined ? {} : { filters: JSON.stringify(query.filters) }),
              ...(query.limit === undefined ? {} : { limit: query.limit }),
            },
          },
        }),
        isRawGroupSummary,
        options,
      );
      return {
        groups: summary.groups,
        totalCount: summary.total_count,
        truncated: summary.truncated,
      };
    },

    /**
     * Frappe'nin standart kayıt uçlarına istek gönderir (`/api/resource`, `/api/method`, `/api/v2`).
     * Kayıt görünümü bu yöntemi kullanır. Kendi `fetch` katmanı kurmaz (SZ-5, güvenlik bulgusu B3).
     * İzinli yol dışındaki adrese istek gönderilmez ve `invalid_request` hatası döner.
     */
    async frappeDocument(request: DocumentRequest): Promise<DocumentResponse> {
      if (!isDocumentPath(request.path)) {
        throw new ApiError({ kind: 'invalid_request', status: 0, code: 'path' });
      }
      const url = new URL(`${config.siteUrl}${request.path}`);
      for (const [key, value] of Object.entries(request.query ?? {})) {
        url.searchParams.set(key, value);
      }
      const headers = new Headers();
      if (request.body !== undefined) headers.set('Content-Type', 'application/json');
      if (request.etag) headers.set('If-None-Match', request.etag);
      const outgoing = prepare(
        new Request(url, {
          method: request.method,
          headers,
          credentials: config.credentials,
          ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
          ...(request.signal ? { signal: request.signal } : {}),
        }),
      );
      const response = await timedFetch(
        request.timeout === 'model' ? config.modelTimeoutMs : config.timeoutMs,
      )(outgoing);
      const etag = response.headers.get('ETag') ?? undefined;
      if (response.status === 304) return { ok: true, status: 304, etag, body: undefined };
      if (response.ok) {
        if (!isJsonResponse(response)) {
          throw new ApiError({ kind: 'invalid_response', status: response.status });
        }
        const body: unknown = await settle(response.json(), request.signal);
        sessionExpiredNotified = false;
        return { ok: true, status: response.status, etag, body };
      }
      let body: unknown;
      if (isJsonResponse(response)) {
        try {
          body = await response.json();
        } catch (error) {
          // Kullanıcı iptali olduğu gibi iletilir. Bozuk hata gövdesi yok sayılır.
          if (request.signal?.aborted) throw error;
        }
      }
      try {
        return await fail(response, body);
      } catch (error) {
        if (error instanceof ApiError) return { ok: false, error, body };
        throw error;
      }
    },

    /** Model geçidinden yanıt ister. Model anahtarı sunucudadır (AX-2). */
    complete(request: CompletionRequest, options: RequestOptions = {}): Promise<CompletionResult> {
      return unwrap(
        gateway.POST('/api/method/platform_core.api.model.complete', {
          ...signalOf(options),
          body: request,
        }),
        isCompletionResult,
        options,
      );
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

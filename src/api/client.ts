// Shared API client (SZ-5). Components reach the backend only through this client.
//
// The session runs on the same-origin Frappe cookie. The browser holds no access token.
// Writing requests carry the `X-Frappe-CSRF-Token` header (SZ-7). The `Authorization` header is never sent.
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
  /** Called once when the session ends. For example, it redirects the user to sign-in. */
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

/** App version. PWA endpoints require the `1.2.3` format in the `X-Mobile-App-Version` header. */
const APP_VERSION = packageVersion;

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const EMPTY_BODY_STATUSES = new Set([202, 204, 304]);

function isJsonResponse(response: Response): boolean {
  const type = response.headers.get('Content-Type') ?? '';
  return /^application\/(.+\+)?json\b/i.test(type);
}

/** A fetch that converts timeouts and network errors to the shared type. A user abort is passed through unchanged. */
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
 * Converts an error raised while reading the body to the shared type.
 * A user abort is passed through unchanged, so the screen does not treat the abort as an error.
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
  /** Fields to read. If omitted, Frappe returns only `name`. */
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
  /** Equality filter or name-membership filter. Example: `[['name', 'in', ['A', 'B']]]`. */
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
  /** Number of records to skip. */
  start?: number;
  /** Page size. Between 1 and 100. Default 20. */
  pageLength?: number;
}

/** `set_role_permission` body. `permissions` carries only the changed rights. */
export interface RolePermissionChange {
  doctype: string;
  role: string;
  permlevel?: number;
  if_owner?: 0 | 1;
  permissions: Record<string, boolean>;
}

/** `list_permission_logs` filters and page. */
export interface PermissionLogQuery {
  for_doctype?: string;
  for_document?: string;
  start?: number;
  page_length?: number;
}

export interface ExplainPermissionQuery {
  doctype: string;
  name: string;
  /** Treated as `read` if omitted. */
  ptype?: PermissionType;
  /** Only "System Manager" may query another user. */
  user?: string;
}

/**
 * Checks pagination values against the contract limits.
 * On an invalid value no request is sent and an `invalid_request` error is returned.
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
 * A request to Frappe's standard record endpoints (record view).
 * These endpoints are not in our OpenAPI contracts. The request still goes through the shared client:
 * site origin, cookie setting, CSRF store, timeout and session-expiry handling are the same (SZ-5).
 */
export interface DocumentRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /**
   * Path relative to the site origin. Starts with `/api/resource/`, `/api/method/` or `/api/v2/`.
   * Path segments are encoded by the caller. The query is given in the `query` field.
   */
  path: string;
  query?: Record<string, string>;
  /** Sent as JSON. */
  body?: unknown;
  /** If given, becomes the `If-None-Match` header. The server may return 304. */
  etag?: string | undefined;
  signal?: AbortSignal | undefined;
  /** If `model` is chosen, the model gateway's longer timeout is used. */
  timeout?: 'model' | undefined;
}

/**
 * A successful response body is raw JSON. Validation is the caller's job.
 * On an error response the shared error type and the raw body are returned. The session check and
 * session-expiry handling (return to sign-in) have already been done at this point.
 * The raw body is never put on screen as is; the record view shows only the sanitised message (SZ-8).
 */
export type DocumentResponse =
  | { ok: true; status: number; etag: string | undefined; body: unknown }
  | { ok: false; error: ApiError; body: unknown };

/** Allowed record path. Origin, query, fragment, and `.` and `..` segments are forbidden. */
const DOCUMENT_PATH = /^\/api\/(?:resource|method|v2)\/[^?#\\]+$/;

/** Is it a dot segment? The browser decodes `%2e` as a dot, and `%2e%2e` counts as `..`. */
function isDotSegment(segment: string): boolean {
  const plain = segment.replace(/%2e/gi, '.');
  return plain === '.' || plain === '..';
}

function isDocumentPath(path: string): boolean {
  if (!DOCUMENT_PATH.test(path) || path.includes('//')) return false;
  if (path.split('/').some(isDotSegment)) return false;
  // Final check: the path as decoded by the browser must also start with an allowed prefix.
  const resolved = new URL(path, 'https://site.invalid').pathname;
  return DOCUMENT_PATH.test(resolved);
}

export function createApiClient({ config, csrf, onSessionExpired }: ApiClientDeps) {
  let sessionExpiredNotified = false;

  /** Headers shared by every request. No token header; the CSRF token is read from the store on every write. */
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
      // A successful response must be JSON (SZ-5). Otherwise the response is not read.
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
  const frappeV2 = make<FrappeV2Paths>(config.siteUrl);
  // Required headers for PWA endpoints. The browser sets the `Origin` header itself and ignores this value.
  // The panel and the tenant site share an origin, so the value is the site origin.
  const pwaHeaders = {
    Origin: new URL(config.siteUrl).origin,
    'X-Mobile-App-Version': APP_VERSION,
    'X-Mobile-Contract-Version': '1' as const,
  };

  /**
   * For an ambiguous 403, verifies the session with a separate, uncached request (SZ-8).
   * The session counts as ended only on firm evidence: 401, a guest 403 or the `Guest` user.
   * A server error, malformed response or network error gives `unknown`. The original permission error is then kept.
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

  /** Checks the response and returns the `message` field. */
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
    // A Frappe RPC response carries `message`; a record endpoint (`/api/resource`) response carries `data`.
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
     * Returns the name of the signed-in user.
     * This endpoint probes the session. With no session it errors but does not start a redirect to sign-in.
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

    /** Requests the Keycloak sign-in URL from the server. `state`, PKCE and `nonce` are generated on the server. */
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

    /** Closes the Frappe session. Returns the Keycloak sign-out URL. */
    logout(options: RequestOptions = {}): Promise<LogoutUrl> {
      return unwrap(
        identity.POST('/platform_core.api.auth.logout', signalOf(options)),
        isLogoutUrl,
        options,
      );
    },

    /** Reads the shell's boot data: user, roles, apps and sidebar. */
    getBootstrap(options: RequestOptions = {}): Promise<Bootstrap> {
      return unwrap(
        shell.GET('/api/method/platform_core.api.shell.get_bootstrap', signalOf(options)),
        isBootstrap,
        options,
      );
    },

    /**
     * Reads the page definition the server generates from the DocType definition (RE-11).
     * If `etag` is given and nothing has changed, the server returns 304.
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
     * Sends a single JSON-RPC request to the MCP endpoint. Called with the session cookie.
     * When a notification (no `id`) is accepted, the server returns an empty 202. The result is `accepted`.
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
      // Contract: limit is between 1 and 100, start between 0 and 10000.
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

    /** Human approval. Called only when the user presses the approve button. The digest comes from the `getProposal` response. */
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

    /** Reads leave applications page by page. Frappe applies record and field permissions. */
    listLeaveApplications(
      query: LeaveListQuery = {},
      options: RequestOptions = {},
    ): Promise<LeaveApplication[]> {
      const pageLength = query.pageLength ?? 20;
      // Contract: limit_start is at least 0, limit_page_length is between 1 and 100.
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

    /** Approves the application. `version` is the `modified` value of the record read. A stale version gives `conflict`. */
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

    /** Rejects an open application. `version` is the `modified` value of the record read. A stale version gives `conflict`. */
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
     * Reads the four parts of the home page: pending approvals, problem records,
     * recent changes and summary counts. A malformed response gives `invalid_response`.
     */
    getHomeSummary(options: RequestOptions = {}): Promise<HomeSummary> {
      return unwrap(
        hrms.GET('/method/hrms_tr.api.get_home_summary', signalOf(options)),
        isHomeSummary,
        options,
      );
    },

    /** Cancels an approved application. `version` is the `modified` value of the record read. */
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

    /** Reads the permission decision and its reason for a record. The record is not changed. */
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

    /** Reads a summary of the access rules that match the session owner. */
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

    /** Reads all role permission rows of a DocType (G-62). No record is changed. */
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

    /** Writes a role's permission row for a DocType (G-62). Only the given rights change. */
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

    /** Reads Permission Log rows page by page, newest first (G-98). */
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
     * Reads the account's phone and PWA installations page by page. A page holds at most 20 installations.
     * `after` is the previous page's `nextAfter` value. On the last page `nextAfter` is empty.
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

    /** Revokes an installation belonging to the account. The browser's Frappe session stays open. */
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
     * Reads a DocType's records page by page (Frappe API v2, `GET /api/v2/document/<doctype>`).
     * Frappe applies record and field permissions. No total count is returned. `hasNextPage` tells whether there is a next page.
     * Use `groupSummary` for grouped counts and totals.
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
      // An API v2 response has no `message` envelope. `data` and `has_next_page` are at the top level.
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
     * Sends a request to Frappe's standard record endpoints (`/api/resource`, `/api/method`, `/api/v2`).
     * The record view uses this method and does not build its own `fetch` layer (SZ-5, security finding B3).
     * No request is sent to a URL outside the allowed paths; an `invalid_request` error is returned.
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
          // A user abort is passed through unchanged. A malformed error body is ignored.
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

    /** Requests a reply from the model gateway. The model key stays on the server (AX-2). */
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

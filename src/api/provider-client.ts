// Client for AI provider connections (model gateway contract).
//
// This file is not part of the initial load. The module client loads it with `import()` only when
// the AI providers page opens. Requests still go through the shared
// client (SZ-5): `frappeDocument` handles the site origin, CSRF header, timeout and session expiry.
//
// Values are imported only from `./index`. This keeps the shared client, error and guard code in
// the single initial-load chunk; the bundler does not split them into a separate chunk for this file.
import type { ApiClient, DocumentResponse, RequestOptions } from './client';
import type { components as GatewayComponents } from './generated/platform_core-model-gateway';
import type { Guard } from './guards';
import { ApiError } from './index';

export type ProviderCatalog = GatewayComponents['schemas']['ProviderCatalog'];
export type ProviderDefinition = ProviderCatalog['providers'][number];
export type ProviderFieldDefinition = GatewayComponents['schemas']['FieldDefinition'];
export type ConnectionInput = GatewayComponents['schemas']['ConnectionInput'];
export type SavedConnection = GatewayComponents['schemas']['SavedConnection'];
export type ConnectionCheck = GatewayComponents['schemas']['ConnectionCheck'];
export type ConnectionStatus = ConnectionCheck['status'];

/** Catalogue and record IDs: lowercase letters, digits and underscores, at most 40 characters. */
export const CATALOG_ID_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
const FIELD_KINDS = new Set(['secret', 'text', 'url']);
const FIELD_SCOPES = new Set(['account', 'api']);
const AUTH_TYPES = new Set(['none', 'api_key', 'bearer', 'oauth_client_credentials']);
export const CONNECTION_STATUSES: readonly ConnectionStatus[] = [
  'connected',
  'invalid_credentials',
  'permission_denied',
  'quota_exceeded',
  'network_error',
  'provider_error',
  'endpoint_not_approved',
  'configuration_error',
];
const CONNECTION_STATUS_SET = new Set<string>(CONNECTION_STATUSES);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isCatalogId = (value: unknown): value is string =>
  isString(value) && CATALOG_ID_PATTERN.test(value);

export const isProviderFieldDefinition: Guard<ProviderFieldDefinition> = (
  value,
): value is ProviderFieldDefinition =>
  isRecord(value) &&
  isCatalogId(value.name) &&
  isString(value.label) &&
  isString(value.kind) &&
  FIELD_KINDS.has(value.kind) &&
  typeof value.required === 'boolean' &&
  isString(value.scope) &&
  FIELD_SCOPES.has(value.scope) &&
  isString(value.description);

function isProviderDefinition(value: unknown): value is ProviderDefinition {
  return (
    isRecord(value) &&
    isCatalogId(value.id) &&
    isString(value.category) &&
    isString(value.label) &&
    isString(value.description) &&
    isString(value.auth_type) &&
    AUTH_TYPES.has(value.auth_type) &&
    Array.isArray(value.fields) &&
    value.fields.every(isProviderFieldDefinition) &&
    Array.isArray(value.common_fields) &&
    value.common_fields.every(isProviderFieldDefinition)
  );
}

/** Checks the catalogue response. Every provider's category must be in the list. */
export const isProviderCatalog: Guard<ProviderCatalog> = (value): value is ProviderCatalog => {
  if (
    !isRecord(value) ||
    typeof value.version !== 'number' ||
    !Number.isInteger(value.version) ||
    value.version < 1 ||
    !Array.isArray(value.categories) ||
    !Array.isArray(value.providers)
  ) {
    return false;
  }
  const categories = new Set<string>();
  for (const category of value.categories) {
    if (
      !isRecord(category) ||
      !isCatalogId(category.id) ||
      !isString(category.label) ||
      !isString(category.description)
    ) {
      return false;
    }
    categories.add(category.id);
  }
  return value.providers.every(
    (provider) => isProviderDefinition(provider) && categories.has(provider.category),
  );
};

export const isSavedConnection: Guard<SavedConnection> = (value): value is SavedConnection =>
  isRecord(value) &&
  isString(value.provider) &&
  isString(value.account) &&
  isString(value.api) &&
  value.connection_status === 'not_checked';

export const isConnectionCheck: Guard<ConnectionCheck> = (value): value is ConnectionCheck =>
  isRecord(value) &&
  isString(value.api) &&
  isString(value.status) &&
  CONNECTION_STATUS_SET.has(value.status) &&
  isString(value.checked_at) &&
  (value.models_visible === null ||
    (typeof value.models_visible === 'number' &&
      Number.isInteger(value.models_visible) &&
      value.models_visible >= 0));

const NAME_MAX = 140;
const FIELD_VALUE_MAX = 4096;

/**
 * Checks connection input against the contract limits. Invalid input is not sent to the server.
 * `code` names the invalid field: `provider`, `account`, `account_name`, `api_name` or `fields`.
 */
export function connectionInputError(input: ConnectionInput): ApiError | undefined {
  const invalid = (code: string) =>
    new ApiError({ kind: 'invalid_request', status: 0, code, fields: [code] });
  if (!CATALOG_ID_PATTERN.test(input.provider)) return invalid('provider');
  const hasAccount = input.account !== undefined;
  const hasAccountName = input.account_name !== undefined;
  if (hasAccount === hasAccountName) return invalid('account');
  const nameOk = (value: string | undefined) =>
    value === undefined || (value.length >= 1 && value.length <= NAME_MAX);
  if (!nameOk(input.account)) return invalid('account');
  if (!nameOk(input.account_name)) return invalid('account_name');
  if (input.api_name.length < 1 || input.api_name.length > NAME_MAX) return invalid('api_name');
  for (const [name, value] of Object.entries(input.fields)) {
    if (
      !CATALOG_ID_PATTERN.test(name) ||
      typeof value !== 'string' ||
      value.length > FIELD_VALUE_MAX
    )
      return invalid('fields');
  }
  return undefined;
}

/** DocTypes on the backend (model gateway). */
const AI_DOCTYPES = {
  api: 'PLT AI API',
  account: 'PLT AI Account',
  provider: 'PLT AI Provider',
} as const;
/** Fields read. The password field (`api_key`) is never in this list. */
const AI_FIELDS = {
  api: ['name', 'api_name', 'account', 'connection_status', 'connection_checked_at'],
  account: ['name', 'account_name', 'provider'],
  provider: ['name', 'provider_name', 'catalog_provider'],
};
/** Largest page of the list endpoint. More connections are not expected within the MVP scope. */
const AI_LIST_LIMIT = 100;

/** Saved API connections, accounts and provider records. Rows are raw records. */
export interface AiConnectionListing {
  apis: Record<string, unknown>[];
  accounts: Record<string, unknown>[];
  providers: Record<string, unknown>[];
}

const METHOD = '/api/method/platform_core.api.model.';

/** Reads the gateway's `message.fields` list. Only string items are taken; values are not carried (SZ-8). */
function readFields(body: unknown): string[] | undefined {
  if (!isRecord(body) || !isRecord(body.message) || !Array.isArray(body.message.fields)) {
    return undefined;
  }
  const fields = body.message.fields.filter(
    (item): item is string => typeof item === 'string' && item.length > 0,
  );
  return fields.length > 0 ? fields : undefined;
}

/** Adds the fields the server found invalid to the error response. */
function withFields(response: Extract<DocumentResponse, { ok: false }>): ApiError {
  const fields = readFields(response.body);
  return fields ? new ApiError({ ...response.error, fields }) : response.error;
}

export function createProviderClient(api: ApiClient) {
  /** Sends a POST to the model gateway. Unwraps the response from the `message` envelope and checks it. */
  async function post<T>(
    method: 'provider_catalog' | 'save_connection' | 'check_connection',
    body: object,
    guard: Guard<T>,
    options: RequestOptions,
  ): Promise<T> {
    const response = await api.frappeDocument({
      method: 'POST',
      path: `${METHOD}${method}`,
      body,
      timeout: 'model',
      ...(options.signal ? { signal: options.signal } : {}),
    });
    if (!response.ok) throw withFields(response);
    const value = isRecord(response.body) ? response.body.message : undefined;
    if (!guard(value)) throw new ApiError({ kind: 'invalid_response', status: response.status });
    return value;
  }

  return {
    /**
     * Reads the provider catalogue: categories, providers and field schemas.
     * The contract makes this endpoint POST, so the request carries the CSRF header. The response has no secrets or model names.
     */
    listProviderCatalog(options: RequestOptions = {}): Promise<ProviderCatalog> {
      return post('provider_catalog', {}, isProviderCatalog, options);
    },

    /** Reads connections, accounts and provider records via Frappe API v2. */
    async listAiConnections(options: RequestOptions = {}): Promise<AiConnectionListing> {
      const read = (kind: keyof typeof AI_DOCTYPES, orderBy: string) =>
        api
          .listDocuments(
            AI_DOCTYPES[kind],
            { fields: AI_FIELDS[kind], orderBy, limit: AI_LIST_LIMIT },
            options,
          )
          .then((page) => page.data);
      const [apis, accounts, providers] = await Promise.all([
        read('api', 'modified desc'),
        read('account', 'name asc'),
        read('provider', 'name asc'),
      ]);
      return { apis, accounts, providers };
    },

    /**
     * Saves a provider connection. The secret travels only in the request body; the response returns no secret.
     * Exactly one of `account` (existing account) or `account_name` (new account) is given.
     * A request outside the contract gets an `invalid_request` error without reaching the server.
     */
    saveProviderConnection(
      input: ConnectionInput,
      options: RequestOptions = {},
    ): Promise<SavedConnection> {
      const invalid = connectionInputError(input);
      if (invalid) return Promise.reject(invalid);
      return post('save_connection', input, isSavedConnection, options);
    },

    /**
     * Tests a saved connection live. The server sends the provider a single model-list request.
     * A failed test also returns HTTP 200 and a `status` value. Rate limiting gives 429 `gateway_busy`.
     */
    checkProviderConnection(api: string, options: RequestOptions = {}): Promise<ConnectionCheck> {
      if (api.length === 0 || api.length > NAME_MAX) {
        return Promise.reject(new ApiError({ kind: 'invalid_request', status: 0, code: 'api' }));
      }
      return post('check_connection', { api }, isConnectionCheck, options);
    },
  };
}

export type ProviderClient = ReturnType<typeof createProviderClient>;

// AtonotA Login client: sign-in platforms and linked accounts (G-159, G-160).
//
// This file is not part of the initial load. The sign-in screen and the account page load it with `import()`.
// Requests still go through the shared client (SZ-5): `frappeDocument` handles the site origin, CSRF header,
// timeout and session expiry. The contract is in `src/auth/README.md`.
//
// Values are imported only from `./index`. This keeps the shared code in the initial-load chunk.
import type { ApiClient, RequestOptions } from './client';
import type { Guard } from './guards';
import { ApiError, isProviderAlias } from './index';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export interface LoginProvider {
  alias: string;
  display_name: string;
}

export interface LoginProviderList {
  providers: LoginProvider[];
}

export interface LinkedProvider extends LoginProvider {
  linked: boolean;
}

export interface LinkedAccounts {
  providers: LinkedProvider[];
  /** Number of non-platform sign-in methods. Example: password or passkey. */
  local_sign_in_methods: number;
}

const MAX_PROVIDERS = 100;
const MAX_DISPLAY_NAME = 80;

function isLoginProvider(value: unknown): value is LoginProvider {
  return (
    isRecord(value) &&
    isProviderAlias(value.alias) &&
    typeof value.display_name === 'string' &&
    value.display_name.trim().length > 0 &&
    value.display_name.length <= MAX_DISPLAY_NAME
  );
}

function isUniqueProviderList<T extends LoginProvider>(
  value: unknown,
  item: (entry: unknown) => entry is T,
): value is T[] {
  if (!Array.isArray(value) || value.length > MAX_PROVIDERS || !value.every(item)) return false;
  return new Set(value.map((entry) => entry.alias)).size === value.length;
}

export const isLoginProviderList: Guard<LoginProviderList> = (value): value is LoginProviderList =>
  isRecord(value) && isUniqueProviderList(value.providers, isLoginProvider);

function isLinkedProvider(value: unknown): value is LinkedProvider {
  return isLoginProvider(value) && typeof (value as { linked?: unknown }).linked === 'boolean';
}

export const isLinkedAccounts: Guard<LinkedAccounts> = (value): value is LinkedAccounts =>
  isRecord(value) &&
  isUniqueProviderList(value.providers, isLinkedProvider) &&
  typeof value.local_sign_in_methods === 'number' &&
  Number.isInteger(value.local_sign_in_methods) &&
  value.local_sign_in_methods >= 0;

const METHOD = '/api/method/platform_core.api.auth.';

/** Rule for the return path after linking: a simple lowercase path on the same origin (GV-3). */
const RETURN_PATH_PATTERN = /^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/;

/**
 * Builds the account linking URL (G-160). The browser goes to this URL with a page navigation.
 * The server checks the session and starts Keycloak's linking flow. The browser holds no token.
 * The calling page supplies the return path. Example: `/account`.
 * If the platform name or return path breaks the rule, no URL is built and `undefined` is returned.
 */
export function startLinkUrl(
  siteUrl: string,
  provider: string,
  returnPath: string,
): string | undefined {
  if (!isProviderAlias(provider) || !RETURN_PATH_PATTERN.test(returnPath)) return undefined;
  const url = new URL(`${siteUrl}${METHOD}start_link`);
  url.searchParams.set('provider', provider);
  url.searchParams.set('redirect_to', returnPath);
  return url.toString();
}

export function createLoginClient(api: Pick<ApiClient, 'frappeDocument'>) {
  async function call<T>(
    method: 'GET' | 'POST',
    name: string,
    body: object | undefined,
    guard: Guard<T>,
    options: RequestOptions,
  ): Promise<T> {
    const response = await api.frappeDocument({
      method,
      path: `${METHOD}${name}`,
      ...(body ? { body } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
    if (!response.ok) throw response.error;
    const value = isRecord(response.body) ? response.body.message : undefined;
    if (!guard(value)) throw new ApiError({ kind: 'invalid_response', status: response.status });
    return value;
  }

  return {
    /**
     * Reads the sign-in screen's platform list (G-159). Needs no session.
     * The server returns only enabled platforms, in the server's order.
     */
    async listLoginProviders(options: RequestOptions = {}): Promise<LoginProvider[]> {
      const list = await call(
        'GET',
        'list_login_providers',
        undefined,
        isLoginProviderList,
        options,
      );
      return list.providers;
    },

    /** Reads the signed-in user's linked platforms (G-160). */
    listLinkedAccounts(options: RequestOptions = {}): Promise<LinkedAccounts> {
      return call('GET', 'list_linked_accounts', undefined, isLinkedAccounts, options);
    },

    /**
     * Removes a platform link. Returns the new list.
     * The last sign-in method cannot be removed: the server returns 409 and `LastSignInMethod`.
     */
    unlinkAccount(provider: string, options: RequestOptions = {}): Promise<LinkedAccounts> {
      if (!isProviderAlias(provider)) {
        return Promise.reject(
          new ApiError({ kind: 'invalid_request', status: 0, code: 'provider' }),
        );
      }
      return call('POST', 'unlink_account', { provider }, isLinkedAccounts, options);
    },
  };
}

export type LoginClient = ReturnType<typeof createLoginClient>;

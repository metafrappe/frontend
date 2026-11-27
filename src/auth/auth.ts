// Web panel sign-in.
//
// The browser holds no access token. Sign-in goes through the backend flow:
//   start_login -> Keycloak -> keycloak_callback -> Frappe session cookie.
// `state`, the PKCE verifier and `nonce` are generated and stored on the server.
// The panel is served from the same origin. Only the CSRF token is kept in memory. It is cleared on logout and when the session ends.
import type { ApiClient } from '@/api/client';
import type { ApiConfig } from '@/api/config';
import type { CsrfStore } from '@/api/csrf';
import { ApiError } from '@/api/errors';
import { isProviderAlias } from '@/api/guards';

/**
 * Short note on the sign-in screen.
 * `idp_session_may_remain`: the panel session is closed, but the Keycloak session may still be open.
 */
export type SignedOutNotice = 'idp_session_may_remain';

export type AuthState =
  | { status: 'checking' }
  | { status: 'signed_in'; user: string }
  | { status: 'signed_out'; notice?: SignedOutNotice }
  | { status: 'redirecting' }
  | { status: 'error'; error: ApiError };

export interface AuthDeps {
  api: Pick<ApiClient, 'getLoggedUser' | 'logout'>;
  config: Pick<ApiConfig, 'siteUrl' | 'keycloakUrl'>;
  csrf: CsrfStore;
  /** Navigates the browser to the given URL. Example: `(url) => window.location.assign(url)`. */
  navigate: (url: string) => void;
  /** Path to return to after sign-in. Example: `/panel/kayitlar?durum=acik`. */
  currentPath: () => string;
}

// The `redirect_to` pattern from the contract.
const REDIRECT_PATTERN = /^\/(?!\/)[A-Za-z0-9\-._~/?#@!$&()*+,;=%:[\]]*$/;

/** Is the return path a relative path on the same origin? Follows the contract rule. */
export function isSafeRedirect(path: string): boolean {
  return path.length <= 2048 && REDIRECT_PATTERN.test(path);
}

/**
 * Builds the backend URL that starts sign-in.
 * An unsafe return path is not added to the URL. The server then returns to `platform_panel_url`.
 * A given platform name is added as `provider`. The server passes it to Keycloak as `kc_idp_hint`.
 * So the browser goes straight to the platform's sign-in page (G-159).
 * A platform name that breaks the rule is not added. The AtonotA Login screen then opens.
 */
export function startLoginUrl(siteUrl: string, redirectTo: string, provider?: string): string {
  const url = new URL(`${siteUrl}/api/method/platform_core.api.auth.start_login`);
  if (isSafeRedirect(redirectTo)) url.searchParams.set('redirect_to', redirectTo);
  if (provider !== undefined && isProviderAlias(provider))
    url.searchParams.set('provider', provider);
  return url.toString();
}

const LOGOUT_PATH_SUFFIX = '/protocol/openid-connect/logout';

/**
 * Validates the Keycloak logout URL (GV-3).
 * The URL's origin must match the `keycloakUrl` origin, so we never go to another domain.
 * An `http` URL passes only if the Keycloak root is also `http`. Matching origins guarantee this.
 * The path ends with `/protocol/openid-connect/logout`. The URL contains no username or password.
 */
export function isSafeLogoutUrl(value: string, keycloakUrl: string): boolean {
  let url: URL;
  let base: URL;
  try {
    url = new URL(value);
    base = new URL(keycloakUrl);
  } catch {
    return false;
  }
  return (
    (url.protocol === 'https:' || url.protocol === 'http:') &&
    url.origin === base.origin &&
    url.username === '' &&
    url.password === '' &&
    url.pathname.endsWith(LOGOUT_PATH_SUFFIX)
  );
}

function sameState(a: AuthState, b: AuthState): boolean {
  if (a.status !== b.status) return false;
  if (a.status === 'signed_in' && b.status === 'signed_in') return a.user === b.user;
  if (a.status === 'error' && b.status === 'error') return a.error === b.error;
  if (a.status === 'signed_out' && b.status === 'signed_out') return a.notice === b.notice;
  return true;
}

function asApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError({ kind: 'unknown', status: 0 });
}

export function createAuth({ api, config, csrf, navigate, currentPath }: AuthDeps) {
  let state: AuthState = { status: 'checking' };
  const listeners = new Set<() => void>();

  function setState(next: AuthState): void {
    if (sameState(state, next)) return;
    state = next;
    for (const listener of listeners) listener();
  }

  /**
   * Sends the user to the backend sign-in flow. Called only on a user action or when the session ends.
   * If a platform name is given, sign-in starts with that platform. Example: `signIn(undefined, 'google')`.
   */
  function signIn(redirectTo: string = currentPath(), provider?: string): void {
    setState({ status: 'redirecting' });
    navigate(startLoginUrl(config.siteUrl, redirectTo, provider));
  }

  return {
    getState: (): AuthState => state,

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /**
     * Asks the server for the session. Does not redirect when there is no session; the screen shows the sign-in button.
     * On a server error it moves to the `error` state. The session is not treated as ended.
     */
    async check(): Promise<void> {
      if (state.status !== 'signed_in') setState({ status: 'checking' });
      try {
        const user = await api.getLoggedUser();
        setState(user === 'Guest' ? { status: 'signed_out' } : { status: 'signed_in', user });
      } catch (error) {
        const apiError = asApiError(error);
        if (apiError.kind === 'session_expired' || apiError.kind === 'forbidden') {
          setState({ status: 'signed_out' });
        } else {
          setState({ status: 'error', error: apiError });
        }
      }
    },

    signIn,

    /**
     * Closes the Frappe session, then goes to the Keycloak logout page.
     * If the request fails, the session stays open and the function rejects with `ApiError`.
     * If the URL from the server fails validation, the panel's sign-in screen opens.
     * The screen then says the Keycloak session may still be open (K-3).
     */
    async signOut(): Promise<void> {
      let target: { logout_url: string };
      try {
        target = await api.logout();
      } catch (error) {
        throw asApiError(error);
      }
      // The Frappe session is closed. The CSRF token in memory is cleared too.
      csrf.clear();
      if (!isSafeLogoutUrl(target.logout_url, config.keycloakUrl)) {
        setState({ status: 'signed_out', notice: 'idp_session_may_remain' });
        return;
      }
      setState({ status: 'redirecting' });
      navigate(target.logout_url);
    },

    /**
     * Called when the API client reports that the session has ended.
     * If the user was signed in, sends them to sign in again, once.
     * If no session was ever open, only the sign-in screen is shown. No automatic redirect happens.
     */
    handleSessionExpired(): void {
      csrf.clear();
      if (state.status === 'signed_in') signIn();
      else if (state.status !== 'redirecting') setState({ status: 'signed_out' });
    },
  };
}

export type Auth = ReturnType<typeof createAuth>;

/**
 * API settings. Values come from the build environment (`VITE_` variables).
 * These values reach the browser. No secret values go here (GV-1).
 */
export interface ApiConfig {
  /** Origin of the tenant site. Example: `https://kiraci.example.test`. The panel is served on the same origin. */
  siteUrl: string;
  /** Cookie policy. `same-origin` on the same origin, `include` on a different origin of the same site (SZ-14). */
  credentials: RequestCredentials;
  /** Timeout for an ordinary request, in milliseconds. */
  timeoutMs: number;
  /** Timeout for a model gateway request, in milliseconds. The gateway's own timeout is 60 seconds. */
  modelTimeoutMs: number;
  /** Keycloak origin as seen from the browser. The sign-in URL is checked against this origin. */
  keycloakUrl: string;
  /** Keycloak realm name. */
  keycloakRealm: string;
  /** Name of the "AI Route" record in the model gateway. If empty, AI is disabled. */
  aiRoute: string;
  /** Name of the `meta` element that carries the CSRF token. */
  csrfMetaName: string;
}

export interface ApiEnv {
  VITE_SITE_URL?: string;
  VITE_KEYCLOAK_URL?: string;
  VITE_KEYCLOAK_REALM?: string;
  VITE_AI_ROUTE?: string;
  VITE_CSRF_META_NAME?: string;
}

/** AtonotA Login sign-in URL. In each environment it is `https://api.login.<ortam>.atonota.net`. */
export const DEFAULT_KEYCLOAK_URL = 'https://api.login.atonota.net';
export const DEFAULT_KEYCLOAK_REALM = 'platform';

function trimSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function readApiConfig(env: ApiEnv, currentOrigin: string): ApiConfig {
  const siteUrl = trimSlash(env.VITE_SITE_URL?.trim() || currentOrigin);
  const sameOrigin = new URL(siteUrl).origin === currentOrigin;
  return {
    siteUrl,
    credentials: sameOrigin ? 'same-origin' : 'include',
    timeoutMs: 30_000,
    modelTimeoutMs: 65_000,
    keycloakUrl: trimSlash(env.VITE_KEYCLOAK_URL?.trim() || DEFAULT_KEYCLOAK_URL),
    keycloakRealm: env.VITE_KEYCLOAK_REALM?.trim() || DEFAULT_KEYCLOAK_REALM,
    aiRoute: env.VITE_AI_ROUTE?.trim() ?? '',
    csrfMetaName: env.VITE_CSRF_META_NAME?.trim() || 'csrf-token',
  };
}

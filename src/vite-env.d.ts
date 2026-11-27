/// <reference types="vite/client" />

/** Build-time environment variables. Values come from .env files or the command line. */
interface ImportMetaEnv {
  /** Origin of the tenant site. Defaults to the page origin. */
  readonly VITE_SITE_URL?: string;
  /** Keycloak origin. Default https://api.login.atonota.net */
  readonly VITE_KEYCLOAK_URL?: string;
  /** Keycloak realm name. Default platform */
  readonly VITE_KEYCLOAK_REALM?: string;
  readonly VITE_AI_ROUTE?: string;
  /** Name of the meta element carrying the CSRF token. Default csrf-token */
  readonly VITE_CSRF_META_NAME?: string;
  /** Mock server: "on" enables it in the build, "off" disables it in development. */
  readonly VITE_API_MOCKS?: 'on' | 'off' | string;
  /** Dev server only: address of the local Frappe backend. See vite/dev-backend.ts */
  readonly VITE_DEV_BACKEND?: string;
  /** Dev server only: Frappe socket.io address. */
  readonly VITE_DEV_SOCKET?: string;
  /** Dev server only: Frappe site name (X-Frappe-Site-Name). */
  readonly VITE_DEV_SITE_NAME?: string;
  /** Dev server only: Host mode, "browser" or "target". */
  readonly VITE_DEV_BACKEND_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

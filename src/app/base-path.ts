// The panel's base path. The value comes from the build config (`vite.config.ts`, `vite/base-path.ts`).
// It is `/panel/` in production and `/` in local development and e2e mode.

/** The build's base path. Always starts and ends with `/`. */
export const APP_BASE: string = import.meta.env.BASE_URL;

/** The router's `basename` value. There is no value at the root path. Example: `/panel` for `/panel/`. */
export function routerBasename(base: string = APP_BASE): string | undefined {
  const trimmed = base.replace(/\/+$/, '');
  return trimmed === '' ? undefined : trimmed;
}

/**
 * The in-app path of the browser URL. The panel prefix is removed.
 * Example: `/atonota-login` for `/panel/atonota-login`. A path not starting with the prefix is unchanged.
 */
export function appPathname(pathname: string, base: string = APP_BASE): string {
  const prefix = routerBasename(base);
  if (!prefix) return pathname;
  if (pathname === prefix) return '/';
  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
}

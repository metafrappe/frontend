/**
 * Demo pages open only in the e2e build: `vite build --mode e2e` or `vite --mode e2e`.
 * In the production build (`vite build`) these pages do not enter the bundle; the condition is constant at build time.
 *
 * Path rule: each work item opens its demo page at `/_demo/<work-item>`. Routes are registered
 * in the shell work's lazy route list (`src/shell/routes.ts`). Each work item adds only its own line to that list:
 *   ...(import.meta.env.MODE === 'e2e' ? [{ path: '/_demo/ai', ... load: () => import('@/ai/demo/page') }] : [])
 * The condition must be a plain comparison. An `isDemoEnabled(...)` call is not folded to a constant at build time.
 *
 * The `/_demo/` prefix never falls through to the collection page (`/:module/:doctype`). If no demo
 * page is registered, the path goes to the "not found" page. The router (shell work) enforces this rule;
 * `isDemoPath` provides this distinction from a single place.
 */
export const DEMO_MODE = 'e2e';
export const DEMO_PATH_PREFIX = '/_demo/';

export function isDemoEnabled(mode: string | undefined): boolean {
  return mode === DEMO_MODE;
}

/** Is the path of the form `/_demo/<work-item>`? Query strings and sub-paths count; `/_demo` on its own does not. */
export function isDemoPath(pathname: string): boolean {
  return pathname.startsWith(DEMO_PATH_PREFIX) && pathname.length > DEMO_PATH_PREFIX.length;
}

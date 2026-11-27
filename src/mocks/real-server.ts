/**
 * Real server guard. AtonotA Login and environment servers are in the `atonota.net` domain.
 * Example: `api.login.atonota.net` and `api.login.alpha.atonota.net`.
 *
 * The mock server does not let requests to this domain reach the network. Its worker cuts them.
 * The shared browser test fixture uses the same check: `tests/setup/dis-istek.ts`.
 */
export const GUARDED_DOMAIN = 'atonota.net';

/** Prefix of a cut request in the browser log. Browser tests read this entry. */
export const REAL_SERVER_LOG_PREFIX = '[sahte-sunucu] gerçek sunucu isteği kesildi:';

/**
 * Returns `true` if the address is in the guarded domain. Look-alike names (`notatonota.net`) are
 * not guarded.
 */
export function isGuardedUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return host === GUARDED_DOMAIN || host.endsWith(`.${GUARDED_DOMAIN}`);
}

/** Log entry: `<prefix> <method> <address>`. */
export function realServerLogLine(method: string, url: string): string {
  return `${REAL_SERVER_LOG_PREFIX} ${method} ${url}`;
}

/** Returns `<method> <address>` if the log line records a cut request. */
export function parseRealServerLogLine(line: string): string | null {
  if (!line.startsWith(`${REAL_SERVER_LOG_PREFIX} `)) return null;
  return line.slice(REAL_SERVER_LOG_PREFIX.length + 1);
}

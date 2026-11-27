// Address of the Press account deletion page.
//
// Orchestrator decision, Monday 23 November 2026: the panel does not call the Press endpoint directly.
// Press is a separate origin. Press writes its own CSRF token into its own `/account-deletion` page.
// The browser does not carry another origin's cookie or CSRF token (SZ-7).
// On the "Delete account" button, the panel does a full-page redirect of the user to this page.
// Re-authentication and confirmation happen on the Press page. Details: src/api/README.md.

export interface PressEnv {
  VITE_PRESS_URL?: string;
  /** True on the Vite dev server. Plain HTTP localhost is accepted only in this case. */
  DEV?: boolean;
}

export interface PressConfig {
  /** Press origin. Example: `https://press.example.test`. It carries no path, query or user info. */
  pressUrl: string;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function isLocalHost(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname) || hostname.endsWith('.localhost');
}

/**
 * Reads the Press setting and validates the origin (GV-3).
 * If the setting is absent, Press is disabled and `undefined` is returned.
 * If the setting is invalid, it throws. This way a wrong address is never used silently.
 */
export function readPressConfig(env: PressEnv): PressConfig | undefined {
  const raw = env.VITE_PRESS_URL?.trim();
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('VITE_PRESS_URL is not a valid URL.');
  }
  const secure =
    url.protocol === 'https:' ||
    (env.DEV === true && url.protocol === 'http:' && isLocalHost(url.hostname));
  const bareOrigin =
    url.username === '' &&
    url.password === '' &&
    (url.pathname === '/' || url.pathname === '') &&
    url.search === '' &&
    url.hash === '';
  if (!secure || !bareOrigin) {
    throw new Error('VITE_PRESS_URL must be an https origin without path, query or credentials.');
  }
  return { pressUrl: url.origin };
}

/** Full address of the Press account deletion page. The panel does a full-page redirect to it. */
export function pressAccountDeletionUrl(config: PressConfig): string {
  return `${config.pressUrl}/account-deletion`;
}

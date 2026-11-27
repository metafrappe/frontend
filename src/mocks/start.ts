// Starts the mock server in the browser.
//
// The mock server starts when:
//   - on the dev server (`import.meta.env.DEV`), unless `VITE_API_MOCKS=off`,
//   - or the build sets `VITE_API_MOCKS=on`, for example for browser tests.
// Without this setting, a production build does not include the mock server.

export interface MockEnv {
  DEV: boolean;
  VITE_API_MOCKS?: string;
}

export function mocksEnabled(env: MockEnv): boolean {
  if (env.VITE_API_MOCKS === 'off') return false;
  return env.DEV || env.VITE_API_MOCKS === 'on';
}

export type MockStartResult = { active: false } | { active: true; csrfToken: string };

/**
 * Requests the mock server owns: those whose path starts with `/api/`.
 * Page, chunk and font requests do not belong to the mock server; they pass through unchanged.
 * An `/api/` request with no handler fails and does not reach the network.
 */
export function isMockedApiRequest(url: string): boolean {
  return new URL(url).pathname.startsWith('/api/');
}

/** Called before API requests. No request is sent before the worker is ready. */
export async function startApiMocks(): Promise<MockStartResult> {
  // The condition uses `import.meta.env` directly. The build turns it into a constant,
  // so when off, the mock server is not bundled. The rule matches `mocksEnabled`.
  if (
    import.meta.env.VITE_API_MOCKS === 'off' ||
    !(import.meta.env.DEV || import.meta.env.VITE_API_MOCKS === 'on')
  ) {
    return { active: false };
  }
  const { startMockWorker } = await import('./browser');
  const { csrfToken } = await startMockWorker();
  return { active: true, csrfToken };
}

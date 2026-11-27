// Mock server that runs in the browser during development.
// Load it dynamically only under `import.meta.env.DEV`. It is not in the production bundle.
import { setupWorker } from 'msw/browser';

import { SAMPLE_CSRF_TOKEN } from './fixtures';
import { handlers } from './handlers';
import { isGuardedUrl, realServerLogLine } from './real-server';
import { applyMockScenario, readMockScenario } from './scenarios';
import { isMockedApiRequest } from './start';
import { mockWorkerOptions } from './worker-url';

/**
 * Starts the mock server. The returned CSRF value is a sample and is valid only on the mock server.
 */
export async function startMockWorker(): Promise<{ csrfToken: string }> {
  // If a browser test chose a scenario, the mock server answers according to it.
  applyMockScenario(readMockScenario());
  const worker = setupWorker(...handlers);
  await worker.start({
    quiet: true,
    // The worker is on the panel path: `/mockServiceWorker.js` at the root,
    // `/panel/mockServiceWorker.js` live.
    serviceWorker: mockWorkerOptions(import.meta.env.BASE_URL),
    /**
     * Only `/api/` requests belong to the mock server. A request with no handler fails and does
     * not reach the network. Page and static file requests pass through the worker unchanged.
     * The built-in "error" rule also broke page reloads: when the worker checked the page, the
     * page request did not match the rule, and only a JSON error text was left on screen.
     *
     * An `atonota.net` request does not reach the network. The worker turns it into a network
     * error and writes it to the log. In WebKit, Playwright does not see requests the worker
     * passes on. Browser tests read this log entry: `tests/setup/playwright-fixtures.ts`.
     */
    onUnhandledFrame({ frame, defaults }) {
      if (frame.protocol !== 'http') return;
      const { request } = frame.data as { request: Request };
      if (isGuardedUrl(new URL(request.url))) {
        console.error(realServerLogLine(request.method, request.url));
        // MSW sends a thrown response to the client. `Response.error()` is a network error.
        throw Response.error();
      }
      if (!isMockedApiRequest(request.url)) return;
      defaults.error();
      throw new Error(
        `Sahte sunucuda karşılığı olmayan API isteği: ${request.method} ${request.url}`,
      );
    },
  });
  return { csrfToken: SAMPLE_CSRF_TOKEN };
}

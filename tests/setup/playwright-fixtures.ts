/**
 * Shared `test` value for all browser tests. Tests take `test` and `expect`
 * from this file instead of `@playwright/test`. The rule is checked by `src/app/e2e-fixture.node.test.ts`.
 *
 * The mock Keycloak root is the real production URL: `https://api.login.atonota.net`.
 * This fixture catches every request to the `atonota.net` domain. The request is aborted and never reaches the network.
 * The test's own `page.route` takes precedence. A caught request is an unexpected request.
 * If there is an unexpected request, the test fails at the end. Test: `tests/e2e/dis-istek-korumasi.spec.ts`.
 *
 * Service worker: Playwright does not see requests served by the page's service worker (MSW).
 * WebKit also hides requests the worker passes to the network. So the mock server aborts the `atonota.net`
 * request in the worker and writes a record to the browser console (`src/mocks/browser.ts`).
 * The fixture also counts this record as an unexpected request. Chromium and WebKit take the same path.
 */
import { test as base } from '@playwright/test';

import { isGuardedUrl, parseRealServerLogLine } from './dis-istek';

export * from '@playwright/test';

/** Caught real server requests. A test that sends a request on purpose reads the record with `take`. */
export interface RealServerRequests {
  /** Records an aborted request: `<method> <url>`. */
  add(entry: string): void;
  /** Returns the record without changing it. */
  peek(): string[];
  /** Returns the record and clears it. With an empty record the test does not fail. */
  take(): string[];
}

export const test = base.extend<{
  gercekSunucuIstekleri: RealServerRequests;
  gercekSunucuKorumasi: undefined;
}>({
  gercekSunucuIstekleri: [
    // A Playwright fixture function requires its first argument to be destructured.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const list: string[] = [];
      await use({
        add: (entry) => list.push(entry),
        peek: () => [...list],
        take: () => list.splice(0, list.length),
      });
    },
    { scope: 'test' },
  ],
  gercekSunucuKorumasi: [
    async ({ context, gercekSunucuIstekleri }, use) => {
      // A request the mock server aborted in its service worker. The record lands in the browser console.
      context.on('console', (message) => {
        const request = parseRealServerLogLine(message.text());
        if (request) gercekSunucuIstekleri.add(request);
      });
      await context.route(isGuardedUrl, async (route) => {
        const request = route.request();
        gercekSunucuIstekleri.add(`${request.method()} ${request.url()}`);
        await route.abort('blockedbyclient');
      });
      await use(undefined);
      const unexpected = gercekSunucuIstekleri.take();
      if (unexpected.length > 0) {
        throw new Error(
          `Test gerçek sunucuya istek attı. İstek kesildi. Testte page.route ile yönlendirme kurun:\n${unexpected.join('\n')}`,
        );
      }
    },
    { auto: true },
  ],
});

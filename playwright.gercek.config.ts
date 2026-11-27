import { defineConfig, devices } from '@playwright/test';

/**
 * Real stack gate (AJA-945). The four panel role tests run against the real panel on the local stack.
 * There is no mock server. Each test signs in to AtonotA Login with the role's review account.
 *
 * Requirements:
 * 1. The local stack is up: `backend/e2e/stack up` and `backend/e2e/stack review-accounts`.
 * 2. The panel is running via `npm run dev:yerel`. The Keycloak redirect returns to `http://localhost:5180`.
 * 3. The panel under test is on the same or another port. Example: `vite --mode yerel --port 5181`.
 *
 * Command:
 * `PANEL_GERCEK_URL=http://localhost:5181/ PANEL_HESAPLAR=<yol>/review-accounts.json \
 *   npx playwright test -c playwright.gercek.config.ts`
 *
 * This gate never connects to a live server. If the host is not `localhost`, the gate stops.
 */
const url = process.env['PANEL_GERCEK_URL'];
if (!url) throw new Error('PANEL_GERCEK_URL değişkeni gerekir. Örnek: http://localhost:5181/');
if (new URL(url).hostname !== 'localhost') {
  throw new Error('Gerçek yığın kapısı yalnız localhost adresinde koşar.');
}

const chromium = devices['Desktop Chrome'];

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: ['rol-*.spec.ts'],
  fullyParallel: true,
  // Each worker signs in once per account. Few workers keep the load on Keycloak low.
  workers: 2,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: url,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'gercek-chromium-320',
      use: { ...chromium, viewport: { width: 320, height: 568 }, hasTouch: true },
    },
    {
      name: 'gercek-chromium-desktop',
      use: { ...chromium, viewport: { width: 1440, height: 900 } },
    },
  ],
});

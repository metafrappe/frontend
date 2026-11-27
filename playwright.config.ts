import { defineConfig, devices } from '@playwright/test';

// Several worktrees can run tests on the same machine. The port is changed with E2E_PORT.
const PORT = Number(process.env['E2E_PORT'] ?? 4173);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Acceptance order: 320, 360, 375, 390 px, landscape phone, tablet, desktop.
 * Firefox is not run (project decision). Widths are CSS px.
 */
const chromium = devices['Desktop Chrome'];
const webkit = devices['Desktop Safari'];

export default defineConfig({
  // Single test gate: root tests and each feature's own e2e folder. No separate Playwright config needed.
  testDir: '.',
  testMatch: ['tests/e2e/**/*.spec.ts', 'src/**/e2e/**/*.spec.ts'],
  testIgnore: ['**/node_modules/**', '**/dist/**', '**/.pane/**', '**/.serena/**', '**/.git/**'],
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // Browser tests do not connect to the real backend. The build enables the mock server (MSW).
    // Harness pages are only included in the e2e build (vite --mode e2e). They stay out of the production build.
    // Preview also runs in e2e mode, so it serves at the root path; production mode uses `/panel/`.
    command: `npm run build:e2e && npx vite preview --mode e2e --port ${PORT} --strictPort --host 127.0.0.1`,
    // The mock server and Keycloak origin come from `vite/e2e-env.ts`. Vite provides them in e2e mode.
    // So the server started with `npm run dev:e2e` uses the same settings too (review 2, K-3).
    url: BASE_URL,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium-320',
      use: { ...chromium, viewport: { width: 320, height: 568 }, hasTouch: true },
    },
    {
      name: 'chromium-360',
      use: { ...chromium, viewport: { width: 360, height: 740 }, hasTouch: true },
    },
    {
      name: 'chromium-375',
      use: { ...chromium, viewport: { width: 375, height: 667 }, hasTouch: true },
    },
    {
      name: 'chromium-390',
      use: { ...chromium, viewport: { width: 390, height: 844 }, hasTouch: true },
    },
    {
      name: 'chromium-landscape-phone',
      use: { ...chromium, viewport: { width: 844, height: 390 }, hasTouch: true },
    },
    {
      name: 'chromium-tablet',
      use: { ...chromium, viewport: { width: 1024, height: 768 }, hasTouch: true },
    },
    { name: 'chromium-desktop', use: { ...chromium, viewport: { width: 1440, height: 900 } } },
    { name: 'webkit-320', use: { ...webkit, viewport: { width: 320, height: 568 } } },
    { name: 'webkit-desktop', use: { ...webkit, viewport: { width: 1440, height: 900 } } },
    { name: 'iphone-13', use: { ...devices['iPhone 13'] } },
  ],
});

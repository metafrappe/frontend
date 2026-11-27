/**
 * Shared browser check for the four panel roles (AJA-831; G-62, G-168, G-169, G-170).
 * The tests were written before the code. Each role's list is in its own test file:
 *
 * - `tests/e2e/rol-tenant-admin.spec.ts`
 * - `tests/e2e/rol-tenant-admin-assistant.spec.ts`
 * - `tests/e2e/rol-reseller-admin.spec.ts`
 * - `tests/e2e/rol-reseller-assistant.spec.ts`
 *
 * The mock server provides the role. Before the page opens, the test writes the scenario name to session storage.
 * The scenario changes the user roles in the bootstrap response (`get_bootstrap`).
 * Scenario names are added to `src/mocks/scenarios.ts`:
 *
 * - `rol-tenant-admin`: roles "Website User" and "Tenant Admin".
 * - `rol-tenant-admin-assistant`: roles "Website User" and "Tenant Admin Assistant".
 * - `rol-reseller-admin`: roles "Website User" and "Reseller Admin".
 * - `rol-reseller-assistant`: roles "Website User" and "Reseller Assistant".
 *
 * The filter only arranges the screen. The server checks permissions. The server tests
 * are in the `backend/apps/platform_core/platform_core/access/tests/test_role_*.py` files.
 *
 * Real stack mode (AJA-945). The same tests also run against the real panel on the local stack.
 * In this mode there is no mock server. The test signs in to AtonotA Login with the role's review account.
 * The mode is enabled by two environment variables:
 *
 * - `PANEL_GERCEK_URL`: root of the panel under test. Example: `http://localhost:5181/`.
 * - `PANEL_HESAPLAR`: path to `backend/e2e/review-accounts.json`. The password is there.
 *
 * Command: `npx playwright test -c playwright.gercek.config.ts`. Details are in that file.
 */
import { readFileSync } from 'node:fs';

import type { BrowserContext, Cookie, Page } from '@playwright/test';

import { expect, test } from './playwright-fixtures';

/** Mock server scenario key. Source: `MOCK_SCENARIO_KEY` in `src/mocks/scenarios.ts`. */
const SCENARIO_KEY = 'atonota.mock-senaryo';

/** Menu group names and page paths. The customers group is added for reseller roles (G-169). */
export const MENU_GROUPS = {
  Hesap: '/account',
  Yönetim: '/administration',
  'Yapay zekâ sağlayıcıları': '/administration/ai-providers',
  'İzin talepleri': '/hr',
  'Site ve plan': '/site-plan',
  'Yapay zekâ işlemleri': '/ai-operations',
  Müşteriler: '/customers',
} as const;

export type MenuGroup = keyof typeof MENU_GROUPS;

/** Notice for a page that cannot be opened. The page title is not shown. This notice is shown instead. */
export const DENIED_NOTE = /Bu sayfayı açma yetkiniz yok/;
/** Notice for a read-only page (the "you can only read this section" message). */
export const READ_ONLY_NOTE = /yalnız okuyabilirsiniz/i;

export interface ButtonCheck {
  /** The page the button is on. */
  page: MenuGroup;
  /** Action buttons the role sees. */
  shown: readonly string[];
  /** Action buttons the role does not see. */
  hidden: readonly string[];
}

export interface RoleContract {
  /** Name of the Frappe role. */
  role: string;
  /** Mock server scenario. */
  scenario: string;
  /** Review account on the real stack. List: `backend/e2e/review-accounts.json`. */
  account: string;
  /** Groups the role sees in the menu. Written in `MENU_GROUPS` order. */
  menu: readonly MenuGroup[];
  /** Pages the role can open. */
  pagesOpen: readonly MenuGroup[];
  /** Pages the role cannot open. These pages are not in the menu either. */
  pagesClosed: readonly MenuGroup[];
  /** Pages the role can only read. The read-only notice appears on the page. */
  readOnly: readonly MenuGroup[];
  /** Action buttons the role sees and does not see. */
  buttons: readonly ButtonCheck[];
}

/** Root of the panel under test in real stack mode. If unset, the tests run against the mock server. */
export const REAL_PANEL_URL = process.env['PANEL_GERCEK_URL'];

/** Turns an in-panel path into a URL. In real mode the panel root is prepended. Example: `/customers`. */
function address(path: string): string {
  if (!REAL_PANEL_URL) return path;
  const root = REAL_PANEL_URL.endsWith('/') ? REAL_PANEL_URL : `${REAL_PANEL_URL}/`;
  return new URL(path.replace(/^\//, ''), root).href;
}

/** Reads the password only from the file. The password is never written to test output. */
function reviewPassword(): string {
  const file = process.env['PANEL_HESAPLAR'];
  if (!file) throw new Error('Gerçek kip PANEL_HESAPLAR değişkenini ister.');
  const data = JSON.parse(readFileSync(file, 'utf8')) as { password?: unknown };
  if (typeof data.password !== 'string' || !data.password) {
    throw new Error('İnceleme hesapları dosyasında parola yok.');
  }
  return data.password;
}

/** The panel's sign-in button. The panel shows it when there is no session. */
const SIGN_IN = 'AtonotA Login ile oturum aç';

/** Session cookies within one worker. Each account signs in once per worker. */
const sessions = new Map<string, Cookie[]>();

/**
 * Signs the account in with AtonotA Login. Sign-in starts with the panel's own button.
 * The Keycloak redirect returns to the stack's panel URL. Example: `http://localhost:5180/`.
 * The session cookie is on the `localhost` domain. Cookies ignore the port. So the panel under test also sees the cookie.
 */
async function signIn(page: Page, context: BrowserContext, account: string) {
  const saved = sessions.get(account);
  if (saved) {
    await context.addCookies(saved);
    return;
  }
  await page.goto(address('/'));
  await page.getByRole('button', { name: SIGN_IN }).click();
  await page.locator('#username').fill(account);
  await page.locator('#password').fill(reviewPassword());
  await page.locator('#kc-login').click();
  await page.waitForURL((url) => url.hostname === 'localhost');
  // Once signed in, the shell renders with the page title. The sign-in button disappears.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: SIGN_IN })).toHaveCount(0);
  sessions.set(account, await context.cookies());
}

async function useRole(page: Page, context: BrowserContext, contract: RoleContract) {
  if (REAL_PANEL_URL) {
    await signIn(page, context, contract.account);
    return;
  }
  await page.addInitScript(([key, value]) => sessionStorage.setItem(key, value), [
    SCENARIO_KEY,
    contract.scenario,
  ] as const);
}

async function openMenu(page: Page) {
  // The button is not visible until the shell renders. Wait for the page title first.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const button = page.getByRole('button', { name: 'Menüyü aç' });
  if (await button.isVisible()) {
    await button.click();
    await expect(page.getByRole('dialog', { name: 'Menü' })).toBeVisible();
  }
}

/** Group links in the menu. Only `MENU_GROUPS` names are counted. */
async function menuGroups(page: Page): Promise<MenuGroup[]> {
  const menu = page.locator('#shell-drawer');
  await expect(menu.getByRole('link', { name: 'Ana sayfa', exact: true })).toBeVisible();
  const found: MenuGroup[] = [];
  for (const group of Object.keys(MENU_GROUPS) as MenuGroup[]) {
    if ((await menu.getByRole('link', { name: group, exact: true }).count()) > 0) found.push(group);
  }
  return found;
}

/** Notice shown while the permission check runs. When it disappears, the page gate has decided. */
const CHECKING_NOTE = /Sayfa yetkiniz denetleniyor/;

async function openPage(page: Page, group: MenuGroup) {
  await page.goto(address(MENU_GROUPS[group]));
  if (REAL_PANEL_URL) {
    // The real panel has no sample-data notice. When the gate decides, the title or the permission notice appears.
    await expect(page.getByRole('button', { name: SIGN_IN })).toHaveCount(0);
    await expect(
      page.getByRole('heading', { level: 1 }).or(page.getByText(DENIED_NOTE)).first(),
    ).toBeVisible();
    await expect(page.getByText(CHECKING_NOTE)).toHaveCount(0);
    return;
  }
  // The mock server's notice shows that the shell has opened.
  await expect(page.getByRole('status').filter({ hasText: 'Örnek veri' })).toBeVisible();
}

/** The reseller detection request must not go to the old endpoint (AJA-945). Example: `get_doctype?doctype=Reseller...`. */
function isResellerMetaRequest(url: string): boolean {
  const parsed = new URL(url);
  return (
    parsed.pathname.endsWith('/platform_core.api.meta.get_doctype') &&
    parsed.searchParams.get('doctype') === 'Reseller Customer Link'
  );
}

/** Registers all browser tests for one role. Each test file calls this once. */
export function describeRole(contract: RoleContract) {
  test.describe(`"${contract.role}" rolü`, () => {
    test.beforeEach(async ({ page, context }) => {
      await useRole(page, context, contract);
    });

    test('menüde yalnız rolün grupları görünür', async ({ page }) => {
      // In mock mode, requests served by the service worker are not visible. The check is meaningful in real mode.
      const metaRequests: string[] = [];
      page.on('request', (request) => {
        if (isResellerMetaRequest(request.url())) metaRequests.push(request.url());
      });
      await page.goto(address('/'));
      await openMenu(page);
      // The menu takes its final form after the server's permission response. So the list is polled.
      await expect.poll(() => menuGroups(page)).toEqual([...contract.menu]);
      expect(metaRequests).toEqual([]);
    });

    for (const group of contract.pagesOpen) {
      test(`"${group}" sayfasını açar`, async ({ page }) => {
        await openPage(page, group);
        await expect(
          page.getByRole('heading', { level: 1, name: group, exact: true }),
        ).toBeVisible();
        await expect(page.getByText(DENIED_NOTE)).toHaveCount(0);
        const note = page.getByText(READ_ONLY_NOTE);
        if (contract.readOnly.includes(group)) await expect(note).toBeVisible();
        else await expect(note).toHaveCount(0);
      });
    }

    for (const group of contract.pagesClosed) {
      test(`"${group}" sayfasını açamaz`, async ({ page }) => {
        await openPage(page, group);
        await expect(page.getByText(DENIED_NOTE)).toBeVisible();
        await expect(page.getByRole('heading', { level: 1, name: group, exact: true })).toHaveCount(
          0,
        );
      });
    }

    for (const check of contract.buttons) {
      test(`"${check.page}" sayfasında rolün eylem düğmeleri`, async ({ page }) => {
        await openPage(page, check.page);
        await expect(
          page.getByRole('heading', { level: 1, name: check.page, exact: true }),
        ).toBeVisible();
        for (const name of check.shown) {
          await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
        }
        for (const name of check.hidden) {
          await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
        }
      });
    }
  });
}

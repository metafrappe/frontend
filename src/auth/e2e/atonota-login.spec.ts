// AtonotA Login: sign-in platforms, linked accounts and product page (G-159, G-160, G-165).
// The tests run in every project, from a 320 px phone up to desktop. Firefox is not run.
import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../../../tests/setup/playwright-fixtures';
import { SAMPLE_KEYCLOAK_URL } from '../../mocks/fixtures';
import { MOCK_START_LINK_KEY, MOCK_START_LOGIN_KEY } from '../../mocks/handlers';
import { MOCK_SCENARIO_KEY } from '../../mocks/scenarios';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

async function useScenario(page: Page, name: string) {
  await page.addInitScript(([key, value]) => sessionStorage.setItem(key, value), [
    MOCK_SCENARIO_KEY,
    name,
  ] as const);
}

/** Does the page overflow horizontally? Returns the overflow in pixels. 0 or a negative value means no overflow. */
async function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

/**
 * Key that moves to the next element. In Safari, Tab only reaches form fields.
 * Links and buttons are reached with Option+Tab, so WebKit presses `Alt+Tab`.
 */
function tabKey(page: Page): string {
  return page.context().browser()?.browserType().name() === 'webkit' ? 'Alt+Tab' : 'Tab';
}

/**
 * Reaches the target with the Tab key, without the mouse. Tries at most 40 steps.
 * The first press is Tab in every browser: only Tab turns on visible focus mode (focus rule).
 */
async function tabTo(page: Page, target: Locator) {
  for (let step = 0; step < 40; step += 1) {
    await page.keyboard.press(step === 0 ? 'Tab' : tabKey(page));
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error('Hedefe klavyeyle ulaşılamadı.');
}

/** Reads the request URL the mock server wrote to session storage. The page must be on its own origin. */
async function readMockUrl(page: Page, key: string): Promise<URL> {
  const value = await page.evaluate((name) => sessionStorage.getItem(name), key);
  expect(value).not.toBeNull();
  return new URL(value ?? '');
}

/** Smallest computed font size. Checks visible text elements. */
async function smallestFont(root: Locator): Promise<number> {
  return root.evaluate((node) =>
    Math.min(
      ...Array.from(node.querySelectorAll('h1, h2, h3, p, a, button, li, span, strong'))
        .filter((el) => el.getBoundingClientRect().width > 0 && el.textContent?.trim())
        .map((el) => Number.parseFloat(getComputedStyle(el).fontSize)),
    ),
  );
}

test.describe('giriş ekranı platformları (G-159)', () => {
  test('açık platformlar veriden gelir, kapalı platform görünmez', async ({ page }) => {
    await useScenario(page, 'oturum-kapali');
    await page.goto('/');
    const main = page.getByRole('main', { name: 'Oturum açın' });
    await expect(main.getByRole('button', { name: 'AtonotA Login ile oturum aç' })).toBeVisible();
    const list = main.getByRole('list', { name: 'Başka bir hesapla oturum açın' });
    await expect(list.getByRole('button')).toHaveText([
      'Google ile oturum aç',
      'Facebook ile oturum aç',
      'LinkedIn ile oturum aç',
      'X ile oturum aç',
    ]);
    await expect(main.getByText('GitHub')).toHaveCount(0);

    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    expect(await smallestFont(main)).toBeGreaterThanOrEqual(14);
    const results = await new AxeBuilder({ page }).include('main').withTags(AXE_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('klavyeyle platform düğmesine basınca backend giriş yoluna gidilir', async ({ page }) => {
    // The mock server answers `start_login` with 302. The target is the mock Keycloak root.
    await page.route(`${SAMPLE_KEYCLOAK_URL}/**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<title>AtonotA Login</title>',
      }),
    );
    await useScenario(page, 'oturum-kapali');
    await page.goto('/');
    const google = page.getByRole('button', { name: 'Google ile oturum aç' });
    await expect(google).toBeVisible();

    await tabTo(page, google);
    await page.keyboard.press('Enter');

    await page.waitForURL((url) => url.origin === SAMPLE_KEYCLOAK_URL);
    // The mock server recorded the request URL. We return to the panel and read the record.
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Oturum açın' })).toBeVisible();
    const url = await readMockUrl(page, MOCK_START_LOGIN_KEY);
    expect(url.pathname).toBe('/api/method/platform_core.api.auth.start_login');
    expect(url.searchParams.get('provider')).toBe('google');
    expect(url.searchParams.get('redirect_to')).toBe('/');
  });

  test('platform yoksa yalnız AtonotA Login düğmesi görünür', async ({ page }) => {
    await useScenario(page, 'platform-yok');
    await page.goto('/');
    const main = page.getByRole('main', { name: 'Oturum açın' });
    await expect(main.getByRole('button', { name: 'AtonotA Login ile oturum aç' })).toBeVisible();
    await expect(main.getByRole('button')).toHaveCount(1);
    await expect(main.getByRole('list')).toHaveCount(0);
  });
});

test.describe('bağlı hesaplar (G-160)', () => {
  test('kullanıcı bağı klavyeyle kaldırır, son giriş yolu kaldırılamaz', async ({ page }) => {
    await page.goto('/account');
    const region = page.getByRole('region', { name: 'Bağlı hesaplar' });
    const linkedin = region.getByRole('button', { name: 'LinkedIn bağını kaldır' });
    await expect(linkedin).toBeVisible();
    await expect(region.getByRole('link', { name: 'Facebook hesabını bağla' })).toHaveAttribute(
      'href',
      /platform_core\.api\.auth\.start_link\?provider=facebook&redirect_to=%2Faccount$/,
    );

    await tabTo(page, linkedin);
    await page.keyboard.press('Enter');
    const confirm = region.getByRole('group', { name: 'LinkedIn bağını kaldırma onayı' });
    await expect(confirm.getByRole('button', { name: 'Vazgeç' })).toBeFocused();
    await page.keyboard.press(tabKey(page));
    await expect(confirm.getByRole('button', { name: 'Bağı kaldır' })).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(region.getByRole('status')).toHaveText('LinkedIn bağı kaldırıldı.');
    // There is no remove button any more. Focus moves to the link action in the same row.
    await expect(region.getByRole('link', { name: 'LinkedIn hesabını bağla' })).toBeFocused();
    // Google is now the only sign-in method. There is no remove button, and the reason is shown.
    await expect(region.getByRole('button', { name: 'Google bağını kaldır' })).toHaveCount(0);
    await expect(
      region.getByText('Bu sizin son giriş yolunuz. Bu bağı kaldıramazsınız.'),
    ).toBeVisible();

    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page })
      .include('.module-page')
      .withTags(AXE_TAGS)
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('bağlama bağlantısı sayfa geçişiyle backend bağlama yoluna gider', async ({ page }) => {
    await page.goto('/account');
    const link = page.getByRole('link', { name: 'Facebook hesabını bağla' });
    await tabTo(page, link);
    await page.keyboard.press('Enter');
    // The mock server records the URL and sends the browser back to the accounts page.
    // The page cannot be read during navigation. A read error counts as `null` and is retried.
    await expect
      .poll(() =>
        page.evaluate((key) => sessionStorage.getItem(key), MOCK_START_LINK_KEY).catch(() => null),
      )
      .not.toBeNull();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole('region', { name: 'Bağlı hesaplar' })).toBeVisible();
    const url = await readMockUrl(page, MOCK_START_LINK_KEY);
    expect(url.pathname).toBe('/api/method/platform_core.api.auth.start_link');
    expect(url.searchParams.get('provider')).toBe('facebook');
    expect(url.searchParams.get('redirect_to')).toBe('/account');
  });
});

test.describe('tanıtım sayfası (G-165)', () => {
  test('oturum istemez, taşmaz ve dış adrese istek göndermez', async ({ page, baseURL }) => {
    const foreign: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (!url.startsWith(baseURL ?? '') && !url.startsWith('data:')) foreign.push(url);
    });
    // The page opens when signed out too.
    await useScenario(page, 'oturum-kapali');
    await page.goto('/atonota-login');
    const main = page.getByRole('main', { name: 'AtonotA Login' });
    await expect(main.getByRole('heading', { level: 1 })).toHaveText('AtonotA Login');
    await expect(main.getByRole('region', { name: 'Bugün neler var?' })).toBeVisible();
    await expect(main.getByRole('region', { name: 'Yakında' })).toBeVisible();
    await expect(main.getByText('Fiyat henüz açıklanmadı.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Oturum açın' })).toHaveCount(0);

    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    // On the public page, text is at least 16 px (G-165 and the general body rule).
    expect(await smallestFont(main)).toBeGreaterThanOrEqual(16);
    const results = await new AxeBuilder({ page }).include('main').withTags(AXE_TAGS).analyze();
    expect(results.violations).toEqual([]);
    expect(foreign).toEqual([]);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme === 'dark' ? 'koyu' : 'açık'} temada tanıtım sayfası erişilebilirdir`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/atonota-login');
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('AtonotA Login');
      const results = await new AxeBuilder({ page }).include('main').withTags(AXE_TAGS).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test('kullanıcı kök yazı boyutunu büyütünce metin 1rem altına düşmez (inceleme 2, bulgu 3)', async ({
    page,
  }) => {
    await page.goto('/atonota-login');
    // Emulates a 20 px font size in browser settings: 1rem = 20 px.
    await page.addStyleTag({ content: 'html { font-size: 125% !important; }' });
    const main = page.getByRole('main', { name: 'AtonotA Login' });
    await expect(main.getByRole('heading', { level: 1 })).toBeVisible();
    const rem = await page.evaluate(() =>
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
    );
    expect(rem).toBe(20);
    expect(await smallestFont(main)).toBeGreaterThanOrEqual(rem);
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('giriş ekranından tanıtım sayfasına klavyeyle gidilir', async ({ page }) => {
    await useScenario(page, 'oturum-kapali');
    await page.goto('/');
    const link = page.getByRole('link', { name: 'AtonotA Login nedir?' });
    await tabTo(page, link);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/atonota-login$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('AtonotA Login');
  });
});

import type { Page } from '@playwright/test';
import { expect, test } from '../../../tests/setup/playwright-fixtures';

import {
  isBottomBarOnly,
  isRingShadow,
  splitShadows,
  tokenColor,
} from '../../../tests/setup/odak-gostergesi';
import { SAMPLE_KEYCLOAK_URL, sampleLoginUrl } from '../../mocks/fixtures';
import { MOCK_START_LOGIN_KEY } from '../../mocks/handlers';
import { MOCK_SCENARIO_KEY } from '../../mocks/scenarios';

const BUTTON = 'AtonotA Login ile oturum aç';
const START_LOGIN = '/api/method/platform_core.api.auth.start_login';

/**
 * The mock server starts signed out. The sign-in screen is shown.
 * The mock server answers `start_login` with a 302 pointing to the Keycloak sign-in URL.
 * The Keycloak URL is the `api.login.atonota.net` root. When the browser goes there, a blank page is returned.
 */
async function openLogin(page: Page): Promise<void> {
  await page.route(`${SAMPLE_KEYCLOAK_URL}/**`, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>AtonotA Login</title>' }),
  );
  await page.addInitScript(([key, value]) => sessionStorage.setItem(key, value), [
    MOCK_SCENARIO_KEY,
    'oturum-kapali',
  ] as const);
  await page.goto('/panel');
  await expect(page.getByRole('heading', { name: 'Oturum açın' })).toBeVisible();
}

/**
 * The mock server runs inside the page, so Playwright does not see the `start_login` request.
 * The mock server writes the request URL to session storage. The test goes back to the panel and reads the record.
 */
async function readStartLogin(page: Page): Promise<URL> {
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Oturum açın' })).toBeVisible();
  const url = await page.evaluate((key) => sessionStorage.getItem(key), MOCK_START_LOGIN_KEY);
  expect(url).not.toBeNull();
  return new URL(url ?? '');
}

test.describe('AtonotA Login düğmesi', () => {
  test('düğme görünür ve marka adını tam yazar', async ({ page }) => {
    await openLogin(page);
    const button = page.getByRole('button', { name: BUTTON });
    await expect(button).toBeVisible();
    await expect(button).toHaveText(BUTTON);
    // The page does not overflow horizontally at 320 px wide either.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test('düğmeye basınca start_login yoluna, sonra api.login.atonota.net köküne gidilir', async ({
    page,
  }) => {
    await openLogin(page);
    await page.getByRole('button', { name: BUTTON }).click();
    await expect(page).toHaveURL(sampleLoginUrl.login_url);
    expect(new URL(page.url()).origin).toBe('https://api.login.atonota.net');
    const startLogin = await readStartLogin(page);
    expect(startLogin.pathname).toBe(START_LOGIN);
    expect(startLogin.searchParams.get('redirect_to')).toBe('/panel');
  });

  test('düğme klavyeyle de basılır', async ({ page, browserName }) => {
    await openLogin(page);
    const button = page.getByRole('button', { name: BUTTON });
    // The Tab key turns on visible focus mode. Alt+Tab does not (focus rule).
    await page.keyboard.press('Tab');
    await expect(page.locator('html')).toHaveAttribute('data-focus-mode', 'keyboard');
    // Tab moves focus to the button. Enter presses it.
    // macOS WebKit does not Tab to buttons. Alt+Tab is used there (same as controls.spec.ts).
    const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
    for (let i = 0; i < 10; i += 1) {
      if (await button.evaluate((node) => node === document.activeElement)) break;
      await page.keyboard.press(tab);
    }
    await expect(button).toBeFocused();
    // There is no surrounding focus ring. Both outline and box-shadow are checked.
    const outline = await button.evaluate((node) => {
      const style = getComputedStyle(node);
      return style.outlineStyle === 'none' || style.outlineWidth === '0px';
    });
    expect(outline, 'outline').toBe(true);
    // The indicator is a single accent-colour line on the bottom edge. The colour is read from the token (`--focus-indicator-color`).
    // The indicator appears with a transition, so the test waits.
    const FOCUS_RGB = await tokenColor(page, '--focus-indicator-color');
    const shadows = async () =>
      splitShadows(await button.evaluate((node) => getComputedStyle(node).boxShadow));
    await expect
      .poll(async () => (await shadows()).filter((p) => isBottomBarOnly(p, FOCUS_RGB)))
      .toHaveLength(1);
    const parts = await shadows();
    expect(
      parts.filter((p) => p.includes(FOCUS_RGB)),
      parts.join(' | '),
    ).toHaveLength(1);
    expect(parts.filter(isRingShadow), parts.join(' | ')).toEqual([]);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(sampleLoginUrl.login_url);
    expect((await readStartLogin(page)).pathname).toBe(START_LOGIN);
  });
});

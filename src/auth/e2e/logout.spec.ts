import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from '../../../tests/setup/playwright-fixtures';

import { SAMPLE_KEYCLOAK_URL, SAMPLE_USER, sampleLogoutUrl } from '../../mocks/fixtures';
import { MOCK_SCENARIO_KEY } from '../../mocks/scenarios';

const isCompact = (page: Page) => {
  const v = page.viewportSize();
  return !!v && (v.width <= 767 || v.height <= 499);
};

const SIGN_OUT_ERROR = 'Oturum kapatılamadı. Oturumunuz açık. Biraz sonra yeniden deneyin.';

/** The mock server starts with this scenario. The name is written to session storage before the page opens. */
async function useScenario(page: Page, name: string) {
  await page.addInitScript(([key, value]) => sessionStorage.setItem(key, value), [
    MOCK_SCENARIO_KEY,
    name,
  ] as const);
}

/** Makes the side menu visible. On phones the menu is inside the drawer. */
async function openSidebar(page: Page) {
  await page.goto('/');
  await expect(page.locator('.shell')).toBeVisible();
  if (isCompact(page)) {
    await page.getByRole('button', { name: 'Menüyü aç' }).click();
    await expect(page.getByRole('dialog', { name: 'Menü' })).toBeVisible();
  }
}

test.describe('oturumu kapatma (B1)', () => {
  test('kullanıcı kartı oturumdaki kişiyi gösterir, örnek kişiyi göstermez', async ({ page }) => {
    await openSidebar(page);
    const card = page.locator('.shell-user').last();
    await expect(card).toContainText(SAMPLE_USER);
    await expect(card).not.toContainText('Yönetici');
  });

  test('"Oturumu kapat" düğmesi sahte sunucunun Keycloak çıkış adresine gider', async ({
    page,
  }) => {
    // Keycloak is a mock origin. When the browser goes there, a blank page is returned.
    await page.route(`${SAMPLE_KEYCLOAK_URL}/**`, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Çıkış</title>' }),
    );
    await openSidebar(page);
    const button = page.getByRole('button', { name: 'Oturumu kapat' }).last();
    await expect(button).toBeVisible();
    await button.click();
    await expect(page).toHaveURL(sampleLogoutUrl.logout_url);
  });

  test('tarayıcı testi sahte sunucunun Keycloak kökünü kullanır', async () => {
    expect(new URL(sampleLogoutUrl.logout_url).origin).toBe(SAMPLE_KEYCLOAK_URL);
  });

  test('çıkış isteği başarısız olursa hata metni görünür ve oturum açık kalır (K-2)', async ({
    page,
  }) => {
    await useScenario(page, 'cikis-hatasi');
    await openSidebar(page);
    await page.getByRole('button', { name: 'Oturumu kapat' }).last().click();

    const alert = page.getByRole('alert').filter({ hasText: SIGN_OUT_ERROR });
    await expect(alert).toBeVisible();
    await expect(page.locator('.shell-user').last()).toContainText(SAMPLE_USER);
    await expect(page).not.toHaveURL(/api\.login\.atonota\.net/);
  });

  test('dar kipte çıkış hatası gözle görünen bir uyarıda çıkar (Ö-2)', async ({ page }) => {
    test.skip(isCompact(page), 'Dar kip yalnız geniş ekranda vardır. Telefonda menü çekmecededir.');
    await useScenario(page, 'cikis-hatasi');
    await openSidebar(page);
    await page.getByRole('button', { name: 'Dar görünüme geç' }).click();
    await page.getByRole('button', { name: 'Oturumu kapat' }).click();

    await expect(page.locator('.ant-message').getByText(SIGN_OUT_ERROR)).toBeVisible();
    // The alert icon is hidden from screen readers. The English icon name is not read out (review 2, K-2).
    // The alert closes after 3 seconds, so the check is done once, without waiting.
    const exposed = await page
      .locator('.ant-message-notice-content')
      .first()
      .evaluate((node) =>
        Array.from(node.querySelectorAll('[aria-label], [role="img"]'))
          .filter((el) => !el.closest('[aria-hidden="true"]'))
          .map((el) => el.getAttribute('aria-label') ?? el.getAttribute('role')),
      );
    expect(exposed).toEqual([]);
    // The screen reader still hears the text once.
    await expect(page.getByRole('alert').filter({ hasText: SIGN_OUT_ERROR })).toHaveCount(1);
  });

  test('başka kökenli çıkış adresine gidilmez, giriş ekranı not gösterir (Ö-3, K-3)', async ({
    page,
  }) => {
    const foreign: string[] = [];
    await page.route('https://baska.example.test/**', (route) => {
      foreign.push(route.request().url());
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<title>Yabancı</title>',
      });
    });
    await useScenario(page, 'cikis-yabanci-adres');
    await openSidebar(page);
    await page.getByRole('button', { name: 'Oturumu kapat' }).last().click();

    await expect(page.getByRole('heading', { name: 'Oturum açın' })).toBeVisible();
    await expect(page.getByRole('main', { name: 'Oturum açın' }).getByRole('status')).toHaveText(
      'Panelden çıktınız. Kimlik oturumunuz açık kalmış olabilir.',
    );
    expect(foreign).toEqual([]);
    expect(new URL(page.url()).hostname).not.toBe('baska.example.test');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme === 'dark' ? 'koyu' : 'açık'} temada giriş ekranı notu en az 4.5:1 verir (inceleme 2, Ö-1)`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await useScenario(page, 'cikis-yabanci-adres');
      await openSidebar(page);
      await page.getByRole('button', { name: 'Oturumu kapat' }).last().click();

      const main = page.getByRole('main', { name: 'Oturum açın' });
      await expect(main.getByRole('status')).toHaveText(
        'Panelden çıktınız. Kimlik oturumunuz açık kalmış olabilir.',
      );
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);

      const results = await new AxeBuilder({ page })
        .include('main')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

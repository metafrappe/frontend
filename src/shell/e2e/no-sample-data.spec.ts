import type { Page } from '@playwright/test';
import { expect, test } from '../../../tests/setup/playwright-fixtures';

/**
 * MVP check: the live panel has no sample data.
 * The live panel is connected to the mock server. The mock server's menu is empty and it has no credit endpoint.
 */
const isCompact = (page: Page) => {
  const v = page.viewportSize();
  return !!v && (v.width <= 767 || v.height <= 499);
};

/** Opens the sidebar. On phones the menu is in a drawer. */
async function openSidebar(page: Page) {
  await page.goto('/');
  await expect(page.locator('.shell')).toBeVisible();
  if (isCompact(page)) {
    await page.getByRole('button', { name: 'Menüyü aç' }).click();
    await expect(page.getByRole('dialog', { name: 'Menü' })).toBeVisible();
  }
  return page.locator('.shell-sb');
}

test.describe('canlı panelde örnek veri yok', () => {
  test('çalışma alanı oturumun sitesidir, örnek şirket görünmez', async ({ page }) => {
    const sidebar = await openSidebar(page);
    await expect(sidebar.locator('.shell-ws')).toBeVisible();
    await expect(page.getByText(/Örnek Şirket/)).toHaveCount(0);
    // A single workspace is not a dropdown.
    await expect(sidebar.locator('button.shell-ws')).toHaveCount(0);
    await expect(sidebar.locator('[aria-haspopup="menu"]')).toHaveCount(0);
  });

  test('kredi ucu yoksa sayaç ve uydurma sayı görünmez', async ({ page }) => {
    await openSidebar(page);
    await expect(page.getByText('AI kredisi')).toHaveCount(0);
    await expect(page.getByRole('img', { name: /Kredinin/ })).toHaveCount(0);
  });

  test('sunucu menüsü boşsa hızlı eylem ve örnek öneri görünmez', async ({ page }) => {
    await openSidebar(page);
    await expect(page.getByRole('group', { name: 'Hızlı eylemler' })).toHaveCount(0);
    await expect(page.getByText('Günün özeti')).toHaveCount(0);
  });

  test('ana sayfa örnek ajan göstermez, bekleyen işleri sunucudan alır', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Bekleyenler' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: /Onayınızı bekleyen/ })).toBeVisible();
    await expect(page.getByText('Bu sayfadaki veriler örnektir.')).toHaveCount(0);
    await expect(page.getByText('Kayıt yok')).toHaveCount(0);
  });

  test('klavyeyle gezinince çalışma alanı Tab sırasına girmez', async ({ page }) => {
    test.skip(isCompact(page), 'telefonda menü çekmecededir; çekmece testi ayrıdır');
    await page.goto('/');
    await expect(page.locator('.shell')).toBeVisible();
    // A single workspace is not an action. The first Tab stop is a navigation link or button.
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press('Tab');
      const inWorkspace = await page.evaluate(
        () => document.activeElement?.closest('.shell-ws') !== null,
      );
      expect(inWorkspace).toBe(false);
    }
  });

  test('telefonda çekmece klavyeyle açılır, örnek veri görünmez', async ({ page }) => {
    test.skip(!isCompact(page), 'yalnız telefon kabuğu');
    await page.goto('/');
    const menu = page.getByRole('button', { name: 'Menüyü aç' });
    await menu.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Menü' })).toBeVisible();
    await expect(page.getByText(/Örnek Şirket/)).toHaveCount(0);
    await expect(page.getByText('AI kredisi')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(menu).toBeFocused();
  });
});

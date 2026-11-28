/**
 * G-139 tur motoru, deneme sayfası `/_demo/tour`. Sayfa yalnız e2e derlemesinde vardır.
 * Deneme sayfası ilerlemeyi tarayıcı deposunda tutar. Sayfayı yenilemek "sonraki ziyaret" olur.
 * Denenenler: ilk ziyaret, devam, yeniden başlatma, girdi koruması, kipsiz panel, klavye,
 * duyuru, 320 px taşma, kısa yatay ekran ve axe.
 *
 * Her test boş bir tarayıcı bağlamıyla başlar. Depo zaten boştur. Bu yüzden testten önce
 * sayfa açıp depo silinmez. Öyle yapınca ikinci açılış ilk açılışı yarıda keser.
 * WebKit'te sahte sunucunun kaydı yarıda kalır ve sayfa boş açılabilir (CI, iPhone 13).
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { expect, test } from '../../../tests/setup/playwright-fixtures';

const DEMO = '/_demo/tour';

const panel = (page: Page) => page.getByRole('dialog', { name: 'Tur: Tur denemesi' });

async function open(page: Page) {
  await page.goto(DEMO);
  await expect(page.getByRole('heading', { level: 1, name: 'Tur denemesi' })).toBeVisible();
}

async function overflowX(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe('tur motoru', () => {
  test('ilk ziyarette kipsiz tur açılır ve adımı duyurur', async ({ page }) => {
    await open(page);
    const dialog = panel(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'false');
    await expect(page.getByRole('status').filter({ hasText: 'Adım 1 /' })).toBeAttached();
    // Sayfa kilitlenmez: alan tur açıkken yazılabilir.
    const input = page.getByRole('textbox', { name: 'Gerekçe' });
    await input.fill('Aile ziyareti');
    await expect(input).toHaveValue('Aile ziyareti');
  });

  test('ertelenen tur yenilenen sayfada kaldığı yerden sürer', async ({ page }) => {
    await open(page);
    const dialog = panel(page);
    await dialog.getByRole('button', { name: 'İleri' }).click();
    await expect(dialog.getByRole('heading', { name: 'Gerekçe' })).toBeVisible();
    await dialog.getByRole('button', { name: 'İleri' }).focus();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await page.reload();
    await expect(panel(page).getByRole('heading', { name: 'Gerekçe' })).toBeVisible();
  });

  test('atlanan tur açılmaz, yeniden başlatma baştan açar', async ({ page }) => {
    await open(page);
    await panel(page).getByRole('button', { name: 'Turu atla' }).click();
    await expect(panel(page)).toBeHidden();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Tur denemesi' })).toBeVisible();
    await expect(panel(page)).toBeHidden();
    await page.getByRole('button', { name: 'Turu yeniden başlat' }).click();
    await expect(panel(page).getByRole('heading', { name: 'Hoş geldiniz' })).toBeVisible();
  });

  test('tur yazılan veriyi silmez', async ({ page }) => {
    await open(page);
    const input = page.getByRole('textbox', { name: 'Gerekçe' });
    await input.fill('Aile ziyareti');
    const dialog = panel(page);
    await dialog.getByRole('button', { name: 'İleri' }).click();
    await dialog.getByRole('button', { name: 'İleri' }).click();
    await dialog.getByRole('button', { name: 'Bitir' }).click();
    await expect(dialog).toBeHidden();
    await expect(input).toHaveValue('Aile ziyareti');
  });

  test('ok tuşlarıyla ileri ve geri gidilir', async ({ page }) => {
    await open(page);
    const dialog = panel(page);
    await dialog.getByRole('button', { name: 'İleri' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByRole('heading', { name: 'Gerekçe' })).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(dialog.getByRole('heading', { name: 'Hoş geldiniz' })).toBeVisible();
  });

  test('panel taşmaz, düğmeleri görünür ve axe bulgusu yoktur', async ({ page }) => {
    await open(page);
    await expect(panel(page)).toBeVisible();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    for (const name of ['İleri', 'Ertele', 'Turu atla']) {
      await expect(panel(page).getByRole('button', { name })).toBeInViewport();
    }
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('kısa yatay telefonda panel düğmeleri ekranda kalır', async ({ page }) => {
    // Yatay telefonda kabuğun çubuğu sol kenara geçer. Çubuğun boyu alt pay sayılmaz.
    await page.setViewportSize({ width: 844, height: 390 });
    await open(page);
    const dialog = panel(page);
    await expect(dialog).toBeVisible();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    for (const name of ['Geri', 'İleri', 'Ertele', 'Turu atla']) {
      await expect(dialog.getByRole('button', { name })).toBeInViewport({ ratio: 1 });
    }
    const box = await dialog.boundingBox();
    if (!box) throw new Error('Tur paneli ölçülemedi.');
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(390);
    // Panel sol çubuğun üstüne binmez.
    const rail = await page.locator('.shell-bar').boundingBox();
    if (rail) expect(box.x).toBeGreaterThanOrEqual(rail.x + rail.width);
    await dialog.getByRole('button', { name: 'İleri' }).click();
    await expect(dialog.getByRole('heading', { name: 'Gerekçe' })).toBeVisible();
  });
});

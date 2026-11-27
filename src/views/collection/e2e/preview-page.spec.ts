import { expect, test } from '../../../../tests/setup/playwright-fixtures';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Deneme sayfasının kendisi de axe denetiminden geçer (AJA-1567).
 * Denetim yalnız liste bölümünü değil, bütün sayfayı kapsar.
 */
const preview = '/src/views/collection/preview/';
const screenshotDir = process.env['AJA_SCREENSHOT_DIR'];

async function openPreview(page: Page, theme: 'light' | 'dark') {
  await page.goto(`${preview}?theme=${theme}`);
  await expect(page.getByText('ORNEK-0001', { exact: true }).first()).toBeVisible();
}

for (const theme of ['light', 'dark'] as const) {
  test(`whole preview page passes axe right after load in ${theme} theme`, async ({ page }) => {
    await openPreview(page, theme);
    // Denetim beklemeden koşar. Renk geçişi süren düğme de düşük karşıtlık sayılır.
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.map((violation) => violation.id)).toEqual([]);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    // Başlık metni dil kataloğundan gelir. Ekran okuyucu yine bu adı okur (AJA-1621).
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Koleksiyon örneği');
  });
}

test('page buttons draw their final color on first paint', async ({ page }) => {
  await openPreview(page, 'dark');
  // Sayfa açılırken düğmede renk geçişi koşmaz. Düğme ilk çizimde son rengindedir.
  const running = await page
    .getByRole('navigation', { name: 'Kayıt sayfaları' })
    .getByRole('button')
    .evaluateAll((buttons) => buttons.flatMap((button) => button.getAnimations()).length);
  expect(running).toBe(0);
});

test('dark theme has no light band above the list', async ({ page }, testInfo) => {
  await openPreview(page, 'dark');
  // Sayfanın en üstündeki noktanın arka planı koyu olmalı. Saydam katmanlar atlanır.
  // Hiçbir öğe boyamazsa tarayıcı tuvali beyaz çizer.
  const luminance = await page.evaluate(() => {
    let element: Element | null = document.elementFromPoint(innerWidth / 2, 2);
    while (element) {
      const color = getComputedStyle(element).backgroundColor;
      const parts = color.match(/[\d.]+/g)?.map(Number) ?? [];
      if (parts.length >= 3 && (parts[3] ?? 1) > 0) {
        const [r = 0, g = 0, b = 0] = parts.map((value) => value / 255);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }
      element = element.parentElement;
    }
    const canvas = getComputedStyle(document.documentElement).colorScheme;
    return canvas.includes('dark') ? 0 : 1;
  });
  expect(luminance).toBeLessThan(0.2);
  if (screenshotDir && ['chromium-320', 'chromium-desktop'].includes(testInfo.project.name)) {
    await page.setViewportSize({
      width: testInfo.project.name === 'chromium-320' ? 320 : 1366,
      height: 900,
    });
    const width = testInfo.project.name === 'chromium-320' ? 320 : 1366;
    await page.screenshot({ path: `${screenshotDir}/AJA-1567-liste-${width}.png` });
  }
});

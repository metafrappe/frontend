import AxeBuilder from '@axe-core/playwright';

import { expect, test, type Page } from '../../../tests/setup/playwright-fixtures';

/**
 * Browser tests for the six AI surfaces (AJA-1156).
 * The demo page opens at `/_demo/genui` only in the e2e build.
 * The route line is in `src/shell/routes.ts`.
 */
const DEMO = '/_demo/genui';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const SURFACES = ['scope', 'events', 'source', 'review', 'queue', 'result'];

async function open(page: Page) {
  await page.goto(DEMO);
  await expect(page.getByRole('heading', { name: 'Yapay zekâ yüzeyleri' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await open(page);
});

test('altı yüzeyin her biri kayıttan çizilir', async ({ page }) => {
  for (const type of SURFACES) {
    await expect(page.locator(`[data-demo="genui"] [data-genui="${type}"]`)).toBeVisible();
  }
});

test('kayıtta olmayan blok çizilmez', async ({ page }) => {
  const demo = page.locator('[data-demo="genui"]');
  await expect(demo.locator('[data-genui]')).toHaveCount(SURFACES.length);
  await expect(demo).not.toContainText('kayitsiz_blok');
  await expect(demo.locator('[data-genui="json"]')).toHaveCount(0);
});

test('yüzeyler yatay taşmaz', async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const boxes = await page.locator('[data-genui]').evaluateAll((els) =>
    els.map((el) => ({
      type: el.getAttribute('data-genui'),
      scroll: el.scrollWidth,
      client: el.clientWidth,
    })),
  );
  expect(boxes.length).toBeGreaterThan(SURFACES.length);
  for (const box of boxes) expect(box.scroll, box.type ?? '').toBeLessThanOrEqual(box.client);
});

test('en küçük metin 14 CSS px olur', async ({ page }) => {
  const min = await page.evaluate(() => {
    let smallest = Infinity;
    const walker = document.createTreeWalker(
      document.querySelector('.shell-page') ?? document.body,
      NodeFilter.SHOW_TEXT,
    );
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!el || !node.textContent?.trim()) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      smallest = Math.min(smallest, parseFloat(getComputedStyle(el).fontSize));
    }
    return smallest;
  });
  expect(min).toBeGreaterThanOrEqual(14);
  expect(min).toBeLessThan(Infinity);
});

test('kaynak bağlantısının dokunma alanı token kadardır', async ({ page }) => {
  const link = page.locator('[data-genui="source"]').getByRole('link').first();
  await expect(link).toHaveAttribute('href', /IZN-0041/);
  const target = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hit-target')),
  );
  expect(target).toBeGreaterThan(0);
  const box = await link.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(target - 0.5);
});

test('yüzeylerde güven yüzdesi yazmaz', async ({ page }) => {
  const text = (await page.locator('[data-demo^="genui"]').allTextContents()).join(' ');
  expect(text).not.toMatch(/%|güven/i);
});

test('axe denetimi hata vermez', async ({ page }) => {
  const results = await new AxeBuilder({ page })
    .include('[data-demo="genui"]')
    .include('[data-demo="genui-states"]')
    .withTags(AXE_TAGS)
    .analyze();
  expect(results.violations).toEqual([]);
});

test('koyu temada sayfa gerçekten koyu çizilir', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await open(page);
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
});

test('koyu temada axe denetimi hata vermez', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await open(page);
  const results = await new AxeBuilder({ page })
    .include('[data-demo="genui"]')
    .include('[data-demo="genui-states"]')
    .withTags(AXE_TAGS)
    .analyze();
  expect(results.violations).toEqual([]);
});

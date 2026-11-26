import { expect, test } from '../../../../tests/setup/playwright-fixtures';
import AxeBuilder from '@axe-core/playwright';

const preview = '/src/views/collection/preview/';
const screenshotDir = process.env['AJA_SCREENSHOT_DIR'];

test('draws the four parts in order without horizontal overflow', async ({ page }, testInfo) => {
  await page.goto(preview);
  await expect(page.getByText('ORNEK-0001', { exact: true })).toBeVisible();
  const parts = await page
    .locator('[data-collection-part]')
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-collection-part')),
    );
  expect(parts).toEqual(['views', 'filters', 'bulk', 'table']);
  const tops = await page
    .locator('[data-collection-part]:not(:empty)')
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
  expect([...tops].sort((a, b) => a - b)).toEqual(tops);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // Süzgeç satırındaki alanlar içeriği kadar yüksektir. Tablo öncesinde boş alan kalmaz.
  const slack = await page.locator('.collection-tools > label').evaluateAll((labels) =>
    labels.map((label) => {
      const select = label.querySelector('.collection-select');
      return select
        ? label.getBoundingClientRect().bottom - select.getBoundingClientRect().bottom
        : 0;
    }),
  );
  for (const value of slack) expect(value).toBeLessThanOrEqual(1);
  // Kayıtlı görünüm seçenekleri dokunma alanı tokenını karşılar.
  const sizes = await page.locator('.collection-saved-option').evaluateAll((labels) =>
    labels.map((label) => ({
      height: label.getBoundingClientRect().height,
      target: parseFloat(getComputedStyle(label).minHeight),
      font: parseFloat(getComputedStyle(label).fontSize),
    })),
  );
  for (const size of sizes) {
    expect(size.height).toBeGreaterThanOrEqual(size.target);
    expect(size.target).toBeGreaterThanOrEqual(44);
    expect(size.font).toBeGreaterThanOrEqual(14);
  }
  if (testInfo.project.name === 'iphone-13')
    for (const size of sizes) expect(size.target).toBeGreaterThanOrEqual(48);
  const axe = await new AxeBuilder({ page }).include('.collection').analyze();
  expect(axe.violations).toEqual([]);
});

test('saved view goes into the address and back returns to the previous view', async ({ page }) => {
  await page.goto(preview);
  await expect(page.getByText('ORNEK-0001', { exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Tümü' })).toBeChecked();
  await page.getByRole('radio', { name: 'Bekleyenler' }).click();
  await expect(page).toHaveURL(/saved=bekleyen/);
  await expect(page.getByRole('list', { name: 'Etkin süzgeçler' })).toContainText('Durum: Açık');
  await expect(page.getByText('1 süzgeç etkin')).toBeVisible();
  await page.getByRole('radio', { name: 'Tutara göre' }).click();
  await expect(page).toHaveURL(/saved=tutar/);
  await expect(page.getByText('Etkin süzgeç yok.')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/saved=bekleyen/);
  await expect(page.getByRole('radio', { name: 'Bekleyenler' })).toBeChecked();
});

test('saved views use one keyboard underline and arrow keys', async ({ page, browserName }) => {
  await page.goto(preview);
  await expect(page.getByText('ORNEK-0001', { exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  const all = page.getByRole('radio', { name: 'Tümü' });
  // WebKit varsayılan ayarda Tab ile radyo düğmesine gitmez. Klavye kipi açıkken odağı taşırız.
  if (browserName === 'webkit') await all.focus();
  await expect(all).toBeFocused();
  const option = page.locator('.collection-saved-option').filter({ has: all });
  const style = await option.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      shadow: computed.boxShadow,
      outline: computed.outlineStyle,
      bottomLeft: computed.borderBottomLeftRadius,
    };
  });
  expect(style.shadow).toContain('inset');
  expect(style.outline).toBe('none');
  expect(style.bottomLeft).toBe('0px');
  expect(await all.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('none');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('radio', { name: 'Tutara göre' })).toBeChecked();
  await expect(page).toHaveURL(/saved=tutar/);
});

test('a shared filtered link opens the same list in a new tab and search survives reload', async ({
  page,
  context,
}) => {
  const link = preview + '?filter=status&value=A%C3%A7%C4%B1k&sort=amount&direction=desc';
  const tab = await context.newPage();
  await tab.goto(link);
  await expect(tab.getByRole('list', { name: 'Etkin süzgeçler' })).toContainText('Durum: Açık');
  // Sıralama "Bekleyenler" görünümünden farklıdır. Bu yüzden hiçbir kayıtlı görünüm seçili değildir.
  await expect(tab.getByRole('radio', { name: 'Bekleyenler' })).not.toBeChecked();
  await expect(
    tab.locator('.collection-select').filter({
      has: tab.getByRole('combobox', { name: 'Sıralama alanı' }),
    }),
  ).toContainText('Tutar');
  await tab.close();

  await page.goto(preview + '?search=%C3%96rnek&gizli=1&filter=yok');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Kayıt ara' })).toHaveValue('Örnek');
  await expect(page.getByRole('list', { name: 'Etkin süzgeçler' })).toContainText('Arama: Örnek');
  await expect(page.getByText('1 süzgeç etkin')).toBeVisible();
});

test('captures 320 and 1366 screenshots', async ({ page }, testInfo) => {
  test.skip(!screenshotDir, 'AJA_SCREENSHOT_DIR verilmedi.');
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Görüntü yalnız bir projede alınır.');
  for (const width of [320, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(preview + '?saved=bekleyen&filter=status&value=A%C3%A7%C4%B1k');
    await expect(page.getByText('ORNEK-0001', { exact: true })).toBeVisible();
    await page.screenshot({
      path: `${screenshotDir}/AJA-1193-liste-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }
});

import { expect, test } from '../../../../tests/setup/playwright-fixtures';
import AxeBuilder from '@axe-core/playwright';

const preview = '/src/views/collection/preview/';
const screenshotDir = process.env['AJA_SCREENSHOT_DIR'];

test('keyboard opens selection mode, preview and returns focus to the opener', async ({
  page,
  browserName,
}) => {
  await page.goto(preview);
  await expect(page.getByText('ORNEK-0001', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Toplu işlem', exact: true })).toHaveCount(0);
  const toggle = page.getByRole('button', { name: 'Seç', exact: true });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const row = page.getByRole('checkbox', { name: 'ORNEK-0001 seç', exact: true });
  await row.focus();
  await page.keyboard.press('Space');
  const bar = page.getByRole('region', { name: 'Toplu işlem', exact: true });
  await expect(bar).toContainText('1 kayıt seçildi');
  const opener = bar.getByRole('button', { name: 'Seçilenleri onayla' });
  await opener.focus();
  await page.keyboard.press('Enter');
  const box = page.getByRole('region', { name: 'Toplu işlem önizlemesi' });
  await expect(box).toContainText('Risk düzeyi: R2 Orta. Çok kaydı değiştirir.');
  const confirm = box.getByRole('button', { name: 'Onayla', exact: true });
  await expect(confirm).toBeDisabled();
  const ack = box.getByRole('checkbox', { name: 'Önizlemeyi okudum.' });
  await expect(ack).toBeFocused();
  await page.keyboard.press('Space');
  await expect(confirm).toBeEnabled();
  // WebKit varsayılan ayarda Tab ile düğmeye gitmez. Safari de böyle davranır.
  if (browserName === 'webkit') await confirm.focus();
  else await page.keyboard.press('Tab');
  await expect(confirm).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(box.getByRole('status')).toHaveText(
    'Kayıtlar değişmedi. Onay işlemi henüz bağlı değil.',
  );
  await page.keyboard.press('Escape');
  await expect(box).toHaveCount(0);
  await expect(opener).toBeFocused();
  const axe = await new AxeBuilder({ page }).include('.collection').analyze();
  expect(axe.violations).toEqual([]);
});

test('pointer and touch select rows; "Vazgeç" keeps records unchanged', async ({
  page,
}, testInfo) => {
  await page.goto(preview);
  await expect(page.getByText('ORNEK-0001', { exact: true })).toBeVisible();
  const touch = testInfo.project.name === 'iphone-13';
  const press = async (locator: ReturnType<typeof page.getByRole>) => {
    if (touch) await locator.tap();
    else await locator.click();
  };
  await press(page.getByRole('button', { name: 'Seç', exact: true }));
  await press(page.getByRole('checkbox', { name: 'ORNEK-0001 seç', exact: true }));
  await press(page.getByRole('checkbox', { name: 'ORNEK-0002 seç', exact: true }));
  const bar = page.getByRole('region', { name: 'Toplu işlem', exact: true });
  await expect(bar).toContainText('2 kayıt seçildi');
  // Toplu işlem düğmeleri dokunma alanı tokenını karşılar.
  const sizes = await bar.getByRole('button').evaluateAll((buttons) =>
    buttons.map((button) => ({
      height: button.getBoundingClientRect().height,
      target: parseFloat(getComputedStyle(button).minHeight),
    })),
  );
  for (const size of sizes) {
    expect(size.height).toBeGreaterThanOrEqual(size.target);
    expect(size.target).toBeGreaterThanOrEqual(touch ? 48 : 44);
  }
  const opener = bar.getByRole('button', { name: 'Seçilenleri onayla' });
  await press(opener);
  const box = page.getByRole('region', { name: 'Toplu işlem önizlemesi' });
  await expect(box).toContainText('2 kayıt onaylanır: ORNEK-0001, ORNEK-0002.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const axe = await new AxeBuilder({ page }).include('.collection').analyze();
  expect(axe.violations).toEqual([]);
  await press(box.getByRole('button', { name: 'Vazgeç' }));
  await expect(box).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(page.getByText('ORNEK-0001', { exact: true })).toBeVisible();
  await expect(bar).toContainText('2 kayıt seçildi');
});

test('captures 320 and 1366 screenshots with an open preview', async ({ page }, testInfo) => {
  test.skip(!screenshotDir, 'AJA_SCREENSHOT_DIR verilmedi.');
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Görüntü yalnız bir projede alınır.');
  for (const width of [320, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(preview);
    await expect(page.getByText('ORNEK-0001', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Seç', exact: true }).click();
    await page.getByRole('checkbox', { name: 'ORNEK-0001 seç', exact: true }).check();
    await page.getByRole('checkbox', { name: 'ORNEK-0002 seç', exact: true }).check();
    await page.getByRole('button', { name: 'Seçilenleri onayla' }).click();
    await expect(page.getByRole('region', { name: 'Toplu işlem önizlemesi' })).toBeVisible();
    await page.screenshot({
      path: `${screenshotDir}/AJA-1194-liste-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }
});

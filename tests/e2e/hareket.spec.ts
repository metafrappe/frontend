import { expect, test } from '../setup/playwright-fixtures';

const DEMO = '/_demo/foundation';

test.describe('odak perdesi hareketi', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO);
    await expect(page.getByRole('heading', { level: 1, name: 'Atonota' })).toBeVisible();
  });

  test('açılış ve kapanış merkezi süre ve eğriyle olur', async ({ page }) => {
    const overlay = page.getByTestId('focus-dim-overlay');
    const toggle = page.getByTestId('dim-toggle');
    await expect(overlay).toHaveCSS('transition-duration', '0.32s');
    await expect(overlay).toHaveCSS('transition-timing-function', 'cubic-bezier(0.65, 0, 0.35, 1)');
    await expect(overlay).toHaveCSS('background-color', /rgba\(\d+, \d+, \d+, 0\)/);

    await toggle.click();
    await expect(page.locator('body')).toHaveClass(/focus-dim-on/);
    await expect(toggle).toHaveClass(/focus-dim-source/);
    await expect(overlay).toHaveCSS('background-color', 'rgba(100, 116, 139, 0.33)');
    // The trigger element is above the overlay
    const [zOverlay, zSource] = await Promise.all([
      overlay.evaluate((el) => Number(getComputedStyle(el).zIndex)),
      toggle.evaluate((el) => Number(getComputedStyle(el).zIndex)),
    ]);
    expect(zSource).toBeGreaterThan(zOverlay);

    await toggle.click();
    await expect(page.locator('body')).not.toHaveClass(/focus-dim-on/);
    await expect(overlay).toHaveCSS('background-color', /rgba\(\d+, \d+, \d+, 0\)/);
  });

  test('koyu temada perde rengi koyu karardır', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('radiogroup', { name: 'Tema' }).getByText('Koyu', { exact: true }).click();
    await page.getByTestId('dim-toggle').click();
    await expect(page.getByTestId('focus-dim-overlay')).toHaveCSS(
      'background-color',
      'rgba(50, 58, 70, 0.66)',
    );
  });

  test('azaltılmış harekette geçiş yoktur', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const overlay = page.getByTestId('focus-dim-overlay');
    const duration = await overlay.evaluate((el) => getComputedStyle(el).transitionDuration);
    // WebKit returns an empty value for `transition: none`.
    expect(['0s', '']).toContain(duration);
    await page.getByTestId('dim-toggle').click();
    await expect(overlay).toHaveCSS('background-color', 'rgba(100, 116, 139, 0.33)');
  });
});

import { expect, test } from '../setup/playwright-fixtures';

const DEMO = '/_demo/foundation';

/**
 * Perdenin bulanıklığı (backdrop-filter) yazılımla çizilen tarayıcıda çok pahalıdır.
 * CI'daki Linux WebKit, 1440 px genişlikte bir kareyi saniyelerce çizemez (AJA-2062).
 * Çizim durunca geçiş de ilerlemez ve renk ara değerde kalır.
 * Bu yüzden süre ve eğri testi yalnız bulanıklığı kapatır. Renk, süre ve eğri denetimi aynen kalır.
 * Bulanıklığın kendisi azaltılmış hareket testinde denetlenir. O testte geçiş yoktur.
 */
const NO_BLUR_CSS =
  '.focus-dim-overlay { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }';

test.describe('odak perdesi hareketi', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO);
    await expect(page.getByRole('heading', { level: 1, name: 'Atonota' })).toBeVisible();
  });

  test('açılış ve kapanış merkezi süre ve eğriyle olur', async ({ page }) => {
    await page.addStyleTag({ content: NO_BLUR_CSS });
    const overlay = page.getByTestId('focus-dim-overlay');
    const toggle = page.getByTestId('dim-toggle');
    await expect(overlay).toHaveCSS('transition-property', /background-color/);
    await expect(overlay).toHaveCSS('transition-duration', '0.32s');
    await expect(overlay).toHaveCSS('transition-timing-function', 'cubic-bezier(0.65, 0, 0.35, 1)');
    await expect(overlay).toHaveCSS('background-color', /rgba\(\d+, \d+, \d+, 0\)/);

    await toggle.click();
    await expect(page.locator('body')).toHaveClass(/focus-dim-on/);
    await expect(toggle).toHaveClass(/focus-dim-source/);
    await expect(overlay).toHaveCSS('background-color', 'rgba(100, 116, 139, 0.33)');
    // Açan öğe perdenin üstündedir
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
    // WebKit `transition: none` için boş değer döner.
    expect(['0s', '']).toContain(duration);
    await expect(overlay).toHaveCSS('backdrop-filter', 'blur(0px)');
    await page.getByTestId('dim-toggle').click();
    await expect(overlay).toHaveCSS('background-color', 'rgba(100, 116, 139, 0.33)');
    // Açık perde arkasını bulanıklaştırır. Değer `--focus-dim-blur` değişkeninden gelir.
    const blur = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--focus-dim-blur').trim(),
    );
    expect(blur).toMatch(/^[1-9]\d*px$/);
    await expect(overlay).toHaveCSS('backdrop-filter', `blur(${blur})`);
  });
});

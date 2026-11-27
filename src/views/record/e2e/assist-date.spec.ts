import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../../../../tests/setup/playwright-fixtures';

const FORM = '/src/views/record/harness/?scenario=leave&assist=1';

// Linux Chromium draws text with coloured subpixel edges. The right edge of each letter is blue,
// so the ring probe below would count letters as a ring. Grayscale text keeps the probe honest.
// The probe and its zero expectation do not change. WebKit rejects this switch, so only
// Chromium gets it.
test.use({
  launchOptions: [
    async ({ browserName }, use) => {
      await use(browserName === 'chromium' ? { args: ['--disable-lcd-text'] } : {});
    },
    { scope: 'worker' },
  ],
});

/** Safari reaches buttons with Option+Tab; plain Tab skips them (macOS keyboard setting). */
async function tabTo(page: Page, target: Locator, key = 'Tab') {
  for (let i = 0; i < 30; i += 1) {
    await page.keyboard.press(key);
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error('Tab did not reach the target');
}

/** Returns the wrapper style; a surrounding ring is any non-inset or side shadow. */
async function focusStyle(control: Locator) {
  return control.evaluate(async (el) => {
    const root = el.closest('.rv-root');
    if (!root) throw new Error('Missing record root');
    // Tarih alanı markalı seçicidir (panel sorunu 3). Kutusu `.ant-picker` öğesidir.
    const surface = el.closest('.ant-picker, .ant-input-affix-wrapper') ?? el;
    surface.getBoundingClientRect();
    await Promise.all(surface.getAnimations().map((animation) => animation.finished));
    const style = getComputedStyle(surface);
    const own = getComputedStyle(el);
    return {
      outline: style.outlineStyle,
      ownOutline: own.outlineStyle,
      ownShadow: own.boxShadow,
      shadow: style.boxShadow,
      border: style.borderColor,
      focusColor: getComputedStyle(root).getPropertyValue('--rv-focus-color').trim(),
      inputShadow: (() => {
        const probe = document.createElement('i');
        probe.style.boxShadow = 'var(--rv-shadow-input)';
        root.append(probe);
        const value = getComputedStyle(probe).boxShadow;
        probe.remove();
        return value;
      })(),
    };
  });
}

function shadowParts(shadow: string): string[] {
  return shadow === 'none' ? [] : shadow.split(/,(?![^(]*\))/).map((part) => part.trim());
}

test('date field shows one underline on Tab focus and no surrounding ring', async ({ page }) => {
  await page.goto(FORM);
  const date = page.getByLabel(/Başlangıç tarihi/);
  await expect(date).toBeVisible();
  const resting = await focusStyle(date);
  await tabTo(page, date);
  await expect(page.locator('.rv-root')).toHaveAttribute('data-rv-kbd', 'true');
  const focused = await focusStyle(date);
  expect(focused.outline).toBe('none');
  expect(focused.ownOutline).toBe('none');
  expect(focused.ownShadow).toBe('none');
  expect(focused.border).toBe(resting.border);
  const known = [...shadowParts(resting.shadow), ...shadowParts(focused.inputShadow)];
  const added = shadowParts(focused.shadow).filter((part) => !known.includes(part));
  // Exactly one new shadow: an inset bottom line in the shared focus token colour.
  // The resting input token is an inset top shade, not a ring.
  expect(added).toHaveLength(1);
  expect(added[0]).toMatch(/inset/);
  expect(added[0]).toMatch(/0px -\d+(\.\d+)?px 0px 0px/);
  const probe = await page.evaluate((color) => {
    const el = document.createElement('i');
    el.style.color = color;
    document.body.append(el);
    const value = getComputedStyle(el).color;
    el.remove();
    return value;
  }, focused.focusColor);
  expect(added[0]).toContain(probe);
  // WebKit draws a native rounded ring around the focused date segment. The pixel probe counts
  // the system accent blue that this ring uses; tokens never produce it.
  const wrapper = date.locator('xpath=ancestor::*[contains(@class,"ant-picker")][1]');
  const png = (await wrapper.screenshot({ animations: 'disabled' })).toString('base64');
  const nativeRing = await page.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Missing canvas context');
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, img.width, img.height).data;
    let count = 0;
    for (let i = 0; i < px.length; i += 4) {
      const red = px[i] ?? 0;
      const blue = px[i + 2] ?? 0;
      if (blue > 200 && blue - red > 120) count += 1;
    }
    return count;
  }, png);
  expect(nativeRing).toBe(0);
});

test('assistant button opens the assistant without changing the text', async ({
  page,
  browserName,
}) => {
  await page.goto(FORM);
  const text = page.getByLabel('Açıklama');
  await text.fill('Örnek metin');
  const buttons = page.getByRole('button', { name: 'Yardımcıyla yaz' });
  await expect(buttons).toHaveCount(1);
  const button = buttons.first();
  await button.click();
  await tabTo(page, button, browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toHaveAttribute('data-assist-calls', '2');
  await expect(text).toHaveValue('Örnek metin');
  const box = await button.boundingBox();
  const phone = (await page.locator('.rv-root').getAttribute('data-rv-viewport')) === 'phone';
  if (phone) {
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(48);
  }
});

test('@touch assistant button works with touch', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, 'Touch is not enabled in this project');
  await page.goto(FORM);
  await page.getByRole('button', { name: 'Yardımcıyla yaz' }).tap();
  await expect(page.locator('main')).toHaveAttribute('data-assist-calls', '1');
});

test('form with focused date is readable, accessible and does not overflow', async ({
  page,
}, testInfo) => {
  await page.goto(FORM);
  const date = page.getByLabel(/Başlangıç tarihi/);
  await tabTo(page, date);
  const checks = await page.locator('.rv-root').evaluate((root) => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    smallText: [...root.querySelectorAll<HTMLElement>('*')]
      .filter(
        (el) =>
          el.getClientRects().length &&
          [...el.childNodes].some((c) => c.nodeType === Node.TEXT_NODE && c.textContent?.trim()),
      )
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 14)
      .map((el) => el.textContent),
  }));
  expect(checks.overflow).toBeLessThanOrEqual(0);
  expect(checks.smallText).toEqual([]);
  const results = await new AxeBuilder({ page }).include('.rv-root').analyze();
  expect(results.violations).toEqual([]);
  const width = page.viewportSize()?.width;
  const name =
    testInfo.project.name === 'chromium-320'
      ? 'AJA-986c-form-320.png'
      : testInfo.project.name === 'chromium-desktop'
        ? 'AJA-986c-form-1366.png'
        : null;
  if (name && process.env['AJA986C_SHOTS'] === '1') {
    if (width !== 320) await page.setViewportSize({ width: 1366, height: 900 });
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(date).toBeFocused();
    // Full-page capture of a sticky header is only correct from the top of the page.
    await page.evaluate(() => window.scrollTo(0, 0));
    // SHOT_DIR yoksa görüntü testin kendi çıktı klasörüne yazılır.
    const shotDir = process.env['SHOT_DIR'];
    const path = shotDir ? join(shotDir, name) : testInfo.outputPath(name);
    await page.screenshot({ path, fullPage: true });
  }
});

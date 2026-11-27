/**
 * In the light theme #00aacc is never a text colour (AJA-997, QA AJA-1007).
 * The primary colour is used only for button backgrounds. Text, links and focus use the accent colour (`--color-ink`).
 * Muted text (Typography type="secondary") gives at least 4.5:1 on every background.
 * Colours are not hard-coded in the test; they are read from the page's tokens.
 */
import type { Page } from '@playwright/test';

import { tokenColor } from '../setup/odak-gostergesi';
import { expect, test } from '../setup/playwright-fixtures';

/** A page and the element showing that it is ready. */
const PAGES: Record<string, (page: Page) => ReturnType<Page['locator']>> = {
  '/_demo/foundation': (page) => page.getByTestId('btn-md'),
  '/_demo/controls': (page) => page.getByRole('button', { name: 'İşlemler' }),
  '/_demo/shell': (page) => page.getByRole('link', { name: 'yardım sayfası' }),
  '/atonota-login': (page) => page.getByRole('heading', { level: 1, name: 'AtonotA Login' }),
};

async function openLight(page: Page, path: string) {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const ready = PAGES[path];
  if (!ready) throw new Error(`Bilinmeyen sayfa: ${path}`);
  await expect(ready(page)).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

/** Visible elements with their own text: short descriptions of those in the given colour. */
function visibleTextIn(page: Page, color: string): Promise<string[]> {
  return page.evaluate((target) => {
    const hits: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const ownText = Array.from(el.childNodes).some(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '',
      );
      if (!ownText) continue;
      const s = getComputedStyle(el);
      if (s.visibility !== 'visible' || Number(s.opacity) === 0) continue;
      if (el.getClientRects().length === 0) continue;
      if (s.color === target) {
        hits.push(
          `${el.tagName.toLowerCase()}.${Array.from(el.classList).join('.')}: ${el.textContent?.trim().slice(0, 40)}`,
        );
      }
    }
    return hits;
  }, color);
}

for (const path of Object.keys(PAGES)) {
  test(`açık temada ${path} sayfasında hiçbir yazı birincil renkte değildir`, async ({ page }) => {
    await openLight(page, path);
    const primary = await tokenColor(page, '--color-primary');
    expect(await visibleTextIn(page, primary)).toEqual([]);
  });
}

test('açık temada seçili radyo düğmesinin yazısı vurgu rengidir', async ({ page }) => {
  await openLight(page, '/_demo/controls');
  const checked = page.locator('.ant-radio-button-wrapper-checked').first();
  await expect(checked).toBeVisible();
  await expect(checked).toHaveCSS('color', await tokenColor(page, '--color-ink'));
});

test('açık temada giriş sayfasının soluk yazısı her zeminde en az 4.5:1 verir', async ({
  page,
}) => {
  await openLight(page, '/atonota-login');
  const secondary = page.locator('.ant-typography-secondary');
  await expect(secondary.first()).toBeVisible();
  const ratios = await page.evaluate(() => {
    const probe = (value: string) => {
      const el = document.createElement('span');
      el.style.color = value;
      document.body.append(el);
      const c = getComputedStyle(el).color;
      el.remove();
      return c;
    };
    const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r = 0, g = 0, b = 0]: number[]) => {
      const ch = (v: number) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
    };
    const surfaces = ['--color-bg-layout', '--color-bg-panel', '--color-bg-panel-alt'].map((v) =>
      parse(probe(`var(${v})`)),
    );
    const out: number[] = [];
    for (const el of Array.from(document.querySelectorAll('.ant-typography-secondary'))) {
      const [r = 0, g = 0, b = 0, a = 1] = parse(getComputedStyle(el).color);
      for (const [sr = 0, sg = 0, sb = 0] of surfaces) {
        const fg = [r * a + sr * (1 - a), g * a + sg * (1 - a), b * a + sb * (1 - a)];
        const [hi, lo] = [lum(fg), lum([sr, sg, sb])].sort((x, y) => y - x);
        out.push(((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05));
      }
    }
    return out;
  });
  expect(ratios.length).toBeGreaterThan(0);
  for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
});

/**
 * In hover and pressed states the text is also the accent colour (QA AJA-1023).
 * antd uses `colorPrimary` on an unselected radio button and `colorPrimaryHover` on a bordered button.
 * These two colours do not give 4.5:1 on a white background.
 */
test('açık temada seçili olmayan radyo düğmesinin üstüne gelince yazı vurgu rengidir', async ({
  page,
}) => {
  await openLight(page, '/_demo/controls');
  const unchecked = page
    .getByTestId('radio-buttons')
    .locator('.ant-radio-button-wrapper:not(.ant-radio-button-wrapper-checked)')
    .first();
  await unchecked.hover();
  await expect(unchecked).toHaveCSS('color', await tokenColor(page, '--color-link-hover'));
});

test('açık temada seçili radyo düğmesinin üstüne gelince yazı vurgu rengidir', async ({ page }) => {
  await openLight(page, '/_demo/controls');
  const checked = page.getByTestId('radio-buttons').locator('.ant-radio-button-wrapper-checked');
  await checked.hover();
  await expect(checked).toHaveCSS('color', await tokenColor(page, '--color-link-hover'));
});

for (const name of ['Kaydet', 'İşlemler']) {
  test(`açık temada "${name}" düğmesinin üstüne gelince yazı vurgu rengidir`, async ({ page }) => {
    await openLight(page, '/_demo/controls');
    const button = page.getByRole('button', { name, exact: true }).first();
    await expect(button).toBeVisible();
    await button.hover();
    await expect(button).toHaveCSS('color', await tokenColor(page, '--color-link-hover'));
  });
}

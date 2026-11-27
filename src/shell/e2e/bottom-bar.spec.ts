import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from '../../../tests/setup/playwright-fixtures';

/**
 * Phone bottom bar (AJA-982b). Acceptance order is 320, 360, 375, 390 px, landscape phone,
 * tablet and desktop. The decision matches the phone query in `useMedia.ts`.
 */
const isCompact = (page: Page) => {
  const v = page.viewportSize();
  return !!v && (v.width <= 767 || v.height <= 499);
};
const isLandscapePhone = (page: Page) => {
  const v = page.viewportSize();
  return !!v && v.width > v.height && v.height <= 499;
};

const LIST = `/ornek/${encodeURIComponent('örnek-kayıt')}`;
const RECORD = `${LIST}/ORNEK-0003`;
const NAMES = ['Bekleyenler', 'Ara', 'Asistan', 'Menü'];

const bar = (page: Page) => page.getByRole('navigation', { name: 'Alt menü' });
const item = (page: Page, name: string) =>
  bar(page).getByRole(name === 'Ara' || name === 'Menü' ? 'button' : 'link', {
    name,
    exact: true,
  });

async function settle(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime))
        .map((a) => a.finished.catch(() => undefined)),
    );
  });
}

// The visible area's height shrinks. This is how the virtual keyboard appears in the browser.
async function openKeyboard(page: Page) {
  await page.evaluate(() => {
    const vv = window.visualViewport;
    if (!vv) throw new Error('visualViewport yok');
    Object.defineProperty(vv, 'height', {
      configurable: true,
      get: () => Math.round(window.innerHeight * 0.5),
    });
    vv.dispatchEvent(new Event('resize'));
  });
}

async function closeKeyboard(page: Page) {
  await page.evaluate(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    delete (vv as { height?: number }).height;
    vv.dispatchEvent(new Event('resize'));
  });
}

test.describe('telefon alt çubuğu', () => {
  test('telefonda görünür; tablet ve masaüstünde görünmez', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.shell')).toBeVisible();
    if (!isCompact(page)) {
      await expect(bar(page)).toHaveCount(0);
      await expect(page.getByRole('navigation', { name: 'Ana gezinme' })).toBeVisible();
      return;
    }
    await expect(bar(page)).toBeVisible();
    for (const name of NAMES) {
      const el = item(page, name);
      await expect(el).toBeVisible();
      const m = await el.evaluate((node) => {
        const r = node.getBoundingClientRect();
        const label = node.querySelector('span');
        return {
          w: r.width,
          h: r.height,
          font: parseFloat(getComputedStyle(node).fontSize),
          // The label is not truncated: the text fits its box.
          clipped: label ? label.scrollWidth > label.clientWidth + 1 : true,
          outline: getComputedStyle(node).outlineStyle,
        };
      });
      expect(m.w).toBeGreaterThanOrEqual(48);
      expect(m.h).toBeGreaterThanOrEqual(48);
      expect(m.font).toBeGreaterThanOrEqual(14);
      expect(m.clipped).toBe(false);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await settle(page);
    expect((await new AxeBuilder({ page }).include('.shell').analyze()).violations).toEqual([]);
  });

  test('dikey telefonda altta, yatay telefonda sol kenarda; başlığı örtmez', async ({ page }) => {
    test.skip(!isCompact(page), 'Alt çubuk yalnız telefon kabuğundadır.');
    await page.goto('/');
    const box = await bar(page).boundingBox();
    const header = await page.getByRole('banner', { name: 'Kimlik şeridi' }).boundingBox();
    const main = await page.locator('#main').boundingBox();
    const v = page.viewportSize();
    expect(box && header && main && v).toBeTruthy();
    if (!box || !header || !main || !v) return;
    if (isLandscapePhone(page)) {
      expect(box.x).toBe(0);
      expect(box.height).toBeGreaterThan(box.width);
      // The bar stays to the left of the header and the page. They do not overlap.
      expect(header.x).toBeGreaterThanOrEqual(box.x + box.width - 1);
      expect(main.x).toBeGreaterThanOrEqual(box.x + box.width - 1);
      // The notice above the shell is not covered either. Example: the mock server's sample data notice.
      const shellTop = await page
        .locator('.shell')
        .evaluate((el) => el.getBoundingClientRect().top);
      expect(box.y).toBeGreaterThanOrEqual(Math.max(0, shellTop) - 1);
    } else {
      expect(Math.round(box.y + box.height)).toBe(v.height);
      expect(box.width).toBe(v.width);
      expect(box.y).toBeGreaterThanOrEqual(header.y + header.height);
    }
  });

  test('dikey telefonda sanal klavye açılınca gizlenir, kapanınca geri gelir', async ({ page }) => {
    test.skip(!isCompact(page), 'Alt çubuk yalnız telefon kabuğundadır.');
    test.skip(isLandscapePhone(page), 'Yatay telefonda çubuk gizlenmez. Ayrı test vardır.');
    await page.goto('/');
    await expect(bar(page)).toBeVisible();
    await openKeyboard(page);
    await expect(bar(page)).toBeHidden();
    await closeKeyboard(page);
    await expect(bar(page)).toBeVisible();
  });

  // This test runs in every project. The viewport is switched to landscape phone. That way WebKit is tested too.
  test('yatay telefonda sanal klavye açılınca sol çubuk yerinde kalır, sayfa kaymaz', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto(RECORD);
    await expect(page.locator('.shell')).toHaveAttribute('data-layout', 'compact');
    await expect(bar(page)).toBeVisible();
    const measure = () =>
      page.evaluate(() => {
        const shell = document.querySelector<HTMLElement>('.shell');
        const main = document.querySelector<HTMLElement>('#main');
        return {
          pad: shell ? getComputedStyle(shell).paddingLeft : '',
          mainX: main?.getBoundingClientRect().left ?? -1,
        };
      });
    const before = await measure();
    expect(parseFloat(before.pad)).toBeGreaterThan(0);
    const title = page.getByRole('textbox', { name: /Örnek başlık/ });
    await title.focus();
    await openKeyboard(page);
    await expect(bar(page)).toHaveAttribute('data-keyboard', 'open');
    await expect(bar(page)).toBeVisible();
    expect(await measure()).toEqual(before);
    await expect(title).toBeFocused();
    await closeKeyboard(page);
    await expect(bar(page)).not.toHaveAttribute('data-keyboard', 'open');
    expect(await measure()).toEqual(before);
  });

  test('menü Escape ile ve kapatma düğmesiyle kapanınca odak "Menü" düğmesine döner', async ({
    page,
  }) => {
    test.skip(!isCompact(page), 'Alt çubuk yalnız telefon kabuğundadır.');
    await page.goto('/');
    const menu = item(page, 'Menü');
    const drawer = page.getByRole('dialog', { name: 'Menü' });

    await menu.click();
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(menu).toBeFocused();

    await menu.click();
    await expect(drawer).toBeVisible();
    await page.getByRole('button', { name: 'Menüyü kapat' }).click();
    await expect(drawer).toBeHidden();
    await expect(menu).toBeFocused();
  });

  test('dört düğme klavye, fare ve dokunmayla çalışır', async ({ page, browserName }) => {
    test.skip(!isCompact(page), 'Alt çubuk yalnız telefon kabuğundadır.');
    await page.goto(LIST);
    await expect(bar(page)).toBeVisible();
    const drawer = page.getByRole('dialog', { name: 'Menü' });
    const touch = !!test.info().project.use.hasTouch;
    // Safari and WebKit move only to fields with Tab. They move to buttons with Option+Tab.
    const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
    const backTab = browserName === 'webkit' ? 'Alt+Shift+Tab' : 'Shift+Tab';

    // Mouse.
    await item(page, 'Asistan').click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/asistan');
    await expect(item(page, 'Asistan')).toHaveAttribute('aria-current', 'page');
    await item(page, 'Bekleyenler').click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/');
    await item(page, 'Ara').click();
    await expect(drawer).toBeVisible();
    await expect(page.getByRole('banner', { name: 'Kimlik şeridi' })).toContainText('KipAra');
    await page.keyboard.press('Escape');
    await expect(item(page, 'Ara')).toBeFocused();

    // Keyboard. The focus indicator does not surround: no outline, an underline instead.
    await item(page, 'Bekleyenler').focus();
    await page.keyboard.press(tab);
    await expect(item(page, 'Ara')).toBeFocused();
    await page.keyboard.press(tab);
    await expect(item(page, 'Asistan')).toBeFocused();
    await page.keyboard.press(backTab);
    await expect(item(page, 'Ara')).toBeFocused();
    const focus = await item(page, 'Ara').evaluate((el) => ({
      outline: getComputedStyle(el).outlineStyle,
      shadow: getComputedStyle(el).boxShadow,
      indicator: getComputedStyle(el, '::after').opacity,
    }));
    expect(focus.outline).toBe('none');
    expect(focus.shadow).toBe('none');
    // Only plain Tab turns on focus mode (`src/engines/focus-mode`). In WebKit, Option+Tab does not turn it on.
    // So the underline indicator is measured only in Chromium. The open issue is in the task comment.
    if (browserName === 'chromium') expect(focus.indicator).toBe('1');
    await page.keyboard.press(tab);
    await page.keyboard.press('Enter');
    await expect.poll(() => new URL(page.url()).pathname).toBe('/asistan');
    await item(page, 'Menü').focus();
    await page.keyboard.press('Space');
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(item(page, 'Menü')).toBeFocused();

    // Touch.
    if (touch) {
      await item(page, 'Bekleyenler').tap();
      await expect.poll(() => new URL(page.url()).pathname).toBe('/');
      await item(page, 'Menü').tap();
      await expect(drawer).toBeVisible();
    }
  });

  test('yön değişince form verisi ve odak korunur', async ({ page }) => {
    test.skip(!isCompact(page), 'Alt çubuk yalnız telefon kabuğundadır.');
    const start = page.viewportSize();
    if (!start) return;
    await page.goto(RECORD);
    const title = page.getByRole('textbox', { name: /Örnek başlık/ });
    await expect(title).toHaveValue('Örnek veri 3');
    await title.fill('Yön değişimi metni');
    await title.focus();
    // Portrait phone rotates to landscape, landscape to portrait. In neither case does the tablet layout open.
    await page.setViewportSize({ width: start.height, height: start.width });
    await expect(page.locator('.shell')).toHaveAttribute('data-layout', 'compact');
    await expect(title).toHaveValue('Yön değişimi metni');
    await expect(title).toBeFocused();
    await page.setViewportSize(start);
    await expect(page.locator('.shell')).toHaveAttribute('data-layout', 'compact');
    await expect(title).toHaveValue('Yön değişimi metni');
    await expect(title).toBeFocused();
  });
});

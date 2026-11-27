import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { isRingShadow, splitShadows } from '../../../tests/setup/odak-gostergesi';
import { expect, test } from '../../../tests/setup/playwright-fixtures';

const SHOTS = process.env['ASSIST_SHOT_DIR'];

async function settle(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
}

const isCompact = (page: Page) => {
  const vp = page.viewportSize();
  return !!vp && (vp.width <= 767 || vp.height <= 499);
};

async function ready(page: Page) {
  await page.goto('/');
  await expect(page.locator('.shell')).toBeVisible();
  const trigger = page.getByRole('button', { name: 'Asistan', exact: true });
  await expect(trigger).toBeVisible();
  return trigger;
}

const panel = (page: Page) => page.locator('#shell-assist');

/** Is the focus overlay open? The shell overlay and the engine overlay are checked together. */
async function dimOn(page: Page) {
  return page.evaluate(
    () =>
      document.body.hasAttribute('data-focus-dim') ||
      document.body.classList.contains('focus-dim-on') ||
      !!document.querySelector('.shell-dim[data-on="true"]'),
  );
}

test.describe('yardımcı panel', () => {
  test('fare üstüne gelince panel açılmaz', async ({ page }) => {
    const trigger = await ready(page);
    test.skip(!(await page.evaluate(() => matchMedia('(hover: hover)').matches)), 'hover yok');
    await trigger.hover();
    await page.waitForTimeout(400);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(panel(page)).toBeHidden();
  });

  test('tıklamayla açılır, Escape kapatır, odak düğmeye döner', async ({ page }) => {
    const trigger = await ready(page);
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByRole('heading', { name: 'Asistan' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  for (const key of ['Enter', 'Space']) {
    test(`${key} tuşuyla açılır, kapatma düğmesi odağı geri verir`, async ({ page }) => {
      const trigger = await ready(page);
      await trigger.focus();
      await page.keyboard.press(key);
      await expect(panel(page)).toBeVisible();
      const close = panel(page).getByRole('button', { name: 'Asistanı kapat' });
      await expect(close).toBeFocused();
      await page.keyboard.press(key);
      await expect(panel(page)).toBeHidden();
      await expect(trigger).toBeFocused();
    });
  }

  test('masaüstünde sağda açılır ve içeriği örtmez', async ({ page }) => {
    test.skip(isCompact(page), 'geniş kabuk');
    await page.setViewportSize({ width: 1366, height: 800 });
    const trigger = await ready(page);
    await trigger.click();
    await settle(page);
    const p = await panel(page).boundingBox();
    const main = await page.locator('#main').boundingBox();
    expect(p && main).toBeTruthy();
    if (!p || !main) return;
    expect(Math.round(p.x + p.width)).toBe(1366);
    expect(main.x + main.width).toBeLessThanOrEqual(p.x + 0.5);
    expect(await dimOn(page)).toBe(false);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/AJA-982c-panel-1366.png` });
  });

  test('telefonda alttan tam boy açılır', async ({ page }) => {
    test.skip(!isCompact(page), 'telefon kabuğu');
    const trigger = await ready(page);
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Asistan' });
    await expect(dialog).toBeVisible();
    await settle(page);
    const box = await dialog.boundingBox();
    const vp = page.viewportSize();
    // The sample data notice is outside the shell. The panel starts below the notice and the notice stays visible.
    const note = page.getByRole('status').filter({ hasText: 'Örnek veri' });
    await expect(note).toBeVisible();
    const noteBox = await note.boundingBox();
    expect(box && vp && noteBox).toBeTruthy();
    if (!box || !vp || !noteBox) return;
    expect(noteBox.height).toBeGreaterThan(0);
    expect(Math.round(box.x)).toBe(0);
    expect(Math.round(box.y)).toBe(Math.round(noteBox.y + noteBox.height));
    expect(Math.round(box.width)).toBe(vp.width);
    expect(Math.round(box.y + box.height)).toBe(vp.height);
    // No other element sits on top of the notice. The panel does not cover the notice.
    const topAtNote = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.closest('#shell-assist') === null,
      [noteBox.x + noteBox.width / 2, noteBox.y + noteBox.height / 2] as const,
    );
    expect(topAtNote).toBe(true);
    expect(await dimOn(page)).toBe(false);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    if (SHOTS && vp.width === 320) {
      await page.screenshot({ path: `${SHOTS}/AJA-982c-panel-320.png` });
    }
  });

  test('açık panelde metin 14 px altına inmez, halka yoktur, axe temizdir', async ({ page }) => {
    const trigger = await ready(page);
    await trigger.focus();
    await page.keyboard.press('Enter');
    const close = panel(page).getByRole('button', { name: 'Asistanı kapat' });
    await expect(close).toBeFocused();
    // Tab turns on visible focus mode. WebKit does not stop on the button with Tab.
    // So focus is then given directly to the close button.
    await page.keyboard.press('Tab');
    await close.focus();
    await expect(close).toBeFocused();
    await settle(page);
    const m = await panel(page).evaluate((root) => {
      const btn = root.querySelector('button');
      const s = btn ? getComputedStyle(btn) : null;
      return {
        small: Array.from(root.querySelectorAll('*'))
          .filter((el) => el.getBoundingClientRect().width > 0 && el.textContent?.trim())
          .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 14).length,
        outline: s?.outlineStyle,
        shadow: s?.boxShadow,
        indicator: btn ? getComputedStyle(btn, '::after').opacity : null,
      };
    });
    expect(m.small).toBe(0);
    expect(m.outline).toBe('none');
    // Single indicator: an inset shadow line on the bottom edge. There is no ring and no second underline.
    const parts = splitShadows(m.shadow ?? '');
    expect(parts).toHaveLength(1);
    expect(parts.some(isRingShadow)).toBe(false);
    expect(parts[0]).toContain('inset');
    expect(m.indicator).toBe('0');
    expect((await new AxeBuilder({ page }).include('.shell').analyze()).violations).toEqual([]);
  });

  test('kimlik şeridindeki düğmede çevreleyen halka yoktur', async ({ page }) => {
    const trigger = await ready(page);
    // Tab turns on visible focus mode. Then focus is given directly to the button.
    await page.keyboard.press('Tab');
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await settle(page);
    const m = await trigger.evaluate((btn) => {
      const s = getComputedStyle(btn);
      return {
        mode: document.documentElement.dataset['focusMode'],
        visible: btn.matches(':focus-visible'),
        outline: s.outlineStyle,
        shadow: s.boxShadow,
        indicator: getComputedStyle(btn, '::after').opacity,
      };
    });
    expect(m.mode).toBe('keyboard');
    expect(m.visible).toBe(true);
    expect(m.outline).toBe('none');
    // Single indicator: an inset shadow line on the bottom edge. There is no ring and no second underline.
    const parts = splitShadows(m.shadow);
    expect(parts).toHaveLength(1);
    expect(parts.some(isRingShadow)).toBe(false);
    expect(parts[0]).toContain('inset');
    expect(m.indicator).toBe('0');
  });

  test('reduced motion tercihinde panel hareketsiz açılır', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const trigger = await ready(page);
    await trigger.click();
    const state = await panel(page).evaluate((el) => ({
      running: el.getAnimations({ subtree: true }).length,
      duration: getComputedStyle(el).transitionDuration,
      transform: getComputedStyle(el).transform,
    }));
    expect(state.running).toBe(0);
    expect(state.duration.split(',').every((d) => parseFloat(d) === 0)).toBe(true);
    expect(state.transform).toBe('none');
  });
});

test.describe('telefonda panel düğmesi', () => {
  test.use({ hasTouch: true });
  test('dokunma alanı en az 48 px', async ({ page }) => {
    test.skip(!isCompact(page), 'telefon kabuğu');
    const trigger = await ready(page);
    const m = await trigger.evaluate((el) => {
      const layer = getComputedStyle(el, '::before');
      return {
        w: Math.max(el.getBoundingClientRect().width, parseFloat(layer.width) || 0),
        h: Math.max(el.getBoundingClientRect().height, parseFloat(layer.height) || 0),
      };
    });
    expect(m.w).toBeGreaterThanOrEqual(48);
    expect(m.h).toBeGreaterThanOrEqual(48);
  });
});

test.describe('odak perdesi', () => {
  test('menü ve panel açıkken perde yoktur', async ({ page }) => {
    const trigger = await ready(page);
    await trigger.click();
    await expect(panel(page)).toBeVisible();
    expect(await dimOn(page)).toBe(false);
    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden();

    if (isCompact(page)) {
      await page.getByRole('button', { name: 'Menüyü aç' }).click();
      await expect(page.getByRole('dialog', { name: 'Menü' })).toBeVisible();
      expect(await dimOn(page)).toBe(false);
      return;
    }
    // On wide screens the submenu panel and the workspace menu do not open an overlay.
    await page.goto('/_demo/shell');
    const parent = page.getByRole('button', { name: 'Satış', exact: true });
    await parent.focus();
    await expect(page.getByRole('group', { name: 'Satış' })).toBeVisible();
    await page.waitForTimeout(300);
    expect(await dimOn(page)).toBe(false);
    await page.keyboard.press('Escape');
    const ws = page.locator('.shell-sb [aria-haspopup="menu"]').first();
    await ws.click();
    await expect(page.getByRole('menu').first()).toBeVisible();
    await page.waitForTimeout(300);
    expect(await dimOn(page)).toBe(false);
  });
});

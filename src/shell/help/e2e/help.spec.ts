import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { expect, test } from '../../../../tests/setup/playwright-fixtures';
import { isRingShadow, splitShadows } from '../../../../tests/setup/odak-gostergesi';

/**
 * G-137: yardım kulakçığı ve kendi kendine destek modu.
 * Kayıt sayfası sahte sunucudan gelir. Alan yardım işareti bu sayfada denenir.
 */
const LIST = `/ornek/${encodeURIComponent('örnek-kayıt')}`;
const RECORD = `${LIST}/ORNEK-0003`;
const FIELD = 'Örnek başlık';

/** Yan yana yerleşim için gereken genişlik: sidebar 288 + panel 280 + okunur içerik 600. */
const DOCK_MIN = 288 + 280 + 600;

const tab = (page: Page) => page.getByRole('button', { name: 'Yardım', exact: true });
const panel = (page: Page) => page.locator('#shell-help');
const modeSwitch = (page: Page) => page.getByRole('switch', { name: 'Kendi kendine destek modu' });
const marker = (page: Page) => page.getByRole('button', { name: `${FIELD} alanının yardımı` });

const docked = (page: Page) => {
  const v = page.viewportSize();
  return !!v && v.width >= DOCK_MIN && v.height > 499;
};

async function openRecord(page: Page) {
  await page.goto(RECORD);
  await expect(page.getByRole('textbox', { name: new RegExp(FIELD) })).toHaveValue('Örnek veri 3');
}

async function overflowX(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.beforeEach(async ({ page }) => {
  // Her test kapalı modla başlar. Tercih tarayıcıda saklanır.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('g137-hazir')) {
      localStorage.removeItem('atonota.shell.selfHelp');
      sessionStorage.setItem('g137-hazir', '1');
    }
  });
});

test.describe('yardım kulakçığı', () => {
  test('kulakçık düğmedir; panel açılınca aria-expanded true olur', async ({ page }) => {
    await openRecord(page);
    const t = tab(page);
    await expect(t).toBeVisible();
    await expect(t).toHaveAttribute('aria-expanded', 'false');
    await expect(t).toHaveAttribute('aria-controls', 'shell-help');
    await t.click();
    await expect(t).toHaveAttribute('aria-expanded', 'true');
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByRole('heading', { name: 'Sayfa yardımı' })).toBeVisible();
    await expect(panel(page).getByRole('heading', { name: 'Sık görevler' })).toBeVisible();
    await expect(modeSwitch(page)).toHaveAttribute('aria-checked', 'false');
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
  });

  test('kulakçık sağ kenara yapışıktır ve kaydırmada yerinde kalır', async ({ page }) => {
    await openRecord(page);
    const vw = page.viewportSize()?.width ?? 0;
    const before = await tab(page).boundingBox();
    expect(before).not.toBeNull();
    expect(Math.round((before?.x ?? 0) + (before?.width ?? 0))).toBeGreaterThanOrEqual(vw - 1);
    await page.mouse.wheel(0, 400);
    await page.evaluate(() => window.scrollBy(0, 400));
    const after = await tab(page).boundingBox();
    expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThanOrEqual(1);
  });

  test('Escape paneli kapatır; odak kulakçığa döner', async ({ page }) => {
    await openRecord(page);
    await tab(page).click();
    await expect(panel(page)).toBeVisible();
    // Odak panele taşınır.
    await expect
      .poll(() => page.evaluate(() => !!document.activeElement?.closest('#shell-help')))
      .toBe(true);
    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden();
    await expect(tab(page)).toBeFocused();
    await expect(tab(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('klavyeyle açılır; Space anahtarı değiştirir', async ({ page }) => {
    await openRecord(page);
    await tab(page).focus();
    await page.keyboard.press('Enter');
    await expect(panel(page)).toBeVisible();
    await modeSwitch(page).focus();
    await page.keyboard.press('Space');
    await expect(modeSwitch(page)).toHaveAttribute('aria-checked', 'true');
  });

  test('odak göstergesi çevreleyen halka değildir', async ({ page }) => {
    await openRecord(page);
    await tab(page).focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(tab(page)).toBeFocused();
    const style = await tab(page).evaluate((el) => {
      const s = getComputedStyle(el);
      return { outline: s.outlineStyle, shadow: s.boxShadow };
    });
    expect(style.outline).toBe('none');
    expect(splitShadows(style.shadow).some(isRingShadow)).toBe(false);
  });

  test('dokunmayla açılır ve kapanır', async ({ page }, info) => {
    test.skip(!info.project.use.hasTouch, 'yalnız dokunma profili');
    await openRecord(page);
    await tab(page).tap();
    await expect(panel(page)).toBeVisible();
    await panel(page).getByRole('button', { name: 'Yardımı kapat' }).tap();
    await expect(panel(page)).toBeHidden();
  });
});

test.describe('kendi kendine destek modu', () => {
  test('mod kapalıyken alan işareti yoktur; açılınca alan adıyla görünür', async ({ page }) => {
    await openRecord(page);
    await expect(marker(page)).toHaveCount(0);
    await tab(page).click();
    await modeSwitch(page).click();
    await expect(modeSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await expect(marker(page)).toBeVisible();
    await expect(page.getByRole('button', { name: /sayfanın yardımı$/ })).toBeVisible();
  });

  test('tercih saklanır; sayfa yenilenince mod açık kalır', async ({ page }) => {
    await openRecord(page);
    await tab(page).click();
    await modeSwitch(page).click();
    await page.reload();
    await expect(page.getByRole('textbox', { name: new RegExp(FIELD) })).toBeVisible();
    await expect(marker(page)).toBeVisible();
  });

  test('alan işareti paneli alan yardımıyla açar; Escape odağı işarete döndürür', async ({
    page,
  }) => {
    await openRecord(page);
    await tab(page).click();
    await modeSwitch(page).click();
    await page.keyboard.press('Escape');
    await marker(page).click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByRole('heading', { name: FIELD })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden();
    await expect(marker(page)).toBeFocused();
  });
});

test.describe('sağ yuva ve çekmece', () => {
  test('geniş ekranda panel içerikle yan yana durur', async ({ page }) => {
    test.skip(!docked(page), 'yalnız yan yana sığan genişlik');
    await openRecord(page);
    await tab(page).click();
    await expect(panel(page)).not.toHaveAttribute('role', 'dialog');
    const main = await page.locator('#main').boundingBox();
    const box = await panel(page).boundingBox();
    expect(Math.round((main?.x ?? 0) + (main?.width ?? 0))).toBeLessThanOrEqual(
      Math.round(box?.x ?? 0) + 1,
    );
    // Sayfa etkileşime açık kalır.
    await page.getByRole('textbox', { name: new RegExp(FIELD) }).fill('Yan yana');
    await expect(page.getByRole('textbox', { name: new RegExp(FIELD) })).toHaveValue('Yan yana');
  });

  test('yer yetmezse panel tam ekran çekmece olur', async ({ page }) => {
    test.skip(docked(page), 'yalnız dar yerleşim');
    await openRecord(page);
    await tab(page).click();
    await expect(panel(page)).toHaveAttribute('role', 'dialog');
    await expect(panel(page)).toHaveAttribute('aria-modal', 'true');
    const vp = page.viewportSize();
    await expect
      .poll(async () => {
        const b = await panel(page).boundingBox();
        return b ? [Math.round(b.x), Math.round(b.width), Math.round(b.height)] : null;
      })
      .toEqual([0, vp?.width ?? 0, vp?.height ?? 0]);
    await expect(page.locator('#main')).toHaveAttribute('inert', '');
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
  });

  test('yön değişince açık panel, anahtar ve girdi korunur', async ({ page }) => {
    const vp = page.viewportSize();
    test.skip(!vp || vp.width > 430, 'yalnız dikey telefon');
    await openRecord(page);
    await page.getByRole('textbox', { name: new RegExp(FIELD) }).fill('Yön değişti');
    await tab(page).click();
    await modeSwitch(page).click();
    await modeSwitch(page).focus();
    await page.setViewportSize({ width: vp.height, height: vp.width });
    await expect(panel(page)).toBeVisible();
    await expect(modeSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await expect(modeSwitch(page)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('textbox', { name: new RegExp(FIELD) })).toHaveValue('Yön değişti');
  });
});

test('açık panel axe denetiminden geçer', async ({ page }) => {
  await openRecord(page);
  await tab(page).click();
  await modeSwitch(page).click();
  await expect(panel(page)).toBeVisible();
  const result = await new AxeBuilder({ page })
    .include('#shell-help')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(result.violations).toEqual([]);
});

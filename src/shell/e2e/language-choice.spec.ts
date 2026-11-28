import type { Page } from '@playwright/test';
import { expect, test } from '../../../tests/setup/playwright-fixtures';

/**
 * Language choice (AJA-1772). The page has a half-filled form, an open filter and a draft.
 * The language switch is in the sidebar footer. On a phone it is in the menu drawer.
 * The mock server writes the choice to the user profile and keeps it across a reload.
 */
const DEMO = '/_demo/dil';

/** The mock server reads these keys from session storage on start (`src/mocks`). */
const SCENARIO_KEY = 'atonota.mock-senaryo';
const STORED_LANGUAGE_KEY = 'atonota.mock-dil';

const isCompact = (page: Page) => {
  const v = page.viewportSize();
  return !!v && (v.width <= 767 || v.height <= 499);
};

/** The label follows the UI language: Turkish "Dil", English "Language". */
const LANGUAGE = /^(Dil|Language)$/;

async function languageSelect(page: Page) {
  if (isCompact(page) && !(await page.getByRole('dialog', { name: 'Menü' }).isVisible())) {
    await page.getByRole('button', { name: 'Menüyü aç' }).click();
  }
  const select = page.getByRole('combobox', { name: LANGUAGE });
  await expect(select).toBeVisible();
  return select;
}

/** Opens the list by its visible box. The selected text sits over the search input. */
async function openList(page: Page) {
  await languageSelect(page);
  await page.locator('.shell-lang .ant-select-selector').click();
}

async function choose(page: Page, name: string) {
  await openList(page);
  await page.locator('.ant-select-item-option', { hasText: name }).click();
}

async function closeMenu(page: Page) {
  if (!isCompact(page)) return;
  const drawer = page.getByRole('dialog', { name: 'Menü' });
  if (await drawer.isVisible()) {
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  }
}

async function fillPage(page: Page) {
  await page.getByRole('textbox', { name: 'Konu' }).fill('Yarım kalan talep');
  await page.getByRole('textbox', { name: 'Taslak' }).fill('İlk satır');
  await page.getByRole('searchbox', { name: 'Süzgeç' }).fill('vida');
}

async function expectPageKept(page: Page) {
  await expect(page.getByRole('textbox', { name: 'Konu' })).toHaveValue('Yarım kalan talep');
  await expect(page.getByRole('textbox', { name: 'Taslak' })).toHaveValue('İlk satır');
  await expect(page.getByRole('searchbox', { name: 'Süzgeç' })).toHaveValue('vida');
}

/** Marks the page. A reload clears the mark. */
async function markPage(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { dilIsareti?: number }).dilIsareti = 1;
  });
}

async function pageMark(page: Page) {
  return page.evaluate(() => (window as unknown as { dilIsareti?: number }).dilIsareti);
}

test.describe('dil seçimi (AJA-1772)', () => {
  test('dil değişince adres ve sayfa aynı kalır, seçim profile yazılır', async ({ page }) => {
    await page.goto(DEMO);
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr-TR');
    await fillPage(page);
    const address = page.url();
    await markPage(page);

    await choose(page, 'Deutsch');

    await expect(page.locator('html')).toHaveAttribute('lang', 'de-DE');
    expect(page.url()).toBe(address);
    expect(await pageMark(page)).toBe(1);
    await closeMenu(page);
    await expectPageKept(page);

    // The choice is in the profile. A reopened page comes up in the same language.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de-DE');
    await expect(await languageSelect(page)).toBeVisible();
    await expect(page.locator('.shell-foot .ant-select-selection-item')).toHaveText('Deutsch');
  });

  test('profil kaydı reddedilirse eski dil ve neden görünür, form korunur', async ({ page }) => {
    await page.addInitScript(({ key, value }) => sessionStorage.setItem(key, value), {
      key: SCENARIO_KEY,
      value: 'dil-kaydi-red',
    });
    await page.goto(DEMO);
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr-TR');
    await fillPage(page);
    await markPage(page);

    await choose(page, 'Deutsch');

    await expect(page.getByRole('alert').filter({ hasText: 'Dil değişmedi.' })).toContainText(
      'Bu işlem için izniniz yok.',
    );
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr-TR');
    await expect(page.locator('.shell-foot .ant-select-selection-item')).toHaveText('Türkçe');
    expect(await pageMark(page)).toBe(1);
    await closeMenu(page);
    await expectPageKept(page);
  });
});

test.describe('tarayıcı dili kayıtlı seçimi ezmez', () => {
  test.use({ locale: 'tr-TR' });

  test('profil de-DE, tarayıcı tr-TR ise arayüz Almanca açılır', async ({ page }) => {
    await page.addInitScript(({ key, value }) => sessionStorage.setItem(key, value), {
      key: STORED_LANGUAGE_KEY,
      value: 'de-DE',
    });
    await page.goto(DEMO);
    expect(await page.evaluate(() => navigator.language)).toBe('tr-TR');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de-DE');
    await languageSelect(page);
    await expect(page.locator('.shell-foot .ant-select-selection-item')).toHaveText('Deutsch');
  });
});

test.describe('dil listesi telefonda', () => {
  test('liste markalıdır, yerel select yoktur ve sayfa yatay taşmaz', async ({ page }) => {
    await page.goto(DEMO);
    await openList(page);
    for (const name of ['English (UK)', 'Türkçe', 'Deutsch']) {
      await expect(page.locator('.ant-select-item-option', { hasText: name })).toBeVisible();
    }
    expect(await page.locator('select').count()).toBe(0);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../../../../tests/setup/playwright-fixtures';

const isCompact = (page: Page) => {
  const v = page.viewportSize();
  return !!v && (v.width <= 767 || v.height <= 499);
};

/**
 * Workspace button. On phones the button is inside the menu drawer.
 * Multiple workspaces exist only on the test page. The live panel shows the session's single site.
 */
async function switcher(page: Page) {
  await page.goto('/_demo/shell');
  if (isCompact(page)) {
    await page.getByRole('button', { name: 'Menüyü aç' }).click();
    await expect(page.getByRole('dialog', { name: 'Menü' })).toBeVisible();
  }
  const button = page.locator('button.shell-ws').first();
  await expect(button).toBeVisible();
  return button;
}

const menu = (page: Page) => page.getByRole('menu', { name: 'Çalışma alanları' });

/** Where is the focused element relative to the button? Inside the list, before the button, after it, or no element. */
async function focusAfter(page: Page, button: Locator) {
  return button.evaluate((node) => {
    const active = document.activeElement;
    if (!active || active === document.body) return 'none';
    if (active.closest('.ant-dropdown')) return 'menu';
    if (active === node) return 'button';
    return node.compareDocumentPosition(active) & Node.DOCUMENT_POSITION_FOLLOWING
      ? 'after'
      : 'before';
  });
}

test.describe('çalışma alanı menüsü klavyeyle (Ö8)', () => {
  for (const key of ['Enter', ' ', 'ArrowDown']) {
    test(`${key === ' ' ? 'Space' : key} menüyü açar ve odağı ilk öğeye taşır`, async ({
      page,
    }) => {
      const button = await switcher(page);
      await expect(button).toHaveAttribute('aria-haspopup', 'menu');
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await button.focus();
      await page.keyboard.press(key);

      await expect(menu(page)).toBeVisible();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      const items = menu(page).getByRole('menuitem');
      await expect(items.first()).toBeFocused();
    });
  }

  test('oklar öğeler arasında gezer, Escape kapatır ve odağı düğmeye verir', async ({ page }) => {
    const button = await switcher(page);
    await button.focus();
    await page.keyboard.press('Enter');
    const items = menu(page).getByRole('menuitem');
    await expect(items.first()).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(2)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(items.nth(1)).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(menu(page)).toBeHidden();
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  test('Enter öğeyi seçer, menüyü kapatır ve odağı düğmeye verir', async ({ page }) => {
    const button = await switcher(page);
    await button.focus();
    await page.keyboard.press('Enter');
    const items = menu(page).getByRole('menuitem');
    await expect(items.first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    // The menu moves focus one frame later. Enter is pressed once focus moves to the second item.
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(menu(page)).toBeHidden();
    await expect(button).toBeFocused();
    await expect(button).toContainText('Örnek Şirket B');
  });
});

test.describe('çalışma alanı menüsü: Tab ve fareyle açma (Ö-1, K-1)', () => {
  test('ilk Tab menüyü kapatır ve odağı düğmeden sonraki öğeye taşır', async ({
    page,
    browserName,
  }) => {
    const button = await switcher(page);
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(menu(page).getByRole('menuitem').first()).toBeFocused();

    await page.keyboard.press('Tab');

    await expect(menu(page)).toBeHidden();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    // Focus stays neither in the list nor on the body. It moves to an element after the button on the page.
    expect(await focusAfter(page, button)).toBe('after');
    if (browserName === 'chromium') {
      // Chromium puts buttons in the Tab order. Shift+Tab returns to the button.
      // This shows focus is on the element right after the button.
      await page.keyboard.press('Shift+Tab');
      await expect(button).toBeFocused();
    }
  });

  test('Shift+Tab menüyü kapatır ve odak listede kalmaz', async ({ page }) => {
    const button = await switcher(page);
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(menu(page).getByRole('menuitem').first()).toBeFocused();

    await page.keyboard.press('Shift+Tab');

    await expect(menu(page)).toBeHidden();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    // On desktop the button is the page's first element. Focus then moves to the browser.
    expect(await focusAfter(page, button)).not.toBe('after');
    expect(await focusAfter(page, button)).not.toBe('menu');
  });

  for (const [key, index] of [
    ['ArrowDown', 'first'],
    ['ArrowUp', 'last'],
  ] as const) {
    test(`fareyle açılan menüde ${key} odağı ${index === 'first' ? 'ilk' : 'son'} öğeye taşır`, async ({
      page,
    }) => {
      const button = await switcher(page);
      await button.click();
      await expect(menu(page)).toBeVisible();

      await page.keyboard.press(key);

      const items = menu(page).getByRole('menuitem');
      await expect(index === 'first' ? items.first() : items.last()).toBeFocused();
      await expect(menu(page)).toBeVisible();
    });
  }
});

test.describe('çalışma alanı menüsü: fareyle açılınca Tab (inceleme 2, K-1)', () => {
  for (const key of ['Tab', 'Shift+Tab']) {
    test(`fareyle açılan menüde ilk ${key} menüyü kapatır`, async ({ page }) => {
      const button = await switcher(page);
      await button.click();
      await expect(menu(page)).toBeVisible();

      await page.keyboard.press(key);

      await expect(menu(page)).toBeHidden();
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(await focusAfter(page, button)).not.toBe('menu');
    });
  }

  test('fareyle açılan menüde Tab odağı düğmeden sonraki öğeye taşır', async ({
    page,
    browserName,
  }) => {
    // Chromium focuses the clicked button. WebKit does not; there the focus location is left to the browser.
    test.skip(browserName !== 'chromium', 'Yalnız Chromium tıklanan düğmeye odak verir.');
    const button = await switcher(page);
    await button.click();
    await expect(menu(page)).toBeVisible();
    await expect(button).toBeFocused();

    await page.keyboard.press('Tab');

    await expect(menu(page)).toBeHidden();
    expect(await focusAfter(page, button)).toBe('after');
  });
});

test.describe('çalışma alanı menüsü: fareyle seçim (inceleme 1, K-3)', () => {
  test('fareyle seçimden sonra odak gövdeye düşmez', async ({ page }) => {
    const button = await switcher(page);
    await button.click();
    await expect(menu(page)).toBeVisible();
    const before = await focusAfter(page, button);
    // Did the browser focus the clicked element? Chromium does, WebKit may not.
    await page.evaluate(() => {
      const store = window as unknown as { __focusInMenu: boolean };
      store.__focusInMenu = false;
      document.addEventListener('focusin', (event) => {
        if ((event.target as Element | null)?.closest('.ant-dropdown')) store.__focusInMenu = true;
      });
    });

    await menu(page).getByRole('menuitem').nth(1).click();

    await expect(menu(page)).toBeHidden();
    await expect(button).toContainText('Örnek Şirket B');
    const focusWasInMenu = await page.evaluate(
      () => (window as unknown as { __focusInMenu: boolean }).__focusInMenu,
    );
    if (focusWasInMenu) {
      // Focus was in the list. When the list closes, focus returns to the trigger button.
      await expect(button).toBeFocused();
    } else {
      // Focus was not in the list. The selection does not touch focus.
      expect(await focusAfter(page, button)).toBe(before);
    }
  });
});

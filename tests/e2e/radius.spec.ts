import { expect, test } from '../setup/playwright-fixtures';

test('cards and GenUI use the 21px panel step', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  for (const [path, selector] of [
    ['/administration', '.users-row'],
    ['/_demo/controls', '.ant-card'],
    ['/_demo/genui', '.genui-card'],
  ] as const) {
    await page.goto(path);
    await expect(page.locator(selector).first()).toHaveCSS('border-radius', '21px');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});

test('control sizes stay anchored and the attached Select panel uses 9px', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await page.goto('/_demo/controls');
  for (const size of ['small', 'middle', 'large']) {
    const row = page.getByTestId(`row-${size}`);
    for (const selector of [
      '.ant-btn',
      '.ant-input-affix-wrapper',
      '.ant-select-selector',
      '.ant-input-number',
    ]) {
      await expect(row.locator(selector)).toHaveCSS('border-radius', '5px');
    }
  }
  await expect(page.locator('.ant-checkbox-inner').first()).toHaveCSS('border-radius', '3px');
  await page.getByTestId('row-middle').locator('.ant-select-selector').click();
  const popup = page.locator('.atonota-select-popup:visible');
  await expect(popup).toBeVisible();
  const corners = await popup.evaluate((el) => {
    const style = getComputedStyle(el);
    return [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomLeftRadius,
      style.borderBottomRightRadius,
    ].sort();
  });
  expect(corners).toEqual(['0px', '0px', '9px', '9px']);
  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);
});

test('a direct Ant Design Select also opens a 9px panel', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await page.goto('/_demo/foundation');
  const select = page.getByTestId('select-md');
  await expect(select.locator('.ant-select-selector')).toHaveCSS('border-radius', '5px');
  await select.click();
  await expect(page.locator('.ant-select-dropdown:visible')).toHaveCSS('border-radius', '9px');
});

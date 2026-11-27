import { expect, test, type Locator, type Page } from '../setup/playwright-fixtures';

// AJA-1433 (TE-4): kendi bileşenlerimiz rol, etiket ya da data-testid ile bulunur.
// PO istisnası yalnız köşe ölçümü içindir: Ant Design iç parçalarının rolü yoktur
// (.ant-checkbox-inner, .ant-select-selector gibi). Test önce bileşeni rol, etiket ya da
// test kimliğiyle bulur. Sonra yalnız o bileşene bağlı Ant iç parçasını sınıf adıyla seçer.

/** Açık Select panelini combobox'ın denetlediği listbox üzerinden bulur (Ant iç parçası). */
async function selectPopup(page: Page, combobox: Locator) {
  const listId = await combobox.getAttribute('aria-controls');
  expect(listId).toBeTruthy();
  return page.locator('.ant-select-dropdown', { has: page.locator(`[id="${listId}"]`) });
}

test('GenUI warning icons use the control corner instead of a capsule', async ({ page }) => {
  await page.goto('/panel/ai');
  const prompt = page.getByRole('textbox', { name: 'Asistana mesaj yazın' });
  await prompt.fill('Gecikme riski olan siparişleri bul');
  await prompt.press('Enter');
  const warn = page.getByTestId('genui-warn').first();
  await expect(warn).toBeVisible({ timeout: 15_000 });
  await expect(warn).toHaveCSS('border-radius', '5px');
});

test('GenUI inset surfaces use the inner corner of their card', async ({ page }) => {
  await page.goto('/_demo/genui');
  const review = page.getByRole('group', { name: 'Değişiklik önerisi' }).first();
  const source = review.getByTestId('genui-review-source');
  const geometry = await review.evaluate((el) => {
    const card = getComputedStyle(el);
    return { outer: parseFloat(card.borderRadius), inset: parseFloat(card.paddingLeft) };
  });
  expect(geometry).toEqual({ outer: 21, inset: 12 });
  await expect(source).toHaveCSS('border-radius', `${geometry.outer - geometry.inset}px`);
  await expect(
    page.getByRole('group', { name: 'Kapsam' }).first().getByTestId('genui-scope-list'),
  ).toHaveCSS('border-radius', '9px');
});

test('cards and GenUI use the 21px panel step', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  for (const [path, find] of [
    [
      '/administration',
      (p: Page) => p.getByRole('list', { name: 'Kullanıcı listesi' }).getByRole('button'),
    ],
    ['/_demo/controls', (p: Page) => p.getByTestId('card')],
    ['/_demo/genui', (p: Page) => p.getByRole('group', { name: 'Değişiklik önerisi' })],
  ] as const) {
    await page.goto(path);
    await expect(find(page).first()).toHaveCSS('border-radius', '21px');
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
    await expect(row.getByTestId(`button-${size}`)).toHaveCSS('border-radius', '5px');
    for (const part of [
      // AJA-1433 istisnası: Ant iç parçası, rolle bulunan kontrolle süzülür.
      // `has` iç bulucuyu dış öğeye göre arar. Bu yüzden iç bulucu `page` ile başlar.
      row.locator('.ant-input-affix-wrapper', { has: page.getByRole('textbox', { name: 'Ad' }) }),
      row.locator('.ant-select-selector', { has: page.getByRole('combobox', { name: 'Durum' }) }),
      row.locator('.ant-input-number', { has: page.getByRole('spinbutton', { name: 'Adet' }) }),
    ]) {
      await expect(part).toHaveCSS('border-radius', '5px');
    }
  }
  await expect(
    page
      .locator('.ant-checkbox', { has: page.getByRole('checkbox', { name: 'Seç' }) })
      .locator('.ant-checkbox-inner'),
  ).toHaveCSS('border-radius', '3px');
  const middle = page.getByTestId('row-middle');
  const combobox = middle.getByRole('combobox', { name: 'Durum' });
  await middle
    .locator('.ant-select-selector', { has: page.getByRole('combobox', { name: 'Durum' }) })
    .click();
  const popup = await selectPopup(page, combobox);
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
  await expect(popup).toBeHidden();
});

test('a direct Ant Design Select also opens a 9px panel', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await page.goto('/_demo/foundation');
  const select = page.getByTestId('select-md');
  const combobox = select.getByRole('combobox', { name: 'Boyut' });
  // AJA-1433 istisnası: Ant iç parçası, test kimliğiyle bulunan Select içinde seçilir.
  await expect(select.locator('.ant-select-selector')).toHaveCSS('border-radius', '5px');
  await select.click();
  const popup = await selectPopup(page, combobox);
  await expect(popup).toBeVisible();
  await expect(popup).toHaveCSS('border-radius', '9px');
});

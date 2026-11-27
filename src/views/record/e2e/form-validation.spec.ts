import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '../../../../tests/setup/playwright-fixtures';

const FORM = '/src/views/record/harness/?scenario=leave';

test('leave sections announce errors and focus the first invalid field on every submit', async ({
  page,
}) => {
  await page.goto(FORM);
  await expect(page.getByRole('heading', { name: 'Yeni izin talebi' })).toBeVisible();
  for (const name of ['Kişi bilgisi', 'İzin bilgisi']) {
    await expect(page.getByRole('region', { name }).getByRole('heading', { name })).toBeVisible();
  }
  const submit = page.getByRole('button', { name: 'Talebi gönder' });
  await submit.click();
  const type = page.getByRole('combobox', { name: /İzin türü/ });
  await expect(type).toBeFocused();
  await expect(page.getByRole('status')).toHaveText('3 alanda hata var.');
  await submit.click();
  await expect(type).toBeFocused();
  await type.press('ArrowDown');
  await type.press('Enter');
  await expect(type).not.toHaveAttribute('aria-invalid', 'true');
  await submit.click();
  const start = page.getByLabel(/Başlangıç tarihi/);
  await expect(start).toBeFocused();
  await expect(page.getByRole('status').filter({ hasText: 'alanda hata var.' })).toHaveText(
    '2 alanda hata var.',
  );
  // Tarih alanı markalı seçicidir (panel sorunu 3). Tarih kullanıcının biçimiyle yazılır.
  await start.fill('27.11.2026');
  await start.press('Enter');
  await expect(start).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel(/Bitiş tarihi/)).toHaveAttribute('aria-invalid', 'true');
});

for (const theme of ['light', 'dark']) {
  test(`leave errors remain readable and accessible (${theme})`, async ({ page }, testInfo) => {
    await page.goto(`${FORM}&theme=${theme}`);
    await page.getByRole('button', { name: 'Talebi gönder' }).click();
    await expect(page.getByRole('status')).toHaveText('3 alanda hata var.');
    const checks = await page.locator('.rv-root').evaluate((root) => {
      const visibleText = [...root.querySelectorAll<HTMLElement>('*')].filter(
        (el) =>
          el.getClientRects().length &&
          [...el.childNodes].some(
            (child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
          ),
      );
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        smallText: visibleText
          .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 14)
          .map((el) => el.textContent),
        font: getComputedStyle(root).fontFamily,
        shortControls:
          root.getAttribute('data-rv-viewport') === 'phone'
            ? [...root.querySelectorAll('.ant-btn, .ant-select-selector, .ant-picker')]
                .filter((el) => el.getBoundingClientRect().height < 48)
                .map((el) => el.className)
            : [],
        errors: [...root.querySelectorAll('.rv-field-error')].map((error) => {
          const field = error.closest('.rv-field');
          const control = field?.querySelector('[aria-invalid="true"]');
          if (!field || !control || !error.previousElementSibling)
            throw new Error('Missing field error association');
          const box = error.getBoundingClientRect();
          const controlBox = error.previousElementSibling.getBoundingClientRect();
          return {
            linked: control.getAttribute('aria-describedby')?.split(' ').includes(error.id),
            below: box.top >= controlBox.bottom,
            sameSection: error.closest('section') === control.closest('section'),
          };
        }),
      };
    });
    expect(checks.overflow).toBeLessThanOrEqual(0);
    expect(checks.smallText).toEqual([]);
    expect(checks.font).toContain('Outfit');
    expect(checks.shortControls).toEqual([]);
    expect(checks.errors).toEqual(
      Array.from({ length: 3 }, () => ({ linked: true, below: true, sameSection: true })),
    );
    const results = await new AxeBuilder({ page }).include('.rv-root').analyze();
    expect(results.violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`leave-errors-${theme}.png`),
      fullPage: true,
    });
  });
}

test('keyboard error focus has one underline and no surrounding ring', async ({ page }) => {
  await page.goto(FORM);
  await expect(page.getByRole('button', { name: 'Talebi gönder' })).toBeVisible();
  const type = page.getByRole('combobox', { name: /İzin türü/ });
  const restingBorder = await type.evaluate((el) => {
    const selector = el.closest('.ant-select')?.querySelector('.ant-select-selector');
    if (!selector) throw new Error('Missing select surface');
    return getComputedStyle(selector).borderColor;
  });
  await page.keyboard.press('Tab');
  await page.getByRole('button', { name: 'Talebi gönder' }).press('Enter');
  await expect(type).toBeFocused();
  await expect(page.locator('.rv-root')).toHaveAttribute('data-rv-kbd', 'true');
  await expect(page.locator('.ant-select')).toHaveClass(/ant-select-focused/);
  const focus = await type.evaluate(async (el) => {
    const selector = el.closest('.ant-select')?.querySelector('.ant-select-selector');
    if (!selector) throw new Error('Missing select surface');
    selector.getBoundingClientRect();
    await Promise.all(selector.getAnimations().map((animation) => animation.finished));
    const style = getComputedStyle(selector);
    return { outline: style.outlineStyle, shadow: style.boxShadow, border: style.borderColor };
  });
  expect(focus.outline).toBe('none');
  expect(focus.shadow).toContain('inset');
  expect(focus.border).toBe(restingBorder);
  await page.keyboard.press('Tab');
  await expect(page.getByLabel(/Başlangıç tarihi/)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(type).toBeFocused();
});

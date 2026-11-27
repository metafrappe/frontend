import type { Page } from '@playwright/test';
import { expect, test } from '../../../tests/setup/playwright-fixtures';

/**
 * Multi-line text field on the record page. The record comes from the mock server.
 * The backend sends the `text-area` component name for a Small Text field. The mock server's definition does the same.
 */
const RECORD = `/ornek/${encodeURIComponent('örnek-kayıt')}/ORNEK-0003`;

async function overflowX(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe('kayıt sayfası: Small Text alanı', () => {
  test('Small Text alanı "Desteklenmeyen alan" yazmaz; çok satırlı metin kutusu olur', async ({
    page,
  }) => {
    await page.goto(RECORD);
    await expect(page.getByRole('textbox', { name: /Örnek başlık/ })).toHaveValue('Örnek veri 3');
    await expect(page.getByText(/Desteklenmeyen alan/)).toHaveCount(0);
    const box = page.getByRole('textbox', { name: /Açıklama/ });
    await expect(box).toBeVisible();
    expect(await box.evaluate((el) => el.tagName)).toBe('TEXTAREA');
    await expect(box).toHaveValue('Örnek veri 3 için açıklama.\nİkinci satır.');
    await box.focus();
    // The caret is placed at the end of the text. The End key only goes to the end of the line.
    await box.evaluate((el: HTMLTextAreaElement) =>
      el.setSelectionRange(el.value.length, el.value.length),
    );
    await page.keyboard.type(' Ek');
    await expect(box).toHaveValue('Örnek veri 3 için açıklama.\nİkinci satır. Ek');
    await expect(page.getByText('1 kaydedilmemiş değişiklik')).toBeVisible();
    const fontSize = await box.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(14);
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
  });
});

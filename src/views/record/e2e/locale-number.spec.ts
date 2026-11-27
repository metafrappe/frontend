import type { Page } from '@playwright/test';

import { expect, test } from '../../../../tests/setup/playwright-fixtures';

/**
 * Locale number entry in a real browser (AJA-1765). The first project is 320 CSS px wide.
 * The region comes from a fake boot data value until AJA-1732 brings the real field.
 */
const FORM = '/src/views/record/harness/?scenario=number';

const amount = (page: Page) =>
  page.getByRole('textbox', { name: /Amount/ });

test('fr-FR: 1 234,56 is saved as 1234.56 and reopens as the same text', async ({ page }) => {
  await page.goto(`${FORM}&region=fr-FR`);
  const typed = await page.evaluate(() =>
    new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(1234.56),
  );
  await amount(page).fill(typed);
  await amount(page).blur();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(() => page.evaluate(() => window.sessionStorage.getItem('atonota-harness-number')))
    .toContain('"amount":1234.56');

  await page.goto(`${FORM}&region=fr-FR&open=1`);
  await expect(amount(page)).toHaveValue(typed);
  // The field fits the narrow screen. The page does not scroll sideways.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('de-DE: 1.234,56 gives the same value', async ({ page }) => {
  await page.goto(`${FORM}&region=de-DE`);
  await amount(page).fill('1.234,56');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(() => page.evaluate(() => window.sessionStorage.getItem('atonota-harness-number')))
    .toContain('"amount":1234.56');
});

test('an ambiguous value is not saved and the screen asks the user', async ({ page }) => {
  await page.goto(`${FORM}&region=de-DE`);
  await amount(page).fill('1.234');
  await amount(page).blur();
  const question = page.getByRole('group', { name: 'Which number did you mean?' });
  await expect(question).toBeVisible();
  await expect(amount(page)).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: 'Save' }).click();
  expect(
    await page.evaluate(() => window.sessionStorage.getItem('atonota-harness-number')),
  ).toBeNull();

  // Both choices stay inside the screen at 320 CSS px.
  const width = page.viewportSize()?.width ?? 0;
  for (const name of ['1.234,00', '1,23']) {
    const box = await question.getByRole('button', { name }).boundingBox();
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
  }
  await question.getByRole('button', { name: '1.234,00' }).click();
  await expect(amount(page)).toHaveValue('1.234,00');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(() => page.evaluate(() => window.sessionStorage.getItem('atonota-harness-number')))
    .toContain('"amount":1234');
});

test('keeps the draft after a save error', async ({ page }) => {
  await page.goto(`${FORM}&region=fr-FR&fail=1`);
  await amount(page).fill('1 234,56');
  await amount(page).blur();
  const shown = await amount(page).inputValue();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(amount(page)).toHaveValue(shown);
});

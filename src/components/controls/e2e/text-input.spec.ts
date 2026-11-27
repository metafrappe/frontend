import { expect, test } from '../../../../tests/setup/playwright-fixtures';

// Text input rules (AJA-1764, G-73). The demo route opens only in the e2e build.
const demo = '/_demo/controls';
const HINDI = 'क्षि';
const FAMILY = '👩‍👩‍👧';

test.describe('text input rules', () => {
  test('the counter counts perceived characters and cuts at a character boundary', async ({
    page,
  }) => {
    await page.goto(demo);
    const field = page.getByLabel('Kısa not');
    const form = page.getByTestId('text-form');
    await field.fill(`${HINDI}${FAMILY}é`);
    await expect(form.locator('.ant-input-show-count-suffix')).toContainText('3 / 10');
    await expect(form.getByRole('status')).toHaveText('7 characters remaining');

    await field.fill(`abcdefghi${FAMILY}${HINDI}`);
    await expect(field).toHaveValue(`abcdefghi${FAMILY}`);
    await expect(form.getByRole('status')).toHaveText('0 characters remaining');

    // The page does not overflow sideways, even at 320 CSS px.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('Enter submits once, and not while the candidate window is open', async ({ page }) => {
    await page.goto(demo);
    const field = page.getByLabel('Kısa not');
    const count = page.getByTestId('submit-count');
    await field.fill('日本');

    const cancelled = await field.evaluate((element) => {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: true,
        bubbles: true,
        cancelable: true,
      });
      return !element.dispatchEvent(event);
    });
    expect(cancelled).toBe(true);
    await expect(count).toHaveText('0');

    await field.press('Enter');
    await expect(count).toHaveText('1');
  });
});

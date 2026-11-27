import { expect, test } from '../../../../tests/setup/playwright-fixtures';

/**
 * Confirm card at 320 CSS px with the hardest button text (AJA-1859).
 * German button text is long and has long compound words. The UI has no German yet,
 * so the test writes a German text into the buttons. The card must not overflow.
 */
const STUDIO = '/panel/ai';

const LONG_APPROVE =
  'Bestellungsänderung verbindlich bestätigen und Lieferantenbenachrichtigung senden';
const LONG_REJECT = 'Abbrechen und Bestellungsänderung verwerfen';

test.describe('onay kartı dar alanda', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) > 320, 'Yalnız 320 CSS px genişlikte koşar.');

  test('uzun düğme metni kartı taşırmaz ve kırpılmaz', async ({ page }) => {
    await page.goto(STUDIO);
    const box = page.getByRole('textbox', { name: 'Asistana mesaj yazın' });
    await box.fill('Gecikme riski olan siparişleri bul');
    await box.press('Enter');
    const card = page.locator('[data-genui="confirm"]');
    await expect(card).toBeVisible({ timeout: 15_000 });

    const buttons = card.locator('.genui-actions button');
    await expect(buttons).toHaveCount(2);
    await buttons
      .nth(0)
      .locator('span:last-child')
      .evaluate((el, text) => {
        el.textContent = text;
      }, LONG_APPROVE);
    await buttons
      .nth(1)
      .locator('span:last-child')
      .evaluate((el, text) => {
        el.textContent = text;
      }, LONG_REJECT);

    // Visible boxes are measured. `scrollWidth` would also count the invisible touch layer
    // (`::after`) that the touch area engine draws around a button.
    const report = await card.evaluate((el) => {
      const cardBox = el.getBoundingClientRect();
      const items = [...el.querySelectorAll<HTMLElement>('.genui-actions button')].map((button) => {
        const label = button.querySelector<HTMLElement>('span:last-child') ?? button;
        const rect = button.getBoundingClientRect();
        const text = label.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          textInside: text.left >= rect.left - 0.5 && text.right <= rect.right + 0.5,
          clipped: label.scrollWidth > label.clientWidth + 1,
          fontSize: parseFloat(getComputedStyle(label).fontSize),
        };
      });
      return {
        cardLeft: cardBox.left,
        cardRight: cardBox.right,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        items,
      };
    });

    expect(report.pageOverflow, 'sayfa yatay taşmaz').toBeLessThanOrEqual(0);
    for (const item of report.items) {
      expect(item.left, 'düğme kartın içinde başlar').toBeGreaterThanOrEqual(report.cardLeft - 0.5);
      expect(item.right, 'düğme kartın içinde biter').toBeLessThanOrEqual(report.cardRight + 0.5);
      expect(item.textInside, 'düğme metni düğmenin içindedir').toBe(true);
      expect(item.clipped, 'düğme metni kırpılmaz').toBe(false);
      expect(item.fontSize, 'düğme metni 14 CSS px altına inmez').toBeGreaterThanOrEqual(14);
    }
  });
});

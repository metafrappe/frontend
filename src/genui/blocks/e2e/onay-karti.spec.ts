import AxeBuilder from '@axe-core/playwright';

import { expect, test } from '../../../../tests/setup/playwright-fixtures';

/**
 * Confirm card in the browser (AJA-1157). The card comes from a fake assistant reply.
 * The fake reply has no risk level, so the card behaves as R1.
 * `ConfirmView.test.tsx` checks R2 and R3 behaviour.
 */
const STUDIO = '/panel/ai';

test.describe('onay kartı', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(STUDIO);
    const box = page.getByRole('textbox', { name: 'Asistana mesaj yazın' });
    await box.fill('Gecikme riski olan siparişleri bul');
    await box.press('Enter');
    await expect(page.locator('[data-genui="confirm"]')).toBeVisible({ timeout: 15_000 });
  });

  test('düğmeler dokunma alanını karşılar, "Geri al" düğmesi yoktur', async ({ page }) => {
    const card = page.locator('[data-genui="confirm"]');
    await expect(card).toHaveAttribute('data-risk', 'R1');
    await expect(card.getByText('R1 Düşük')).toBeVisible();
    await expect(card.getByText(/%/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Geri al' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Geri almayı öner' })).toHaveCount(0);

    const coarse = await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches);
    const min = coarse ? 48 : 44;
    for (const name of ['Gönder', 'Vazgeç']) {
      const button = card.getByRole('button', { name });
      const height = await button.evaluate((el) => el.getBoundingClientRect().height);
      expect(height, `${name} yüksekliği`).toBeGreaterThanOrEqual(min);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .include('[data-genui="confirm"]')
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('klavyeyle "Vazgeç" seçilir', async ({ page, browserName }) => {
    const card = page.locator('[data-genui="confirm"]');
    const reject = card.getByRole('button', { name: 'Vazgeç' });
    await card.getByRole('button', { name: 'Gönder' }).focus();
    // WebKit, like Safari, does not reach buttons with plain Tab. This browser uses Alt+Tab.
    await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
    await expect(reject).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(card.getByRole('status')).toHaveText('Vazgeçtiniz. Hiçbir işlem yapılmadı.');
  });

  test('dokunma ya da fareyle "Gönder" seçilir', async ({ page, isMobile }) => {
    const card = page.locator('[data-genui="confirm"]');
    const send = card.getByRole('button', { name: 'Gönder' });
    if (isMobile) await send.tap();
    else await send.click();
    await expect(card.getByRole('status')).toContainText('Onayınız gönderildi.');
  });
});

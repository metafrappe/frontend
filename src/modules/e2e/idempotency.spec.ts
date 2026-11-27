import { expect, test, type Page } from '../../../tests/setup/playwright-fixtures';
import AxeBuilder from '@axe-core/playwright';

// Deneme yolu yalnız e2e derlemesinde açılır (src/shell/routes.ts). Sunucu sahtedir.
const demo = '/_demo/idempotency';

/**
 * Opens the demo page once. Every test gets a new browser context, so storage starts empty.
 * The page is not reloaded: in WebKit a reload can be interrupted or leave a blank page.
 * With `hold`, the fake request waits until the test releases it. The setting exists before the page loads.
 */
async function open(page: Page, { hold = false } = {}) {
  if (hold) {
    await page.addInitScript(() => {
      (window as Window & { __idempotencyDemoHold?: boolean }).__idempotencyDemoHold = true;
    });
  }
  await page.goto(demo);
  await expect(page.getByRole('button', { name: 'Kayıt aç' })).toBeVisible();
}

test('a double press sends one request and the button says it is processing', async ({ page }) => {
  // The fake request waits until the test lets it finish. No timer decides the result.
  await open(page, { hold: true });
  const button = page.getByRole('button', { name: 'Kayıt aç' });
  await button.dblclick();
  const busy = page.getByRole('button', { name: 'İşleniyor' });
  await expect(busy).toHaveAttribute('aria-busy', 'true');
  // Playwright `click()` waits for the button to settle. The event is sent at once instead.
  await busy.dispatchEvent('click');
  await expect(page.getByTestId('request-count')).toHaveText('Gönderilen istek: 1');
  await expect(busy).toHaveAttribute('aria-busy', 'true');
  await page.evaluate(() => {
    const release = (window as Window & { __idempotencyDemoRelease?: () => void })
      .__idempotencyDemoRelease;
    if (!release) throw new Error('The demo page has no release hook.');
    release();
  });
  await expect(page.getByText('İşlem tamam.')).toBeVisible();
  await expect(page.getByTestId('request-count')).toHaveText('Gönderilen istek: 1');
});

test('a change in another tab shows the conflict message', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Başka sekmede değiştir' }).click();
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.getByText('Bu kayıt siz açtıktan sonra değişti.')).toBeVisible();
  await expect(page.getByTestId('ticket-subject')).toHaveText('Yazıcı açılmıyor');
});

test('the screen fits, keeps text at 14 px and passes axe', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Başka sekmede değiştir' }).click();
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.getByText('Bu kayıt siz açtıktan sonra değişti.')).toBeVisible();
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
  });
  const report = await page.evaluate(() => {
    const root = document.querySelector('.module-page');
    const small: string[] = [];
    const anywhere: string[] = [];
    for (const element of root ? root.querySelectorAll<HTMLElement>('*') : []) {
      const style = getComputedStyle(element);
      const hasText = [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      );
      if (hasText && parseFloat(style.fontSize) < 14) small.push(element.tagName);
      if (/^(H[1-6]|TD|TH)$/.test(element.tagName) && style.overflowWrap === 'anywhere')
        anywhere.push(element.tagName);
    }
    return {
      fits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      small,
      anywhere,
    };
  });
  expect(report).toEqual({ fits: true, small: [], anywhere: [] });
  expect((await new AxeBuilder({ page }).include('.module-page').analyze()).violations).toEqual([]);
});

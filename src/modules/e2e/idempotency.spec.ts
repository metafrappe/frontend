import { expect, test } from '../../../tests/setup/playwright-fixtures';
import AxeBuilder from '@axe-core/playwright';

// Deneme yolu yalnız e2e derlemesinde açılır (src/shell/routes.ts). Sunucu sahtedir.
const demo = '/_demo/idempotency';

test.beforeEach(async ({ page }) => {
  await page.goto(demo);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test('a double press sends one request and the button says it is processing', async ({ page }) => {
  const button = page.getByRole('button', { name: 'Kayıt aç' });
  await button.dblclick();
  const busy = page.getByRole('button', { name: 'İşleniyor' });
  await expect(busy).toHaveAttribute('aria-busy', 'true');
  // Playwright `click()` waits for the button to settle; by then the first request may be done.
  // The event is sent at once so the press really happens while the request is pending.
  await busy.dispatchEvent('click');
  await expect(page.getByTestId('request-count')).toHaveText('Gönderilen istek: 1');
  await expect(page.getByText('İşlem tamam.')).toBeVisible();
  await expect(page.getByTestId('request-count')).toHaveText('Gönderilen istek: 1');
});

test('a change in another tab shows the conflict message', async ({ page }) => {
  await page.getByRole('button', { name: 'Başka sekmede değiştir' }).click();
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.getByText('Bu kayıt siz açtıktan sonra değişti.')).toBeVisible();
  await expect(page.getByTestId('ticket-subject')).toHaveText('Yazıcı açılmıyor');
});

test('the screen fits, keeps text at 14 px and passes axe', async ({ page }) => {
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

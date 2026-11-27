import { expect, test } from '../setup/playwright-fixtures';

// In-browser mock server (MSW) tests. The build is made with `VITE_API_MOCKS=on`.

test('sahte sunucu açıkken ekranda “Örnek veri” yazar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('status').filter({ hasText: 'Örnek veri' })).toBeVisible();
});

test('kayıtlı API ucu sahte sunucudan yanıt alır', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('status').filter({ hasText: 'Örnek veri' })).toBeVisible();

  const user = await page.evaluate(async () => {
    const response = await fetch('/api/method/frappe.auth.get_logged_user');
    return ((await response.json()) as { message: string }).message;
  });

  expect(user).toBe('ornek.kisi@example.test');
});

test('eşleşmeyen API isteği arka uca ulaşmaz', async ({ page, context }) => {
  const reachedNetwork: string[] = [];
  await context.route('**/api/**', async (route) => {
    reachedNetwork.push(route.request().url());
    await route.abort();
  });
  await page.goto('/');
  await expect(page.getByRole('status').filter({ hasText: 'Örnek veri' })).toBeVisible();

  // MSW does not pass an unmatched request to the network. It ends it with an error response or a network error.
  const status = await page.evaluate(async () => {
    try {
      return (await fetch('/api/method/bilinmeyen.uc')).status;
    } catch {
      return 0;
    }
  });

  expect(status === 0 || status >= 500).toBe(true);
  expect(reachedNetwork).toEqual([]);
});

test('sayfa yenilenince ve ikinci sayfa açılınca panel yine açılır', async ({ page }) => {
  // While the worker controls the page, page and static file requests must pass through unchanged.
  // The old "error" rule left only a JSON error text on the second load.
  await page.goto('/');
  await expect(page.getByRole('status').filter({ hasText: 'Örnek veri' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: 'Örnek veri' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Bekleyenler' })).toBeVisible();
  await page.goto('/account');
  await expect(page.getByRole('heading', { level: 1, name: 'Hesap', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Hesap', exact: true })).toBeVisible();
  expect(await page.locator('body').innerText()).not.toContain('Cannot bypass');
});

test('sahte sunucu açıkken modül sayfası veri kipini “Örnek veri” gösterir', async ({ page }) => {
  await page.goto('/account');
  await expect(page.getByRole('heading', { level: 1, name: 'Hesap', exact: true })).toBeVisible();
  const mode = page.locator('.module-page dt', { hasText: 'Mod' }).locator('+ dd');
  await expect(mode).toHaveText('Örnek veri');
  await expect(page.locator('.module-page')).not.toContainText('Canlı veri');
});

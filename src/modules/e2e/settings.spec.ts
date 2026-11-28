// G-97 parça 1 (AJA-2491): kiracı ayarları ve marka ekranı.
// Form elle yazılmaz. Kayıt katmanı formu türün şemasından çizer. Sahte sunucu `src/mocks/settings.ts`.
// Rol kapısı `tests/e2e/rol-*.spec.ts` dosyalarında denetlenir.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '../../../tests/setup/playwright-fixtures';

async function open(page: Page, path: string, title: string) {
  await page.goto(path);
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
}

async function noPageOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test('genel ayarlar dil, saat dilimi, biçim, oturum ve e-posta bilgisini gösterir', async ({
  page,
}) => {
  await open(page, '/settings', 'Genel ayarlar');
  for (const section of ['Dil ve bölge', 'Biçimler', 'Oturum', 'E-posta']) {
    await expect(page.getByRole('heading', { name: section, level: 2 })).toBeVisible();
  }
  await expect(page.getByLabel('Oturum süresi (saat:dakika)')).toHaveValue('06:00');
  // E-posta alan adı ve hesabı yalnız görünür. Kiracı yöneticisi bunları değiştiremez.
  const email: [string, string][] = [
    ['E-posta alan adı', 'kiraci.example.test'],
    ['Giden e-posta hesabı', 'bildirim@kiraci.example.test'],
  ];
  for (const [label, value] of email) {
    const box = page.getByRole('textbox', { name: label });
    await expect(box).toHaveValue(value);
    await expect(box).not.toBeEditable();
  }
  await noPageOverflow(page);
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(axe.violations).toEqual([]);
});

test('kiracı yöneticisi oturum süresini değiştirir ve kaydeder', async ({ page }) => {
  await open(page, '/settings', 'Genel ayarlar');
  const field = page.getByLabel('Oturum süresi (saat:dakika)');
  await field.fill('04:00');
  const write = page.waitForRequest(
    (request) =>
      request.method() === 'PUT' && request.url().includes('/api/resource/Tenant%20Settings/'),
  );
  await page.getByRole('button', { name: 'Ayarları kaydet' }).click();
  const body = (await write).postDataJSON() as Record<string, unknown>;
  expect(body['session_expiry']).toBe('04:00');
  // Salt okunur e-posta alanları kayıt isteğine girmez.
  expect(body).not.toHaveProperty('email_domain');
  await expect(field).toHaveValue('04:00');
});

test('marka sayfası logo ve renk tokenlarını kayıt formuyla açar', async ({ page }) => {
  await open(page, '/settings/branding', 'Marka');
  await expect(page.getByRole('heading', { name: 'Logo', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Renkler', level: 2 })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Logo/ })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Ana renk' })).toHaveValue('#1F6F5C');
  await expect(page.getByRole('textbox', { name: 'Vurgu rengi' })).toHaveValue('#B35C1E');
  await noPageOverflow(page);
});

test('uygulama ayar türü aynı form katmanıyla açılır', async ({ page }) => {
  await open(page, '/settings/hr', 'İK ayarları');
  await expect(page.getByRole('checkbox', { name: 'İzin onayında bildirim gönder' })).toBeChecked();
  await noPageOverflow(page);
});

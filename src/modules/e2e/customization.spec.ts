// G-97 parça 2 (AJA-2492): "Özelleştirme" sayfası. Test koddan önce yazıldı.
// Kiracı yöneticisi alan ekler, alanı yeniden adlandırır ya da gizler ve kenar menüsünü düzenler.
// Formları kayıt katmanı (`src/views/record`) türün tanımından çizer.
// Sahte sunucu `src/mocks/customization.ts` dosyasındadır.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '../../../tests/setup/playwright-fixtures';
import { MOCK_SCENARIO_KEY } from '@/mocks/scenarios';

const PATH = '/administration/customization';
const TITLE = 'Özelleştirme';
const DOCTYPE = 'Örnek Kayıt';

/** antd Select'i yalnız klavyeyle seçer: odak, aşağı ok ve Enter. */
async function chooseByKeyboard(page: Page, label: string, option: string) {
  const input = page.getByLabel(label, { exact: true });
  await input.focus();
  await page.keyboard.press('ArrowDown');
  const item = page.locator('.ant-select-item-option', { hasText: option }).last();
  await expect(item).toBeVisible();
  for (let step = 0; step < 10; step += 1) {
    if ((await item.getAttribute('class'))?.includes('ant-select-item-option-active')) break;
    await page.keyboard.press('ArrowDown');
  }
  await page.keyboard.press('Enter');
  await expect(page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')).toHaveCount(
    0,
  );
}

async function openDoctype(page: Page) {
  await page.goto(PATH);
  await expect(page.getByRole('heading', { name: TITLE, level: 1 })).toBeVisible();
  await chooseByKeyboard(page, 'Belge türü', DOCTYPE);
  await expect(page.getByRole('list', { name: 'Alanlar', exact: true })).toBeVisible();
}

function fieldRow(page: Page, label: string) {
  return page
    .getByRole('list', { name: 'Alanlar', exact: true })
    .getByRole('listitem')
    .filter({ has: page.getByText(label, { exact: true }) });
}

async function expectNoPageOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(layout.page).toBeLessThanOrEqual(layout.viewport);
}

test('yönetici alan listesini taşmadan görür ve axe geçer', async ({ page }) => {
  await openDoctype(page);
  await expect(fieldRow(page, 'Açıklama')).toBeVisible();
  await expectNoPageOverflow(page);
  const fontSizes = await page.locator('.module-page').evaluate((root) =>
    Array.from(root.querySelectorAll('p, h1, h2, h3, label, button, li'))
      .filter((element) => (element.textContent ?? '').trim().length > 0)
      .map((element) => parseFloat(getComputedStyle(element).fontSize)),
  );
  expect(Math.min(...fontSizes)).toBeGreaterThanOrEqual(14);
  const results = await new AxeBuilder({ page }).include('.module-page').analyze();
  expect(results.violations).toEqual([]);
});

test('sistem alanında değiştirme düğmesi yoktur (kabul ölçütü 3)', async ({ page }) => {
  await openDoctype(page);
  const system = fieldRow(page, 'Örnek başlık');
  await expect(system.getByText('Sistem alanı. Bu alan değiştirilemez.')).toBeVisible();
  await expect(system.getByRole('button')).toHaveCount(0);
});

test('yönetici yeni alan ekler (kabul ölçütü 1)', async ({ page }) => {
  await openDoctype(page);
  await page.getByRole('button', { name: 'Alan ekle' }).click();
  await expect(page.getByRole('heading', { name: 'Yeni alan' })).toBeVisible();
  await page.getByLabel(/^Etiket/).fill('Müşteri numarası');
  await page.getByRole('button', { name: 'Alanı ekle' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Alan eklendi.' })).toBeVisible();
  await expect(fieldRow(page, 'Müşteri numarası')).toBeVisible();
  await expectNoPageOverflow(page);
});

test('yönetici alanı yeniden adlandırır (kabul ölçütü 2)', async ({ page }) => {
  await openDoctype(page);
  await fieldRow(page, 'Açıklama').getByRole('button', { name: 'Yeniden adlandır' }).click();
  await expect(page.getByRole('heading', { name: 'Alanı yeniden adlandır' })).toBeVisible();
  await page.getByLabel(/^Yeni ad/).fill('Not');
  await page.getByRole('button', { name: 'Adı kaydet' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Alanın adı değişti.' })).toBeVisible();
  await expect(fieldRow(page, 'Not')).toBeVisible();
});

test('yönetici alanı klavyeyle gizler ve yeniden gösterir (kabul ölçütü 2)', async ({ page }) => {
  await openDoctype(page);
  const hide = fieldRow(page, 'Açıklama').getByRole('button', { name: 'Gizle' });
  await hide.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'Alan gizlendi.' })).toBeVisible();
  const row = fieldRow(page, 'Açıklama');
  await expect(row.getByText('Gizli', { exact: true })).toBeVisible();
  await row.getByRole('button', { name: 'Göster' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Alan görünür oldu.' })).toBeVisible();
  await expect(fieldRow(page, 'Açıklama').getByText('Gizli', { exact: true })).toHaveCount(0);
});

test('yönetici kenar menüsünü düzenler (kabul ölçütü 4)', async ({ page }) => {
  await page.goto(PATH);
  const menu = page.getByRole('list', { name: 'Çalışma alanları' });
  const row = menu.getByRole('listitem').filter({ hasText: 'İnsan kaynakları' });
  await row.getByRole('button', { name: 'Düzenle' }).click();
  await page.getByLabel(/^Başlık/).fill('Personel');
  await page.getByRole('button', { name: 'Menüyü kaydet' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Menü kaydedildi.' })).toBeVisible();
  await expect(menu.getByRole('listitem').filter({ hasText: 'Personel' })).toBeVisible();
  await expectNoPageOverflow(page);
});

test('yetkisi olmayan kullanıcı sayfayı açamaz (kabul ölçütü 5)', async ({ page }) => {
  await page.addInitScript(([key, value]) => sessionStorage.setItem(key, value), [
    MOCK_SCENARIO_KEY,
    'rol-tenant-admin-assistant',
  ] as const);
  await page.goto(PATH);
  await expect(page.getByText(/Bu sayfayı açma yetkiniz yok/)).toBeVisible();
  await expect(page.getByRole('heading', { name: TITLE, level: 1 })).toHaveCount(0);
});

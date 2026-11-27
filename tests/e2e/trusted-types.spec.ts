import { expect, test } from '../setup/playwright-fixtures';

/** GV-2 ve GV-6: içerik güvenlik politikası yayımlanan yanıtta sınanır (AJA-2283). */
test('önizleme yanıtı Trusted Types başlığını rapor kipinde gönderir', async ({ page }) => {
  const response = await page.goto('/');
  expect(response).not.toBeNull();
  const headers = response!.headers();
  expect(headers['content-security-policy-report-only']).toBe("require-trusted-types-for 'script'");
  expect(headers['content-security-policy']).toBeUndefined();
});

/**
 * Rapor kipi gerçek ihlali göstermelidir. antd stil yazımı ise ihlal sayılmaz.
 * antd, `<style>` öğesine CSS metnini `innerHTML` ile yazar. Varsayılan ilke bu düz metne izin verir.
 */
test('antd stil yazımı Trusted Types ihlali üretmez; HTML yazımı ihlal üretir', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const list: string[] = [];
    (window as unknown as { __tt: string[] }).__tt = list;
    document.addEventListener('securitypolicyviolation', (event) => {
      if (event.violatedDirective === 'require-trusted-types-for') list.push(event.sample);
    });
  });
  await page.goto(`/ornek/${encodeURIComponent('örnek-kayıt')}/ORNEK-0003`);
  await expect(page.getByRole('textbox', { name: /Örnek başlık/ })).toHaveValue('Örnek veri 3');
  // Açılır liste çalışma anında yeni stil öğeleri ekler.
  await page.getByRole('combobox', { name: /İlgili kayıt/ }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(
    page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').first(),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __tt: string[] }).__tt)).toEqual([]);

  // Öğe üreten HTML ilkeden geçmez. Rapor kipi bu yazımı raporlar.
  await page.evaluate(() => {
    document.createElement('div').innerHTML = '<b>deneme</b>';
  });
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __tt: string[] }).__tt.length))
    .toBe(1);
});

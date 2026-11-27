// "Veri aktarımı" sayfası tarayıcıda (G-97 parça 3, AJA-2493).
// Sayfa 320 pikselden başlar. Yatay taşmaz. Yazı en az 14 pikseldir. axe ihlali yoktur.
// Akış: şablon, yükleme, sütun eşleme, hata raporu, dışa aktarım ve KVKK talebi.
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { expect, test } from '../../../tests/setup/playwright-fixtures';

const PATH = '/data-transfer';
const DOCTYPE = 'Örnek Kayıt';

async function expectReadableLayout(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== 'running'),
  );
  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(layout.page).toBeLessThanOrEqual(layout.viewport);
  const fontSizes = await page.locator('.module-page').evaluate((root) =>
    Array.from(root.querySelectorAll('p, h1, h2, label, button, li, dd, dt, [role="alert"]'))
      .filter((element) => element.getBoundingClientRect().width > 0)
      .map((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
  );
  expect(fontSizes.length).toBeGreaterThan(0);
  expect(fontSizes.every((size) => size >= 14)).toBe(true);
  expect((await new AxeBuilder({ page }).include('.module-page').analyze()).violations).toEqual([]);
}

async function choose(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.locator('.ant-select-item-option', { hasText: option }).last().click();
}

test('kullanıcı şablonu indirir, dosyayı yükler, eşler ve hata raporunu görür', async ({
  page,
}) => {
  await page.goto(PATH);
  await expect(page.getByRole('heading', { level: 1, name: 'Veri aktarımı' })).toBeVisible();
  const section = page.getByRole('region', { name: 'İçe aktar' });
  await choose(page, 'İçe aktarılacak kayıt türü', DOCTYPE);

  const templateDownload = page.waitForEvent('download');
  await section.getByRole('button', { name: 'Şablonu indir' }).click();
  const template = await templateDownload;
  const header = (await readFile(await template.path(), 'utf8')).replace(/^﻿/, '');
  expect(header.split('\r\n')[0]).toContain('Örnek başlık');

  await section.getByLabel('Aktarım dosyası').setInputFiles({
    name: 'veri.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Örnek başlık,Fazla\r\nA,1\r\n,2\r\n'),
  });
  await section.getByRole('button', { name: 'Dosyayı yükle' }).click();
  await expect(section.getByText('Dosyada 2 satır var.')).toBeVisible();
  await expectReadableLayout(page);

  await section.getByRole('button', { name: 'Aktarımı başlat' }).click();
  await section.getByRole('button', { name: 'Sonucu göster' }).click();
  const report = section.getByRole('list', { name: 'Hata raporu' });
  await expect(report.getByText(/^Satır 3:/)).toBeVisible();
  await expectReadableLayout(page);
});

test('dışa aktarım yalnız okunabilir alanları yazar', async ({ page }) => {
  await page.goto(PATH);
  const section = page.getByRole('region', { name: 'Dışa aktar' });
  await choose(page, 'Dışa aktarılacak kayıt türü', DOCTYPE);
  const download = page.waitForEvent('download');
  await section.getByRole('button', { name: 'CSV indir' }).click();
  const file = await download;
  const csv = (await readFile(await file.path(), 'utf8')).replace(/^﻿/, '');
  const columns = csv.split('\r\n')[0]!.split(',');
  expect(columns[0]).toBe('ID');
  // Sahte sunucu bu alanı tanımda göstermez. Dosyada da olmamalıdır.
  expect(csv).not.toContain('gizli_not');
  await expect(section.getByText(/kayıt indirildi\./)).toBeVisible();
  await expectReadableLayout(page);
});

test('kullanıcı kişisel veri indirme talebi açar', async ({ page }) => {
  await page.goto(PATH);
  const section = page.getByRole('region', { name: 'Kişisel verilerim' });
  await section.getByRole('button', { name: 'Verilerimi iste' }).click();
  await expect(
    section.getByText('Talebiniz alındı. Dosya hazır olunca e-posta adresinize bağlantı gelir.'),
  ).toBeVisible();
  await expectReadableLayout(page);
});

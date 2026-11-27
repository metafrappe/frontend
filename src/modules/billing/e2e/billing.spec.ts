// Billing form in the browser (AJA-1785, AJA-1733).
// At 320 px a long company title and a long error message do not cover their neighbours.
// The page sends the shown terms version and language.
import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../../../../tests/setup/playwright-fixtures';

const LONG_TITLE =
  'Örnek Uluslararası Danışmanlık Mühendislik Yazılım Ticaret ve Sanayi Anonim Şirketi İstanbul Şubesi';

async function choose(page: Page, label: string, option: string) {
  await page.getByLabel(label).click();
  await page.locator('.ant-select-item-option', { hasText: option }).last().click();
}

/** Every visible block of the form keeps its own box: no two boxes overlap. */
async function expectNoOverlap(blocks: Locator) {
  const boxes = await blocks.evaluateAll((elements) =>
    elements
      .map((element) => element.getBoundingClientRect())
      .filter((box) => box.width > 0 && box.height > 0)
      .map((box) => ({ top: box.top, bottom: box.bottom, left: box.left, right: box.right })),
  );
  expect(boxes.length).toBeGreaterThan(3);
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      const overlap =
        Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5 &&
        Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5;
      expect(overlap, `block ${i} overlaps block ${j}`).toBe(false);
    }
  }
}

async function expectReadable(page: Page) {
  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(layout.page).toBeLessThanOrEqual(layout.viewport);
  const texts = await page.locator('.billing-page').evaluate((root) =>
    Array.from(root.querySelectorAll('h1, h2, h3, p, label, button, input, dd, dt, [role="alert"]'))
      .filter((element) => element.getBoundingClientRect().width > 0)
      .map((element) => {
        const style = getComputedStyle(element);
        return {
          size: Number.parseFloat(style.fontSize),
          wrap: style.overflowWrap,
          // Text that is wider than its own box spills onto a neighbour.
          spills: element.scrollWidth > element.clientWidth + 1 && element.tagName !== 'INPUT',
        };
      }),
  );
  expect(texts.length).toBeGreaterThan(0);
  expect(texts.every((text) => text.size >= 14)).toBe(true);
  expect(texts.some((text) => text.wrap === 'anywhere')).toBe(false);
  expect(texts.filter((text) => text.spills)).toEqual([]);
}

test('320 pikselde uzun şirket unvanı ve uzun hata iletisi komşusuna binmez', async ({
  page,
}, testInfo) => {
  await page.goto('/_demo/billing?tax=unavailable');
  await expect(page.getByRole('heading', { level: 1, name: 'Fatura bilgileri' })).toBeVisible();
  await page.getByRole('radio', { name: 'Şirket' }).check({ force: true });
  await choose(page, 'Fatura ülkesi', 'Türkiye');
  await page.getByLabel(/^Ad ya da şirket unvanı/).fill(LONG_TITLE);

  // Empty required fields show one error under each field.
  await page.getByRole('button', { name: 'Taslağı kaydet' }).click();
  await expect(page.getByText('İli yazın.')).toBeVisible();
  await expectReadable(page);
  await expectNoOverlap(page.locator('.billing-form > *'));

  await page.getByLabel(/^Vergi numarası/).fill('1234567890');
  await page.getByLabel(/^Adres$/).fill('Örnek Mahallesi Uzun Sokak No 1 Daire 2');
  await page.getByLabel(/^İlçe/).fill('Kadıköy');
  await page.getByLabel(/^İl/).fill('İstanbul');
  await page.getByRole('button', { name: 'Taslağı kaydet' }).click();
  await expect(page.getByText(/şu an denetlenemedi/)).toBeVisible();
  await expect(page.getByText(/yanlış/i)).toHaveCount(0);
  await expect(page.getByText(LONG_TITLE)).toBeVisible();
  await expect(page.getByLabel(/^Ad ya da şirket unvanı/)).toHaveValue(LONG_TITLE);
  await expectReadable(page);
  await expectNoOverlap(page.locator('.billing-form > *'));
  await expectNoOverlap(page.locator('.billing-summary > div'));
  await testInfo.attach('billing-320', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

test('dil değişince kabul isteği gösterilen metnin dilini ve sürümünü taşır', async ({
  page,
}) => {
  await page.goto('/_demo/billing');
  await expect(page.getByText('Hizmeti bu koşullarla kullanırsınız.')).toBeVisible();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByText('You use the service under these terms.')).toBeVisible();
  await page.getByRole('checkbox', { name: /I have read the terms/ }).check({ force: true });
  await page.getByRole('button', { name: 'Accept the terms' }).click();
  await expect(page.getByText(/You accepted version 2026-11-01/)).toBeVisible();
  const requests = await page.evaluate(
    () => (window as unknown as { __billingRequests: unknown[] }).__billingRequests,
  );
  expect(requests).toContainEqual({
    method: 'acceptTerms',
    body: { terms_id: 'terms-of-use', terms_version: '2026-11-01', shown_locale: 'en' },
  });
  await expectReadable(page);
});

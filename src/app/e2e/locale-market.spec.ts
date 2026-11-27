import { expect, test, type Page } from '../../../tests/setup/playwright-fixtures';

/**
 * AJA-1770: changing only the language keeps the amount and the draft; the road distance follows the region.
 * The demo page `/_demo/locale` reads the boot data's `locale` fields from the query string.
 * Acceptance widths are 320, 360, 375 and 390 CSS px (Chromium and WebKit). Firefox is not run.
 */
const DRAFT =
  'Angebotsentwurf: Lieferung der Ersatzteile bis Freitag, Rückfragen bitte telefonisch';

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('locale market demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('1. only the language changes: the euro amount and the draft stay', async ({
    page,
  }, testInfo) => {
    await page.goto('/_demo/locale?region=DE&currency=EUR&tz=Europe/Berlin');
    const amount = page.getByRole('status', { name: /Amount|Tutar/ });
    await expect(amount).toContainText('€');
    await expect(amount).toContainText('1,234,567.89');
    const draft = page.getByRole('textbox', { name: /Draft|Taslak/ });
    await draft.fill(DRAFT);

    await page.getByRole('button', { name: 'Türkçe' }).click();
    await expect(page.getByRole('button', { name: 'Türkçe' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(amount).toContainText('€');
    await expect(amount).toContainText('1.234.567,89');
    await expect(amount).not.toContainText('₺');
    await expect(draft).toHaveValue(DRAFT);
    await noHorizontalOverflow(page);

    // Headings and table cells do not break words anywhere.
    const wraps = await page.evaluate(() =>
      [...document.querySelectorAll('h1, h2, th, td')].map(
        (el) => getComputedStyle(el).overflowWrap,
      ),
    );
    expect(wraps).not.toContain('anywhere');
    await testInfo.attach('locale-tr', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await page.getByRole('button', { name: 'English' }).click();
    await expect(amount).toContainText('1,234,567.89');
    await expect(draft).toHaveValue(DRAFT);
  });

  test('2. region GB shows miles, region TR shows kilometres', async ({ page }) => {
    await page.goto('/_demo/locale?region=GB&currency=GBP&tz=Europe/London');
    await expect(page.getByRole('status', { name: 'Road distance' })).toHaveText('26.2 mi');
    await page.goto('/_demo/locale?region=TR&currency=TRY&tz=Europe/Istanbul');
    await expect(page.getByRole('status', { name: 'Road distance' })).toHaveText('42.2 km');
  });

  test('3. the user chooses metric: kilometres even in region GB', async ({ page }) => {
    await page.goto('/_demo/locale?region=GB&measurement=metric&tz=Europe/London');
    await expect(page.getByRole('status', { name: 'Road distance' })).toHaveText('42.2 km');
  });

  test('4. the closing time is in the user time zone and the due day does not move', async ({
    page,
  }) => {
    await page.goto('/_demo/locale?region=GB&tz=Pacific/Auckland');
    const closes = page.getByRole('status', { name: 'Closes' });
    await expect(closes).toContainText('Saturday');
    await expect(closes).toContainText('28 November 2026');
    await expect(closes).toContainText('11:30');
    const due = page.getByRole('status', { name: 'Due day' });
    await expect(due).toContainText('Friday');
    await expect(due).toContainText('27 November 2026');
  });

  test('5. without the new fields the page opens in en-GB', async ({ page }, testInfo) => {
    await page.goto('/_demo/locale');
    await expect(page.getByRole('status', { name: 'Format locale' })).toHaveText(/^en-GB$/);
    await expect(page.getByRole('status', { name: 'Road distance' })).toHaveText('42.2 km');
    await expect(page.getByRole('status', { name: 'Amount' })).toHaveText('1,234,567.89');
    await noHorizontalOverflow(page);
    await testInfo.attach('locale-old-server', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});

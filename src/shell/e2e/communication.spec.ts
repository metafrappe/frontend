import { expect, test } from '../../../tests/setup/playwright-fixtures';

/**
 * Communication list (AJA-812, G-63). The mock server serves part of the real
 * Communication schema: an empty select option, Dynamic Link, Code and Text Editor fields.
 * Both menu groups open the same type: Customer Management and Email.
 */
for (const path of ['/crm/Communication', '/email/Communication']) {
  test(`${path} listesi açılır ve sayfa yana taşmaz`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: 'Communication' })).toBeAttached();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText('ILETISIM-0001').first()).toBeVisible();
    // Rich text is shown as plain text; HTML tags are not written to the screen.
    await expect(page.getByText('<strong>')).toHaveCount(0);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

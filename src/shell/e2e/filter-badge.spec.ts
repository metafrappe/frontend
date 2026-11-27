import { expect, test, type Page } from '../../../tests/setup/playwright-fixtures';
import { openInNarrowContainer, settle } from '../../testing/gilt/playwright';

/**
 * The count badge on the "Filtre" button (AJA-1918).
 * The badge is a square at least `--shell-tag-h` wide. The number sits in its middle.
 * A rule for long button labels (AJA-1742) once set the badge's min-width to 0.
 */
const DEMO = '/_demo/shell?filters=long';

async function openDemo(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEMO);
  await expect(page.locator('.shell-page')).toBeVisible({ timeout: 20_000 });
  await settle(page);
}

async function measureBadge(page: Page) {
  const badge = page.locator('.shell-hd-filter .shell-hd-badge');
  await expect(badge).toHaveText('5');
  return badge.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const tagH = parseFloat(
      getComputedStyle(el).getPropertyValue('--shell-tag-h') ||
        getComputedStyle(document.documentElement).getPropertyValue('--shell-tag-h'),
    );
    const range = document.createRange();
    range.selectNodeContents(el);
    const text = range.getBoundingClientRect();
    return {
      width: box.width,
      height: box.height,
      tagH,
      minWidth: getComputedStyle(el).minWidth,
      // Distance between the badge middle and the number's middle.
      offsetX: Math.abs(box.left + box.width / 2 - (text.left + text.width / 2)),
      offsetY: Math.abs(box.top + box.height / 2 - (text.top + text.height / 2)),
    };
  });
}

async function expectSquareBadge(page: Page) {
  const m = await measureBadge(page);
  expect(m.tagH, 'the --shell-tag-h token is set').toBeGreaterThan(0);
  expect(m.minWidth).not.toBe('0px');
  expect(m.width, 'badge is at least --shell-tag-h wide').toBeGreaterThanOrEqual(m.tagH - 0.5);
  expect(m.width, 'badge is at least as wide as it is tall').toBeGreaterThanOrEqual(m.height - 0.5);
  expect(m.offsetX, 'number is centred across').toBeLessThanOrEqual(1);
  expect(m.offsetY, 'number is centred down').toBeLessThanOrEqual(1);
}

test.describe('Filter button count badge', () => {
  test('the badge keeps its width in the page', async ({ page }) => {
    await openDemo(page);
    await expectSquareBadge(page);
  });

  test('the badge keeps its width in a 260 px container', async ({ page }) => {
    await openDemo(page);
    await openInNarrowContainer(page, '.shell-page');
    await settle(page);
    await expectSquareBadge(page);
  });
});

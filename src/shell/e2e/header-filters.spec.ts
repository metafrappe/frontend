/**
 * Long filter row in the page header (AJA-1746, parent AJA-1734).
 * Chosen path: filters that do not fit wrap onto a new line. No filter is hidden.
 * Each condition runs at every project width (320 px first) and in a 260 px side-panel container.
 */
import { expect, test, type Locator, type Page } from '../../../tests/setup/playwright-fixtures';
import {
  applyPseudoLocale,
  expectNoProblems,
  findClippedButtons,
  findSmallTargets,
  openInNarrowContainer,
  scaleRootText,
  settle,
} from '../../testing/gilt/playwright';

const DEMO = '/_demo/shell?filters=long';
const CHIPS = '.shell-hd-chips';
const FILTER_LABELS = [
  'Bölge: Kuzey İrlanda, İskoçya ve Galler sınır bölgeleri',
  'Sorumlu: Muhasebe ve finansal raporlama ekibinin yöneticileri',
  'Durum: Onay bekleyen ve yeniden gönderilen başvurular',
  'Dönem: Geçen mali yılın son çeyreği ve bu yılın ilk ayı',
  'Ürün kodu: AB-120/XL',
];
const FILTER_COUNT = FILTER_LABELS.length;

const CLEAR = '[data-test-clear]';
const CHIP = '[data-test-chip]';

/**
 * Opens the page and marks the controls by role and name in the source language.
 * The marks survive the pseudo language, which changes every visible text.
 */
async function openFilters(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEMO);
  await expect(page.locator('.shell-page')).toBeVisible({ timeout: 20_000 });
  const row = page.getByRole('group', { name: 'Etkin filtreler' });
  await expect(row).toBeVisible();
  await row
    .getByRole('button', { name: 'Temizle', exact: true })
    .evaluate((el) => el.setAttribute('data-test-clear', ''));
  for (const label of FILTER_LABELS) {
    await row
      .getByText(label, { exact: true })
      .evaluate((el) => el.setAttribute('data-test-chip', ''));
  }
  await settle(page);
}

const narrow = (page: Page) => openInNarrowContainer(page, '.shell-page');

const CONDITIONS = [
  { name: 'source language', apply: async (_page: Page) => undefined },
  { name: 'long pseudo language', apply: (page: Page) => applyPseudoLocale(page, 'long') },
  { name: 'right-to-left pseudo language', apply: (page: Page) => applyPseudoLocale(page, 'rtl') },
  {
    name: 'long pseudo language and 200 % text',
    apply: async (page: Page) => {
      await scaleRootText(page);
      await applyPseudoLocale(page, 'long');
    },
  },
  {
    name: 'German compound in a 260 px container',
    apply: async (page: Page) => {
      await narrow(page);
      await applyPseudoLocale(page, 'german', { scope: '.shell-page' });
    },
  },
  {
    name: 'long pseudo language, 200 % text, 260 px container',
    apply: async (page: Page) => {
      await narrow(page);
      await scaleRootText(page);
      await applyPseudoLocale(page, 'long', { scope: '.shell-page' });
    },
  },
] as const;

/** The element is fully inside the screen width and inside the header box. */
async function expectInside(page: Page, target: Locator, what: string) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  const header = await page.locator('.shell-hd').first().boundingBox();
  const viewport = page.viewportSize();
  expect(box, `${what}: box`).not.toBeNull();
  expect(header).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!box || !header || !viewport) return;
  const r = (n: number) => Math.round(n);
  expect(r(box.x), `${what}: left edge on screen`).toBeGreaterThanOrEqual(0);
  expect(r(box.x + box.width), `${what}: right edge on screen`).toBeLessThanOrEqual(viewport.width);
  expect(r(box.y), `${what}: top edge on screen`).toBeGreaterThanOrEqual(0);
  expect(r(box.y + box.height), `${what}: bottom edge on screen`).toBeLessThanOrEqual(
    viewport.height,
  );
  expect(r(box.x), `${what}: left edge in header`).toBeGreaterThanOrEqual(r(header.x));
  expect(r(box.x + box.width), `${what}: right edge in header`).toBeLessThanOrEqual(
    r(header.x + header.width),
  );
}

test.describe('Page header: long filter row', () => {
  // The touch target rule is the same on every device.
  test.use({ hasTouch: true });

  for (const condition of CONDITIONS) {
    test(`"Clear" stays visible with five long filters: ${condition.name}`, async ({ page }) => {
      await openFilters(page);
      const clearName = (await page.locator(CLEAR).innerText()).trim();
      await condition.apply(page);
      await settle(page);

      const clear = page.locator(CLEAR);
      await expect(clear).toBeVisible();
      const visibleText = (await clear.innerText()).trim();
      expect(visibleText.length).toBeGreaterThan(0);
      // The accessible name contains the visible text (WCAG 2.5.3).
      const name = await clear.evaluate(
        (el) => el.getAttribute('aria-label') ?? el.textContent ?? '',
      );
      expect(name.trim()).toContain(visibleText);
      await expectInside(page, clear, '"Clear" button');

      // Every filter chip stays inside the header too.
      const chips = page.locator(CHIP);
      await expect(chips).toHaveCount(FILTER_COUNT);
      for (let i = 0; i < FILTER_COUNT; i += 1) {
        await expectInside(page, chips.nth(i), `filter ${i + 1}`);
      }

      await test.info().attach('clear-button', {
        body: JSON.stringify({
          condition: condition.name,
          sourceName: clearName,
          visibleText,
          name,
        }),
        contentType: 'application/json',
      });
      await test.info().attach('filter-row', {
        body: await page.locator(CHIPS).screenshot(),
        contentType: 'image/png',
      });

      await expectNoProblems(
        page,
        test.info(),
        'clipping',
        await findClippedButtons(page, { scope: CHIPS }),
      );
      await expectNoProblems(
        page,
        test.info(),
        'touch',
        await findSmallTargets(page, { scope: CHIPS }),
      );
    });
  }

  test('"Clear" removes only the filters', async ({ page }) => {
    await openFilters(page);
    const search = page.locator('.shell-hd-search input');
    await expect(search).toHaveValue('AB-120');
    await page.locator(CLEAR).click();
    await expect(page.locator(CHIPS)).toHaveCount(0);
    await expect(search).toHaveValue('AB-120');
    await expect(page.locator('h1.shell-hd-title')).toBeVisible();
    await expect(page.locator('.shell-hd-vsw .ant-segmented-item-selected')).toHaveCount(1);
  });

  for (const width of ['page', 'narrow'] as const) {
    test(`every filter is reached with Tab: ${width} container`, async ({ page }) => {
      await openFilters(page);
      if (width === 'narrow') await narrow(page);
      const labels = FILTER_LABELS;

      await page.locator('.shell-hd-search input').focus();
      const reached: string[] = [];
      // Search, filter button, view switch, then the chips. A short margin covers the rest.
      for (let i = 0; i < FILTER_COUNT + 12; i += 1) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate((chips) => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || !el.closest(chips)) return null;
          // Accessible name: aria-label, then aria-labelledby, then the text.
          const ids = el.getAttribute('aria-labelledby');
          const byId = ids
            ? ids
                .split(/\s+/)
                .map((id) => document.getElementById(id)?.textContent ?? '')
                .join(' ')
            : null;
          return el.getAttribute('aria-label') ?? byId ?? el.textContent?.trim() ?? '';
        }, CHIPS);
        if (info !== null) reached.push(info);
        if (reached.length === FILTER_COUNT + 1) break;
      }
      for (const label of labels) {
        expect(reached.some((r) => r.includes(label.trim()))).toBe(true);
      }
      // The last stop in the row is "Clear".
      const clearText = (await page.locator(CLEAR).innerText()).trim();
      expect(reached.at(-1)).toContain(clearText);

      // Each reached control is on screen when it has focus.
      await expectInside(page, page.locator(CLEAR), '"Clear" with focus');
    });
  }

  for (const condition of CONDITIONS) {
    test(`selected tab and page name stay visible: ${condition.name}`, async ({ page }) => {
      await openFilters(page);
      await condition.apply(page);
      await settle(page);
      const title = page.locator('h1.shell-hd-title');
      await expect(title).toBeVisible();
      await expectInside(page, title, 'page title');
      const current = page.locator('.shell-hd-crumbs [aria-current="page"]');
      await expect(current).toBeVisible();
      await expectInside(page, current, 'current page in breadcrumb');
      const selected = page.locator('.shell-hd-vsw .ant-segmented-item-selected');
      await expect(selected).toHaveCount(1);
      await expect(selected).toBeVisible();
      await expectInside(page, selected, 'selected view tab');
      // The view switch scrolls inside its own box; the selected tab is not cut by it.
      const cut = await selected.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const wrap = el.closest('.shell-hd-vsw')?.getBoundingClientRect();
        if (!wrap) return true;
        return box.left < wrap.left - 0.5 || box.right > wrap.right + 0.5;
      });
      expect(cut).toBe(false);
    });
  }
});

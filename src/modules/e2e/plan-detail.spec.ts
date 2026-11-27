// Plan detail in a narrow space (AJA-1744). The tests were written before the code.
// Demo page: `/_demo/plan-detail` (e2e build only). The plans are test data, not real plans.
import { expect, test, type Locator, type Page } from '../../../tests/setup/playwright-fixtures';
import {
  NARROW_WIDTH,
  applyPseudoLocale,
  expectNoProblems,
  findClippedButtons,
  findSmallTargets,
  openInNarrowContainer,
  scaleRootText,
  settle,
  type PseudoMode,
} from '../../testing/gilt/playwright';

const DEMO = '/_demo/plan-detail';
/** Comparison of the two test plans. */
const SLOT = '#plan-slot';
/** A single plan with a long error message. */
const ERROR_SLOT = '#plan-error-slot';
/** Wide enough for the two columns inside one card. */
const WIDE = 720;
const EPSILON = 0.5;

async function open(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEMO);
  // The e2e build starts the mock server first. Under a full parallel run this can take a while.
  await expect(page.locator(`${SLOT} .plan-card`).first()).toBeVisible({ timeout: 20_000 });
  await settle(page);
}

async function box(locator: Locator) {
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error('Expected an element with a visible layout box');
  return bounds;
}

/** The element lies inside the card on the inline axis: nothing is cut at the side. */
async function expectInside(inner: Locator, outer: Locator) {
  const a = await box(inner);
  const b = await box(outer);
  expect(a.x).toBeGreaterThanOrEqual(b.x - EPSILON);
  expect(a.x + a.width).toBeLessThanOrEqual(b.x + b.width + EPSILON);
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

const conditions: { name: string; narrow: boolean; scale: boolean; pseudo?: PseudoMode }[] = [
  { name: 'page width', narrow: false, scale: false },
  { name: '260 CSS px side panel', narrow: true, scale: false },
  { name: '260 CSS px, German compound', narrow: true, scale: false, pseudo: 'german' },
  { name: 'page width, text 200 %', narrow: false, scale: true },
  { name: 'page width, long pseudo language', narrow: false, scale: false, pseudo: 'long' },
  { name: 'page width, right-to-left pseudo language', narrow: false, scale: false, pseudo: 'rtl' },
];

async function apply(page: Page, condition: (typeof conditions)[number]) {
  if (condition.pseudo) await applyPseudoLocale(page, condition.pseudo, { scope: SLOT });
  if (condition.narrow) expect(await openInNarrowContainer(page, SLOT)).toBe(NARROW_WIDTH);
  if (condition.scale) await scaleRootText(page);
  await settle(page);
}

test.describe('Plan detail: narrow space', () => {
  for (const condition of conditions) {
    test(`summary, price and select button stay visible and uncut (${condition.name})`, async ({
      page,
    }) => {
      await open(page);
      await apply(page, condition);
      const cards = page.locator(`${SLOT} .plan-card`);
      await expect(cards).toHaveCount(2);
      for (const card of await cards.all()) {
        for (const part of [
          card.locator('.plan-card__variant'),
          card.locator('.plan-card__summary'),
          card.getByTestId('plan-price'),
          card.locator('.plan-card__select'),
        ]) {
          await expect(part).toBeVisible();
          await expectInside(part, card);
        }
      }
      await expectNoPageOverflow(page);
      const info = test.info();
      await expectNoProblems(
        page,
        info,
        'clipping',
        await findClippedButtons(page, { scope: SLOT }),
      );
      await expectNoProblems(page, info, 'touch', await findSmallTargets(page, { scope: SLOT }));
    });
  }

  test('the header spans both columns in a wide card', async ({ page }) => {
    await open(page);
    // A wide container is possible only on a wide page.
    test.skip((page.viewportSize()?.width ?? 0) < WIDE + 100, 'needs a wide page');
    await openInNarrowContainer(page, ERROR_SLOT, WIDE);
    const card = page.locator(`${ERROR_SLOT} .plan-card`);
    const grid = card.locator('.plan-card__grid');
    const columns = await grid.evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
    );
    expect(columns).toBe(2);
    const header = card.locator('.plan-card__header');
    const style = await header.evaluate((el) => {
      const s = getComputedStyle(el);
      return { start: s.gridColumnStart, end: s.gridColumnEnd };
    });
    expect(style).toEqual({ start: '1', end: '-1' });
    expect((await box(header)).width).toBeCloseTo((await box(grid)).width, 0);
  });

  test('the narrow card has one column; each shrinking cell allows zero minimum size', async ({
    page,
  }) => {
    await open(page);
    await openInNarrowContainer(page, SLOT);
    const card = page.locator(`${SLOT} .plan-card`).first();
    const grid = card.locator('.plan-card__grid');
    const template = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    expect(template.split(' ')).toHaveLength(1);
    for (const cell of await grid.locator('> *').all()) {
      expect(await cell.evaluate((el) => getComputedStyle(el).minInlineSize)).toBe('0px');
    }
  });

  test('the feature label stands above its value in a narrow space', async ({ page }) => {
    await open(page);
    await openInNarrowContainer(page, SLOT);
    await scaleRootText(page);
    const rows = page.locator(`${SLOT} .plan-card`).first().locator('.plan-feature');
    expect(await rows.count()).toBeGreaterThanOrEqual(3);
    for (const row of await rows.all()) {
      const term = await box(row.locator('dt'));
      const value = await box(row.locator('dd'));
      expect(term.y + term.height).toBeLessThanOrEqual(value.y + EPSILON);
      expect(Math.abs(term.x - value.x)).toBeLessThanOrEqual(EPSILON);
    }
  });

  const rangeConditions = conditions.filter(
    (condition) => !condition.pseudo && condition.narrow !== condition.scale,
  );
  for (const condition of rangeConditions) {
    test(`the temperature range is not broken (${condition.name})`, async ({ page }) => {
      await open(page);
      await apply(page, condition);
      for (const range of await page.getByTestId('plan-range-temperature').all()) {
        await expect(range).toHaveText(/^[-−]20 … \+60\s?°C$/);
        // An inline element that wraps has client rectangles on more than one line.
        const lines = await range.evaluate(
          (el) => new Set([...el.getClientRects()].map((rect) => Math.round(rect.top))).size,
        );
        expect(lines).toBe(1);
        await expectInside(range, range.locator('xpath=ancestor::article[1]'));
      }
    });
  }

  test('two plans with the same 30-character prefix store different identities', async ({
    page,
  }) => {
    await open(page);
    const cards = page.locator(`${SLOT} .plan-card`);
    const names = await cards.locator('h3').allInnerTexts();
    const [first = '', second = ''] = names.map((name) => name.replace(/\s+/g, ' ').trim());
    expect(first.slice(0, 30)).toBe(second.slice(0, 30));
    expect(first).not.toBe(second);

    const selected = page.getByTestId('selected-plan-id');
    await cards.nth(0).locator('.plan-card__select').click();
    await expect(selected).toHaveText('test-plan-a');
    await expect(cards.nth(0).getByText('Seçili', { exact: true })).toBeVisible();
    await cards.nth(1).locator('.plan-card__select').click();
    await expect(selected).toHaveText('test-plan-b');
    await expect(cards.nth(0).getByText('Seçili', { exact: true })).toHaveCount(0);

    // Evidence: visible text, accessible name, selected identity and a screenshot.
    const button = cards.nth(1).locator('.plan-card__select');
    await test.info().attach('plan-selection', {
      body: JSON.stringify(
        {
          visibleText: (await button.innerText()).trim(),
          accessibleName: await button.evaluate((el) =>
            (el.getAttribute('aria-labelledby') ?? '')
              .split(' ')
              .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
              .join(' '),
          ),
          selectedId: await selected.innerText(),
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });
    await test.info().attach('plan-detail', {
      body: await page.locator(SLOT).screenshot(),
      contentType: 'image/png',
    });
  });

  for (const narrow of [false, true]) {
    test(`a long error message stays below its own field (${narrow ? '260 CSS px' : 'page width'})`, async ({
      page,
    }) => {
      await open(page);
      if (narrow) await openInNarrowContainer(page, ERROR_SLOT);
      const card = page.locator(`${ERROR_SLOT} .plan-card`);
      const alert = card.getByRole('alert');
      await expect(alert).toBeVisible();
      const message = await box(alert);
      const button = await box(card.locator('.plan-card__select'));
      expect(message.y).toBeGreaterThanOrEqual(button.y + button.height - EPSILON);
      await expectInside(alert, card);
      // The message does not cover the next block: the feature list starts below it or beside it.
      const features = await box(card.locator('.plan-card__features'));
      const beside = features.x >= message.x + message.width - EPSILON;
      if (!beside) expect(features.y).toBeGreaterThanOrEqual(message.y + message.height - EPSILON);
    });
  }
});

import { expect, test } from '../../../../tests/setup/playwright-fixtures';

// Demo route (src/shell/routes.ts). It exists only in the e2e build.
const demo = '/_demo/bidi';
const CODE = 'AB-120/XL';
/** Invisible direction marks and isolates: LRM, RLM, ALM, LRE..RLO, LRI..PDI. */
const DIRECTION_MARKS = /[‎‏؜‪-‮⁦-⁩]/;

/** Left edge of every character in the element's single text node, in logical order. */
function charLefts(el: Element): number[] {
  const node = el.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) return [];
  return Array.from(node.textContent ?? '', (_, i) => {
    const range = document.createRange();
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    return range.getBoundingClientRect().left;
  });
}

/** True when each value is larger than the one before: the characters run left to right. */
function isAscending(values: number[]): boolean {
  return values.every((v, i) => i === 0 || v > (values[i - 1] ?? Number.POSITIVE_INFINITY));
}

test.beforeEach(async ({ page }) => {
  await page.goto(demo);
  await expect(page.getByTestId('rtl-sentence')).toBeVisible();
});

test('the commercial code reads left to right inside a right-to-left sentence', async ({
  page,
}) => {
  const sentence = page.getByTestId('rtl-sentence');
  await expect(sentence).toHaveAttribute('dir', 'rtl');
  const code = sentence.getByTestId('commercial-code');
  await expect(code).toHaveText(CODE);
  // The code is isolated from the sentence direction: a <bdi> element.
  expect(await code.evaluate((el) => el.tagName)).toBe('BDI');

  // Visual order: the x position of every character grows from left to right.
  const lefts = await code.evaluate(charLefts);
  expect(lefts).toHaveLength(CODE.length);
  expect(isAscending(lefts)).toBe(true);

  // The negative value keeps its sign in front of the digits.
  const value = sentence.getByTestId('negative-value');
  expect(await value.evaluate((el) => el.tagName)).toBe('BDI');
  const valueLefts = await value.evaluate(charLefts);
  expect(valueLefts).toHaveLength(2);
  expect(isAscending(valueLefts)).toBe(true);

  // The sentence stays inside the viewport at every width.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('a copied commercial code is byte-for-byte the same, without direction marks', async ({
  page,
  browserName,
  context,
}) => {
  const code = page.getByTestId('rtl-sentence').getByTestId('commercial-code');
  const raw = await code.evaluate((el) => el.textContent ?? '');
  expect(raw).toBe(CODE);
  expect(raw).not.toMatch(DIRECTION_MARKS);

  // Select the code as a user would and read the plain text the browser copies.
  const selected = await code.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    if (!selection) return null;
    selection.removeAllRanges();
    selection.addRange(range);
    return selection.toString();
  });
  expect(selected).toBe(CODE);

  // Chromium also lets the test read the real clipboard after the copy shortcut.
  if (browserName === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.keyboard.press('ControlOrMeta+C');
    const pasted = await page.evaluate(() => navigator.clipboard.readText());
    expect(pasted).toBe(CODE);
    expect(pasted).not.toMatch(DIRECTION_MARKS);
  }
});

test('a block of unknown direction takes its direction from its own text', async ({ page }) => {
  const block = page.getByTestId('unknown-direction');
  await expect(block).toHaveAttribute('dir', 'auto');
});

import { expect, test, type Locator, type Page } from '../../../tests/setup/playwright-fixtures';

/**
 * AJA-1782: the chat must not overflow on a 320 CSS px phone.
 * Long content stays in its own box. The page itself never scrolls sideways.
 * The e2e mock server answers the trigger text below with a long link, a code block
 * and a wide table. Sample words are German and Finnish compounds.
 */
const PAGE = '/panel/ai';
const LONG_CONTENT = 'Uzun içerik örneği göster';
const FINNISH = 'lentokonesuihkuturbiinimoottoriapumekaanikkoaliupseerioppilas';
const GERMAN = 'Betriebsumgebungstemperatur';

async function open(page: Page) {
  await page.goto(PAGE);
  await expect(page.getByRole('textbox', { name: 'Asistana mesaj yazın' })).toBeVisible();
}

async function ask(page: Page, text: string) {
  await page.getByRole('textbox', { name: 'Asistana mesaj yazın' }).fill(text);
  await page.getByRole('button', { name: 'Mesajı gönder' }).click();
}

async function pageOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

/** Smallest computed font size of the visible text. */
async function smallestFont(page: Page) {
  return page.evaluate(() => {
    let min = Infinity;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!el || !node.textContent?.trim()) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (el.closest('.ai-visually-hidden')) continue;
      min = Math.min(min, parseFloat(getComputedStyle(el).fontSize));
    }
    return min;
  });
}

async function longAnswer(page: Page) {
  await open(page);
  await ask(page, LONG_CONTENT);
  const log = page.getByRole('log');
  await expect(log.getByRole('button', { name: 'Kopyala' })).toBeVisible({ timeout: 15_000 });
  return log;
}

/** The element is inside the chat column. Its right edge does not pass the log's right edge. */
async function insideLog(page: Page, target: Locator) {
  const log = await page.getByRole('log').boundingBox();
  const box = await target.boundingBox();
  expect(log).not.toBeNull();
  expect(box).not.toBeNull();
  if (!log || !box) return;
  expect(box.x).toBeGreaterThanOrEqual(log.x - 1);
  expect(box.x + box.width).toBeLessThanOrEqual(log.x + log.width + 1);
}

test.describe('Sohbet dar ekranda taşmaz (AJA-1782)', () => {
  test('uzun bağlantı sohbeti genişletmez', async ({ page }) => {
    const log = await longAnswer(page);
    const link = log.locator('a.ai-link').first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /^https:\/\/beispiel\.example\//);
    // Only the link may break anywhere. The copied address stays unchanged.
    expect(await link.evaluate((el) => getComputedStyle(el).overflowWrap)).toBe('anywhere');
    expect(await link.getAttribute('href')).toBe(await link.textContent());
    await insideLog(page, link);
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    expect(await smallestFont(page)).toBeGreaterThanOrEqual(14);
  });

  test('kod bloğu kendi kutusunda yatay kayar, sayfa taşmaz', async ({ page }) => {
    const log = await longAnswer(page);
    const code = log.getByRole('region', { name: 'Kod bloğu' }).first();
    await expect(code).toBeVisible();
    // The box is keyboard-scrollable: it can take focus.
    await expect(code).toHaveAttribute('tabindex', '0');
    const scroll = await code.evaluate((el) => ({
      overflowX: getComputedStyle(el).overflowX,
      wraps: getComputedStyle(el).whiteSpace,
      wider: el.scrollWidth > el.clientWidth,
    }));
    expect(scroll).toEqual({ overflowX: 'auto', wraps: 'pre', wider: true });
    const moved = await code.evaluate((el) => {
      el.scrollLeft = 120;
      return el.scrollLeft;
    });
    expect(moved).toBeGreaterThan(0);
    await insideLog(page, code);
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    expect(await smallestFont(page)).toBeGreaterThanOrEqual(14);
  });

  test('geniş tablo kendi kutusunda kayar, hücrede sözcük bölünmez', async ({ page }) => {
    const log = await longAnswer(page);
    const table = log.locator('[data-genui="table"]').last();
    await expect(table).toContainText(FINNISH);
    await expect(table).toContainText(GERMAN);
    // Some box inside the table card scrolls sideways. The card itself stays inside the chat.
    const scrolls = await table.evaluate((root) =>
      [...root.querySelectorAll<HTMLElement>('*')].some(
        (el) =>
          ['auto', 'scroll'].includes(getComputedStyle(el).overflowX) &&
          el.scrollWidth > el.clientWidth,
      ),
    );
    expect(scrolls).toBe(true);
    await insideLog(page, table);
    // Cells never break a word in the middle. Every word fits inside its cell.
    const cells = await table.locator('th, td').evaluateAll((els) =>
      els.map((el) => {
        const s = getComputedStyle(el);
        return {
          wrap: s.overflowWrap,
          wordBreak: s.wordBreak,
          fits: el.scrollWidth <= el.clientWidth + 1,
        };
      }),
    );
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells)
      expect(cell).toEqual({ wrap: 'normal', wordBreak: 'normal', fits: true });
    const finnish = table.getByText(FINNISH, { exact: true });
    const lines = await finnish.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
    });
    expect(lines).toBe(1);
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    expect(await smallestFont(page)).toBeGreaterThanOrEqual(14);
  });

  test('öneri kartları dar alanda alt alta dizilir, düğme kaybolmaz', async ({ page }) => {
    await open(page);
    const width = page.viewportSize()?.width ?? 0;
    const prompts = page.locator('.ai-welcome > .ant-prompts');
    await expect(prompts).toBeVisible();
    const groups = prompts.locator(':scope > .ant-prompts-list > .ant-prompts-item');
    await expect(groups).toHaveCount(2);
    const [first, second] = await Promise.all([
      groups.nth(0).boundingBox(),
      groups.nth(1).boundingBox(),
    ]);
    expect(first && second).toBeTruthy();
    if (width <= 390 && first && second) {
      // Phone: cards sit one under the other at the same left edge.
      expect(Math.abs(first.x - second.x)).toBeLessThanOrEqual(1);
      expect(second.y).toBeGreaterThanOrEqual(first.y + first.height - 1);
    }
    // Every suggestion button stays fully on screen and inside the chat column.
    const buttons = prompts.locator('.ant-prompts-nested .ant-prompts-item');
    await expect(buttons).toHaveCount(4);
    for (const button of await buttons.all()) {
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      }
      await insideLog(page, button);
      const text = await button.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
      expect(text).toBe(true);
    }
    await buttons.first().click();
    await expect(page.getByRole('log').getByRole('button', { name: 'Kopyala' })).toBeVisible({
      timeout: 15_000,
    });
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('yazma kutusu içerikle büyür, yazılan metin gizlenmez', async ({ page }) => {
    await open(page);
    const box = page.getByRole('textbox', { name: 'Asistana mesaj yazın' });
    const before = await box.evaluate((el) => el.clientHeight);
    const text = [`${GERMAN} prüfen.`, 'Toinen rivi näkyy.', 'Viimeinen rivi.'].join('\n');
    await box.fill(text);
    await expect
      .poll(() => box.evaluate((el) => el.clientHeight), { message: 'Sender büyümedi' })
      .toBeGreaterThan(before);
    // The height change may animate. Measure after it ends.
    const measure = () =>
      box.evaluate(async (el) => {
        await Promise.all(el.getAnimations().map((a) => a.finished.catch(() => undefined)));
        return {
          hidden: el.scrollHeight > el.clientHeight + 1,
          wide: el.scrollWidth > el.clientWidth + 1,
          scrolls: ['auto', 'scroll'].includes(getComputedStyle(el).overflowY),
          value: (el as HTMLTextAreaElement).value,
        };
      });
    expect(await measure()).toMatchObject({ hidden: false, wide: false, value: text });
    // Very long text: the box stops growing and scrolls inside. Text is never cut off.
    const long = Array.from({ length: 14 }, (_, i) => `${i + 1}. ${GERMAN}`).join('\n');
    await box.fill(long);
    const tall = await measure();
    expect(tall).toMatchObject({ wide: false, value: long });
    if (tall.hidden) expect(tall.scrolls).toBe(true);
    const send = page.getByRole('button', { name: 'Mesajı gönder' });
    await send.scrollIntoViewIfNeeded();
    await expect(send).toBeVisible();
    await expect(send).toBeInViewport();
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    expect(await smallestFont(page)).toBeGreaterThanOrEqual(14);
  });
});

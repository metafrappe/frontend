import { expect, test, type Page } from '../../../tests/setup/playwright-fixtures';

/**
 * AI Studio browser tests. In the production build the page is at `/panel/ai`.
 * The route is registered in `src/app/routes.ts`. The root Playwright config runs this folder.
 */
const PAGE = '/panel/ai';
const WIDE = 1140;

async function open(page: Page) {
  await page.goto(PAGE);
  await expect(page.getByRole('textbox', { name: 'Asistana mesaj yazın' })).toBeVisible();
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

async function ask(page: Page, text: string) {
  await page.getByRole('textbox', { name: 'Asistana mesaj yazın' }).fill(text);
  await page.getByRole('button', { name: 'Mesajı gönder' }).click();
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

/** Counts how many lines the element's text spans. */
async function lineCount(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
    });
}

/** Outline and underline indicator of the focused element. */
async function focusLook(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return null;
    const style = getComputedStyle(el);
    return {
      label: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '',
      outline: style.outlineStyle === 'none' || style.outlineWidth === '0px',
      indicator: style.boxShadow.includes('inset'),
    };
  });
}

async function waitConfirm(page: Page) {
  const confirm = page.locator('[data-genui="confirm"]');
  await expect(confirm).toBeVisible({ timeout: 15_000 });
  return confirm;
}

test.describe('AI Studio', () => {
  test('boş durumda yatay taşmaz', async ({ page }) => {
    await open(page);
    await expect(page.getByText('Merhaba, ben Atonota asistanı')).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await smallestFont(page)).toBeGreaterThanOrEqual(12);
  });

  test('tablo ve onay bloğuyla yatay taşmaz, açıklama sarılır', async ({ page }) => {
    await open(page);
    await ask(page, 'Geciken siparişleri bul');
    await waitConfirm(page);
    await expect(page.locator('[data-genui="table"]')).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await smallestFont(page)).toBeGreaterThanOrEqual(12);
    expect(await lineCount(page, '[data-genui="table"] th')).toBe(1);
    expect(await lineCount(page, '[data-genui="table"] td.genui-cell-id')).toBe(1);
    expect(await lineCount(page, '[data-genui="table"] td.genui-cell-text')).toBeGreaterThan(1);
  });

  test('onay ekranı önce ve sonra değerini gösterir', async ({ page }) => {
    await open(page);
    await ask(page, 'Geciken siparişleri bul');
    const confirm = await waitConfirm(page);
    const table = confirm.getByRole('table', { name: 'Değişecek alanlar' });
    await expect(table.getByRole('columnheader', { name: 'Önce' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Sonra' })).toBeVisible();
    await expect(table.getByText('Gönderilmedi')).toBeVisible();
    // The next value must be visible without scrolling. It must not stay hidden during approval.
    await confirm.scrollIntoViewIfNeeded();
    const box = await table.getByRole('columnheader', { name: 'Sonra' }).boundingBox();
    const width = page.viewportSize()?.width ?? 0;
    expect(box && box.x + box.width).toBeLessThanOrEqual(width);
    // Cells do not break mid-word and do not overflow.
    const cells = await table.locator('th, td').evaluateAll((els) =>
      els.map((el) => ({
        wrap: getComputedStyle(el).overflowWrap,
        fits: el.scrollWidth <= el.clientWidth + 1,
      })),
    );
    for (const cell of cells) expect(cell).toEqual({ wrap: 'normal', fits: true });
  });

  test('onaylanınca yeni mesaj gelir, yeniden üret onayı tekrar göndermez', async ({ page }) => {
    await open(page);
    await ask(page, 'Geciken siparişleri bul');
    const confirm = await waitConfirm(page);
    await expect(page.getByText(/^Onaylıyorum/)).toHaveCount(0);
    await confirm.getByRole('button', { name: 'Gönder' }).click();
    await expect(page.getByText(/^Onaylıyorum/)).toHaveCount(1);
    const log = page.getByRole('log');
    await expect(log).toContainText('gerçek bir işlem yapılmadı', { timeout: 15_000 });
    await page.getByRole('button', { name: 'Yeniden üret' }).last().click();
    await expect(log).toContainText('Hiçbir işlem yeniden yapılmadı', { timeout: 15_000 });
    await expect(log).not.toContainText('zaten kullanıldı');
    await expect(page.getByText(/^Onaylıyorum/)).toHaveCount(1);
  });

  test('yanıt akarken eski onay düğmesi kapalıdır', async ({ page }) => {
    await open(page);
    await ask(page, 'Geciken siparişleri bul');
    const confirm = await waitConfirm(page);
    await expect(page.getByRole('button', { name: 'Mesajı gönder' })).toBeVisible();
    await ask(page, 'Bu haftanın satış özetini çıkar');
    await expect(confirm.getByRole('button', { name: 'Gönder' })).toBeDisabled();
    await expect(confirm).toContainText('Yanıt bitince onay verebilirsiniz.');
  });

  test('iptal akışı durdurur', async ({ page }) => {
    // The mock stream waits until the button is pressed: in the e2e build `?gecikme=` sets the
    // gap between two events to 60 seconds. So the stream cannot end before Stop is pressed.
    await page.goto(`${PAGE}?gecikme=60000`);
    await expect(page.getByRole('textbox', { name: 'Asistana mesaj yazın' })).toBeVisible();
    await ask(page, 'Bu haftanın satış özetini çıkar');
    await page.getByRole('button', { name: 'Yanıtı durdur' }).click();
    await expect(page.getByText('Yanıt durduruldu.')).toBeVisible();
    await page.waitForTimeout(800);
    await expect(page.locator('[data-genui]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Mesajı gönder' })).toBeVisible();
  });

  test('dar ekranda çekmeceler açılır ve taşmaz', async ({ page }, info) => {
    test.skip((page.viewportSize()?.width ?? 0) >= WIDE, `${info.project.name}: çekmece yok`);
    await open(page);
    await page.getByRole('button', { name: 'Sohbetleri aç' }).click();
    await expect(page.getByRole('navigation', { name: 'Sohbetler' })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Çalışma alanını aç' }).click();
    await expect(page.getByRole('complementary', { name: 'Çalışma alanı' })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('klavye odağı çevreleyen halka çizmez, alt çizgiyle görünür', async ({ page }, info) => {
    test.skip((page.viewportSize()?.width ?? 0) >= WIDE, `${info.project.name}: çekmece yok`);
    await open(page);
    // WebKit may skip buttons on Tab. So the first focused element depends on the browser.
    await page.keyboard.press('Tab');
    const first = await focusLook(page);
    expect(first).toMatchObject({ outline: true, indicator: true });

    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    expect(await focusLook(page)).toMatchObject({
      label: first?.label,
      outline: true,
      indicator: true,
    });

    // In keyboard mode the drawer button also uses the non-surrounding indicator.
    await page.getByRole('button', { name: 'Sohbetleri aç' }).focus();
    expect(await focusLook(page)).toMatchObject({
      label: 'Sohbetleri aç',
      outline: true,
      indicator: true,
    });
    await page.keyboard.press('Enter');
    await expect(page.getByRole('navigation', { name: 'Sohbetler' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Sohbetleri aç' })).toBeFocused();
    expect(await focusLook(page)).toMatchObject({ outline: true, indicator: true });
  });

  test('fareyle odakta gösterge çıkmaz', async ({ page }) => {
    await open(page);
    await page.getByRole('textbox', { name: 'Asistana mesaj yazın' }).click();
    const ring = await page.locator('.ai-sender .ant-sender').evaluate((el) => {
      const after = getComputedStyle(el, '::after');
      return {
        color: after.borderTopColor,
        width: after.borderTopWidth,
        outline: getComputedStyle(el).outlineStyle,
      };
    });
    expect(ring.color).not.toBe('rgb(0, 170, 204)');
    expect(ring.width).toBe('1px');
    expect(ring.outline).toBe('none');
  });

  test('form alanı odakta kenarını boyamaz, yalnız tek kenar göstergesi kullanır', async ({
    page,
  }) => {
    await open(page);
    await ask(page, 'Stok uyarısı için otomasyon kur');
    const form = page.locator('[data-genui="form"]');
    await expect(form).toBeVisible({ timeout: 15_000 });
    const input = form.getByLabel('Kural adı');
    const selectRoot = form.locator('.ant-select').first();
    const select = selectRoot.locator('.ant-select-selector');

    /**
     * Measures the edges. First it waits for all CSS transitions on the element to finish.
     * So the measurement is not taken before a transition starts and the result is stable.
     */
    const settled = (locator: typeof input) =>
      locator.evaluate(async (el) => {
        await Promise.all(el.getAnimations().map((a) => a.finished.catch(() => undefined)));
        const s = getComputedStyle(el);
        return {
          colors: [s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor],
          shadow: s.boxShadow,
          outline: s.outlineStyle === 'none' || s.outlineWidth === '0px',
        };
      });
    /** Surrounding ring shadow: x and y zero, positive spread. */
    const ring = /0px 0px 0px [1-9]/;
    /** Single-edge indicator: inset shadow on the bottom edge only. x zero, y negative, blur zero. */
    const bottomBar = /0px -\d+(\.\d+)?px 0px 0px inset|inset 0px -\d+(\.\d+)?px 0px 0px/;

    // In the resting measurement the mouse must not hover any field. The mouse that clicked Send
    // stays in place. On a narrow screen the form can move under that point. Then the Select's touch
    // layer takes the hover colour. This happened on Linux WebKit 320 (PR #3 CI failure).
    await page.mouse.move(0, 0);
    await expect(selectRoot).not.toHaveClass(/ant-select-focused/);
    await expect
      .poll(() => selectRoot.evaluate((el) => el.matches(':hover')), {
        message: 'dinlenme ölçümünde Select fare altında',
      })
      .toBe(false);
    const restInput = await settled(input);
    const restSelect = await settled(select);
    expect(restSelect.shadow).not.toMatch(bottomBar);

    // Mouse focus: the border colour does not change. There is no ring and no indicator.
    await input.click();
    await page.mouse.move(0, 0);
    const mouseInput = await settled(input);
    expect(mouseInput.colors).toEqual(restInput.colors);
    expect(mouseInput.shadow).not.toMatch(ring);
    expect(mouseInput.outline).toBe(true);

    // The touch-area layer is on the select box. The click goes to the box.
    await selectRoot.click();
    await expect(selectRoot).toHaveClass(/ant-select-focused/);
    await page.mouse.move(0, 0);
    const mouseSelect = await settled(select);
    expect(mouseSelect.colors).toEqual(restSelect.colors);
    expect(mouseSelect.shadow).not.toMatch(ring);
    expect(mouseSelect.shadow).not.toMatch(bottomBar);
    await page.keyboard.press('Escape');

    // Keyboard focus: the border colour does not change. Only a single line shows on the bottom edge.
    await page.keyboard.press('Tab');
    await input.focus();
    const keyInput = await settled(input);
    expect(keyInput.colors).toEqual(restInput.colors);
    expect(keyInput.shadow).not.toMatch(ring);
    expect(keyInput.shadow).toMatch(bottomBar);
    expect(keyInput.outline).toBe(true);

    await selectRoot.locator('input').focus();
    await expect(selectRoot).toHaveClass(/ant-select-focused/);
    const keySelect = await settled(select);
    expect(keySelect.colors).toEqual(restSelect.colors);
    expect(keySelect.shadow).not.toMatch(ring);
    expect(keySelect.shadow).toMatch(bottomBar);
  });
});

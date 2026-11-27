import AxeBuilder from '@axe-core/playwright';

import { expect, test, type Page } from '../../../tests/setup/playwright-fixtures';

/**
 * Assistant flow on screen (AJA-1159). In the e2e build the page opens with the mock server.
 * Acceptance criteria: server event, R3 approval, removed items, overflow, axe, keyboard and touch.
 */
const PAGE = '/panel/ai';
const ACT = 'İşlem yap';
const R3_TEXT = 'SO-0041 siparişini iptal et';
const R1_TEXT = 'SO-0041 siparişinin teslim tarihini bir gün ileri al';

async function open(page: Page, query = '') {
  await page.goto(`${PAGE}${query}`);
  await expect(page.getByRole('textbox', { name: 'Asistana mesaj yazın' })).toBeVisible();
}

async function ask(page: Page, text: string) {
  await page.getByRole('textbox', { name: 'Asistana mesaj yazın' }).fill(text);
  await page.getByRole('button', { name: 'Mesajı gönder' }).click();
}

/** Clicks the mode label. The antd radio input is invisible, so the user clicks the label. */
async function pickAct(page: Page) {
  await page.locator('.ai-mode label').filter({ hasText: ACT }).click();
  await expect(
    page.getByRole('region', { name: 'AI Studio' }).getByRole('radio', { name: ACT }),
  ).toBeChecked();
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

async function settle(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
}

test.describe('Yardımcı akışı', () => {
  test('sunucu olayı gelmeden araç olayı görünmez', async ({ page }) => {
    // The mock server waits 1.5 seconds before each event. There is no list before the first event.
    await open(page, '?gecikme=1500');
    await pickAct(page);
    await ask(page, R1_TEXT);
    const log = page.getByRole('log');
    await expect(page.getByRole('button', { name: 'Yanıtı durdur' })).toBeVisible();
    await expect(log.locator('[data-genui="events"]')).toHaveCount(0);
    await expect(log.getByText('Araç olayları')).toHaveCount(0);
    // The list appears when the first server event arrives.
    await expect(log.locator('[data-genui="events"]').first()).toBeVisible({ timeout: 15_000 });
  });

  test('R3 önerisinde ad yanlış yazılınca "Onayla" kapalı kalır', async ({ page }) => {
    await open(page);
    await pickAct(page);
    await ask(page, R3_TEXT);
    const card = page.locator('[data-genui="confirm"][data-risk="R3"]');
    await expect(card).toBeVisible({ timeout: 15_000 });
    const approve = card.getByRole('button', { name: 'Onayla' });
    await expect(approve).toBeDisabled();
    const input = card.getByRole('textbox');
    await input.fill('SO-0014');
    await expect(approve).toBeDisabled();
    await input.fill('SO-0041');
    await expect(approve).toBeEnabled();
  });

  test('ekranda "Geri al", baykuş ve yüzde yoktur', async ({ page }) => {
    await open(page);
    await expect(page.locator('svg.owl, .owl')).toHaveCount(0);
    await pickAct(page);
    await ask(page, R1_TEXT);
    const card = page.locator('[data-genui="confirm"]');
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.getByRole('button', { name: 'Onayla' }).click();
    await expect(page.locator('[data-genui="result"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Geri al', exact: true })).toHaveCount(0);
    await expect(page.locator('svg.owl, .owl')).toHaveCount(0);
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/%\s?\d|\d\s?%/);
  });

  test('akışla sayfa yatay taşmaz ve axe hata vermez', async ({ page }) => {
    await open(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await pickAct(page);
    await ask(page, R3_TEXT);
    await expect(page.locator('[data-genui="confirm"]')).toBeVisible({ timeout: 15_000 });
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await settle(page);
    const result = await new AxeBuilder({ page }).include('.ai-studio').analyze();
    expect(
      result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    ).toEqual([]);
  });

  test('kip klavyeyle seçilir ve onay klavyeyle verilir', async ({ page }) => {
    await open(page);
    const studio = page.getByRole('region', { name: 'AI Studio' });
    await studio.getByRole('radio', { name: 'Sor' }).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(studio.getByRole('radio', { name: ACT })).toBeChecked();
    await page.getByRole('textbox', { name: 'Asistana mesaj yazın' }).fill(R1_TEXT);
    await page.keyboard.press('Enter');
    const card = page.locator('[data-genui="confirm"]');
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.getByRole('button', { name: 'Onayla' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-genui="result"]')).toBeVisible({ timeout: 15_000 });
  });

  test('kip ve onay dokunmayla seçilir, dokunma alanı yeterlidir', async ({ page }, info) => {
    test.skip(!info.project.use.hasTouch, `${info.project.name}: dokunma yok`);
    await open(page);
    const radio = page.locator('.ai-mode label').filter({ hasText: ACT });
    const box = await radio.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
    await radio.tap();
    await expect(
      page.getByRole('region', { name: 'AI Studio' }).getByRole('radio', { name: ACT }),
    ).toBeChecked();
    await ask(page, R1_TEXT);
    const card = page.locator('[data-genui="confirm"]');
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.getByRole('button', { name: 'Onayla' }).tap();
    await expect(page.locator('[data-genui="result"]')).toBeVisible({ timeout: 15_000 });
  });
});

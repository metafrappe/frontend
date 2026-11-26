import { expect, test } from '../../../../tests/setup/playwright-fixtures';
import type { Page } from '../../../../tests/setup/playwright-fixtures';
import AxeBuilder from '@axe-core/playwright';
import { isPhone } from './phone-helpers';

const preview = '/src/views/collection/preview/';
const screenshotDir = process.env['AJA_SCREENSHOT_DIR'];
const phoneButtons = ['Süzgeç', 'Sırala', 'Seç', 'Tablo'] as const;

async function noPageOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
}
/** Kayıt metninde harf arası bölme kuralı kullanılmaz. */
async function forcedBreaks(page: Page) {
  return page
    .locator('.collection')
    .evaluate(
      (root) =>
        [root, ...root.querySelectorAll<HTMLElement>('*')].filter(
          (element) =>
            getComputedStyle(element).wordBreak === 'break-all' ||
            getComputedStyle(element).overflowWrap === 'anywhere',
        ).length,
    );
}

test('row height has three token levels and coarse pointers get at least 48 px', async ({
  page,
}) => {
  const expected = { sm: 36, md: 42, lg: 48 } as const;
  for (const level of ['sm', 'md', 'lg'] as const) {
    await page.goto(preview + '?row=' + level);
    await expect(page.getByText('ORNEK-0001', { exact: true })).toBeVisible();
    if (isPhone(page)) await page.getByRole('button', { name: 'Tablo', exact: true }).click();
    const coarse = await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches);
    const heights = await page
      .locator('.collection-table tbody tr')
      .evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThan(0);
    for (const height of heights) {
      if (coarse) expect(height).toBeGreaterThanOrEqual(48);
      else expect(Math.round(height)).toBe(expected[level]);
    }
  }
});

test('phone shows record cards, one tool row and a table toggle', async ({ page }, testInfo) => {
  test.skip(!isPhone(page), 'Kart görünümü yalnız dar ekranda vardır.');
  await page.goto(preview);
  const first = page.getByText('ORNEK-0001', { exact: true });
  await expect(first).toBeVisible();
  // İlk ekranda en az bir kayıt görünür.
  const cards = page.getByRole('list', { name: 'Örnek kayıtlar kayıtları' });
  await expect(cards).toBeVisible();
  const card = cards.getByRole('listitem').first();
  const viewport = page.viewportSize();
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport?.height ?? 0);
  await expect(page.getByRole('region', { name: 'Kayıt tablosu yatay kaydırma' })).toHaveCount(0);

  // Dört düğme tek satırdadır. Her birinin dokunma alanı en az 48 px'tir.
  const tools = page.getByRole('group', { name: 'Liste araçları' });
  const sizes = await Promise.all(
    phoneButtons.map((name) =>
      tools.getByRole('button', { name: new RegExp('^' + name) }).evaluate((button) => {
        const rect = button.getBoundingClientRect();
        return {
          top: Math.round(rect.top),
          height: rect.height,
          width: rect.width,
          font: parseFloat(getComputedStyle(button).fontSize),
          // Dokunma katmanı düğmenin dışına taşar. Bu yüzden metin parçasının sınırı ölçülür.
          clipped: [...button.querySelectorAll('span')].some((part) => {
            const inner = part.getBoundingClientRect();
            return inner.left < rect.left - 0.5 || inner.right > rect.right + 0.5;
          }),
        };
      }),
    ),
  );
  for (const size of sizes) {
    expect(size.top).toBe(sizes[0]?.top);
    expect(size.height).toBeGreaterThanOrEqual(48);
    expect(size.width).toBeGreaterThanOrEqual(48);
    expect(size.font).toBeGreaterThanOrEqual(14);
    expect(size.clipped).toBe(false);
  }
  expect(await noPageOverflow(page)).toBe(true);
  expect(await forcedBreaks(page)).toBe(0);
  let axe = await new AxeBuilder({ page }).include('.collection').analyze();
  expect(axe.violations).toEqual([]);

  // "Süzgeç" ve "Sırala" kendi alanlarını açar.
  const filter = tools.getByRole('button', { name: /^Süzgeç/ });
  await expect(page.getByRole('textbox', { name: 'Kayıt ara' })).toBeHidden();
  await filter.click();
  await expect(filter).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('textbox', { name: 'Kayıt ara' })).toBeVisible();
  const sort = tools.getByRole('button', { name: 'Sırala', exact: true });
  await sort.click();
  await expect(sort).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('combobox', { name: 'Sıralama alanı' })).toBeVisible();
  await filter.click();
  await sort.click();
  await expect(page.getByRole('combobox', { name: 'Sıralama alanı' })).toBeHidden();

  // "Tablo" düğmesi kart ile tablo arasında geçiş yapar.
  const toggle = tools.getByRole('button', { name: 'Tablo', exact: true });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  const restingBackground = await toggle.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  // Basılı düğme görsel olarak da ayrılır. İmleç düğmeden çekilir ki üzerine gelme rengi karışmasın.
  if (!testInfo.project.use.isMobile) await page.mouse.move(0, 0);
  await expect
    .poll(() => toggle.evaluate((element) => getComputedStyle(element).backgroundColor))
    .not.toBe(restingBackground);
  await expect(cards).toHaveCount(0);
  const scroller = page.getByRole('region', { name: 'Kayıt tablosu yatay kaydırma' });
  await expect(scroller).toBeVisible();
  expect(await scroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
    true,
  );
  expect(await noPageOverflow(page)).toBe(true);
  expect(await forcedBreaks(page)).toBe(0);
  axe = await new AxeBuilder({ page }).include('.collection').analyze();
  expect(axe.violations).toEqual([]);

  // Kutu klavyeyle odak alır. Ok tuşu kaydırması Chromium'da ölçülür.
  // Playwright WebKit odaklı kutuyu ok tuşuyla kaydırmaz. Gerçek Safari denetimi ayrıca yapılır.
  await scroller.focus();
  await expect(scroller).toBeFocused();
  if (testInfo.project.name.startsWith('chromium')) {
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await scroller.evaluate((element) => {
      element.scrollLeft = 0;
    });
  }
  // Fare tekerleği ile kayar. Playwright WebKit yatay tekerlek olayını kutuya iletmez.
  // Bu yüzden tekerlek denetimi Chromium'da koşar. Dokunmatik profilde fare tekerleği yoktur.
  if (testInfo.project.name.startsWith('chromium')) {
    const area = await scroller.boundingBox();
    await page.mouse.move((area?.x ?? 0) + 20, (area?.y ?? 0) + 20);
    await page.mouse.wheel(120, 0);
    await expect.poll(() => scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await scroller.evaluate((element) => {
      element.scrollLeft = 0;
    });
  }
  // Dokunma ile kayar. Chromium dokunma hareketini CDP ile üretir.
  if (testInfo.project.name.startsWith('chromium')) {
    const area = await scroller.boundingBox();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.synthesizeScrollGesture', {
      x: (area?.x ?? 0) + (area?.width ?? 0) / 2,
      y: (area?.y ?? 0) + 20,
      xDistance: -150,
      yDistance: 0,
      gestureSourceType: 'touch',
    });
    await expect.poll(() => scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  }
  // Geri dönünce kartlar yeniden görünür.
  await toggle.click();
  await expect(cards).toBeVisible();
});

test('root font 200% keeps buttons and records readable', async ({ page }) => {
  test.skip(!isPhone(page), 'Kök yazı denetimi telefon genişliğinde yapılır.');
  await page.goto(preview);
  await expect(page.getByText('ORNEK-0001', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await expect(page.getByText('ORNEK-0001', { exact: true })).toBeVisible();
  const tools = page.getByRole('group', { name: 'Liste araçları' });
  for (const name of phoneButtons) {
    const button = tools.getByRole('button', { name: new RegExp('^' + name) });
    await expect(button).toBeVisible();
    const clipped = await button.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return [...element.querySelectorAll('span')].some((part) => {
        const inner = part.getBoundingClientRect();
        return inner.left < rect.left - 0.5 || inner.right > rect.right + 0.5;
      });
    });
    expect(clipped).toBe(false);
  }
  expect(await noPageOverflow(page)).toBe(true);
  expect(await forcedBreaks(page)).toBe(0);
});

test('captures phone and desktop screenshots', async ({ page }, testInfo) => {
  test.skip(!screenshotDir, 'AJA_SCREENSHOT_DIR verilmedi.');
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Görüntü yalnız bir projede alınır.');
  for (const width of [320, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(preview);
    await expect(page.getByText('ORNEK-0001', { exact: true })).toBeVisible();
    await page.screenshot({
      path: `${screenshotDir}/AJA-1195-liste-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(preview);
  await page.getByRole('button', { name: 'Tablo', exact: true }).click();
  await page.screenshot({
    path: `${screenshotDir}/AJA-1195-liste-320-tablo.png`,
    fullPage: true,
    animations: 'disabled',
  });
});

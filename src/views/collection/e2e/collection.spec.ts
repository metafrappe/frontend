import { expect, test } from '../../../../tests/setup/playwright-fixtures';
import AxeBuilder from '@axe-core/playwright';
import designSource from '../../../../design/source/control-size-config.json' with { type: 'json' };
import { isPhone, openPhoneTools, showTable } from './phone-helpers';
test('expanded input and select targets work without covering their centers', async ({
  page,
}, testInfo) => {
  await page.goto(preview + '?experimentalViews=1');
  await expect(page.getByText('ORNEK-0001', { exact: true })).toBeVisible();
  await openPhoneTools(page);
  const input = page.getByRole('textbox', { name: 'Kayıt ara' });
  const wrapper = page.locator('.collection-input');
  const inputBox = await wrapper.boundingBox();
  if (!inputBox) throw new Error('Missing input target');
  if (testInfo.project.use.hasTouch)
    await page.touchscreen.tap(inputBox.x + inputBox.width / 2, inputBox.y - 1);
  else await page.mouse.click(inputBox.x + inputBox.width / 2, inputBox.y - 1);
  await expect(input).toBeFocused();
  await input.fill('Örnek');
  await expect(input).toHaveValue('Örnek');
  const select = page
    .locator('.collection-select')
    .filter({ has: page.getByRole('combobox', { name: 'Görünüm', exact: true }) });
  await select.scrollIntoViewIfNeeded();
  const selectBox = await select.boundingBox();
  if (!selectBox) throw new Error('Missing select target');
  if (testInfo.project.use.hasTouch)
    await page.touchscreen.tap(selectBox.x + selectBox.width / 2, selectBox.y - 1);
  else await page.mouse.click(selectBox.x + selectBox.width / 2, selectBox.y - 1);
  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Görünüm', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.collection-popup:visible')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Görünüm', exact: true }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Görünüm', exact: true })).toHaveAttribute(
    'aria-activedescendant',
    /_0$/,
  );
  await page.locator('.collection-popup:visible').evaluate(async (element) => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  await page.locator('.collection-popup:visible').screenshot({
    path: testInfo.outputPath('dropdown-open.png'),
    animations: 'disabled',
  });
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Görünüm', exact: true })).toHaveAttribute(
    'aria-activedescendant',
    /_1$/,
  );
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-view="kanban"]')).toBeVisible();
});

const preview = '/src/views/collection/preview/';
test('table preserves readability, keyboard focus, selection and URL history', async ({
  page,
  browserName,
}, testInfo) => {
  await page.goto(preview + '?experimentalViews=1');
  await expect(page.getByText('ORNEK-0001', { exact: true })).toBeVisible();
  // Telefonda tablo "Tablo" düğmesiyle açılır. Arama "Süzgeç" düğmesiyle açılır.
  await openPhoneTools(page);
  await showTable(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const scroller = page.getByRole('region', { name: 'Kayıt tablosu yatay kaydırma' });
  // Dar telefonda tablo kendi kapsayıcısında kayar. Geniş ekranda sığabilir.
  if ((page.viewportSize()?.width ?? 0) <= 400)
    expect(await scroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      true,
    );
  const fontSizes = await page
    .locator('.collection')
    .evaluate((root) =>
      [...root.querySelectorAll<HTMLElement>('*')]
        .filter(
          (element) => element.textContent?.trim() && element.getBoundingClientRect().width > 0,
        )
        .map((element) => parseFloat(getComputedStyle(element).fontSize)),
    );
  expect(Math.min(...fontSizes)).toBeGreaterThanOrEqual(14);
  // Görünüm satırı önce gelir: kayıtlı görünüm, görünüm türü ve "Seç", sonra arama.
  // WebKit varsayılan ayarda Tab ile radyo düğmesine gitmez. Safari de böyle davranır.
  // Telefon düğmelerine basıldıysa Tab sırası başlıktan yeniden başlar.
  if (isPhone(page)) await page.getByRole('heading', { name: 'Örnek kayıtlar' }).click();
  await page.keyboard.press('Tab');
  if (browserName !== 'webkit') {
    await expect(page.getByRole('radio', { name: 'Tümü' })).toBeFocused();
    await page.keyboard.press('Tab');
  }
  await expect(page.getByRole('combobox', { name: 'Görünüm', exact: true })).toBeFocused();
  // WebKit varsayılan ayarda Tab ile düğmelere de gitmez.
  // Telefonda sıra "Süzgeç", "Sırala", "Seç" ve "Tablo" olur. Geniş ekranda yalnız "Seç" vardır.
  if (browserName !== 'webkit') {
    const order = isPhone(page) ? [/^Süzgeç/, /^Sırala$/, /^Seç$/, /^Tablo$/] : [/^Seç$/];
    for (const name of order) {
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name })).toBeFocused();
    }
  }
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Kayıt ara' })).toBeFocused();
  const wrapper = page.locator('.collection-input');
  expect(await wrapper.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe('none');
  expect(
    await page
      .getByRole('textbox', { name: 'Kayıt ara' })
      .evaluate((element) => getComputedStyle(element).outlineStyle),
  ).toBe('none');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await page.getByRole('button', { name: 'Seç', exact: true }).click();
  await page.getByRole('checkbox', { name: 'ORNEK-0001 seç', exact: true }).check();
  await expect(page.getByRole('region', { name: 'Toplu işlem', exact: true })).toContainText(
    '1 kayıt seçildi',
  );
  await page.getByRole('button', { name: 'Sonraki sayfa' }).click();
  await expect(page.getByText('ORNEK-0021', { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByText('ORNEK-0001', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('table.png'), fullPage: true });
  const axe = await new AxeBuilder({ page }).include('.collection').analyze();
  expect(axe.violations).toEqual([]);
});
test('loads only requested views and supports keyboard dropdown navigation', async ({
  page,
}, testInfo) => {
  const scripts: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(request.url());
  });
  await page.goto(preview + '?experimentalViews=1');
  await expect(page.getByText('ORNEK-0001', { exact: true })).toBeVisible();
  await openPhoneTools(page);
  expect(scripts.some((url) => /(?:Kanban|Pivot|Report|Gantt|Timesheet)View-/.test(url))).toBe(
    false,
  );
  for (const [value, label] of [
    ['kanban', 'Kanban'],
    ['pivot', 'Pivot'],
    ['report', 'Rapor'],
    ['gantt', 'Gantt'],
    ['timesheet', 'Timesheet'],
  ] as const) {
    const combo = page.getByRole('combobox', { name: 'Görünüm', exact: true });
    await page.locator('.collection-select').filter({ has: combo }).click();
    await page.getByRole('option', { name: label, exact: true }).click();
    await expect(page.locator('[data-view="' + value + '"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.locator('.collection-popup:visible')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(value + '.png'), fullPage: true });
  }
  await page.getByRole('combobox', { name: 'Görünüm', exact: true }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Görünüm', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).not.toBeVisible();
  // Arama ortak istemciyle /api/v2/document ucuna `like` süzgeci olarak gider.
  const searched = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname.startsWith('/api/v2/document/') &&
      url.searchParams.get('filters') === JSON.stringify([['title', 'like', '%Örnek veri 2%']])
    );
  });
  await page.getByRole('textbox', { name: 'Kayıt ara' }).fill('Örnek veri 2');
  await page.getByRole('button', { name: 'Ara', exact: true }).click();
  await searched;
  await expect(page).toHaveURL(/search=%C3%96rnek\+veri\+2/);
  const resources = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((entry) => {
      const resource = entry as PerformanceResourceTiming;
      return {
        name: resource.name,
        type: resource.initiatorType,
        transfer: resource.transferSize,
        encoded: resource.encodedBodySize,
        decoded: resource.decodedBodySize,
      };
    }),
  );
  await testInfo.attach('resource-bytes', {
    body: JSON.stringify(resources, null, 2),
    contentType: 'application/json',
  });
  await testInfo.attach('environment', {
    body: JSON.stringify({
      browser: page.context().browser()?.version(),
      project: testInfo.project.name,
      viewport: page.viewportSize(),
      userAgent: await page.evaluate(() => navigator.userAgent),
      touch: await page.evaluate(() => navigator.maxTouchPoints),
    }),
    contentType: 'application/json',
  });
  await testInfo.attach('script-requests', {
    body: JSON.stringify(scripts, null, 2),
    contentType: 'application/json',
  });
});
test('shows all data states, light theme and reduced motion', async ({ page }, testInfo) => {
  for (const [state, message] of [
    ['loading', 'Kayıtlar yükleniyor.'],
    ['empty', 'Kayıt bulunamadı.'],
    ['error', 'Kayıtlar yüklenemedi.'],
    ['unauthorized', 'Bu kayıtları görme yetkiniz yok.'],
  ] as const) {
    await page.goto(preview + '?experimentalViews=1&view=report&state=' + state);
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(preview + '?theme=light');
  await expect(page.getByText('ORNEK-0001', { exact: true })).toBeVisible();
  await openPhoneTools(page);
  // Telefonda tek seçenekli "Görünüm" listesi yoktur. Açılır liste "Sıralama alanı" ile denenir.
  const popupOwner = page.getByRole('combobox', {
    name: isPhone(page) ? 'Sıralama alanı' : 'Görünüm',
    exact: true,
  });
  await page.locator('.collection-select').filter({ has: popupOwner }).click();
  expect(
    await page
      .locator('.collection-popup')
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none');
  const popup = page.locator('.collection-popup:visible');
  const shadow = await popup.evaluate((element) => getComputedStyle(element).boxShadow);
  expect(shadow).not.toBe('none');
  expect(shadow).toBe(
    await popup.evaluate((element, expectedShadow) => {
      const probe = document.createElement('div');
      probe.style.boxShadow = expectedShadow;
      element.appendChild(probe);
      const value = getComputedStyle(probe).boxShadow;
      probe.remove();
      return value;
    }, designSource.derived.shadowCss.dropdown),
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('.collection-popup:visible')).toHaveCount(0);
  const direction = page.getByRole('combobox', { name: 'Sıralama yönü' });
  await page.locator('.collection-select').filter({ has: direction }).click();
  await page.getByRole('option', { name: 'Azalan', exact: true }).click();
  await expect(direction).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.collection-popup:visible')).toHaveCount(0);
  const lightAxe = await new AxeBuilder({ page }).include('.collection').analyze();
  expect(lightAxe.violations).toEqual([]);
  await page.getByRole('textbox', { name: 'Kayıt ara' }).fill('Taslak');
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole('textbox', { name: 'Kayıt ara' })).toHaveValue('Taslak');
  await expect(page.getByRole('textbox', { name: 'Kayıt ara' })).toBeFocused();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('light-landscape.png'), fullPage: true });
});

test('default gate prevents summary rendering and downloads from a shared URL', async ({
  page,
}) => {
  const scripts: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(request.url());
  });
  await page.goto(preview + '?view=pivot');
  await expect(page.getByText('ORNEK-0001', { exact: true })).toBeVisible();
  await showTable(page);
  await expect(page.locator('[data-view="table"]')).toBeVisible();
  await expect(
    page.getByText('İstenen görünüm şu anda kapalı. Tablo gösteriliyor.', { exact: true }),
  ).toBeVisible();
  const viewType = page.getByRole('combobox', { name: 'Görünüm', exact: true });
  // Telefonda tek seçenekli görünüm listesi gösterilmez.
  if (isPhone(page)) await expect(viewType).toHaveCount(0);
  else {
    await page.locator('.collection-select').filter({ has: viewType }).click();
    await expect(page.getByRole('option')).toHaveCount(1);
  }
  expect(scripts.some((url) => /(?:Kanban|Pivot|Report|Gantt|Timesheet)View-/.test(url))).toBe(
    false,
  );
});

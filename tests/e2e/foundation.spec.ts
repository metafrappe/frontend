import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '../setup/playwright-fixtures';

const DEMO = '/_demo/foundation';

test.describe('temel kapılar', () => {
  test.beforeEach(async ({ page }) => {
    // Do not measure before transitions finish. The preference is set before the page opens; changing it in the page
    // rebuilds the theme and remounts the elements.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(DEMO);
    await expect(page.getByRole('heading', { level: 1, name: 'Atonota' })).toBeVisible();
  });

  test('tema düğmesi açık, koyu ve sistem seçeneklerini uygular', async ({ page }) => {
    const html = page.locator('html');
    await page.getByRole('radiogroup', { name: 'Tema' }).getByText('Koyu', { exact: true }).click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(html).toHaveCSS('color-scheme', 'dark');
    await page.getByRole('radiogroup', { name: 'Tema' }).getByText('Açık', { exact: true }).click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await page
      .getByRole('radiogroup', { name: 'Tema' })
      .getByText('Sistem', { exact: true })
      .click();
    await expect(html).toHaveAttribute('data-theme', /light|dark/);
    await page.reload();
    expect(await page.evaluate(() => localStorage.getItem('atonota.theme-mode'))).toBe('system');
  });

  test('yazı tipi Outfit ve metin en az 12 px', async ({ page }) => {
    const family = await page.locator('body').evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family).toContain('Outfit');
    const tooSmall = await page.evaluate(() =>
      Array.from(document.querySelectorAll('main *'))
        .filter(
          (el) =>
            el.childNodes.length &&
            Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent?.trim()),
        )
        .map((el) => parseFloat(getComputedStyle(el).fontSize))
        .filter((px) => px < 12),
    );
    expect(tooSmall).toEqual([]);
  });

  test('kontrol yükseklikleri 36, 42 ve 48 px', async ({ page }) => {
    const h = async (id: string) => (await page.getByTestId(id).boundingBox())?.height ?? 0;
    expect(Math.round(await h('btn-sm'))).toBe(36);
    expect(Math.round(await h('btn-md'))).toBe(42);
    expect(Math.round(await h('btn-lg'))).toBe(48);
  });

  test('ok tuşu klavye modunu açmaz', async ({ page }) => {
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('html')).not.toHaveAttribute('data-focus-mode', 'keyboard');
  });

  test('dokunma alanı: %12 genişleme, pasif kontrol hariç, bitişik kenar 0', async ({ page }) => {
    const md = page.getByTestId('btn-md');
    await expect(md).toHaveClass(/\bhit\b/);
    await expect(md).toHaveAttribute('data-hit-ok', '1');
    const info = await md.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const after = getComputedStyle(el, '::after');
      return {
        h: r.height,
        w: r.width,
        top: parseFloat(after.top),
        left: parseFloat(after.left),
        position: getComputedStyle(el).position,
        hit: el.getAttribute('data-hit') ?? '',
      };
    });
    const [t, , , l] = info.hit.split(' ').map(Number);
    // R1 + R2: top/bottom h·0.06; left/right w·0.06 (if no neighbour)
    expect(t).toBeCloseTo(info.h * 0.06, 1);
    expect(l ?? 0).toBeLessThanOrEqual(info.w * 0.06 + 0.01);
    // R7: ::after overflows outwards with a negative offset; the box is positioned
    expect(info.position).not.toBe('static');
    expect(info.top).toBeLessThan(0);
    expect(info.left).toBeLessThan(0);

    // R6: a disabled button is not enlarged
    await expect(page.getByTestId('btn-disabled')).not.toHaveClass(/\bhit\b/);

    // R4: Space.Compact shared edge 0
    const leftHit = (await page.getByTestId('compact-left').getAttribute('data-hit')) ?? '';
    const rightHit = (await page.getByTestId('compact-right').getAttribute('data-hit')) ?? '';
    expect(Number(leftHit.split(' ')[1])).toBe(0);
    expect(Number(rightHit.split(' ')[3])).toBe(0);

    // R9: applied to the input wrapper
    const wrapper = page.locator('.ant-input-affix-wrapper').first();
    await expect(wrapper).toHaveClass(/\bhit\b/);
    await expect(page.getByTestId('input-md')).not.toHaveClass(/\bhit\b/);
  });

  test('R11: Select genişletilmiş alandan tıklanınca açılır ve değer seçilir', async ({ page }) => {
    const root = page.getByTestId('select-md');
    await root.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    const box = (await root.boundingBox())!;
    // Click near the root element's top edge, on the ::after layer
    await page.mouse.click(box.x + box.width / 2, box.y + 1);
    // antd's role="listbox" element is for screen readers and has zero size; the visible list is .ant-select-dropdown.
    await expect(page.locator('.ant-select-dropdown')).toBeVisible();
    await expect(root.locator('.ant-select-selection-search-input')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await page.locator('.ant-select-item-option', { hasText: 'Orta' }).click();
    await expect(page.locator('.ant-select-dropdown')).toBeHidden();
    await expect(root.locator('.ant-select-selection-item')).toHaveText('Orta');
    expect(await page.locator('select').count()).toBe(0);
  });

  test('dropdown ve select listesi tarayıcı yerel select değildir', async ({ page }) => {
    expect(await page.locator('select').count()).toBe(0);
  });

  async function pickSelectValue(page: Page) {
    await page.getByTestId('select-md').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.getByTestId('select-md').click();
    await expect(page.locator('.ant-select-dropdown')).toBeVisible();
    await page.locator('.ant-select-item-option', { hasText: 'Orta' }).click();
    await expect(page.getByTestId('select-md').locator('.ant-select-selection-item')).toHaveText(
      'Orta',
    );
  }

  test('axe: erişilebilirlik ihlali yok', async ({ page }) => {
    await pickSelectValue(page);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  async function switchToDark(page: Page) {
    await page.getByRole('radiogroup', { name: 'Tema' }).getByText('Koyu', { exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    // Wait until the antd colour transition finishes: dark button background #34343B.
    await expect(page.getByTestId('btn-sm')).toHaveCSS('background-color', 'rgb(52, 52, 59)');
  }

  test('axe: koyu temada erişilebilirlik ihlali yok', async ({ page }) => {
    await switchToDark(page);
    await pickSelectValue(page);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('koyu birincil buton metni AA kontrastını verir', async ({ page }) => {
    await switchToDark(page);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include('.ant-btn-primary')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test('odak modu: Tab açar, pointerdown kapatır', async ({ page }) => {
  await page.goto(DEMO);
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-focus-mode', 'keyboard');
  await page.getByTestId('btn-sm').click();
  await expect(html).not.toHaveAttribute('data-focus-mode', 'keyboard');
  await page.keyboard.press('Tab');
  await expect(html).toHaveAttribute('data-focus-mode', 'keyboard');
  await page.mouse.click(5, 5);
  await expect(html).not.toHaveAttribute('data-focus-mode', 'keyboard');
});

test.describe('kök sayfa', () => {
  test('kabuk sağlayıcılar içinde açılır ve sahte sunucu bildirimi görünür', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.shell')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Örnek veri' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/);
    const family = await page.locator('body').evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family).toContain('Outfit');
  });

  // `src/app/build-output.node.test.ts` checks that the test page is absent from the production build.
  test('deneme sayfası e2e derlemesinde /_demo/foundation yolunda açılır', async ({ page }) => {
    await page.goto(DEMO);
    await expect(page.getByRole('heading', { level: 1, name: 'Atonota' })).toBeVisible();
  });
});

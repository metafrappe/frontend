/**
 * Accessibility audit findings (Ö1, Ö2, Ö3, Ö5, Ö6, K1, K3, K5, list header).
 * The finding IDs are the IDs in the `qa-a11y-raporu.md` report.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { tokenColor } from '../../../tests/setup/odak-gostergesi';
import { expect, test } from '../../../tests/setup/playwright-fixtures';

const LIST = `/ornek/${encodeURIComponent('örnek-kayıt')}`;
/** The shell's test page: the text link and the breadcrumb link are here. */
const DEMO = '/_demo/shell';

const isCompact = (page: Page) => {
  const v = page.viewportSize();
  return !!v && (v.width <= 767 || v.height <= 499);
};

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
  });
}

/** Turns on visible focus mode with Tab. Then focus is given to the element programmatically. */
async function keyboardFocus(page: Page, target: Locator) {
  await page.keyboard.press('Tab');
  await expect(page.locator('html')).toHaveAttribute('data-focus-mode', 'keyboard');
  await target.focus();
  await expect(target).toBeFocused();
}

async function openMenu(page: Page) {
  if (!isCompact(page)) return;
  await page.getByRole('button', { name: 'Menüyü aç' }).click();
  await expect(page.getByRole('dialog', { name: 'Menü' })).toBeVisible();
}

test.describe('Ö1: metin bağlantısında klavye odağı görünür', () => {
  test('odaklanınca alt çizgi kalınlaşır ve vurgu rengi olur', async ({ page }) => {
    await page.goto(DEMO);
    const link = page.getByRole('link', { name: 'yardım sayfası' });
    await expect(link).toBeVisible();
    await settle(page);
    // The colour is read from the token: `--focus-indicator-color` (dark blue in the light theme, AJA-997).
    const focusRgb = await tokenColor(page, '--focus-indicator-color');
    const rest = await link.evaluate((el) => {
      const s = getComputedStyle(el);
      return { thickness: s.textDecorationThickness, color: s.textDecorationColor };
    });
    await keyboardFocus(page, link);
    await expect(link).toHaveCSS('text-decoration-line', 'underline');
    await expect(link).toHaveCSS('text-decoration-thickness', '2px');
    await expect(link).toHaveCSS('text-decoration-color', focusRgb);
    // The indicator really changes the appearance: it differs from the resting state.
    expect(rest.thickness === '2px' && rest.color === focusRgb).toBe(false);
    // There is no surrounding ring.
    await expect(link).toHaveCSS('outline-style', 'none');
    await expect(link).toHaveCSS('box-shadow', 'none');
  });

  test('ekmek kırıntısı bağlantısı da aynı göstergeyi alır', async ({ page }) => {
    await page.goto(DEMO);
    const crumb = page.getByRole('navigation', { name: 'Konum' }).getByRole('link');
    await expect(crumb).toBeVisible();
    await settle(page);
    const focusRgb = await tokenColor(page, '--focus-indicator-color');
    await keyboardFocus(page, crumb);
    await expect(crumb).toHaveCSS('text-decoration-thickness', '2px');
    await expect(crumb).toHaveCSS('text-decoration-color', focusRgb);
  });
});

test.describe('Ö2: menü yalnız açılabilen sayfaları gösterir', () => {
  test('menüde örnek grup, örnek sayı ve örnek ajan yoktur', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Bekleyenler' })).toBeVisible();
    await openMenu(page);
    const nav = page.getByRole('navigation', { name: 'Ana gezinme' });
    await expect(nav.getByRole('link', { name: 'Ana sayfa' })).toBeVisible();
    for (const name of ['Satış', 'Stok', 'Muhasebe']) {
      await expect(nav.getByRole('button', { name, exact: true })).toHaveCount(0);
    }
    await expect(nav.getByRole('link', { name: 'Görevler' })).toHaveCount(0);
    await expect(nav.locator('.shell-badge')).toHaveCount(0);
    await expect(nav.getByRole('heading', { name: 'AI ajanları' })).toHaveCount(0);
  });

  test('menüdeki her bağlantı hata ya da "bulunamadı" ekranı açmaz', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/');
    await openMenu(page);
    const nav = page.getByRole('navigation', { name: 'Ana gezinme' });
    await expect(nav.getByRole('link', { name: 'Ana sayfa' })).toBeVisible();
    const hrefs = await nav
      .locator('a[href]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of new Set(hrefs)) {
      await page.goto(href);
      await expect(page.locator('.shell-main h1').first(), href).toBeAttached();
      await expect(page.getByText('Liste tanımı alınamadı'), href).toHaveCount(0);
      await expect(page.getByText('Sayfa bulunamadı'), href).toHaveCount(0);
    }
  });
});

test.describe('Ö3: liste hata ekranında sayfa başlığı vardır', () => {
  test('h1 görünür ve adresteki türü söyler', async ({ page }) => {
    await page.goto('/satis/teklif');
    await expect(page.getByRole('alert')).toContainText('Liste tanımı alınamadı');
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('Teklif');
    await expect(h1).toBeVisible();
  });
});

test.describe('liste başlığı DocType adını gösterir', () => {
  test('"Kayıtlar" yazmaz', async ({ page }) => {
    await page.goto(LIST);
    await expect(page.getByText('ORNEK-0001').first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Örnek Kayıt' })).toBeAttached();
    await expect(page.getByRole('heading', { name: 'Kayıtlar', exact: true })).toHaveCount(0);
  });
});

test.describe('Ö5: "Sayfa bulunamadı" alt metni yeterli kontrast verir', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`axe renk kontrastı: ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/olmayan/adres/x/y');
      await expect(page.getByRole('heading', { level: 1, name: 'Sayfa bulunamadı' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
      await settle(page);
      const r = await new AxeBuilder({ page })
        .include('.ant-result')
        .withRules(['color-contrast'])
        .analyze();
      expect(r.violations.map((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([]);
    });
  }
});

test.describe('Ö6: yapışkan üst çubuk odaklanan öğeyi örtmez', () => {
  test('liste sayfasında aşağıdan odaklanan kutu üst çubuğun altında kalmaz', async ({ page }) => {
    test.skip(!isCompact(page), 'üst çubuk yalnız telefon kabuğunda');
    await page.goto(LIST);
    const box = page.getByRole('checkbox', { name: 'Bu sayfadaki tüm kayıtları seç' });
    await expect(box).toBeAttached();
    await settle(page);
    const scrollable = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight,
    );
    test.skip(!scrollable, 'sayfa kaymıyor');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.keyboard.press('Tab');
    await box.focus();
    await expect(box).toBeFocused();
    const top = await page.evaluate(() => {
      const bar = document.querySelector('.shell-identity')?.getBoundingClientRect();
      return bar?.bottom ?? 0;
    });
    const target = await box.evaluate(
      (el) => (el.closest('.ant-checkbox-wrapper') ?? el).getBoundingClientRect().top,
    );
    expect(target).toBeGreaterThanOrEqual(top);
  });

  test('kaydırma payı kimlik şeridinin ölçülen yüksekliğidir', async ({ page }) => {
    test.skip(!isCompact(page), 'üst çubuk yalnız telefon kabuğunda');
    await page.goto(LIST);
    await expect(page.locator('.shell-identity')).toBeVisible();
    const { padding, bar, token } = await page.evaluate(() => {
      const root = document.documentElement;
      return {
        padding: getComputedStyle(root).scrollPaddingTop,
        bar: document.querySelector('.shell-identity')?.getBoundingClientRect().height ?? 0,
        token: getComputedStyle(root).getPropertyValue('--shell-identity-height').trim(),
      };
    });
    expect(token).toMatch(/^\d+(\.\d+)?px$/);
    expect(padding).toBe(token);
    expect(bar).toBeCloseTo(Number.parseFloat(token), 1);
  });
});

test.describe('K1: menü bağlantılarının altı çizili değildir', () => {
  test('menü bağlantısı çizgisiz, metin bağlantısı çizgili', async ({ page }) => {
    await page.goto(DEMO);
    await openMenu(page);
    const nav = page.getByRole('navigation', { name: 'Ana gezinme' });
    await expect(nav.getByRole('link', { name: 'Ana sayfa' })).toHaveCSS(
      'text-decoration-line',
      'none',
    );
    if (isCompact(page)) await page.keyboard.press('Escape');
    await expect(page.getByRole('link', { name: 'yardım sayfası' })).toHaveCSS(
      'text-decoration-line',
      'underline',
    );
  });

  test('odaklanan menü bağlantısı tek gösterge taşır (alt çizgi eklenmez)', async ({ page }) => {
    test.skip(isCompact(page), 'geniş ekran');
    await page.goto('/');
    const link = page
      .getByRole('navigation', { name: 'Ana gezinme' })
      .getByRole('link', { name: 'Ana sayfa' });
    await expect(page.getByRole('heading', { level: 1, name: 'Bekleyenler' })).toBeVisible();
    await settle(page);
    await keyboardFocus(page, link);
    await expect(link).toHaveCSS('text-decoration-line', 'none');
    await expect
      .poll(() => link.evaluate((el) => getComputedStyle(el, '::after').opacity))
      .toBe('1');
  });
});

test.describe('K3: "Örnek veri" uyarısı kenara yapışık değildir', () => {
  test('uyarının kenar boşluğu boşluk tokenıdır', async ({ page }) => {
    await page.goto('/');
    const notice = page.getByRole('status').filter({ hasText: 'Örnek veri' }).first();
    await expect(notice).toBeVisible();
    const { left, token } = await notice.evaluate((el) => ({
      left: getComputedStyle(el).paddingLeft,
      token: getComputedStyle(document.documentElement).getPropertyValue('--space-md').trim(),
    }));
    expect(token).toMatch(/^\d+px$/);
    expect(left).toBe(token);
  });
});

test.describe('K5: ekmek kırıntısı bağlantısının dokunma alanı', () => {
  test('görünen boy aynı kalır, dokunma alanı en az dokunma tokenı kadardır', async ({ page }) => {
    await page.goto(DEMO);
    const crumb = page.getByRole('navigation', { name: 'Konum' }).getByRole('link');
    await expect(crumb).toBeVisible();
    await settle(page);
    const r = await crumb.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const min = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--hit-min-target'),
      );
      const x = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const reach = (y: number) => {
        const hit = document.elementFromPoint(x, y);
        return !!hit && (hit === el || el.contains(hit));
      };
      return {
        visibleHeight: rect.height,
        fontSize: Number.parseFloat(getComputedStyle(el).fontSize),
        min,
        up: reach(cy - min / 2 + 1),
        down: reach(cy + min / 2 - 1),
      };
    });
    expect(r.min).toBeGreaterThanOrEqual(24);
    // The visible box stays as tall as the text line; only the touch area grows.
    expect(r.visibleHeight).toBeLessThan(r.min);
    expect(r.up).toBe(true);
    expect(r.down).toBe(true);
  });
});

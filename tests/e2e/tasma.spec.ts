import { expect, test, type Page } from '../setup/playwright-fixtures';

const DEMO = '/_demo/foundation';

/**
 * Horizontal overflow (px). Three measurements together:
 * 1. document width, 2. element boxes extending off screen,
 * 3. elements whose content exceeds their box (clipped text). `[data-scroll-x]` containers scroll internally and are not counted.
 */
export async function overflow(page: Page): Promise<{ worst: number; offenders: string[] }> {
  return page.evaluate(() => {
    // The touch target layer (::after) is not content; it is disabled during measurement.
    const probe = document.createElement('style');
    probe.textContent = '.hit::after { display: none !important; }';
    document.head.appendChild(probe);
    const limit = document.documentElement.clientWidth;
    let worst = document.documentElement.scrollWidth - limit;
    const offenders: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Contents of a scroll container are reached by scrolling; the container itself is measured.
      const scroller = el.closest('[data-scroll-x]');
      if (scroller && scroller !== el) continue;
      const outside = Math.max(r.right - limit, -r.left);
      if (outside > 0.5)
        offenders.push(`${el.tagName.toLowerCase()} kutu ${outside.toFixed(1)}px dışarıda`);
      worst = Math.max(worst, outside);
      if (scroller) continue;
      const inner = el.scrollWidth - el.clientWidth;
      if (inner > 1 && el.clientWidth > 0) {
        offenders.push(`${el.tagName.toLowerCase()} içerik ${inner}px taşıyor`);
        worst = Math.max(worst, inner);
      }
    }
    probe.remove();
    return { worst: Math.round(worst * 100) / 100, offenders: offenders.slice(0, 8) };
  });
}

test.describe('yatay taşma', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO);
    await expect(page.getByRole('heading', { level: 1, name: 'Atonota' })).toBeVisible();
  });

  test('sayfa açık ve koyu temada yatay taşmaz', async ({ page }) => {
    const light = await overflow(page);
    expect(light.worst, light.offenders.join('; ')).toBeLessThanOrEqual(0);
    await page.getByRole('radiogroup', { name: 'Tema' }).getByText('Koyu', { exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const dark = await overflow(page);
    expect(dark.worst, dark.offenders.join('; ')).toBeLessThanOrEqual(0);
  });

  test('dedektör kesilen metni yakalar (negatif kontrol)', async ({ page }) => {
    await page.evaluate(() => {
      const p = document.createElement('p');
      p.id = 'tasma-probe';
      p.textContent = 'A'.repeat(400);
      document.querySelector('main')?.appendChild(p);
    });
    const withProbe = await overflow(page);
    expect(withProbe.worst).toBeGreaterThan(0);
    expect(withProbe.offenders.join(' ')).toContain('içerik');
    await page.evaluate(() => document.getElementById('tasma-probe')?.remove());
    expect((await overflow(page)).worst).toBeLessThanOrEqual(0);
  });

  test('geniş tablo kendi kapsayıcısında kayar, sayfa taşmaz', async ({ page }) => {
    const container = page.getByTestId('wide-table');
    await expect(container).toBeVisible();
    const scrollable = await container.evaluate((el) => {
      const s = el.querySelector<HTMLElement>('[data-scroll-x]') ?? (el as HTMLElement);
      return { inner: s.scrollWidth - s.clientWidth, overflowX: getComputedStyle(s).overflowX };
    });
    const viewport = page.viewportSize()!;
    // At phone widths the sum of column minimum widths exceeds the screen; the table must scroll.
    if (viewport.width < 600) {
      expect(scrollable.inner).toBeGreaterThan(0);
      expect(['auto', 'scroll']).toContain(scrollable.overflowX);
    }
    const result = await overflow(page);
    expect(result.worst, result.offenders.join('; ')).toBeLessThanOrEqual(0);
    // Table headers do not break mid-word
    const broken = await container.evaluate((el) =>
      Array.from(el.querySelectorAll('th')).some(
        (th) => getComputedStyle(th).wordBreak === 'break-all',
      ),
    );
    expect(broken).toBe(false);
  });
});

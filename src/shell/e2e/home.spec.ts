import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../../../tests/setup/playwright-fixtures';

/**
 * Home page ("Bekleyenler", pending items). Data comes from the mock server's `get_home_summary` endpoint.
 * The scenario name is written to `sessionStorage` before the page opens (`src/mocks/scenarios.ts`).
 * The default data has a single open request: ORNEK-IZIN-0001, owned by sample person 1.
 */
const SCENARIO_KEY = 'atonota.mock-senaryo';

async function open(page: Page, scenario?: string) {
  if (scenario) {
    await page.addInitScript(({ key, value }) => sessionStorage.setItem(key, value), {
      key: SCENARIO_KEY,
      value: scenario,
    });
  }
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Bekleyenler' })).toBeVisible();
}

const pendingList = (page: Page) => page.getByRole('list', { name: /Onayınızı bekleyen/ });

function row(page: Page, who: string): Locator {
  return pendingList(page).getByRole('listitem').filter({ hasText: who });
}

async function settle(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime))
        .map((a) => a.finished.catch(() => undefined)),
    );
  });
}

/** Turns on keyboard mode with Tab, then focuses the target. By default WebKit does not reach the button with Tab. */
async function keyboardFocus(page: Page, target: Locator) {
  await page.keyboard.press('Tab');
  await expect(page.locator('html')).toHaveAttribute('data-focus-mode', 'keyboard');
  await target.focus();
  await expect(target).toBeFocused();
}

const coarse = (page: Page) => page.evaluate(() => matchMedia('(any-pointer: coarse)').matches);

test.describe('ana sayfa: Bekleyenler', () => {
  test('dört adımda onay: aç, gör, Onayla, Onaylandı', async ({ page }) => {
    await open(page, 'ana-sayfa-iki-bekleyen');
    const item = row(page, 'Örnek Kişi 3');
    await expect(item).toBeVisible();
    await item.getByRole('button', { name: /Onayla/ }).click();
    await expect(item.getByText('Onaylandı')).toBeVisible();
    await expect(page.getByRole('status', { name: 'Karar sonucu' })).toHaveText(
      'Örnek Kişi 3: Örnek Yıllık İzin onaylandı.',
    );
    await expect(
      page.getByRole('heading', { level: 2, name: 'Onayınızı bekleyen 1 izin talebi var' }),
    ).toBeVisible();
  });

  test('klavyeyle ret: düğmeye odaklanılır, Enter ile reddedilir', async ({ page }) => {
    await open(page);
    const item = row(page, 'Örnek Kişi');
    const reject = item.getByRole('button', { name: /Reddet/ });
    await expect(reject).toBeVisible();
    await keyboardFocus(page, reject);
    await page.keyboard.press('Enter');
    await expect(item.getByText('Reddedildi')).toBeVisible();
    await expect(page.getByRole('status', { name: 'Karar sonucu' })).toHaveText(
      'Örnek Kişi: Örnek Yıllık İzin reddedildi.',
    );
    await expect(
      page.getByText('Onayınızı bekleyen iş yok. Yeni talep gelince burada görünür.'),
    ).toBeVisible();
  });

  test('dokunmayla onay', async ({ page, hasTouch }) => {
    test.skip(!hasTouch, 'dokunma yok');
    await open(page);
    const item = row(page, 'Örnek Kişi');
    await item.getByRole('button', { name: /Onayla/ }).tap();
    await expect(item.getByText('Onaylandı')).toBeVisible();
  });

  test('bekleyen talep yoksa ekran açıkça yazar, "Kayıt yok" demez', async ({ page }) => {
    await open(page, 'ana-sayfa-bos');
    await expect(
      page.getByText('Onayınızı bekleyen iş yok. Yeni talep gelince burada görünür.'),
    ).toBeVisible();
    await expect(page.getByText('Kayıt yok')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'Sorunlu kayıtlar' })).toBeVisible();
  });

  test('sunucu hata verirse hata yazılır ve yeniden denenir', async ({ page }) => {
    await open(page, 'ana-sayfa-hata');
    await expect(page.getByRole('alert')).toContainText('Bir sorun çıktı');
    await expect(page.getByRole('button', { name: 'Yeniden dene' })).toBeVisible();
    await expect(page.getByText('Kayıt yok')).toHaveCount(0);
  });

  test('eski sürümle onay hata verir, talep listede kalır', async ({ page }) => {
    await open(page, 'ana-sayfa-eski-surum');
    const item = row(page, 'Örnek Kişi');
    await item.getByRole('button', { name: /Onayla/ }).click();
    await expect(item.getByRole('alert')).toContainText('Bu kaydı başka biri değiştirdi');
    await expect(item.getByRole('button', { name: /Onayla/ })).toBeVisible();
    await expect(item.getByText('Onaylandı')).toHaveCount(0);
  });

  test('bölüm sırası taslaktaki gibidir', async ({ page }) => {
    await open(page);
    await expect(page.locator('.shell-home').getByRole('heading', { level: 2 })).toHaveText([
      /Onayınızı bekleyen/,
      'Sorunlu kayıtlar',
      'Son değişiklikler',
      'Özet sayılar',
    ]);
  });

  test('sahte ilerleme yoktur', async ({ page }) => {
    // The mock server runs in the service worker; the request cannot be held. So every state of the body is recorded.
    await page.addInitScript(() => {
      const w = window as unknown as { __homeSnapshots: string[] };
      w.__homeSnapshots = [];
      new MutationObserver(() => {
        const body = document.querySelector('.shell-home .shell-body');
        if (!body) return;
        const bar = body.querySelector('[role="progressbar"], progress') ? '[progressbar]' : '';
        w.__homeSnapshots.push(`${bar}${body.textContent ?? ''}`);
      }).observe(document, { subtree: true, childList: true, characterData: true });
    });
    await open(page);
    await expect(row(page, 'Örnek Kişi')).toBeVisible();
    const snapshots = await page.evaluate(
      () => (window as unknown as { __homeSnapshots: string[] }).__homeSnapshots,
    );
    const loading = snapshots.filter((text) => !text.includes('Onayınızı bekleyen'));
    expect(loading).toContain('Bekleyen işler yükleniyor.');
    for (const text of loading) {
      expect(text).not.toMatch(/%|\[progressbar\]|\d{1,2}[:.]\d{2}/);
    }
  });

  test('yatay taşma yoktur', async ({ page }) => {
    await open(page, 'ana-sayfa-iki-bekleyen');
    await expect(row(page, 'Örnek Kişi 3')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('dokunmalı ekranda düğmelerin dokunma alanı en az 48 px', async ({ page }) => {
    await open(page);
    test.skip(!(await coarse(page)), 'yalnız dokunmalı işaretçi');
    const item = row(page, 'Örnek Kişi');
    for (const button of [
      item.getByRole('button', { name: /Onayla/ }),
      item.getByRole('button', { name: /Reddet/ }),
      page.getByRole('button', { name: 'Yeni izin talebi' }),
    ]) {
      const box = await button.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(48);
    }
  });

  test('yazı Outfit, en küçük metin 14 px, gövde 16 px', async ({ page }) => {
    await open(page, 'ana-sayfa-iki-bekleyen');
    await expect(row(page, 'Örnek Kişi 3')).toBeVisible();
    const r = await page.locator('.shell-home').evaluate((root) => {
      const sizes: number[] = [];
      const fonts = new Set<string>();
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || !n.textContent?.trim()) continue;
        const cs = getComputedStyle(el);
        if (cs.position === 'absolute' && cs.clip === 'rect(0px, 0px, 0px, 0px)') continue;
        sizes.push(Number.parseFloat(cs.fontSize));
        fonts.add(cs.fontFamily.split(',')[0]?.replace(/['"]/g, '').trim() ?? '');
      }
      const meta = root.querySelector('.shell-home-who');
      return {
        min: Math.min(...sizes),
        fonts: [...fonts],
        body: meta ? Number.parseFloat(getComputedStyle(meta).fontSize) : 0,
      };
    });
    expect(r.min).toBeGreaterThanOrEqual(14);
    expect(r.body).toBe(16);
    expect(r.fonts).toEqual(['Outfit Variable']);
  });

  test('klavye odağı tek göstergedir, çevreleyen halka yoktur', async ({ page }) => {
    await open(page);
    const approve = row(page, 'Örnek Kişi').getByRole('button', { name: /Onayla/ });
    await expect(approve).toBeVisible();
    await settle(page);
    await keyboardFocus(page, approve);
    const s = await approve.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { outline: cs.outlineStyle, shadow: cs.boxShadow };
    });
    // The central indicator is the inset bottom line (`src/design/css-variables.ts`). There is no ring.
    expect(s.outline).toBe('none');
    expect(s.shadow).toMatch(/inset/);
    expect(s.shadow).not.toMatch(/0px 0px 0px [1-9]/);
  });

  test('kavisli vurgu kenarı yoktur', async ({ page }) => {
    await open(page, 'ana-sayfa-iki-bekleyen');
    await expect(row(page, 'Örnek Kişi 3')).toBeVisible();
    const offenders = await page.locator('.shell-home').evaluate((root) =>
      [...root.querySelectorAll('*')]
        .filter((el) => {
          const cs = getComputedStyle(el);
          const radius = Number.parseFloat(cs.borderTopLeftRadius) > 0;
          const widths = [
            cs.borderTopWidth,
            cs.borderRightWidth,
            cs.borderBottomWidth,
            cs.borderLeftWidth,
          ].map(Number.parseFloat);
          const one = widths.filter((w) => w > 0).length;
          return radius && one > 0 && one < 4;
        })
        .map((el) => el.className),
    );
    expect(offenders).toEqual([]);
  });

  test('reduced motion tercihinde hareket durur', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await row(page, 'Örnek Kişi')
      .getByRole('button', { name: /Onayla/ })
      .click();
    await expect(row(page, 'Örnek Kişi').getByText('Onaylandı')).toBeVisible();
    const running = await page.locator('.shell-home').evaluate((root) =>
      root
        .getAnimations({ subtree: true })
        .filter((a) => a.playState === 'running')
        .map((a) => (a as CSSAnimation).animationName ?? 'geçiş'),
    );
    expect(running).toEqual([]);
  });

  test('axe hata vermez', async ({ page }) => {
    await open(page, 'ana-sayfa-iki-bekleyen');
    await expect(row(page, 'Örnek Kişi 3')).toBeVisible();
    await settle(page);
    const r = await new AxeBuilder({ page }).include('.shell-home').analyze();
    expect(
      r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    ).toEqual([]);
  });

  test('iki simge taslaktaki yerde görünür, ekran okuyucu okumaz', async ({ page }) => {
    await open(page, 'ana-sayfa-iki-bekleyen');
    const problems = page.getByRole('heading', { level: 2, name: 'Sorunlu kayıtlar' });
    const warn = problems.locator('svg');
    await expect(warn).toBeVisible();
    await expect(warn).toHaveAttribute('aria-hidden', 'true');
    const recent = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { level: 2, name: 'Son değişiklikler' }) });
    const clocks = recent.getByRole('listitem').locator('svg');
    await expect(clocks.first()).toBeVisible();
    expect(await clocks.count()).toBe(await recent.getByRole('listitem').count());

    // Colour and size come from the central token: compared with a probe element that uses the same token.
    const measure = (loc: Locator) =>
      loc.evaluate((el) => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--shell-warn)';
        probe.style.width = 'var(--shell-item-icon)';
        probe.style.display = 'inline-block';
        (el.closest('.shell') ?? document.body).appendChild(probe);
        const want = getComputedStyle(probe);
        const got = getComputedStyle(el);
        const out = {
          color: got.color,
          warn: want.color,
          size: el.getBoundingClientRect().width,
          token: probe.getBoundingClientRect().width,
        };
        probe.remove();
        return out;
      });
    const w = await measure(warn);
    expect(w.color).toBe(w.warn);
    expect(w.size).toBeCloseTo(w.token, 0);
    const c = await measure(clocks.first());
    expect(c.size).toBeCloseTo(c.token, 0);
  });
});

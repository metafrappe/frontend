import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../../../../tests/setup/playwright-fixtures';

/**
 * Kayıt deneme sayfası. e2e derlemesi sayfayı bu yolda sunar (vite.config.ts, e2eInputs).
 * Testler kök Playwright kapısında koşar; ayrı ayar dosyası yoktur (AGENTS.md).
 */
const HARNESS = '/src/views/record/harness/';

async function overflowX(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

const isPhoneWidth = (page: Page): boolean => {
  const vp = page.viewportSize();
  return Boolean(vp && vp.width <= 767);
};

test.describe('kayıt formu yerleşimi ve 320 px uyumu', () => {
  test('sayfa yatay taşmaz; telefonda tek sütun, geniş ekranda iki sütun olur', async ({
    page,
  }) => {
    await page.goto(HARNESS);
    await expect(page.getByRole('heading', { level: 1, name: 'Örnek Kişi' })).toBeVisible();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);

    const colCount = await page
      .locator('.rv-section-grid')
      .first()
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length);

    if (isPhoneWidth(page)) {
      expect(colCount).toBe(1);
    } else {
      expect(colCount).toBe(2);
    }
  });

  test('alt tablodaki Tutar alanı 320 px dahil okunur genişliktedir ve tablo kendi kutusunda kayar', async ({
    page,
  }) => {
    await page.goto(HARNESS);
    await expect(page.getByRole('heading', { level: 1, name: 'Örnek Kişi' })).toBeVisible();

    const amountInput = page.locator('.rv-table-cell--num input').first();
    await expect(amountInput).toBeVisible();
    const box = await amountInput.boundingBox();
    expect(box).not.toBeNull();
    // Önemli 4: 320 px'te bile sayı giriş kutusu okunur genişlikte kalmalı (0 px olmamalı).
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(72);
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('imza alanı ve bağlantı araması', () => {
  test('imza tuvali birden çok çizgiyi ve sağ yarıdaki çizimi korur', async ({ page }) => {
    await page.goto(HARNESS);
    await expect(page.getByRole('heading', { level: 1, name: 'Örnek Kişi' })).toBeVisible();
    const canvas = page.getByRole('img', { name: 'Onay İmzası' });
    await canvas.scrollIntoViewIfNeeded();

    // Yük altında yerleşim ilk çizimden sonra da değişebilir. O zaman çizgi eski kutuya
    // düşer (inceleme 2, K-1). Çizimden önce tuvalin yeri ve boyutu durmalıdır. Tuvalin
    // piksel boyutu da görünen boyuta ve ekran yoğunluğuna eşit olmalıdır.
    const layout = () =>
      canvas.evaluate((el) => {
        const c = el as HTMLCanvasElement;
        const rect = c.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          synced:
            c.width === Math.round(Math.round(rect.width) * dpr) &&
            c.height === Math.round(Math.round(rect.height) * dpr),
        };
      });
    let previous = '';
    await expect
      .poll(async () => {
        const now = await layout();
        const key = JSON.stringify(now);
        const stable = now.synced && now.width > 0 && key === previous;
        previous = key;
        return stable;
      })
      .toBe(true);
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    // Sol yarıda birinci çizgi
    await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.5, { steps: 6 });
    await page.mouse.up();

    // Sağ yarıda ikinci çizgi (1440 px geniş tuvalde kesilmemeli)
    await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.35);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.88, box.y + box.height * 0.65, { steps: 6 });
    await page.mouse.up();

    // Mürekkep tek okumayla değil, yoklamayla okunur. Çizim bir sonraki karede görünebilir.
    const ink = () =>
      canvas.evaluate((el) => {
        const c = el as HTMLCanvasElement;
        const ctx = c.getContext('2d');
        if (!ctx || c.width === 0 || c.height === 0) {
          return { leftInk: 0, rightInk: 0 };
        }
        const midX = Math.floor(c.width / 2);
        const leftData = ctx.getImageData(0, 0, midX, c.height).data;
        const rightData = ctx.getImageData(midX, 0, c.width - midX, c.height).data;
        let leftInk = 0;
        let rightInk = 0;
        for (let i = 3; i < leftData.length; i += 4) {
          if ((leftData[i] ?? 0) > 0) leftInk += 1;
        }
        for (let i = 3; i < rightData.length; i += 4) {
          if ((rightData[i] ?? 0) > 0) rightInk += 1;
        }
        return { leftInk, rightInk };
      });

    await expect.poll(async () => (await ink()).leftInk, 'sol yarıda mürekkep').toBeGreaterThan(10);
    await expect
      .poll(async () => (await ink()).rightInk, 'sağ yarıda mürekkep')
      .toBeGreaterThan(10);
    await expect(page.getByText('İmza alındı')).toBeVisible();
    await expect(page.getByText('1 kaydedilmemiş değişiklik')).toBeVisible();
  });

  // Her davranış kendi testindedir. Linux WebKit yük altında kareleri saniyelerce geciktirir.
  // Tek testte sıralanan adımlar süreyi birbirine yükler (inceleme 1, Ö-1). Beklentiler aynıdır.
  test('yazarak imzalama gerçek tarayıcıda PNG üretir', async ({ page }) => {
    await page.goto(HARNESS);
    await expect(page.getByRole('heading', { level: 1, name: 'Örnek Kişi' })).toBeVisible();

    // Küçük 1: Yazarak imzalama gerçek tarayıcıda PNG üretmeli
    await page.getByText('Yazarak imzala').click();
    await page.getByLabel('İmza metni').fill('Örnek İmza');
    await page.getByRole('button', { name: 'İmzayı uygula' }).click();
    await expect(page.getByText('İmza alındı')).toBeVisible();
    await expect(
      page.locator('[data-fieldname="signature"] img.rv-attach-preview'),
    ).toHaveAttribute('src', /^data:image\/png;base64,/);
  });

  test('bölüm kartında dekoratif kenarlık yoktur', async ({ page }) => {
    await page.goto(HARNESS);
    await expect(page.getByRole('heading', { level: 1, name: 'Örnek Kişi' })).toBeVisible();

    // Küçük 12: Bölüm kartında dekoratif kenarlık olmamalı (yalnız gölge / yüzey tonu)
    const cardBorderTop = await page
      .locator('.rv-section-card')
      .first()
      .evaluate((el) => getComputedStyle(el).borderTopWidth);
    expect(cardBorderTop).toBe('0px');
  });

  test('bağlantı araması hata alınca hata metni ve Yeniden dene gösterir', async ({ page }) => {
    await page.goto(`${HARNESS}?linkError=1`);
    await expect(page.getByRole('heading', { level: 1, name: 'Örnek Kişi' })).toBeVisible();

    const deptSelector = page.locator('[data-fieldname="department"] .ant-select-selector');
    await deptSelector.scrollIntoViewIfNeeded();
    await deptSelector.click();
    await expect(page.getByText('Arama sunucusuna ulaşılamadı.')).toBeVisible();
    await expect(page.getByText('Eşleşen kayıt yok')).toBeHidden();

    await page.getByRole('button', { name: 'Yeniden dene' }).click();
    await expect(
      page.locator('.ant-select-dropdown').getByText('Mühendislik', { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('.ant-select-dropdown').getByText('Operasyon', { exact: true }),
    ).toBeVisible();
  });
});

test.describe('odak kuralları', () => {
  test('fare tıklamasında klavye odak modu açılmaz, yalnız Tab ile açılır', async ({ page }) => {
    await page.goto(HARNESS);
    const root = page.locator('.rv-root');
    await expect(root).toHaveAttribute('data-rv-kbd', 'false');

    const input = page.getByLabel(/Çalışan Adı/);
    await input.click();
    await expect(root).toHaveAttribute('data-rv-kbd', 'false');

    await page.keyboard.press('Tab');
    await expect(root).toHaveAttribute('data-rv-kbd', 'true');
  });

  test('klavye odağında çevreleyen halka olmamalı ve görünür alt çizgi olmalı', async ({
    page,
  }) => {
    await page.goto(HARNESS);
    await expect(page.getByRole('heading', { level: 1, name: 'Örnek Kişi' })).toBeVisible();

    // Odak göstergesi geçiş hareketiyle gelir. Ölçüm hareketin bitiş değerinde yapılır.
    const inspectFocusedChain = async () =>
      page.evaluate(() => {
        // Hareketler beklenmez, bitiş değerine atlatılır (`finish()`). Bekleme çizim karesine
        // bağlıdır. Linux WebKit yazılımla çizer. Orada kilitli kart gölgesi (`layer7`) yüzünden
        // bir kare saniyeler sürer. O zaman 2 saniyelik yoklama doluyordu (PR #3 CI hatası).
        // `getAnimations()` stili hemen hesaplar. Yeni geçiş de bu listeye girer.
        // Yalnız biten hareketler atlatılır. Sonsuz döngülü hareket (yükleme simgesi gibi)
        // `finish()` ile bitmez, hata verir (inceleme 2, Ö4).
        for (const animation of document.getAnimations()) {
          const end = animation.effect?.getComputedTiming().endTime;
          if (typeof end === 'number' && Number.isFinite(end)) animation.finish();
        }
        const root = document.querySelector('.rv-root');
        const active = document.activeElement;
        if (!root || !active || !root.contains(active)) {
          return { insideRoot: false, visibleOutlines: [], spreadRings: [], hasUnderline: false };
        }

        const splitShadowLayers = (raw: string): string[] => {
          if (!raw || raw === 'none') return [];
          const out: string[] = [];
          let depth = 0;
          let current = '';
          for (const ch of raw) {
            if (ch === '(') depth += 1;
            if (ch === ')') depth = Math.max(0, depth - 1);
            if (ch === ',' && depth === 0) {
              out.push(current.trim());
              current = '';
            } else {
              current += ch;
            }
          }
          if (current.trim()) out.push(current.trim());
          return out;
        };

        const visibleOutlines: string[] = [];
        const spreadRings: string[] = [];
        let hasUnderline = false;

        let node: Element | null = active;
        let stoppedControlWalk = false;
        while (node && root.contains(node)) {
          const style = getComputedStyle(node);
          const outlineW = Number.parseFloat(style.outlineWidth) || 0;
          if (style.outlineStyle !== 'none' && outlineW > 0) {
            visibleOutlines.push(`${node.tagName}:${style.outlineStyle}:${style.outlineWidth}`);
          }

          if (
            node.classList.contains('rv-section-card') ||
            node.classList.contains('rv-header') ||
            node.classList.contains('rv-body') ||
            node.classList.contains('rv-root')
          ) {
            stoppedControlWalk = true;
          }

          if (!stoppedControlWalk) {
            const layers = splitShadowLayers(style.boxShadow);
            for (const layer of layers) {
              const withoutColors = layer.replace(/rgba?\([^)]+\)/g, '').trim();
              const isInset = /\binset\b/.test(withoutColors);
              const nums = (withoutColors.match(/-?\d+(?:\.\d+)?px/g) ?? []).map((v) =>
                Number.parseFloat(v),
              );
              const [offX = 0, offY = 0, blur = 0, spread = 0] = nums;
              const alphaMatch = /rgba\([^)]*,\s*([\d.]+)\)/.exec(layer);
              const isTransparent = alphaMatch
                ? Number.parseFloat(alphaMatch[1] ?? '1') === 0
                : false;
              if (isInset && offX === 0 && offY < 0 && blur === 0) {
                if (!isTransparent) {
                  hasUnderline = true;
                }
              } else if (!isInset && (spread > 0 || (offX === 0 && offY === 0 && blur > 0))) {
                spreadRings.push(`${node.tagName}:${layer}`);
              }
            }
          }

          node = node.parentElement;
        }

        return { insideRoot: true, visibleOutlines, spreadRings, hasUnderline };
      });

    let visitedCount = 0;
    for (let step = 0; step < 60; step += 1) {
      await page.keyboard.press('Tab');
      const check = await inspectFocusedChain();
      if (!check.insideRoot) {
        if (visitedCount > 0) {
          break;
        }
        continue;
      }
      visitedCount += 1;
      expect(check.visibleOutlines, `Tab adımı ${step} outline bulundu`).toEqual([]);
      expect(check.spreadRings, `Tab adımı ${step} çevreleyen gölge bulundu`).toEqual([]);
      // antd bazı denetimlerde odak sınıfını bir sonraki çizimde ekler. Gösterge kısa süre beklenir.
      await expect
        .poll(async () => (await inspectFocusedChain()).hasUnderline, {
          message: `Tab adımı ${step} alt çizgi göstergesi eksik`,
          timeout: 2_000,
        })
        .toBe(true);
      const settled = await inspectFocusedChain();
      expect(settled.visibleOutlines, `Tab adımı ${step} outline bulundu`).toEqual([]);
      expect(settled.spreadRings, `Tab adımı ${step} çevreleyen gölge bulundu`).toEqual([]);
    }

    expect(visitedCount).toBeGreaterThanOrEqual(5);

    // WebKit'te Tab ile atlanabilen düğme ve seçim öğelerini ayrıca doğrudan odakla denetle
    for (const target of [
      page.getByRole('button', { name: 'Sonraki kayıt' }),
      page.getByRole('checkbox', { name: 'Ödendi' }),
    ]) {
      await target.focus();
      await expect
        .poll(async () => (await inspectFocusedChain()).hasUnderline, { timeout: 2_000 })
        .toBe(true);
      const check = await inspectFocusedChain();
      expect(check.visibleOutlines).toEqual([]);
      expect(check.spreadRings).toEqual([]);
    }
  });
});

test.describe('tarih alanı (panel sorunu 3)', () => {
  test('tarih Türkçe biçimde görünür; takvim markalıdır; klavyeyle yazılabilir', async ({
    page,
  }) => {
    await page.goto(HARNESS);
    await expect(page.getByRole('heading', { level: 1, name: 'Örnek Kişi' })).toBeVisible();

    // Tarayıcının kendi tarih kutusu yoktur.
    await expect(page.locator('.rv-root input[type="date"]')).toHaveCount(0);
    await expect(page.locator('.rv-root input[type="datetime-local"]')).toHaveCount(0);

    const input = page.getByRole('textbox', { name: 'Belge Tarihi' });
    await expect(input).toHaveValue('23.11.2026');

    // Takvim açılır. Yazılar en az 14 px'tir.
    await input.click();
    const panel = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)');
    await expect(panel).toBeVisible();
    const minFont = await panel.evaluate((root) => {
      let min = Number.POSITIVE_INFINITY;
      for (const el of root.querySelectorAll<HTMLElement>('*')) {
        if (!el.textContent?.trim() || el.children.length > 0) continue;
        min = Math.min(min, Number.parseFloat(getComputedStyle(el).fontSize));
      }
      return min;
    });
    expect(minFont).toBeGreaterThanOrEqual(14);
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();

    // Klavyeyle yazılan tarih Türkçe biçimde kalır.
    await input.click();
    await input.fill('24.11.2026');
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue('24.11.2026');
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('tarih takvimi dar ekrana sığar (AJA-476)', () => {
  const OPEN_PANEL = '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)';
  // WCAG 2.5.5 dokunma hedefi. Takvim hücresi ve oklar en az bu kadar olur.
  const MIN_TOUCH = 44;
  // antd takvimi açarken kısa bir animasyon oynatır. Animasyonda panelin dikey
  // ölçeği 0'dan 0,8'e, sonra 1'e çıkar. Ölçüm bu sırada yapılırsa yükseklik
  // küçük çıkar. Bu yüzden panelde açılış sınıfı kalmayana kadar beklenir.
  const MOTION_CLASS = /(^|\s)ant-[\w-]+-(appear|enter)(\s|$)/;

  // Takvimin dört kenarı da ekranın içindedir (AJA-514). Yatay telefonda ekran
  // yüksekliği 390 px'tir. Üst ve alt kenar da bu yüzden ölçülür.
  async function expectPanelInsideViewport(page: Page, container: Locator): Promise<void> {
    const vp = page.viewportSize();
    expect(vp).not.toBeNull();
    const box = await container.boundingBox();
    expect(box).not.toBeNull();
    const left = box?.x ?? Number.NEGATIVE_INFINITY;
    const top = box?.y ?? Number.NEGATIVE_INFINITY;
    const right = left + (box?.width ?? Number.POSITIVE_INFINITY);
    const bottom = top + (box?.height ?? Number.POSITIVE_INFINITY);
    expect(left, 'sol kenar').toBeGreaterThanOrEqual(0);
    expect(top, 'üst kenar').toBeGreaterThanOrEqual(0);
    expect(right, 'sağ kenar').toBeLessThanOrEqual(vp?.width ?? 0);
    expect(bottom, 'alt kenar').toBeLessThanOrEqual(vp?.height ?? 0);
  }

  test('takvim ekrana sığar; oklar ve gün hücreleri en az 44 px; takvim Türkçe ve pazartesi başlar', async ({
    page,
  }) => {
    await page.goto(HARNESS);
    await expect(page.getByRole('heading', { level: 1, name: 'Örnek Kişi' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Belge Tarihi' }).click();
    const panel = page.locator(OPEN_PANEL);
    await expect(panel).toBeVisible();
    await expect(panel).not.toHaveClass(MOTION_CLASS);

    await expectPanelInsideViewport(page, panel.locator('.ant-picker-panel-container'));

    // Ay adı, yıl ve iki ay oku görünür. Ay adı Türkçedir.
    await expect(panel.locator('.ant-picker-month-btn')).toHaveText('Kas');
    await expect(panel.locator('.ant-picker-year-btn')).toHaveText('2026');
    for (const cls of [
      '.ant-picker-header-prev-btn',
      '.ant-picker-header-next-btn',
      '.ant-picker-header-super-prev-btn',
      '.ant-picker-header-super-next-btn',
    ]) {
      const btn = panel.locator(cls);
      await expect(btn).toBeInViewport({ ratio: 1 });
      const b = await btn.boundingBox();
      expect(b?.width ?? 0, cls).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(b?.height ?? 0, cls).toBeGreaterThanOrEqual(MIN_TOUCH);
    }

    // Hafta pazartesi başlar.
    await expect(panel.locator('.ant-picker-content thead th').first()).toHaveText('Pzt');

    // Gün hücrelerinin hepsi en az 44 × 44 px'tir.
    const cells = await panel
      .locator('.ant-picker-date-panel .ant-picker-content tbody td')
      .evaluateAll((tds) =>
        tds.map((td) => {
          const r = td.getBoundingClientRect();
          return { w: r.width, h: r.height };
        }),
      );
    expect(cells.length).toBe(42);
    for (const c of cells) {
      expect(c.w).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(c.h).toBeGreaterThanOrEqual(MIN_TOUCH);
    }
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
  });

  test('tarih-saat takvimi ekrana sığar; dar ekranda saat sütunu tarih tablosunun altındadır', async ({
    page,
  }) => {
    await page.goto(HARNESS);
    await expect(page.getByRole('heading', { level: 1, name: 'Örnek Kişi' })).toBeVisible();
    const input = page.getByRole('textbox', { name: 'Takip Zamanı' });
    await expect(input).toHaveValue('23.11.2026 14:05:00');
    await input.click();
    const panel = page.locator(OPEN_PANEL);
    await expect(panel).toBeVisible();
    await expect(panel).not.toHaveClass(MOTION_CLASS);

    await expectPanelInsideViewport(page, panel.locator('.ant-picker-panel-container'));

    // Takvim ekrandan uzunsa kendi içinde kayar (AJA-514). Ay oku ve alt satır görünür kalır.
    await expect(panel.locator('.ant-picker-header-prev-btn')).toBeInViewport({ ratio: 1 });
    await expect(panel.locator('.ant-picker-footer')).toBeInViewport({ ratio: 1 });

    if (isPhoneWidth(page)) {
      const dateBox = await panel.locator('.ant-picker-date-panel').boundingBox();
      const timeBox = await panel.locator('.ant-picker-time-panel').boundingBox();
      expect(timeBox?.y ?? 0).toBeGreaterThanOrEqual(
        (dateBox?.y ?? 0) + (dateBox?.height ?? 0) - 1,
      );
    }
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
  });

  test('@touch ay okuna dokununca ay değişir', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch, 'Dokunma testi yalnız dokunmatik profilde koşar.');
    await page.goto(HARNESS);
    await expect(page.getByRole('heading', { level: 1, name: 'Örnek Kişi' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Belge Tarihi' }).tap();
    const panel = page.locator(OPEN_PANEL);
    await expect(panel).toBeVisible();
    await expect(panel.locator('.ant-picker-month-btn')).toHaveText('Kas');
    await panel.locator('.ant-picker-header-next-btn').tap();
    await expect(panel.locator('.ant-picker-month-btn')).toHaveText('Ara');
    await panel.locator('.ant-picker-header-prev-btn').tap();
    await panel.locator('.ant-picker-header-prev-btn').tap();
    await expect(panel.locator('.ant-picker-month-btn')).toHaveText('Eki');
  });
});

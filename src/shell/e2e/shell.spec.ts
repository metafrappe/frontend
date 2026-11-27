import type { Page } from '@playwright/test';
import { expect, test } from '../../../tests/setup/playwright-fixtures';

const isCompact = (page: Page) => {
  const v = page.viewportSize();
  return !!v && (v.width <= 767 || v.height <= 499);
};

async function overflowX(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

/** Sahte sunucunun tanıdığı liste: tablo gerçekten çizilir. `/satis/teklif` hata ekranını açar. */
const LIST = `/ornek/${encodeURIComponent('örnek-kayıt')}`;

/** Sahte sunucunun tanıdığı kayıt: kayıt formu gerçekten çizilir. `/satis/teklif/TEK-0003` hata verir. */
const RECORD = `${LIST}/ORNEK-0003`;
/**
 * Finds the link to a record.
 * A wide list draws the record as a table row; a narrow list draws it as a card. Both hold the link.
 */
const recordLink = (page: Page, name: string) =>
  page
    .getByRole('row', { name: new RegExp(name) })
    .or(page.getByRole('listitem').filter({ hasText: name }))
    .getByRole('link', { name, exact: true });

/** Kabuk deneme sayfası. Kayıt bağlantısı yoktur; kayıt adresi kabuğun örnek formunu çizer. */
const harness = (path: string) => `/src/shell/harness/?yol=${encodeURIComponent(path)}`;

/**
 * Kabuğun deneme sayfası. Örnek menü grupları (Satış, Stok, Muhasebe) yalnız burada görünür.
 * Canlı menü sahte sunucuda olmayan türleri göstermez. Flyout ve kayan zemin burada denenir.
 */
const DEMO = '/_demo/shell';

const PAGES = ['/', '/satis/teklif', LIST, '/asistan', '/satis/teklif/TEK-0003', RECORD, DEMO];

test.describe('yatay taşma', () => {
  for (const url of PAGES) {
    test(`taşma yok: ${url}`, async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('.shell')).toBeVisible();
      if (url === RECORD) {
        await expect(page.getByRole('textbox', { name: /Örnek başlık/ })).toHaveValue(
          'Örnek veri 3',
        );
      }
      await page.waitForTimeout(400);
      expect(await overflowX(page)).toBeLessThanOrEqual(0);
    });
  }

  test('telefonda açık çekmece taşma yapmaz', async ({ page }) => {
    test.skip(!isCompact(page), 'yalnız telefon kabuğu');
    await page.goto(DEMO);
    await page.getByRole('button', { name: 'Menüyü aç' }).click();
    await expect(page.getByRole('dialog', { name: 'Menü' })).toBeVisible();
    await page.getByRole('button', { name: 'Satış', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Satış' })).toBeVisible();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('klavye ile flyout', () => {
  test('odak açar, sağ ok içeri girer, Escape kapatır', async ({ page }) => {
    test.skip(isCompact(page), 'telefonda panel çekmece içinde açılır');
    await page.goto(DEMO);
    const parent = page.getByRole('button', { name: 'Satış', exact: true });
    await parent.focus();
    const fly = page.getByRole('group', { name: 'Satış' });
    await expect(fly).toBeVisible();
    // Odak perdesi yalnız iletişim kutusundadır. Alt menü perde açmaz.
    await expect(page.locator('body')).not.toHaveAttribute('data-focus-dim', 'on');

    // F1: sidebar sağ kenarına 8 px boşlukla bitişir.
    // F6 hareketi bitince ölçülür.
    await expect(fly).toHaveCSS('opacity', '1');
    await page.waitForTimeout(250);
    const sb = await page.locator('.shell-sb').boundingBox();
    const fb = await fly.boundingBox();
    expect(sb && fb && Math.round(fb.x - (sb.x + sb.width))).toBe(8);

    // F2: panel merkezi üst öğe merkezine denk gelir (taşma yoksa).
    const pb = await parent.boundingBox();
    if (pb && fb) {
      expect(Math.abs(fb.y + fb.height / 2 - (pb.y + pb.height / 2))).toBeLessThanOrEqual(1);
    }

    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('link', { name: /^Teklifler/ })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('link', { name: 'Siparişler' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(fly).toBeHidden();
    await expect(parent).toBeFocused();
    await expect(page.locator('body')).not.toHaveAttribute('data-focus-dim', 'on');
  });

  test('klavyeyle gezinince odak göstergesi halka değildir', async ({ page }) => {
    test.skip(isCompact(page), 'geniş ekran');
    await page.goto(DEMO);
    // Tembel sayfa gelene kadar beklenir. Sonra odak denetlenir.
    await expect(page.getByRole('heading', { level: 1, name: 'Kabuk denemesi' })).toBeVisible();
    // Ok tuşları görsel odak modunu açmaz. Yalnız Tab ve Shift+Tab modu açar.
    // Rota bağlantıları "Ana sayfa" ile "Satış" arasındadır. Rota listesinin son
    // parametresiz satırı "AI Studio" bağlantısıdır. "Satış" düğmesi ondan hemen sonradır.
    await page.getByRole('link', { name: 'AI Studio' }).focus();
    await page.keyboard.press('ArrowDown');
    const next = page.getByRole('button', { name: 'Satış', exact: true });
    await expect(next).toBeFocused();
    await expect(next).toHaveCSS('outline-style', 'none');
    await expect
      .poll(() => next.evaluate((el) => getComputedStyle(el, '::after').opacity))
      .toBe('0');
    await page.keyboard.press('Tab');
    await next.focus();
    await expect
      .poll(() => next.evaluate((el) => getComputedStyle(el, '::after').opacity))
      .toBe('1');
  });

  test('fare ile üzerine gelince açılır, ayrılınca kapanır', async ({ page }) => {
    test.skip(isCompact(page), 'telefonda hover yok');
    await page.goto(DEMO);
    await page.getByRole('button', { name: 'Stok', exact: true }).hover();
    await expect(page.getByRole('group', { name: 'Stok' })).toBeVisible();
    await page.mouse.move(900, 600);
    await expect(page.getByRole('group', { name: 'Stok' })).toBeHidden();
  });
});

test.describe('telefon kabuğu', () => {
  test('çekmece açılır, flyout dokunmayla açılır, sayfaya gider', async ({ page }) => {
    test.skip(!isCompact(page), 'yalnız telefon kabuğu');
    await page.goto(DEMO);
    await page.getByRole('button', { name: 'Menüyü aç' }).click();
    const drawer = page.getByRole('dialog', { name: 'Menü' });
    await expect(drawer).toBeVisible();
    await page.getByRole('button', { name: 'Satış', exact: true }).click();
    await page.getByRole('link', { name: 'Siparişler' }).click();
    await expect(page).toHaveURL(/\/satis\/siparis$/);
    await expect(drawer).toBeHidden();
    // Liste rotası tanımı sunucudan ister. Menüdeki örnek gruplar sahte sunucuda kayıtlı değildir.
    // Sahte sunucu yetki reddi verir. Sayfa tanım hatasını ve yeniden deneme düğmesini gösterir.
    await expect(page.getByRole('alert')).toContainText('Liste tanımı alınamadı');
    await expect(page.getByRole('button', { name: 'Yeniden dene' })).toBeVisible();
  });

  test('Escape çekmeceyi kapatır ve odak menü düğmesine döner', async ({ page }) => {
    test.skip(!isCompact(page), 'yalnız telefon kabuğu');
    await page.goto(DEMO);
    const menu = page.getByRole('button', { name: 'Menüyü aç' });
    await menu.click();
    await expect(page.getByRole('dialog', { name: 'Menü' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Menü' })).toBeHidden();
    await expect(menu).toBeFocused();
  });
});

test.describe('yön değişimi', () => {
  test('telefonda açık panel ve odak korunur', async ({ page }) => {
    test.skip(!isCompact(page), 'yalnız telefon kabuğu');
    const v = page.viewportSize();
    test.skip(!v, '');
    if (!v) return;
    await page.goto(DEMO);
    await page.getByRole('button', { name: 'Menüyü aç' }).click();
    await page.getByRole('button', { name: 'Satış', exact: true }).click();
    const link = page.getByRole('link', { name: 'Siparişler' });
    await link.focus();
    await page.setViewportSize({ width: v.height, height: v.width });
    await expect(page.getByRole('group', { name: 'Satış' })).toBeVisible();
    await expect(link).toBeFocused();
    await page.setViewportSize(v);
    await expect(page.getByRole('group', { name: 'Satış' })).toBeVisible();
    await expect(link).toBeFocused();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
  });

  test('geniş ekranda açık flyout ve odak korunur', async ({ page }) => {
    test.skip(isCompact(page), 'geniş ekran');
    await page.goto(DEMO);
    await page.getByRole('button', { name: 'Satış', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    const link = page.getByRole('link', { name: /^Teklifler/ });
    await expect(link).toBeFocused();
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByRole('group', { name: 'Satış' })).toBeVisible();
    await expect(link).toBeFocused();
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByRole('group', { name: 'Satış' })).toBeVisible();
    await expect(link).toBeFocused();
  });
});

test.describe('header ve sayfalar', () => {
  test('liste rotası views-collection görünümünü çizer', async ({ page }) => {
    // Uygulama girişi liste rotasını ortak API istemcisine bağlar. Adres parçası DocType adına
    // çevrilir: `örnek-kayıt` -> `Örnek Kayıt`. Sahte sunucu yalnız bu türü verir.
    await page.goto(LIST);
    // Başlık DocType'ın görünen adıdır; genel "Kayıtlar" yazmaz.
    await expect(page.getByRole('heading', { level: 1, name: 'Örnek Kayıt' })).toBeAttached();
    await expect(page.getByText('ORNEK-0001').first()).toBeVisible();
    await expect(page.getByText('TEK-0001')).toHaveCount(0);
  });

  test('sahte sunucuda olmayan liste tanım hatasını gösterir', async ({ page }) => {
    await page.goto('/satis/teklif');
    await expect(page.getByRole('alert')).toContainText('Liste tanımı alınamadı');
    await expect(page.getByText('TEK-0001')).toHaveCount(0);
  });

  test('deneme sayfasında örnek formda değişiklik kaydedilmemiş durumunu gösterir', async ({
    page,
  }) => {
    await page.goto(harness('/satis/teklif/TEK-0003'));
    await expect(page.getByText('3 / 24')).toBeVisible();
    await page.getByLabel('Başlık').fill('Yeni başlık');
    await expect(page.getByText('1 değişiklik kaydedilmedi')).toBeVisible();
    await page.getByRole('button', { name: 'Vazgeç' }).click();
    await expect(page.getByText('1 değişiklik kaydedilmedi')).toBeHidden();
  });

  test('kayıt rotası views-record görünümünü çizer; kabuğun örnek formu çizilmez', async ({
    page,
  }) => {
    // Uygulama girişi kayıt rotasını `RecordView` bileşenine bağlar. Adres parçası DocType adına
    // çevrilir (`teklif` -> `Teklif`). Sahte sunucu bu türün tanımını vermez (403). Görünüm
    // erişim reddi durumunu gösterir. Kabuğun örnek formu yalnız bağlantısız deneme sayfasındadır.
    await page.goto('/satis/teklif/TEK-0003');
    const state = page.locator('.rv-state-card[role="alert"]');
    await expect(state).toContainText('Erişim izni yok');
    await expect(state).toContainText('Bu kaydı görüntüleme yetkiniz bulunmuyor.');
    await expect(page.getByText('3 / 24')).toHaveCount(0);
    await expect(page.getByLabel('Başlık')).toHaveCount(0);
  });

  test('kayıt rotası kaydı sahte sunucudan çizer', async ({ page }) => {
    // Kayıt `Örnek Kayıt` türündendir. Değer sahte sunucunun kaydıdır; örnek formda yoktur.
    await page.goto(RECORD);
    await expect(page.getByRole('textbox', { name: /Örnek başlık/ })).toHaveValue('Örnek veri 3');
    await expect(page.getByText('3 / 24')).toHaveCount(0);
    await expect(page.getByText('Erişim izni yok')).toHaveCount(0);
  });

  test('listede kayıt satırına basınca kayıt sayfası açılır', async ({ page }) => {
    await page.goto(LIST);
    await recordLink(page, 'ORNEK-0003').click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(RECORD);
    await expect(page.getByRole('textbox', { name: /Örnek başlık/ })).toHaveValue('Örnek veri 3');
  });

  test('kayıt kaydedilince CSRF hatası çıkmaz; değişiklik sahte sunucuya yazılır', async ({
    page,
  }) => {
    // Sahte sunucu sayfanın içinde çalışır; durumu sayfa yeniden yüklenince sıfırlanır.
    // Bu yüzden kayda listeden girilir ve uygulama içinde geri ve ileri gidilir.
    await page.goto(LIST);
    await recordLink(page, 'ORNEK-0003').click();
    const title = page.getByRole('textbox', { name: /Örnek başlık/ });
    await expect(title).toHaveValue('Örnek veri 3');
    await title.fill('Kaydedilen başlık');
    await expect(page.getByText('1 kaydedilmemiş değişiklik')).toBeVisible();
    await page.getByRole('button', { name: 'Kaydet' }).click();
    // Sahte sunucu CSRF belirteci eksikse 400 `CSRFTokenError` verir. O zaman uyarı çıkar ve
    // değişiklik kaydedilmemiş kalır.
    await expect(page.getByText('1 kaydedilmemiş değişiklik')).toHaveCount(0);
    await expect(page.getByText('Güncel')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Kaydedilen başlık' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    // Kayıt yeniden açılınca değer sahte sunucudan okunur.
    await page.goBack();
    await expect(page.getByText('ORNEK-0001').first()).toBeVisible();
    await page.goForward();
    await expect(page.getByRole('textbox', { name: /Örnek başlık/ })).toHaveValue(
      'Kaydedilen başlık',
    );
  });

  for (const url of ['/satis/teklif', LIST, RECORD]) {
    test(`metin boyutu kaynak alt sınırın altına inmez: ${url}`, async ({ page }) => {
      await page.goto(url);
      // Kayıt adresinde ölçüm kayıt formu sahte sunucudan gelince yapılır.
      if (url === RECORD) {
        await expect(page.getByRole('textbox', { name: /Örnek başlık/ })).toHaveValue(
          'Örnek veri 3',
        );
      }
      await page.waitForTimeout(400);
      const min = await page.evaluate(() => {
        let m = Infinity;
        for (const el of document.querySelectorAll<HTMLElement>('.shell *')) {
          if (!el.childNodes.length) continue;
          const hasText = [...el.childNodes].some(
            (n) => n.nodeType === 3 && (n.textContent ?? '').trim(),
          );
          if (!hasText || el.closest('.shell-vh')) continue;
          const r = el.getBoundingClientRect();
          if (!r.width) continue;
          m = Math.min(m, parseFloat(getComputedStyle(el).fontSize));
        }
        return m;
      });
      expect(min).toBeGreaterThanOrEqual(12);
    });
  }
});

test.describe('komut kutusu önerileri', () => {
  test('öneri etiketi bileşen stili gelmeden de token boyutundadır (WebKit 9.38 px)', async ({
    page,
  }) => {
    // Örnek hızlı eylemler yalnız deneme sayfasındadır. Canlı eylemler sunucu menüsünden gelir.
    await page.goto(DEMO);
    if (isCompact(page)) await page.getByRole('button', { name: 'Menüyü aç' }).click();
    await expect(page.locator('.shell-chips .ant-prompts-label').first()).toBeVisible();
    const result = await page.evaluate(() => {
      // Ant Design X stili sayfaya geç eklenir. O ana kadar `h6` öğesinin varsayılan boyutu
      // geçerlidir. Bileşenin kendi stili kaldırılınca o ilk an ölçülür.
      for (const style of document.querySelectorAll('style')) {
        if (style.textContent?.includes('.ant-prompts')) style.remove();
      }
      const label = document.querySelector('.shell-chips .ant-prompts-label');
      const root = getComputedStyle(document.documentElement);
      return {
        size: label ? getComputedStyle(label).fontSize : '',
        token: root.getPropertyValue('--font-default').trim(),
        body: root.getPropertyValue('--font-body').trim(),
      };
    });
    // Boyut sabit yazılmaz: etiket gövde metni tokenını izler (AJA-997: gövde 16 px).
    expect(result.token).toBe(result.body);
    expect(parseFloat(result.token)).toBeGreaterThanOrEqual(14);
    expect(result.size).toBe(result.token);
  });
});

test.describe('kayan hover zemini (G1–G3)', () => {
  const glide = (page: Page) => page.locator('.shell-sb .shell-glide').first();

  async function centerY(page: Page, name: string) {
    const b = await page.getByRole('button', { name, exact: true }).boundingBox();
    return b ? b.y + b.height / 2 : 0;
  }

  async function glideCenterY(page: Page) {
    const b = await glide(page).boundingBox();
    return b ? b.y + b.height / 2 : -1;
  }

  /** Yazı tipi gelmeden ölçülen öğe konumu sonra kayar. Zemin eski konuma yerleşmiş olur. */
  async function fontsReady(page: Page) {
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
  }

  test('G1: zemin üzerine gelinen öğeye kayar', async ({ page }) => {
    test.skip(isCompact(page), 'telefonda hover yok');
    await page.goto(DEMO);
    await fontsReady(page);
    await page.getByRole('button', { name: 'Stok', exact: true }).hover();
    await expect(glide(page)).toHaveAttribute('data-on', 'true');
    await page.getByRole('button', { name: 'Muhasebe', exact: true }).hover();
    // Hedef konum her adımda yeniden ölçülür. Yük altında yerleşim ilk ölçümden sonra kayabilir.
    // Sınır aynıdır: zemin merkezi öğe merkezinden 0.5 px'ten az sapar.
    await expect
      .poll(async () => Math.abs((await glideCenterY(page)) - (await centerY(page, 'Muhasebe'))))
      .toBeLessThan(0.5);
  });

  test('G3: listeden çıkınca zemin solar', async ({ page }) => {
    test.skip(isCompact(page), 'telefonda hover yok');
    await page.goto(DEMO);
    await page.getByRole('button', { name: 'Stok', exact: true }).hover();
    await expect(glide(page)).toHaveAttribute('data-on', 'true');
    await page.mouse.move(900, 700);
    await expect(glide(page)).toHaveAttribute('data-on', 'false');
  });

  test('G1: flyout panelinde zemin öğeler arasında kayar', async ({ page }) => {
    test.skip(isCompact(page), 'telefonda hover yok');
    await page.goto(DEMO);
    await fontsReady(page);
    await page.getByRole('button', { name: 'Satış', exact: true }).hover();
    const fly = page.getByRole('group', { name: 'Satış' });
    const flyGlide = fly.locator('.shell-glide');
    const first = fly.getByRole('link').nth(0);
    const second = fly.getByRole('link').nth(1);
    await first.hover();
    await expect(flyGlide).toHaveAttribute('data-on', 'true');
    await second.hover();
    const target = await second.boundingBox();
    await expect
      .poll(async () => {
        const b = await flyGlide.boundingBox();
        return b ? b.y + b.height / 2 : -1;
      })
      .toBeCloseTo(target ? target.y + target.height / 2 : 0, 0);
  });

  test('G3: klavye odağı zemini taşır', async ({ page }) => {
    test.skip(isCompact(page), 'geniş ekran');
    await page.goto(DEMO);
    await fontsReady(page);
    await page.getByRole('button', { name: 'Stok', exact: true }).focus();
    await page.keyboard.press('Escape');
    await expect(glide(page)).toHaveAttribute('data-on', 'true');
    // Hedef konum her adımda yeniden ölçülür. Yük altında yerleşim ilk ölçümden sonra kayabilir
    // (WebKit, 7 px). Sınır aynıdır: zemin merkezi öğe merkezinden 0.5 px'ten az sapar.
    await expect
      .poll(async () => Math.abs((await glideCenterY(page)) - (await centerY(page, 'Stok'))))
      .toBeLessThan(0.5);
  });
});

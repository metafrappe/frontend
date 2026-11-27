/**
 * Dört panel rolünün ortak tarayıcı denetimi (AJA-831; G-62, G-168, G-169, G-170).
 * Testler koddan önce yazıldı. Her rolün listesi kendi test dosyasındadır:
 *
 * - `tests/e2e/rol-tenant-admin.spec.ts`
 * - `tests/e2e/rol-tenant-admin-assistant.spec.ts`
 * - `tests/e2e/rol-reseller-admin.spec.ts`
 * - `tests/e2e/rol-reseller-assistant.spec.ts`
 *
 * Rolü sahte sunucu verir. Test, sayfa açılmadan önce senaryo adını oturum deposuna yazar.
 * Senaryo, açılış yanıtındaki (`get_bootstrap`) kullanıcı rollerini değiştirir.
 * Senaryo adları `src/mocks/scenarios.ts` dosyasına eklenir:
 *
 * - `rol-tenant-admin`: roller "Website User" ve "Tenant Admin".
 * - `rol-tenant-admin-assistant`: roller "Website User" ve "Tenant Admin Assistant".
 * - `rol-reseller-admin`: roller "Website User" ve "Reseller Admin".
 * - `rol-reseller-assistant`: roller "Website User" ve "Reseller Assistant".
 *
 * Süzgeç yalnız ekranı düzenler. Yetkiyi sunucu denetler. Sunucu testleri
 * `backend/apps/platform_core/platform_core/access/tests/test_role_*.py` dosyalarındadır.
 *
 * Gerçek yığın kipi (AJA-945). Aynı testler yerel yığındaki gerçek panelde de koşar.
 * Bu kipte sahte sunucu yoktur. Test, rolün inceleme hesabıyla AtonotA Login'e girer.
 * Kip iki ortam değişkeniyle açılır:
 *
 * - `PANEL_GERCEK_URL`: denenen panelin kökü. Örnek: `http://localhost:5181/`.
 * - `PANEL_HESAPLAR`: `backend/e2e/review-accounts.json` dosyasının yolu. Parola oradadır.
 *
 * Komut: `npx playwright test -c playwright.gercek.config.ts`. Ayrıntı o dosyadadır.
 */
import { readFileSync } from 'node:fs';

import type { BrowserContext, Cookie, Page } from '@playwright/test';

import { expect, test } from './playwright-fixtures';

/** Sahte sunucunun senaryo anahtarı. Kaynak: `src/mocks/scenarios.ts` içindeki `MOCK_SCENARIO_KEY`. */
const SCENARIO_KEY = 'atonota.mock-senaryo';

/** Menü gruplarının adı ve sayfa yolu. "Müşteriler" grubu bayi rolleri için eklenir (G-169). */
export const MENU_GROUPS = {
  Hesap: '/account',
  Yönetim: '/administration',
  'Yapay zekâ sağlayıcıları': '/administration/ai-providers',
  Özelleştirme: '/administration/customization',
  'İzin talepleri': '/hr',
  'Site ve plan': '/site-plan',
  'Yapay zekâ işlemleri': '/ai-operations',
  Müşteriler: '/customers',
} as const;

export type MenuGroup = keyof typeof MENU_GROUPS;

/** Açılamayan sayfanın notu. Sayfa başlığı görünmez. Bunun yerine bu not görünür. */
export const DENIED_NOTE = /Bu sayfayı açma yetkiniz yok/;
/** Yalnız okunan sayfanın notu. Örnek: "Bu bölümü yalnız okuyabilirsiniz." */
export const READ_ONLY_NOTE = /yalnız okuyabilirsiniz/i;

export interface ButtonCheck {
  /** Düğmenin bulunduğu sayfa. */
  page: MenuGroup;
  /** Rolün gördüğü eylem düğmeleri. */
  shown: readonly string[];
  /** Rolün görmediği eylem düğmeleri. */
  hidden: readonly string[];
}

export interface RoleContract {
  /** Frappe rolünün adı. */
  role: string;
  /** Sahte sunucu senaryosu. */
  scenario: string;
  /** Gerçek yığındaki inceleme hesabı. Liste: `backend/e2e/review-accounts.json`. */
  account: string;
  /** Rolün menüde gördüğü gruplar. `MENU_GROUPS` sırasıyla yazılır. */
  menu: readonly MenuGroup[];
  /** Rolün açabildiği sayfalar. */
  pagesOpen: readonly MenuGroup[];
  /** Rolün açamadığı sayfalar. Bu sayfalar menüde de yoktur. */
  pagesClosed: readonly MenuGroup[];
  /** Rolün yalnız okuduğu sayfalar. Sayfada yalnız okuma notu görünür. */
  readOnly: readonly MenuGroup[];
  /** Rolün gördüğü ve görmediği eylem düğmeleri. */
  buttons: readonly ButtonCheck[];
}

/** Gerçek yığın kipinde denenen panelin kökü. Değer yoksa testler sahte sunucuyla koşar. */
export const REAL_PANEL_URL = process.env['PANEL_GERCEK_URL'];

/** Panel içi yolu adrese çevirir. Gerçek kipte panelin kökü eklenir. Örnek: `/customers`. */
function address(path: string): string {
  if (!REAL_PANEL_URL) return path;
  const root = REAL_PANEL_URL.endsWith('/') ? REAL_PANEL_URL : `${REAL_PANEL_URL}/`;
  return new URL(path.replace(/^\//, ''), root).href;
}

/** Parolayı yalnız dosyadan okur. Parola test çıktısına yazılmaz. */
function reviewPassword(): string {
  const file = process.env['PANEL_HESAPLAR'];
  if (!file) throw new Error('Gerçek kip PANEL_HESAPLAR değişkenini ister.');
  const data = JSON.parse(readFileSync(file, 'utf8')) as { password?: unknown };
  if (typeof data.password !== 'string' || !data.password) {
    throw new Error('İnceleme hesapları dosyasında parola yok.');
  }
  return data.password;
}

/** Panelin giriş düğmesi. Oturum yoksa panel bu düğmeyi gösterir. */
const SIGN_IN = 'AtonotA Login ile oturum aç';

/** Bir işçideki oturum çerezleri. Her hesap işçi başına bir kez girer. */
const sessions = new Map<string, Cookie[]>();

/**
 * Hesabı AtonotA Login ile oturuma sokar. Giriş panelin kendi düğmesiyle başlar.
 * Keycloak dönüşü yığının panel adresine gelir. Örnek: `http://localhost:5180/`.
 * Oturum çerezi `localhost` alanındadır. Çerez portu ayırmaz. Bu yüzden denenen panel de çerezi görür.
 */
async function signIn(page: Page, context: BrowserContext, account: string) {
  const saved = sessions.get(account);
  if (saved) {
    await context.addCookies(saved);
    return;
  }
  await page.goto(address('/'));
  await page.getByRole('button', { name: SIGN_IN }).click();
  await page.locator('#username').fill(account);
  await page.locator('#password').fill(reviewPassword());
  await page.locator('#kc-login').click();
  await page.waitForURL((url) => url.hostname === 'localhost');
  // Oturum açılınca kabuk sayfa başlığıyla çizilir. Giriş düğmesi kaybolur.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: SIGN_IN })).toHaveCount(0);
  sessions.set(account, await context.cookies());
}

async function useRole(page: Page, context: BrowserContext, contract: RoleContract) {
  if (REAL_PANEL_URL) {
    await signIn(page, context, contract.account);
    return;
  }
  await page.addInitScript(([key, value]) => sessionStorage.setItem(key, value), [
    SCENARIO_KEY,
    contract.scenario,
  ] as const);
}

async function openMenu(page: Page) {
  // Kabuk çizilmeden düğme görünmez. Önce sayfa başlığı beklenir.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const button = page.getByRole('button', { name: 'Menüyü aç' });
  if (await button.isVisible()) {
    await button.click();
    await expect(page.getByRole('dialog', { name: 'Menü' })).toBeVisible();
  }
}

/** Menüdeki grup bağlantıları. Yalnız `MENU_GROUPS` adları sayılır. */
async function menuGroups(page: Page): Promise<MenuGroup[]> {
  const menu = page.locator('#shell-drawer');
  await expect(menu.getByRole('link', { name: 'Ana sayfa', exact: true })).toBeVisible();
  const found: MenuGroup[] = [];
  for (const group of Object.keys(MENU_GROUPS) as MenuGroup[]) {
    if ((await menu.getByRole('link', { name: group, exact: true }).count()) > 0) found.push(group);
  }
  return found;
}

/** Yetki denetimi sürerken görünen not. Not kaybolunca sayfa kapısı karar vermiştir. */
const CHECKING_NOTE = /Sayfa yetkiniz denetleniyor/;

async function openPage(page: Page, group: MenuGroup) {
  await page.goto(address(MENU_GROUPS[group]));
  if (REAL_PANEL_URL) {
    // Gerçek panelde örnek veri notu yoktur. Kapı karar verince başlık ya da yetki notu görünür.
    await expect(page.getByRole('button', { name: SIGN_IN })).toHaveCount(0);
    await expect(
      page.getByRole('heading', { level: 1 }).or(page.getByText(DENIED_NOTE)).first(),
    ).toBeVisible();
    await expect(page.getByText(CHECKING_NOTE)).toHaveCount(0);
    return;
  }
  // Sahte sunucunun notu, kabuğun açıldığını gösterir.
  await expect(page.getByRole('status').filter({ hasText: 'Örnek veri' })).toBeVisible();
}

/** Bayi tanıma isteği eski uca gitmemeli (AJA-945). Örnek: `get_doctype?doctype=Reseller...`. */
function isResellerMetaRequest(url: string): boolean {
  const parsed = new URL(url);
  return (
    parsed.pathname.endsWith('/platform_core.api.meta.get_doctype') &&
    parsed.searchParams.get('doctype') === 'Reseller Customer Link'
  );
}

/** Bir rolün bütün tarayıcı testlerini kaydeder. Her test dosyası bunu bir kez çağırır. */
export function describeRole(contract: RoleContract) {
  test.describe(`"${contract.role}" rolü`, () => {
    test.beforeEach(async ({ page, context }) => {
      await useRole(page, context, contract);
    });

    test('menüde yalnız rolün grupları görünür', async ({ page }) => {
      // Sahte kipte servis işçisinin karşıladığı istek görünmez. Denetim gerçek kipte anlamlıdır.
      const metaRequests: string[] = [];
      page.on('request', (request) => {
        if (isResellerMetaRequest(request.url())) metaRequests.push(request.url());
      });
      await page.goto(address('/'));
      await openMenu(page);
      // Menü, sunucu yetki yanıtından sonra son hâlini alır. Bu yüzden liste yoklanır.
      await expect.poll(() => menuGroups(page)).toEqual([...contract.menu]);
      expect(metaRequests).toEqual([]);
    });

    for (const group of contract.pagesOpen) {
      test(`"${group}" sayfasını açar`, async ({ page }) => {
        await openPage(page, group);
        await expect(
          page.getByRole('heading', { level: 1, name: group, exact: true }),
        ).toBeVisible();
        await expect(page.getByText(DENIED_NOTE)).toHaveCount(0);
        const note = page.getByText(READ_ONLY_NOTE);
        if (contract.readOnly.includes(group)) await expect(note).toBeVisible();
        else await expect(note).toHaveCount(0);
      });
    }

    for (const group of contract.pagesClosed) {
      test(`"${group}" sayfasını açamaz`, async ({ page }) => {
        await openPage(page, group);
        await expect(page.getByText(DENIED_NOTE)).toBeVisible();
        await expect(page.getByRole('heading', { level: 1, name: group, exact: true })).toHaveCount(
          0,
        );
      });
    }

    for (const check of contract.buttons) {
      test(`"${check.page}" sayfasında rolün eylem düğmeleri`, async ({ page }) => {
        await openPage(page, check.page);
        await expect(
          page.getByRole('heading', { level: 1, name: check.page, exact: true }),
        ).toBeVisible();
        for (const name of check.shown) {
          await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
        }
        for (const name of check.hidden) {
          await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
        }
      });
    }
  });
}

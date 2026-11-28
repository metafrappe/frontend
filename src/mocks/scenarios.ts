// Tarayıcı testlerinin seçtiği sahte sunucu senaryoları.
// Sahte sunucu tarayıcıda çalışır. Playwright'ın `page.route` yöntemi bu istekleri görmez.
// Bu yüzden test, sayfa açılmadan önce `sessionStorage` içine bir senaryo adı yazar. Örnek:
//   await page.addInitScript(() => sessionStorage.setItem('atonota.mock-senaryo', 'cikis-hatasi'));
// Sahte sunucu açılırken bu adı okur. Bu dosya yalnız sahte sunucuyla pakete girer.
import { PANEL_ROLE_PROFILES, sampleSecondOpenLeave } from './fixtures';
import { type LogoutOutcome, mockState } from './handlers';

export const MOCK_SCENARIO_KEY = 'atonota.mock-senaryo';

const SCENARIOS: Record<string, () => void> = {
  'cikis-hatasi': () => setLogout('failure'),
  'cikis-yabanci-adres': () => setLogout('foreign_url'),
  // Oturum kapalı başlar. Giriş ekranı, "AtonotA Login" düğmesi ve açık platformlar görünür.
  'oturum-kapali': () => {
    mockState.signedIn = false;
  },
  /** Profil dilinin kaydı reddedilir (403 `PermissionError`, AJA-1772). */
  'dil-kaydi-red': () => {
    mockState.languageSaveRejected = true;
  },
  /** Sağlayıcı kaydetme ve deneme uçları hız sınırı (429 `gateway_busy`) verir. */
  'saglayici-mesgul': () => {
    mockState.providerBusy = true;
  },
  // Oturum kapalıdır ve açık platform yoktur. Yalnız AtonotA Login düğmesi görünür.
  'platform-yok': () => {
    mockState.signedIn = false;
    mockState.loginProviders = [];
  },
  // Dört panel rolü (AJA-831). Senaryo açılış verisindeki rolleri ve okunabilen türleri değiştirir.
  'rol-tenant-admin': () => setRole('Tenant Admin'),
  'rol-tenant-admin-assistant': () => setRole('Tenant Admin Assistant'),
  'rol-reseller-admin': () => setRole('Reseller Admin'),
  'rol-reseller-assistant': () => setRole('Reseller Assistant'),
  // Ana sayfada iki bekleyen izin talebi vardır.
  'ana-sayfa-iki-bekleyen': () => {
    mockState.leaves.set(sampleSecondOpenLeave.name, { ...sampleSecondOpenLeave });
  },
  // Ana sayfada bekleyen izin talebi yoktur. Açık başvurular listeden çıkar.
  'ana-sayfa-bos': () => {
    for (const leave of [...mockState.leaves.values()]) {
      if (leave.status === 'Open') mockState.leaves.delete(leave.name);
    }
  },
  /** Ana sayfa özet ucu sunucu hatası (500) verir. */
  'ana-sayfa-hata': () => {
    mockState.home.failure = true;
  },
  /**
   * Özet bekleyen taleplere eski bir sürüm yazar. Kayıt bu arada değişmiş gibidir.
   * Bu sürümle gelen onay ya da ret isteği çakışma (417 `TimestampMismatchError`) alır.
   */
  'ana-sayfa-eski-surum': () => {
    mockState.home.staleVersions = true;
  },
};

function setRole(role: string): void {
  const profile = PANEL_ROLE_PROFILES[role];
  if (!profile) return;
  mockState.roles = [...profile.roles];
  mockState.readableDocTypes = new Set(profile.readable);
}

function setLogout(outcome: LogoutOutcome): void {
  mockState.logoutOutcome = outcome;
}

/** Oturum deposundaki senaryo adını okur. Depo yoksa ya da erişilemezse `null` döner. */
export function readMockScenario(): string | null {
  try {
    return globalThis.sessionStorage?.getItem(MOCK_SCENARIO_KEY) ?? null;
  } catch {
    return null;
  }
}

/** Senaryoyu uygular. Ad tanınırsa `true` döner. Bilinmeyen ad yok sayılır. */
export function applyMockScenario(name: string | null): boolean {
  const apply = name ? SCENARIOS[name] : undefined;
  if (!apply) return false;
  apply();
  return true;
}

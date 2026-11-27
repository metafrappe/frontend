// Mock server scenarios chosen by browser tests.
// The mock server runs in the browser. Playwright's `page.route` does not see these requests.
// So the test writes a scenario name to `sessionStorage` before the page opens. Example:
//   await page.addInitScript(() => sessionStorage.setItem('atonota.mock-senaryo', 'cikis-hatasi'));
// The mock server reads this name on start. This file is bundled only with the mock server.
import { PANEL_ROLE_PROFILES, sampleSecondOpenLeave } from './fixtures';
import { type LogoutOutcome, mockState } from './handlers';

export const MOCK_SCENARIO_KEY = 'atonota.mock-senaryo';

const SCENARIOS: Record<string, () => void> = {
  'cikis-hatasi': () => setLogout('failure'),
  'cikis-yabanci-adres': () => setLogout('foreign_url'),
  // Starts signed out. The sign-in screen, the "AtonotA Login" button and enabled platforms show.
  'oturum-kapali': () => {
    mockState.signedIn = false;
  },
  /** The provider save and check endpoints return a rate limit (429 `gateway_busy`). */
  'saglayici-mesgul': () => {
    mockState.providerBusy = true;
  },
  // Signed out with no enabled platform. Only the AtonotA Login button shows.
  'platform-yok': () => {
    mockState.signedIn = false;
    mockState.loginProviders = [];
  },
  // Four panel roles (AJA-831). The scenario changes the boot data roles and the readable types.
  'rol-tenant-admin': () => setRole('Tenant Admin'),
  'rol-tenant-admin-assistant': () => setRole('Tenant Admin Assistant'),
  'rol-reseller-admin': () => setRole('Reseller Admin'),
  'rol-reseller-assistant': () => setRole('Reseller Assistant'),
  // The home page has two pending leave requests.
  'ana-sayfa-iki-bekleyen': () => {
    mockState.leaves.set(sampleSecondOpenLeave.name, { ...sampleSecondOpenLeave });
  },
  // The home page has no pending leave requests. Open applications are removed from the list.
  'ana-sayfa-bos': () => {
    for (const leave of [...mockState.leaves.values()]) {
      if (leave.status === 'Open') mockState.leaves.delete(leave.name);
    }
  },
  /** The home page summary endpoint returns a server error (500). */
  'ana-sayfa-hata': () => {
    mockState.home.failure = true;
  },
  /**
   * The summary gives pending requests an old version, as if the record changed meanwhile.
   * An approve or reject request with this version gets a conflict (417 `TimestampMismatchError`).
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

/**
 * Reads the scenario name from session storage. Returns `null` if storage is missing or
 * unavailable.
 */
export function readMockScenario(): string | null {
  try {
    return globalThis.sessionStorage?.getItem(MOCK_SCENARIO_KEY) ?? null;
  } catch {
    return null;
  }
}

/** Applies the scenario. Returns `true` if the name is known. Unknown names are ignored. */
export function applyMockScenario(name: string | null): boolean {
  const apply = name ? SCENARIOS[name] : undefined;
  if (!apply) return false;
  apply();
  return true;
}

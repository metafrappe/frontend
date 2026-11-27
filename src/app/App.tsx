import { lazy, Suspense } from 'react';

import type { ShellViewData } from '@/shell/view-data';

import { AppProviders } from './AppProviders';
import { appPathname } from './base-path';
import { DEMO_PATH_PREFIX } from './demo-mode';

/**
 * Kabuk kendi parçasında tembel yüklenir. Böylece giriş ve bekleme ekranları (AuthGate) kabuğu
 * indirmeden açılır; kabuk yalnız oturum kurulunca iner.
 */
const ShellApp = lazy(() => import('@/shell').then((m) => ({ default: m.ShellApp })));

/**
 * Deneme sayfaları yalnız e2e derlemesinde pakete girer. Koşul derleme zamanında sabittir;
 * üretimde (`vite build`) bu dal ve dinamik içe aktarım koddan düşer.
 */
const DemoFoundationPage =
  import.meta.env.MODE === 'e2e' ? lazy(() => import('./FoundationPage')) : null;
const DemoLocalePage =
  import.meta.env.MODE === 'e2e' ? lazy(() => import('./LocaleDemoPage')) : null;

function currentPath(): string {
  return typeof window === 'undefined' ? '/' : appPathname(window.location.pathname);
}

/** Kabuk ya da deneme sayfası. Sağlayıcıları çağıran kurar (bkz. `Root`). */
export function AppContent({ viewData = null }: { viewData?: ShellViewData | null }) {
  const path = currentPath();
  const foundation = DemoFoundationPage && path === `${DEMO_PATH_PREFIX}foundation`;
  const locale = DemoLocalePage && path === `${DEMO_PATH_PREFIX}locale`;
  return (
    <Suspense fallback={null}>
      {foundation ? (
        <DemoFoundationPage />
      ) : locale ? (
        <DemoLocalePage />
      ) : (
        <ShellApp viewData={viewData} />
      )}
    </Suspense>
  );
}

/** Uygulama kökü: sağlayıcılar içinde kabuk. */
export function App() {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
}

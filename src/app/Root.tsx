import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';

import { AuthGate, type PlatformSession } from '@/auth';
import { isPublicPath } from '@/auth/product/path';
import type { ModuleEnvironment } from '@/modules';

import { AppContent } from './App';
import { appPathname } from './base-path';
import { AppProviders } from './AppProviders';
import { useLanguage, useSetFormatting, useSetLanguage } from './locale';
import type { ThemeModeChoice } from './theme-mode';
import {
  createShellViewData,
  loadShellAccount,
  loadUserLocale,
  workspaceFromSite,
} from './view-data';

export interface RootProps {
  session: PlatformSession;
  initialThemeChoice?: ThemeModeChoice;
  /** For turning the engines off in tests. Enabled by default. */
  engines?: boolean;
  /** Content rendered while the session is open. Defaults to the shell. */
  children?: ReactNode;
  /**
   * Data mode of the module pages. When the mock server is on, `example` is passed; the page shows a sample-data label.
   * Sample data is not presented as live data. Defaults to `live`.
   */
  dataMode?: ModuleEnvironment['mode'];
  /**
   * Path of the opened URL. Defaults to `window.location.pathname`.
   * Pages that need no session (example: `/atonota-login`) do not go through AuthGate.
   */
  pathname?: string;
}

/**
 * The module environment builder is a separate chunk. The login screen does not download it (phone initial-load budget).
 * The chunk is requested as soon as the session opens. The shell and module page arrive later; the environment is ready by then.
 * If a module page opens before the environment arrives, the page shows a status and opens by itself once it arrives.
 */
const loadModuleEnvironment = () => import('@/shell/view-data/modules');

/** The landing page is a separate chunk. The chunk loads only at this URL. */
const ProductPage = lazy(() => import('@/auth/product/ProductPage'));

/**
 * Once the session opens, takes the language from the user language in the bootstrap data (IC-12).
 * Time zone and currency also come from the bootstrap data (IC-13).
 * Until the data arrives the screen is in the fallback language. If the request fails, language and formatting do not change.
 */
function UserLanguage({
  session,
  user,
  children,
}: {
  session: PlatformSession;
  user: string;
  children: ReactNode;
}) {
  const setLanguage = useSetLanguage();
  const setFormatting = useSetFormatting();
  useEffect(() => {
    const ctrl = new AbortController();
    void loadUserLocale(session.api, user, ctrl.signal).then((locale) => {
      if (ctrl.signal.aborted || locale === undefined) return;
      setLanguage(locale.language);
      setFormatting({ time_zone: locale.time_zone, currency: locale.currency });
    });
    return () => ctrl.abort();
  }, [session, user, setLanguage, setFormatting]);
  return children;
}

/** While the session is open, sets up the shell's data wiring: collection source and module environment. */
function SignedIn({
  session,
  user,
  dataMode,
}: {
  session: PlatformSession;
  user: string;
  dataMode: ModuleEnvironment['mode'];
}) {
  const locale = useLanguage();
  const [fullName, setFullName] = useState<string | undefined>(undefined);
  useEffect(() => {
    const ctrl = new AbortController();
    void loadShellAccount(session.api, user, ctrl.signal).then((account) => {
      if (!ctrl.signal.aborted) setFullName(account.fullName);
    });
    return () => ctrl.abort();
  }, [session, user]);
  // The environment is stored with the session, user, mode and language it was built for. If any changes, the old one is not used.
  const [loaded, setLoaded] = useState<
    | {
        session: PlatformSession;
        user: string;
        dataMode: string;
        locale: string;
        env: ModuleEnvironment;
      }
    | undefined
  >(undefined);
  const modules =
    loaded &&
    loaded.session === session &&
    loaded.user === user &&
    loaded.dataMode === dataMode &&
    loaded.locale === locale
      ? loaded.env
      : undefined;
  useEffect(() => {
    let active = true;
    void loadModuleEnvironment().then(({ createShellModuleEnvironment }) => {
      if (!active) return;
      const env = createShellModuleEnvironment({
        api: session.api,
        tenant: session.config.siteUrl,
        user,
        locale,
        mode: dataMode,
      });
      setLoaded({ session, user, dataMode, locale, env });
    });
    return () => {
      active = false;
    };
  }, [session, user, dataMode, locale]);
  // Data wiring is rebuilt only when the session or user changes. The name arrives later.
  // The workspace is the session's site. If the URL cannot be parsed, no workspace is added; the switcher shows only the logo.
  const base = useMemo(() => {
    const workspaces = workspaceFromSite(session.config.siteUrl);
    return { ...createShellViewData(session.api), ...(workspaces ? { workspaces } : {}) };
  }, [session]);
  const viewData = useMemo(
    () => ({
      ...base,
      ...(modules ? { modules } : {}),
      account: { user, ...(fullName ? { fullName } : {}) },
      signOut: () => session.auth.signOut(),
    }),
    [base, modules, user, fullName, session],
  );
  return <AppContent viewData={viewData} />;
}

/**
 * Outermost root of the application.
 * Theme and design providers sit outside AuthGate. So the login, waiting and error
 * screens also use the light and dark theme tokens.
 * Once the session opens, the shell is wired to the session user and the shared API client.
 */
export function Root({
  session,
  initialThemeChoice,
  engines = true,
  children,
  dataMode = 'live',
  pathname = typeof window === 'undefined' ? '/' : window.location.pathname,
}: RootProps) {
  // In production the URL starts with `/panel/`. The comparison uses the in-app path.
  if (isPublicPath(appPathname(pathname))) {
    // The landing page does not require a session (G-165). Theme and design providers are still set up.
    return (
      <AppProviders {...(initialThemeChoice ? { initialThemeChoice } : {})} engines={engines}>
        <Suspense fallback={null}>
          <ProductPage />
        </Suspense>
      </AppProviders>
    );
  }
  return (
    <AppProviders {...(initialThemeChoice ? { initialThemeChoice } : {})} engines={engines}>
      <AuthGate session={session}>
        {(user) => (
          <UserLanguage session={session} user={user}>
            {children ?? <SignedIn session={session} user={user} dataMode={dataMode} />}
          </UserLanguage>
        )}
      </AuthGate>
    </AppProviders>
  );
}

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
  /** Testlerde motorları kapatmak için. Varsayılan açık. */
  engines?: boolean;
  /** Oturum açıkken çizilecek içerik. Varsayılan kabuktur. */
  children?: ReactNode;
  /**
   * Modül sayfalarının veri kipi. Sahte sunucu açıkken `example` verilir; sayfa "Örnek veri" yazar.
   * Örnek veri canlı veri gibi gösterilmez. Varsayılan `live` olur.
   */
  dataMode?: ModuleEnvironment['mode'];
  /**
   * Açılan adresin yolu. Varsayılan `window.location.pathname` olur.
   * Oturum istemeyen sayfalar (örnek: `/atonota-login`) AuthGate'e girmez.
   */
  pathname?: string;
}

/**
 * Modül ortamının kurucusu ayrı parçadır. Giriş ekranı bu parçayı indirmez (telefon ilk yük bütçesi).
 * Parça oturum açılınca hemen istenir. Kabuk ve modül sayfası daha sonra iner; ortam o ana kadar hazır olur.
 * Ortam gelmeden modül sayfası açılırsa sayfa durum yazar ve ortam gelince kendiliğinden açılır.
 */
const loadModuleEnvironment = () => import('@/shell/view-data/modules');

/** Tanıtım sayfası ayrı parçadır. Parça yalnız bu adreste yüklenir. */
const ProductPage = lazy(() => import('@/auth/product/ProductPage'));

/**
 * Oturum açılınca dili açılış verisindeki kullanıcı dilinden alır (IC-12).
 * Saat dilimi ve para birimi de açılış verisinden gelir (IC-13).
 * Veri gelene kadar ekran yedek dildedir. İstek başarısızsa dil ve biçim değişmez.
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
      setFormatting({
        time_zone: locale.time_zone,
        currency: locale.currency,
        region: locale.region,
        measurement_system: locale.measurement_system,
      });
    });
    return () => ctrl.abort();
  }, [session, user, setLanguage, setFormatting]);
  return children;
}

/** Oturum açıkken kabuğun veri bağlantısını kurar: koleksiyon kaynağı ve modül ortamı. */
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
  // Ortam kurulduğu oturum, kullanıcı, kip ve dille saklanır. Biri değişince eski ortam kullanılmaz.
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
  // Veri bağlantısı yalnız oturum ya da kullanıcı değişince yeniden kurulur. Ad sonradan gelir.
  // Çalışma alanı oturumun sitesidir. Adres çözülemezse alan eklenmez; seçici yalnız logoyu gösterir.
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
 * Uygulamanın en dış kökü.
 * Tema ve tasarım sağlayıcıları AuthGate'in dışındadır. Böylece giriş, bekleme ve hata
 * ekranları da açık ve koyu temanın tokenlarını kullanır.
 * Oturum açılınca kabuk, oturumdaki kullanıcıyla ve ortak API istemcisiyle bağlanır.
 */
export function Root({
  session,
  initialThemeChoice,
  engines = true,
  children,
  dataMode = 'live',
  pathname = typeof window === 'undefined' ? '/' : window.location.pathname,
}: RootProps) {
  // Canlıda adres `/panel/` ile başlar. Karşılaştırma uygulama içindeki yolla yapılır.
  if (isPublicPath(appPathname(pathname))) {
    // Tanıtım sayfası oturum sormaz (G-165). Tema ve tasarım sağlayıcıları yine kurulur.
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

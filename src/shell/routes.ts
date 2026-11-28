/**
 * Rota kaydı. Uygulamanın bütün sayfa rotaları buradadır.
 *
 * KURAL: Her iş kendi sayfası için `lazyRoutes` listesine yalnız kendi satırını ekler.
 * Başka işin satırı değiştirilmez. Koleksiyon yolları (`collectionRoutes`) kabuğundur.
 * Satırın biçimi sabittir. Dört alan vardır, başka alan eklenmez:
 *
 *   {
 *     path: '/satis/:doctype',             // react-router yolu, "/" ile başlar
 *     label: 'Satış',                      // menü etiketi, Türkçe ve kısa
 *     icon: ShoppingCart,                  // Phosphor ikonu, ağırlık regular
 *     load: () => import('@/modules/...'), // tembel yükleyici
 *   },
 *
 * Kurallar:
 * - Yükleyici, varsayılan dışa aktarımı bileşen olan bir modül döndürür.
 * - Sayfa modülü bu dosyayı içe aktarmaz. Adresler `paths.ts` dosyasından gelir.
 * - Parametresiz yollar (":" içermeyen) sidebar menüsünde görünür. `/_demo/` yolları görünmez.
 * - Yollar tekildir. `routes.test.ts` biçimi ve tekilliği denetler.
 * - Bu dosyanın sahibi `shell` işidir. Öteki işler yalnız kendi satırını ekler.
 */
import type { Icon } from '@phosphor-icons/react';
import {
  Buildings,
  CalendarCheck,
  FileText,
  Flask,
  GearSix,
  House,
  PaintBrush,
  PlugsConnected,
  Robot,
  Rows,
  ShieldCheck,
  Sparkle,
  SquaresFour,
  UserCircle,
  UsersThree,
} from '@phosphor-icons/react';
import type { ComponentType } from 'react';
import { createElement, lazy } from 'react';

import { DEMO_PATH_PREFIX } from '@/app/demo-mode';

import type { ModuleRegistration } from '@/modules';
import { moduleRegistrations } from '@/modules';
import type { RouteObject } from 'react-router-dom';

export interface RouteEntry {
  path: string;
  label: string;
  icon: Icon;
  load: () => Promise<{ default: ComponentType }>;
}

/**
 * Özellik ayarları. Kapalı ayarın satırı rota listesine girmez.
 * Kapalı satırın adresi koleksiyon sayfasına da düşmez. Bkz. `reservedFirstSegments`.
 */
export const shellFeatures = {
  /** AI Studio bu dalda. Yükleyici `src/ai/studio/AiStudioPage.tsx` dosyasına bağlıdır. */
  aiStudio: true,
};

/** AI Studio satırı. Ayar kapalı olursa listede yoktur. */
export const aiStudioRoute: RouteEntry = {
  path: '/panel/ai',
  label: 'AI Studio',
  icon: Sparkle,
  load: () => import('@/ai/studio/AiStudioPage'),
};

/**
 * Modül sayfasının tembel yükleyicisi.
 * Sayfa ve `ModuleBoundary` yalnız yükleyici çağrılınca istenir.
 * Sayfa `ModuleProvider` içinde açılır.
 */
export function modulePage(load: ModuleRegistration['load'], path?: string): RouteEntry['load'] {
  return () =>
    Promise.all([load(), import('./pages/ModuleBoundary')]).then(([page, boundary]) => {
      const Page = page.default;
      const { ModuleBoundary } = boundary;
      // Yol, sayfa kapısının kuralını seçer (G-94, G-169). Bkz. `moduleAllowed`.
      return {
        default: () => createElement(ModuleBoundary, { page: Page, ...(path ? { path } : {}) }),
      };
    });
}

/** Modül ikonları. Kayıtta ikon alanı yoktur. Bilinmeyen modül genel ikonu alır. */
const moduleIcons: Record<string, Icon> = {
  account: UserCircle,
  administration: ShieldCheck,
  'ai-providers': PlugsConnected,
  hr: CalendarCheck,
  'site-plan': Buildings,
  'ai-operations': Robot,
  customers: UsersThree,
  settings: GearSix,
  'settings-branding': PaintBrush,
  'settings-hr': GearSix,
};

/** `modules` işinin kayıtları (`src/modules/registry.ts`). Kabuk yalnız biçimi çevirir. */
export const moduleRoutes: RouteEntry[] = moduleRegistrations.map((m) => ({
  path: m.path,
  label: m.label.tr,
  icon: moduleIcons[m.id] ?? SquaresFour,
  load: modulePage(m.load, m.path),
}));

/**
 * Tembel rota listesi. Her iş buraya yalnız kendi satırını ekler.
 * Bu satırlar koleksiyon yollarından önce eklenir ve onlardan önce eşleşir.
 */
export const lazyRoutes: RouteEntry[] = [
  { path: '/', label: 'Ana sayfa', icon: House, load: () => import('./pages/HomePage') },
  {
    path: '/asistan',
    label: 'Asistan',
    icon: Sparkle,
    load: () => import('./pages/AssistantPage'),
  },
  { path: '/ajanlar/:id', label: 'AI ajanı', icon: Robot, load: () => import('./pages/AgentPage') },
  ...moduleRoutes,
  ...(shellFeatures.aiStudio ? [aiStudioRoute] : []),
  // Deneme sayfaları yalnız e2e derlemesinde vardır. Koşul derleme zamanında sabittir.
  // İşlev çağrısı kullanılmaz: derleyici çağrıyı sabite çevirmez ve sayfalar üretime girer.
  // Menüde görünmezler (`menuEntries`).
  ...(import.meta.env.MODE === 'e2e'
    ? [
        {
          path: '/_demo/shell',
          label: 'Kabuk denemesi',
          icon: Flask,
          load: () => import('./pages/DemoPage'),
        },
        {
          path: '/_demo/controls',
          label: 'Kontrol denemesi',
          icon: SquaresFour,
          load: () => import('@/components/controls/demo/ControlsDemoPage'),
        },
        {
          path: '/_demo/genui',
          label: 'Yüzey denemesi',
          icon: Flask,
          load: () => import('@/genui/demo/GenuiDemoPage'),
        },
      ]
    : []),
];

/**
 * Koleksiyon yolları. Bu satırların sahibi `shell` işidir. Öteki işler buraya satır eklemez.
 * Liste rotası `views-collection` işinin `CollectionView` bileşenini çizer.
 * Kayıt rotası `views-record` işinin bileşeni gelince ona bağlanacak.
 */
export const collectionRoutes: RouteEntry[] = [
  {
    path: '/:module/:doctype',
    label: 'Kayıtlar',
    icon: Rows,
    load: () => import('./pages/CollectionRoute'),
  },
  {
    path: '/:module/:doctype/:name',
    label: 'Kayıt',
    icon: FileText,
    load: () => import('./pages/RecordPage'),
  },
];

/** Bütün rotalar, eşleşme sırasıyla. */
export const routeRegistry: RouteEntry[] = [...lazyRoutes, ...collectionRoutes];

/**
 * Bu ilk adres parçaları hiçbir zaman koleksiyon ya da kayıt sayfasına düşmez.
 * `_demo` örnek sayfalar içindir. `panel` uygulama sayfaları içindir.
 * Bu öneklerin sayfaları yalnız `lazyRoutes` içindeki kendi satırıyla açılır.
 */
export const reservedFirstSegments: readonly string[] = ['_demo', 'panel'];

export function isReservedSegment(segment: string | undefined): boolean {
  return segment !== undefined && reservedFirstSegments.includes(segment);
}

/**
 * Kayıtları router kayıtlarına çevirir. Sayfa `React.lazy` ile tembel yüklenir.
 * Kabuk hemen çizilir. Sayfa yüklenirken yalnız içerik alanı bekler.
 * Router'ın kendi `lazy` alanı kullanılmaz: ilk açılışta kabuğu da bekletir.
 */
export function toRouteObjects(entries: RouteEntry[]): RouteObject[] {
  return entries.map((e) => ({ path: e.path, Component: lazy(e.load) }));
}

/** Menüde görünen kayıtlar: parametresiz yollar. Deneme sayfaları (`/_demo/`) menüde görünmez. */
export function menuEntries(entries: RouteEntry[]): RouteEntry[] {
  return entries.filter((e) => !e.path.includes(':') && !e.path.startsWith(DEMO_PATH_PREFIX));
}

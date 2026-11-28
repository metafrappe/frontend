import type { ComponentType } from 'react';

import {
  HR_SETTINGS_DOCTYPE,
  TENANT_BRANDING_DOCTYPE,
  TENANT_SETTINGS_DOCTYPE,
} from './settings/doctypes';

export interface ModuleRegistration {
  id: string;
  path: string;
  label: { en: string; tr: string };
  /**
   * Sayfanın okuduğu DocType adları. Menü bu sayfayı yalnız hepsi okunabilirse gösterir (G-94).
   * Okuma yetkisini sunucu bildirir. Kodda rol adı yoktur.
   * Örnek: "İzin talepleri" sayfası `Leave Application` kayıtlarını okur.
   */
  requires?: readonly string[];
  /**
   * Bu DocType adlarından biri okunabilirse sayfa menüde görünmez (G-169, G-170).
   * Örnek: bayi hesabında `Reseller Customer Link` okunabilir sayılır. Bu hesap kiracı sayfalarını görmez.
   * Kararı sunucu verir: bayi müşteri listesi ucu (AJA-945). Kodda rol adı yoktur.
   */
  excludes?: readonly string[];
  /** The shell only calls load after navigation. Importing this registry loads no screen. */
  load: () => Promise<{ default: ComponentType }>;
}
/**
 * Bayiyi müşteri kiracısına bağlayan kayıt türü (G-169). Menüde bayi hesabının işaretidir.
 * Kabuk bu türü tanım ucuna sormaz. Tanım ucu bu türe bayiye de 403 verir (AJA-945).
 * Bayi müşteri listesi ucu 200 dönerse kabuk bu adı okunabilir sayar. Kiracı sayfaları bayiye görünmez.
 */
export const RESELLER_LINK_DOCTYPE = 'Reseller Customer Link';
/** Kiracı sayfaları bayi hesabında görünmez. */
const TENANT_ONLY = [RESELLER_LINK_DOCTYPE] as const;

export const moduleRegistrations: readonly ModuleRegistration[] = [
  {
    id: 'account',
    path: '/account',
    label: { en: 'Account', tr: 'Hesap' },
    load: () => import('./account/Page'),
  },
  {
    id: 'administration',
    path: '/administration',
    label: { en: 'Administration', tr: 'Yönetim' },
    excludes: TENANT_ONLY,
    load: () => import('./administration/Page'),
  },
  {
    // Yönetim bölümünün alt sayfası. Kod yalnız bu sayfa açılınca iner.
    id: 'ai-providers',
    path: '/administration/ai-providers',
    label: { en: 'AI providers', tr: 'Yapay zekâ sağlayıcıları' },
    // Sayfa bu üç türün listesini okur (`src/api/provider-client.ts`, `AI_DOCTYPES`).
    requires: ['PLT AI API', 'PLT AI Account', 'PLT AI Provider'],
    excludes: TENANT_ONLY,
    load: () => import('./ai-providers/Page'),
  },
  {
    id: 'hr',
    path: '/hr',
    label: { en: 'Leave requests', tr: 'İzin talepleri' },
    requires: ['Leave Application'],
    excludes: TENANT_ONLY,
    load: () => import('./hr/Page'),
  },
  {
    id: 'site-plan',
    path: '/site-plan',
    label: { en: 'Site and plan', tr: 'Site ve plan' },
    load: () => import('./site-plan/Page'),
  },
  {
    id: 'ai-operations',
    path: '/ai-operations',
    label: { en: 'AI operations', tr: 'Yapay zekâ işlemleri' },
    excludes: TENANT_ONLY,
    load: () => import('./ai-operations/Page'),
  },
  {
    // Kiracı ayarları (G-97). Dil, saat dilimi, biçimler, oturum süresi ve e-posta bilgisi.
    // Form türün şemasından çizilir. Sunucu yalnız güvenli alanları bu türe koyar.
    id: 'settings',
    path: '/settings',
    label: { en: 'General settings', tr: 'Genel ayarlar' },
    requires: [TENANT_SETTINGS_DOCTYPE],
    excludes: TENANT_ONLY,
    load: () => import('./settings/GeneralPage'),
  },
  {
    // Kiracı markası (G-97): logo ve renk tokenları.
    id: 'settings-branding',
    path: '/settings/branding',
    label: { en: 'Branding', tr: 'Marka' },
    requires: [TENANT_BRANDING_DOCTYPE],
    excludes: TENANT_ONLY,
    load: () => import('./settings/BrandingPage'),
  },
  {
    // Uygulama ayar türü (G-97). Örnek: İK uygulamasının ayarları.
    id: 'settings-hr',
    path: '/settings/hr',
    label: { en: 'HR settings', tr: 'İK ayarları' },
    requires: [HR_SETTINGS_DOCTYPE],
    excludes: TENANT_ONLY,
    load: () => import('./settings/HrSettingsPage'),
  },
  {
    // Bayinin bağlı müşterileri (G-169, G-170). Kiracı hesabı bağ kaydını okuyamaz.
    id: 'customers',
    path: '/customers',
    label: { en: 'Customers', tr: 'Müşteriler' },
    requires: [RESELLER_LINK_DOCTYPE],
    load: () => import('./customers/Page'),
  },
];

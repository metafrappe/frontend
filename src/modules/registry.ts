import type { ComponentType } from 'react';
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
    // G-97 parça 3: içe aktarım, dışa aktarım ve KVKK kişisel veri talebi.
    // Kayıt türü listesini sunucu yetkiye göre verir. KVKK talebi her kiracı kullanıcısına açıktır.
    // Bayi hesabı kiracı verisini aktarmaz; sayfa bayi menüsünde görünmez.
    id: 'data-transfer',
    path: '/data-transfer',
    label: { en: 'Data transfer', tr: 'Veri aktarımı' },
    excludes: TENANT_ONLY,
    load: () => import('./data-transfer/Page'),
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

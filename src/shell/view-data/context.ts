import { createContext } from 'react';
import type { ComponentType } from 'react';

import type { AgentSource, AgentTransport } from '@/ai/agent/types';
import type { ModuleEnvironment } from '@/modules';
import type { CollectionDefinition, CollectionSource } from '@/views/collection';

import type { ShellHomeData } from './home-data';

/** Liste rotasının adres parçaları. Eşleme sağlayıcının işidir. */
export interface CollectionAddress {
  module: string;
  doctype: string;
}

export interface ShellCollectionData {
  /** Adresteki DocType için koleksiyon tanımını getirir. İptal sinyaline uyar. */
  loadDefinition: (
    address: CollectionAddress,
    signal: AbortSignal,
  ) => Promise<CollectionDefinition>;
  /** Liste isteklerini sunucuya ileten kaynak. */
  source: CollectionSource;
  /**
   * Adresteki türün görünen adı. Tanım gelmeden (bekleme ve hata ekranı) sayfa başlığı budur.
   * Örnek: `/satis/teklif` -> `Teklif`. Yoksa başlık genel "Kayıtlar" olur.
   */
  title?: (address: CollectionAddress) => string;
}

/** Sidebar grubundaki liste bağlantısı. */
export interface ShellSidebarLink {
  /** Menüde görünen ad. */
  label: string;
  /** Frappe DocType adı. Adres parçası bundan üretilir. */
  doctype: string;
}

/** Sunucunun açılış verisindeki bir sidebar grubu. Eşleme uygulama girişinin işidir. */
export interface ShellSidebar {
  id: string;
  label: string;
  /** Liste adresinin ilk parçası. Örnek: `selling`. */
  module: string;
  links: ShellSidebarLink[];
}

export interface ShellNavigationData {
  /** Menü gruplarını getirir. Veri yoksa ya da istek başarısızsa boş liste döner. */
  loadSidebars: (signal: AbortSignal) => Promise<ShellSidebar[]>;
  /**
   * Verilen DocType adlarından kullanıcının okuyabildiklerini döner (G-94).
   * Kararı sunucu verir. İstek başarısızsa tür okunamaz sayılır.
   * Bağlantı yoksa menü yetki isteyen sayfayı göstermez.
   */
  loadReadable?: (doctypes: readonly string[], signal: AbortSignal) => Promise<ReadonlySet<string>>;
  /**
   * Hesabın bayi hesabı olup olmadığını sunucuya sorar (G-169, G-170, AJA-945).
   * Bayi müşteri listesi ucu 200 dönerse hesap bayidir. Boş liste de bayi sayılır.
   * Uç 403 dönerse hesap kiracı hesabıdır. Başka hata gelirse söz reddedilir.
   */
  loadAccountKind?: (signal: AbortSignal) => Promise<AccountKind>;
}

/** Hesap türü. `reseller` bayi hesabıdır, `tenant` kiracı hesabıdır. */
export type AccountKind = 'reseller' | 'tenant';

/** Kayıt rotasının adres parçaları. */
export interface RecordAddress {
  module: string;
  doctype: string;
  /** Adresteki kayıt adı, kodlanmış hâliyle. */
  name: string;
}

export interface ShellRecordData {
  /** Kaydı çizen bileşen. Uygulama girişi bunu tembel yükler. */
  Component: ComponentType<RecordAddress>;
}

/**
 * Kabuğun görünümlere verdiği veri bağlantısı.
 * Kabuk API istemcisi kurmaz. Bağlantıyı uygulama girişi (`src/app/`) verir.
 */
/** Oturumdaki kişi. Kullanıcı kartı bunu gösterir. */
export interface ShellAccount {
  /** Frappe kullanıcı kimliği. Örnek: `kisi@example.test`. */
  user: string;
  /** Görünen ad. Yoksa kart kullanıcı kimliğini gösterir. */
  fullName?: string;
}

/**
 * Bir çalışma alanı. Bu sürümde çalışma alanı oturumun kiracısıdır (Frappe sitesi).
 * Örnek: `{ id: 'acme.atonota.net', name: 'acme.atonota.net' }`.
 */
export interface ShellWorkspace {
  id: string;
  name: string;
  /** Adın altındaki kısa not. Yoksa not satırı çizilmez. */
  note?: string;
}

/** Çalışma alanı seçicinin verisi. Tek öğe varsa seçici açılır liste olmadan sade görünür. */
export interface ShellWorkspaceData {
  items: ShellWorkspace[];
  /** Açık çalışma alanının kimliği. */
  current: string;
  /** Başka çalışma alanı seçilince çağrılır. Yoksa seçim yalnız ekranda değişir. */
  select?: (id: string) => void;
}

/** AI kredisi. Sayılar sunucudan gelir. */
export interface ShellCredit {
  used: number;
  total: number;
}

export interface ShellCreditData {
  /** Krediyi okur. Uç yoksa ya da yanıt geçersizse `null` döner; sayaç görünmez. */
  load: (signal: AbortSignal) => Promise<ShellCredit | null>;
}

/**
 * Sunucudan gelen yardım (G-138). Alanlar sözleşmedeki adlarla aynıdır.
 * Bağlantı yoksa değer `null` olur. Panel güvensiz adresi ayrıca atar.
 */
export interface ShellHelpAnswer {
  title: string | null;
  content: string | null;
  tour_url: string | null;
  doc_url: string | null;
  support_url: string | null;
}

/** Yardım panelinin sunucu bağlantısı. Yoksa panel yalnız alan açıklamasını gösterir. */
export interface ShellHelpData {
  /** Alan yardımını okur. Alan okunamıyorsa ya da yardım yoksa `null` döner. */
  loadField: (
    query: { doctype: string; fieldname: string },
    signal: AbortSignal,
  ) => Promise<ShellHelpAnswer | null>;
  /** Bileşen yardımını okur. Bileşen için yardım yoksa `null` döner. */
  loadComponent: (componentId: string, signal: AbortSignal) => Promise<ShellHelpAnswer | null>;
}

export interface ShellViewData {
  /** Çalışma alanı seçici. Yoksa yalnız logo görünür. */
  workspaces?: ShellWorkspaceData;
  /** AI kredisi sayacı. Yoksa sayaç görünmez. */
  credit?: ShellCreditData;
  /** AI Studio bağlantısı. Yoksa AI Studio "bağlantı kurulmadı" yazar. */
  ai?: ShellAiData;
  collection?: ShellCollectionData;
  /** Kayıt rotasının bağlantısı. Yoksa kabuk örnek kaydı gösterir (deneme sayfaları). */
  record?: ShellRecordData;
  /** Oturumdaki kişi. Yoksa kabuk örnek kişiyi gösterir (deneme sayfaları). */
  account?: ShellAccount;
  /** Menü grupları. Yoksa menüde yalnız rota kaydındaki sayfalar görünür. */
  navigation?: ShellNavigationData;
  /**
   * Oturumu kapatır. Başarılı olursa tarayıcı Keycloak çıkış sayfasına gider.
   * İstek başarısız olursa işlev reddedilir ve oturum açık kalır.
   * Yoksa kabuk çıkış düğmesini çizmez (deneme sayfaları).
   */
  signOut?: () => Promise<void>;
  /** Modül sayfalarının ortamı. Kabuk bunu `ModuleProvider` ile verir. */
  modules?: ModuleEnvironment;
  /**
   * Ana sayfanın (Bekleyenler) bağlantısı. Yoksa ana sayfa modül ortamının bağlantısını kullanır.
   * İkisi de yoksa ana sayfa bağlantının kurulmadığını yazar.
   */
  home?: ShellHomeData;
  /** Yardım içeriği (G-138). Yoksa panel bağlantı çizmez. */
  help?: ShellHelpData;
}

/** AI Studio taşıyıcısı ve ekranda yazan kaynak adı (AX-7). */
export interface ShellAiData {
  transport: AgentTransport;
  source: AgentSource;
}

export const ViewDataContext = createContext<ShellViewData | null>(null);

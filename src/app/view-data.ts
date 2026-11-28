import { createElement, lazy } from 'react';

import type { ApiClient } from '@/api';
import type { LocaleTag } from './locale';
import type {
  RecordAddress,
  ShellAccount,
  ShellSidebar,
  ShellViewData,
  ShellWorkspaceData,
} from '@/shell/view-data';
import type { CollectionSource } from '@/views/collection/source';

// Bu dosya ilk yük parçasındadır. Koleksiyon kaynağı ve tanım kurucusu ilk yükte olmamalıdır.
// Zincir yalnız liste rotası ilk isteği yapınca `import()` ile iner (orkestratör eki: ilk yük).
// Kayıt bağdaştırıcısı da yalnız kayıt rotasıyla iner (`RecordRoute` tembel parçası).
const loadCollectionSource = () => import('@/views/collection/source');

/**
 * Adres parçasını Frappe DocType adına çevirir.
 * Örnek: `sales-invoice` -> `Sales Invoice`.
 */
export function doctypeFromSlug(slug: string): string {
  return decodeURIComponent(slug)
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

type Bootstrap = Awaited<ReturnType<ApiClient['getBootstrap']>>;
type BootstrapSidebar = Bootstrap['sidebars'][number];

/**
 * Modül adını adres parçasına çevirir. Örnek: `Selling` -> `selling`, `Site Plan` -> `site-plan`.
 * Menü grubu ve kayıt bağlantısı aynı çeviriyi kullanır; böylece adres menüdeki grupla eşleşir.
 */
export function moduleSlug(name: string): string {
  // Dilden bağımsız küçültme (G-132): Türkçe kural `Integrations` adını `ıntegrations` yapardı.
  // `toLowerCase` dile bakmaz. Adres parçası kullanıcının diline göre değişmez.
  return name.trim().toLowerCase().split(/\s+/).filter(Boolean).join('-');
}

const truthy = (v: number | boolean | null | undefined) => v === true || v === 1;

/**
 * Açılış verisindeki sidebar satırlarını menü grubuna çevirir.
 * Yalnız DocType bağlantıları alınır; liste rotası yalnız bunları açar. Gizli satır alınmaz.
 * Adresten aynı ada geri çevrilemeyen tür alınmaz; bağlantı başka türe giderdi.
 */
function toShellSidebar(sidebar: BootstrapSidebar): ShellSidebar | null {
  const data = sidebar.data;
  const links = (data.items ?? []).flatMap((item) => {
    const doctype = item.link_to?.trim();
    if (item.link_type !== 'DocType' || !doctype || truthy(item.hidden)) return [];
    if (doctypeFromSlug(encodeURIComponent(doctype)) !== doctype) return [];
    return [{ label: item.label?.trim() || doctype, doctype }];
  });
  const module = moduleSlug(data.module ?? sidebar.name);
  if (links.length === 0 || !module) return null;
  return { id: sidebar.name, label: data.label?.trim() || sidebar.name, module, links };
}

/** Bayinin bağlı müşteri listesi. Uç yalnız bayi rollerine 200 döner (G-169, G-170). */
const RESELLER_PROBE_PATH = '/api/method/platform_core.api.reseller.list_customers';

// Kayıt görünümü kendi parçasında iner; yalnız kayıt rotası açılınca yüklenir.
const RecordRoute = lazy(() => import('./RecordRoute'));

/**
 * Kabuğun liste ve kayıt rotalarını ortak API istemcisine bağlar. Kabuk kendi istemcisini kurmaz.
 * Kayıt rotası da aynı istemciyi kullanır: site kökü, CSRF deposu ve oturum süresi işi ortaktır.
 */
export function createShellViewData(
  api: Pick<ApiClient, 'getDocType' | 'listDocuments' | 'frappeDocument' | 'getBootstrap'>,
): ShellViewData {
  function Record(address: RecordAddress) {
    return createElement(RecordRoute, { ...address, api });
  }
  // Liste isteklerini `views-collection` işinin ortak bağlantısı sunucuya iletir.
  // Bağlantı ilk istekte bir kez kurulur.
  let pending: Promise<CollectionSource> | undefined;
  const source: CollectionSource = {
    async list(request, signal) {
      pending ??= loadCollectionSource().then((module) => module.createApiSource(api));
      return (await pending).list(request, signal);
    },
  };
  return {
    collection: {
      async loadDefinition({ doctype }, signal) {
        const [result, module] = await Promise.all([
          api.getDocType(doctypeFromSlug(doctype), undefined, { signal }),
          loadCollectionSource(),
        ]);
        if (result.status !== 'fresh') throw new Error('DocType bilgisi alınamadı.');
        // Liste başlığı DocType'ın görünen adıdır. Sözleşmede ayrı görünen ad yoktur; ad budur.
        return module.createDefinition(result.meta, { label: result.meta.schema.name });
      },
      source,
      title: ({ doctype }) => doctypeFromSlug(doctype),
    },
    navigation: {
      // Menü uydurma grup göstermez: veri yoksa ya da istek başarısızsa liste boştur.
      async loadSidebars(signal) {
        try {
          const bootstrap = await api.getBootstrap({ signal });
          return (bootstrap.sidebars ?? []).flatMap((s) => toShellSidebar(s) ?? []);
        } catch {
          return [];
        }
      },
      // Tanım ucu, okuma yetkisi olmayan türde 403 verir (`platform_core.shell.metadata`).
      // Yanıt gelen tür okunabilir sayılır. Hata ya da iptal okunamaz demektir.
      async loadReadable(doctypes, signal) {
        const results = await Promise.all(
          doctypes.map((doctype) =>
            api.getDocType(doctype, undefined, { signal }).then(
              () => doctype,
              () => null,
            ),
          ),
        );
        return new Set(results.filter((d): d is string => d !== null));
      },
      // Bayi hesabını müşteri listesi ucu tanır (AJA-945). Tanım ucu bağ türüne bayiye de 403 verir.
      // 200 bayi demektir, boş liste de sayılır. 403 kiracı demektir. Başka hata iletilir.
      async loadAccountKind(signal) {
        const response = await api.frappeDocument({
          method: 'GET',
          path: RESELLER_PROBE_PATH,
          signal,
        });
        if (response.ok) return 'reseller';
        if (response.error.kind === 'forbidden' && response.error.status === 403) return 'tenant';
        throw response.error;
      },
    },
    record: { Component: Record },
  };
}

/**
 * Kullanıcı kartı için oturumdaki kişiyi okur. Görünen ad açılış verisinden gelir.
 * Açılış verisi başka kullanıcıya aitse ya da istek başarısızsa yalnız kimlik döner.
 */
export async function loadShellAccount(
  api: Pick<ApiClient, 'getBootstrap'>,
  user: string,
  signal?: AbortSignal,
): Promise<ShellAccount> {
  try {
    const bootstrap = await api.getBootstrap(signal ? { signal } : {});
    const fullName = bootstrap.user.full_name?.trim();
    if (bootstrap.user.name === user && fullName) return { user, fullName };
  } catch {
    /* Ad okunamazsa kart kimliği gösterir. */
  }
  return { user };
}

/**
 * Seçilen dili oturumdaki kullanıcının profiline yazar (AJA-1772).
 * İstek hedef durumdur: aynı dili iki kez göndermek aynı profili verir.
 * Frappe'nin standart kayıt ucu kullanılır. Yetkiyi sunucu denetler.
 * Sunucu reddederse ortak hata fırlatılır. Ekran eski dilde kalır.
 */
export async function saveUserLanguage(
  api: Pick<ApiClient, 'frappeDocument'>,
  user: string,
  locale: LocaleTag,
  signal: AbortSignal,
): Promise<void> {
  const response = await api.frappeDocument({
    method: 'PUT',
    path: `/api/v2/document/User/${encodeURIComponent(user)}`,
    body: { language: locale },
    signal,
  });
  if (!response.ok) throw response.error;
}

/** Açılış verisindeki kullanıcı dili, saat dilimi ve para birimi. */
export interface UserLocale {
  /** Ham dil. Çözümü dil bağlamı yapar. */
  language: string;
  time_zone: string;
  currency: string | null;
}

/**
 * Oturumdaki kişinin dilini, sitenin saat dilimini ve para birimini açılış verisinden okur (IC-12, IC-13).
 * Açılış verisi başka kullanıcıya aitse ya da istek başarısızsa değer dönmez.
 */
export async function loadUserLocale(
  api: Pick<ApiClient, 'getBootstrap'>,
  user: string,
  signal?: AbortSignal,
): Promise<UserLocale | undefined> {
  try {
    const bootstrap = await api.getBootstrap(signal ? { signal } : {});
    if (bootstrap.user.name === user) {
      return {
        language: bootstrap.user.language,
        time_zone: bootstrap.formatting.time_zone,
        currency: bootstrap.formatting.currency,
      };
    }
  } catch {
    /* Açılış verisi okunamazsa ekran yedek dilde ve tarayıcının saat diliminde kalır. */
  }
  return undefined;
}

/**
 * Çalışma alanı seçicinin verisi. Bu sürümde çalışma alanı oturumun kiracısıdır (Frappe sitesi).
 * Ad, site adresinin alan adıdır. Örnek: `https://acme.atonota.net` -> `acme.atonota.net`.
 * Sunucuda kullanıcının birden çok kiracısını veren uç yoktur; liste tek öğedir.
 * Adres çözülemezse veri dönmez; seçici yalnız logoyu gösterir.
 */
export function workspaceFromSite(siteUrl: string): ShellWorkspaceData | undefined {
  let host: string;
  try {
    host = new URL(siteUrl).hostname;
  } catch {
    return undefined;
  }
  if (!host) return undefined;
  return { items: [{ id: host, name: host }], current: host };
}

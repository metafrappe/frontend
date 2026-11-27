import { useCallback } from 'react';

import { localeBundle, useLanguage, type AppLanguage } from '@/app/locale';

/**
 * Liste görünümünün dil kataloğu (IC-10). Anahtarlar İngilizce ve ASCII yazılır (IC-9).
 * Katalogda şimdilik yalnız `tr` metinleri var. İngilizce metin çeviri işinde eklenir.
 * Çevirisi olmayan dil kaynak metne, yani `tr` kataloğuna düşer. Metin uydurulmaz.
 *
 * Sayılı metin `{count}` yer tutucusuyla yazılır (IC-11). Çoğul biçim `Intl.PluralRules` ile seçilir.
 * Çoğul metin bir nesnedir. Örnek: `{ other: '{count} kayıt seçildi' }`. `other` biçimi zorunludur.
 */
type Plural = Readonly<Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }>;
type Message = string | Plural;

const tr = {
  'collection.bulk.region': 'Toplu işlem',
  'collection.bulk.selectedCount': { other: '{count} kayıt seçildi' },
  'collection.bulk.approveSelected': 'Seçilenleri onayla',
  'collection.bulk.clearSelection': 'Seçimi kaldır',
  'collection.bulk.previewRegion': 'Toplu işlem önizlemesi',
  'collection.bulk.previewTitle': 'Önizleme.',
  'collection.bulk.previewSummary': { other: '{count} kayıt onaylanır: {names}.' },
  'collection.bulk.risk': 'Risk düzeyi: R2 Orta. Çok kaydı değiştirir.',
  'collection.bulk.previewAck': 'Önizlemeyi okudum.',
  'collection.bulk.approve': 'Onayla',
  'collection.bulk.cancel': 'Vazgeç',
  'collection.bulk.notConnected': 'Kayıtlar değişmedi. Onay işlemi henüz bağlı değil.',
  'collection.row.select': '{name} seç',
  'collection.table.selectPage': 'Bu sayfadaki tüm kayıtları seç',
  'collection.cards.label': '{label} kayıtları',
  'collection.savedView.legend': 'Kayıtlı görünüm',
  'collection.savedView.all': 'Tümü',
  'collection.viewType.label': 'Görünüm',
  'collection.viewType.disabled': 'İstenen görünüm şu anda kapalı. Tablo gösteriliyor.',
  'collection.toolbar.label': 'Liste araçları',
  'collection.toolbar.filter': 'Süzgeç',
  'collection.toolbar.filterCount': 'Süzgeç ({count})',
  'collection.toolbar.sort': 'Sırala',
  'collection.toolbar.select': 'Seç',
  'collection.toolbar.table': 'Tablo',
  'collection.filters.activeCount': { other: '{count} süzgeç etkin' },
  'collection.filters.none': 'Etkin süzgeç yok.',
  'collection.filters.listLabel': 'Etkin süzgeçler',
  'collection.filters.remove': 'Kaldır',
  'collection.filters.clear': 'Süzgeçleri temizle',
  'collection.filters.all': 'Tümü',
  'collection.filters.fieldsLabel': 'Süzgeç alanları',
  'collection.tags.search': 'Arama: {search}',
  'collection.tags.removeSearch': 'Aramayı kaldır',
  'collection.tags.filter': '{label}: {value}',
  'collection.tags.removeFilter': '{label} süzgecini kaldır',
  'collection.search.label': 'Kayıt ara',
  'collection.search.submit': 'Ara',
  'collection.sort.label': 'Sıralama',
  'collection.sort.field': 'Sıralama alanı',
  'collection.sort.direction': 'Sıralama yönü',
  'collection.sort.asc': 'Artan',
  'collection.sort.desc': 'Azalan',
  'collection.content.label': 'Koleksiyon içeriği',
  'collection.preview.title': 'Koleksiyon örneği',
} as const satisfies Record<string, Message>;

export type CollectionMessageKey = keyof typeof tr;

/** Kaynak dil `tr` kataloğudur. Öteki diller çeviri işinde eklenir. */
const SOURCE_LANGUAGE = 'tr' satisfies AppLanguage;

export const COLLECTION_MESSAGES: Partial<
  Record<AppLanguage, Record<CollectionMessageKey, Message>>
> & { tr: Record<CollectionMessageKey, Message> } = { tr };

export function formatCollectionMessage(
  language: AppLanguage,
  key: CollectionMessageKey,
  params?: Readonly<Record<string, string | number>>,
): string {
  const translated = COLLECTION_MESSAGES[language];
  const catalogLanguage = translated ? language : SOURCE_LANGUAGE;
  const message = (translated ?? COLLECTION_MESSAGES.tr)[key];
  let template: string;
  if (typeof message === 'string') template = message;
  else {
    const count = Number(params?.['count'] ?? 0);
    const rule = new Intl.PluralRules(localeBundle(catalogLanguage).intl).select(count);
    template = message[rule] ?? message.other;
  }
  if (!params) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, token: string) => {
    const value = params[token];
    return value === undefined ? match : String(value);
  });
}

/** Bileşen metni kullanıcının diliyle alır. Dil, dil bağlamından gelir (IC-12). */
export function useCollectionText() {
  const language = useLanguage();
  return useCallback(
    (key: CollectionMessageKey, params?: Readonly<Record<string, string | number>>) =>
      formatCollectionMessage(language, key, params),
    [language],
  );
}

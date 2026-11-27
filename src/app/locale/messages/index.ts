import { useCallback } from 'react';

import { FALLBACK_LANGUAGE, type AppLanguage } from '../language';
import { useLanguage } from '../LanguageProvider';
import { localeBundle } from '../locale-map';

import { enGB, type MessageKey } from './en-GB';
import { createTranslator, type Catalog, type MessageValues } from './format-message';
import { tr } from './tr';

export { formatMessage, messageArguments, MessageFormatError } from './format-message';
export type { MessageKey } from './en-GB';
export type { MessageValues } from './format-message';

/**
 * Kataloğun adı dilin `Intl` etiketidir. Etiket `locale-map.ts` dosyasında yazılır.
 * `en` dili İngiliz İngilizcesidir: katalog `en-GB` olur. `tr` dilinin kataloğu `tr-TR` olur.
 */
const catalogOf = (language: AppLanguage) => localeBundle(language).intl;

/** Kaynak katalog: yedek dilin kataloğu (`en-GB`). Çeviri eksikse bu katalogdaki metin görünür. */
export const SOURCE_CATALOG = catalogOf(FALLBACK_LANGUAGE);

/** Ürün katalogları. Anahtar katalog adıdır. */
export const CATALOGS: Readonly<Record<string, Catalog<MessageKey>>> = {
  [SOURCE_CATALOG]: enGB,
  [catalogOf('tr')]: tr,
};

const translator = createTranslator<MessageKey>({ source: SOURCE_CATALOG, catalogs: CATALOGS });

/** Bir dilde iletiyi çevirir ve biçimler. Bileşen bunun yerine `useMessage()` kullanır. */
export function translate(language: AppLanguage, key: MessageKey, values?: MessageValues): string {
  return translator(catalogOf(language), key, values);
}

/**
 * Geçerli dilin çeviricisi. Örnek: `const m = useMessage(); m('genui.table.rowCount', { count })`.
 * Dil, dil bağlamından gelir (IC-12).
 */
export function useMessage(): (key: MessageKey, values?: MessageValues) => string {
  const language = useLanguage();
  return useCallback((key, values) => translate(language, key, values), [language]);
}

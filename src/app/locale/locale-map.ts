/**
 * Dil eşleme dosyası. Ant Design ve Day.js dil nesneleri yalnız burada içe aktarılır.
 * Bileşenler dili `useLanguage` ve `useLocaleBundle` kancalarından alır (IC-12).
 * Yeni dil eklenince yalnız bu dosya ve `language.ts` değişir.
 */
import deDE from 'antd/locale/de_DE';
import enGB from 'antd/locale/en_GB';
import trTR from 'antd/locale/tr_TR';
import type { Locale as AntdLocale } from 'antd/es/locale';
import 'dayjs/locale/de';
import 'dayjs/locale/en-gb';
import 'dayjs/locale/tr';

import { UI_LOCALES, defaultLocaleOf, type AppLanguage, type LocaleTag } from './language';

/**
 * Ant Design X dil nesnesi. X 1.6.1 sürümü kendi dil alanını taşımaz; bileşenleri antd dilini kullanır.
 * Bu yüzden X nesnesi aynı dildeki antd nesnesidir. X sürümü dil alanı getirirse alanlar buraya eklenir.
 */
export type XLocale = AntdLocale;

export interface LocaleBundle {
  /** Ant Design `ConfigProvider` dil nesnesi. */
  antd: AntdLocale;
  /** Ant Design X `XProvider` dil nesnesi. antd alanlarıyla birleşiktir. */
  x: XLocale;
  /** Day.js dil adı. Dil dosyası bu modülde yüklenir. */
  dayjs: string;
  /** `Intl` biçimlerinin dil etiketi. Tarih, sayı, para ve liste bu etiketle biçimlenir (IC-13). */
  intl: string;
}

/** Ant Design X'in kendi dil alanları. Bu sürümde boştur. */
const X_FIELDS: Record<LocaleTag, Partial<XLocale>> = { 'en-GB': {}, 'tr-TR': {}, 'de-DE': {} };

/**
 * Arayüzün İngilizcesi İngiliz İngilizcesidir (AJA-1407). Bu yüzden `en-GB` dili `en-GB` paketlerini kullanır.
 * Örnek: hafta pazartesi başlar, tarih `27/11/2026` yazılır, saat 24 saatliktir.
 */
const ANTD: Record<LocaleTag, AntdLocale> = { 'en-GB': enGB, 'tr-TR': trTR, 'de-DE': deDE };

/** Day.js dil adları. Bütün diller yukarıda yüklenir. */
const DAYJS: Record<LocaleTag, string> = { 'en-GB': 'en-gb', 'tr-TR': 'tr', 'de-DE': 'de' };

const BUNDLES = Object.fromEntries(
  UI_LOCALES.map(({ tag }) => [
    tag,
    {
      antd: ANTD[tag],
      x: { ...ANTD[tag], ...X_FIELDS[tag] },
      dayjs: DAYJS[tag],
      // The `Intl` tag is the locale tag itself.
      intl: tag,
    },
  ]),
) as Record<LocaleTag, LocaleBundle>;

/**
 * Bir dil etiketinin antd, Ant Design X, Day.js ve `Intl` nesneleri.
 * Katalog dili kendi varsayılan etiketini kullanır. Örnek: `en` için `en-GB`.
 */
export function localeBundle(locale: AppLanguage | LocaleTag): LocaleBundle {
  return BUNDLES[
    locale in BUNDLES ? (locale as LocaleTag) : defaultLocaleOf(locale as AppLanguage)
  ];
}

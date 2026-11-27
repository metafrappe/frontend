/**
 * Dil eşleme dosyası. Ant Design ve Day.js dil nesneleri yalnız burada içe aktarılır.
 * Bileşenler dili `useLanguage` ve `useLocaleBundle` kancalarından alır (IC-12).
 * Yeni dil eklenince yalnız bu dosya ve `language.ts` değişir.
 */
// ES modülü kullanılır. `antd/locale/*` CommonJS biçimindedir. Vite derlemesinde dil nesnesi
// `{ default }` kabına sarılı gelir ve antd İngilizceye düşer (AJA-1971).
import enGB from 'antd/es/locale/en_GB';
import trTR from 'antd/es/locale/tr_TR';
import type { Locale as AntdLocale } from 'antd/es/locale';
import 'dayjs/locale/en-gb';
import 'dayjs/locale/tr';

import type { AppLanguage } from './language';

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
const X_FIELDS: Record<AppLanguage, Partial<XLocale>> = { tr: {}, en: {} };

/**
 * Arayüzün İngilizcesi İngiliz İngilizcesidir (AJA-1407). Bu yüzden `en` dili `en-GB` paketlerini kullanır.
 * Örnek: hafta pazartesi başlar, tarih `27/11/2026` yazılır, saat 24 saatliktir.
 */
const ANTD: Record<AppLanguage, AntdLocale> = { tr: trTR, en: enGB };

/** Day.js dil adları. İki dil de yukarıda yüklenir. */
const DAYJS: Record<AppLanguage, string> = { tr: 'tr', en: 'en-gb' };

/** `Intl` dil etiketleri. Sabit biçim dili yalnız bu dosyada yazılır. */
const INTL: Record<AppLanguage, string> = { tr: 'tr-TR', en: 'en-GB' };

const BUNDLES = Object.fromEntries(
  (Object.keys(ANTD) as AppLanguage[]).map((language) => [
    language,
    {
      antd: ANTD[language],
      x: { ...ANTD[language], ...X_FIELDS[language] },
      dayjs: DAYJS[language],
      intl: INTL[language],
    },
  ]),
) as Record<AppLanguage, LocaleBundle>;

/** Bir dilin antd, Ant Design X, Day.js ve `Intl` nesneleri. */
export function localeBundle(language: AppLanguage): LocaleBundle {
  return BUNDLES[language];
}

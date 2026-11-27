/**
 * The locale map file. Ant Design and Day.js locale objects are imported only here.
 * Components get the language from the `useLanguage` and `useLocaleBundle` hooks (IC-12).
 * When a new language is added, only this file and `language.ts` change.
 */
import enGB from 'antd/locale/en_GB';
import trTR from 'antd/locale/tr_TR';
import type { Locale as AntdLocale } from 'antd/es/locale';
import 'dayjs/locale/en-gb';
import 'dayjs/locale/tr';

import type { AppLanguage } from './language';

/**
 * Ant Design X locale object. X 1.6.1 has no locale fields of its own; its components use the antd locale.
 * So the X object is the antd object for the same language. If an X release adds locale fields, add them here.
 */
export type XLocale = AntdLocale;

export interface LocaleBundle {
  /** Ant Design `ConfigProvider` locale object. */
  antd: AntdLocale;
  /** Ant Design X `XProvider` locale object. Merged with the antd fields. */
  x: XLocale;
  /** Day.js locale name. The locale file is loaded in this module. */
  dayjs: string;
  /** Language tag for `Intl` formats. Dates, numbers, currency and lists are formatted with this tag (IC-13). */
  intl: string;
}

/** Ant Design X's own locale fields. Empty in this version. */
const X_FIELDS: Record<AppLanguage, Partial<XLocale>> = { tr: {}, en: {} };

/**
 * The UI's English is British English (AJA-1407). So the `en` language uses the `en-GB` packages.
 * Example: the week starts on Monday, dates are written `27/11/2026`, and time uses the 24-hour clock.
 */
const ANTD: Record<AppLanguage, AntdLocale> = { tr: trTR, en: enGB };

/** Day.js locale names. Both locales are loaded above. */
const DAYJS: Record<AppLanguage, string> = { tr: 'tr', en: 'en-gb' };

/** `Intl` language tags. A hard-coded format locale is written only in this file. */
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

/** The antd, Ant Design X, Day.js and `Intl` objects for a language. */
export function localeBundle(language: AppLanguage): LocaleBundle {
  return BUNDLES[language];
}

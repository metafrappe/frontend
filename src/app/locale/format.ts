/**
 * Tarih, saat, sayı, para ve liste biçimleri (IC-13).
 * Biçim dili dil bağlamından gelir. Saat dilimi ve para birimi açılış verisinden gelir.
 * Bileşen `Intl` nesnesini sabit dille kurmaz; `useFormat()` kancasını kullanır.
 */
import type { AppLanguage, LocaleTag } from './language';
import { localeBundle } from './locale-map';

/** Açılış verisinin biçim alanlarından arayüzün kullandıkları. */
export interface SiteFormatting {
  /** Sitenin IANA saat dilimi. Örnek: `Europe/Istanbul`. Yoksa tarayıcının saat dilimi kullanılır. */
  time_zone?: string | null | undefined;
  /** Sitenin varsayılan para birimi. Örnek: `TRY`. Yoksa tutar düz sayı yazılır. */
  currency?: string | null | undefined;
}

export interface FormatSettings {
  language: AppLanguage;
  /** Full locale tag. If absent, the language's default locale is used. Example: `de-DE`. */
  locale?: LocaleTag | undefined;
  timeZone?: string | null | undefined;
  currency?: string | null | undefined;
}

export interface Formatter {
  language: AppLanguage;
  /** `Intl` dil etiketi. */
  intl: string;
  /** Sitenin saat dilimi. Açılış verisi gelmediyse ya da tanınmazsa tanımsızdır. */
  timeZone: string | undefined;
  /** Sitenin para birimi. Seçilmediyse ya da tanınmazsa `null` olur. */
  currencyCode: string | null;
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** Takvim günü. Örnek: `2026-11-27` -> "27 Kasım 2026 Cuma". Okunamayan değer olduğu gibi döner. */
  date: (value: string) => string;
  /** Saat ve dakika, sitenin saat diliminde. */
  time: (value: Date) => string;
  /** Gün ve saat, sitenin saat diliminde. */
  dateTime: (value: Date) => string;
  /** Frappe tarih-saat değeri. Değer sitenin saat dilimiyle okunur. Okunamayan değer olduğu gibi döner. */
  frappeDateTime: (value: string) => string;
  /** Frappe tarih-saat değerini sitenin saat dilimiyle okur. */
  parseFrappeDatetime: (value: string) => Date | undefined;
  /** Tutar. Para birimi verilmezse sitenin para birimi kullanılır. */
  currency: (value: number, code?: string | null) => string;
  /** Liste. Örnek: "a, b ve c". */
  list: (items: readonly string[]) => string;
  /** Kullanıcının diline göre küçük harf. Türkçede `I` -> `ı` olur. */
  lower: (text: string) => string;
  /** Kullanıcının diline göre büyük harf. Türkçede `i` -> `İ` olur. */
  upper: (text: string) => string;
}

const DAY: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  weekday: 'long',
};
const TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;
const ZONED_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
const FRAPPE_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?$/;

/** Takvim gününü UTC gece yarısı olarak okur. Geçersiz gün sonuç vermez. */
function calendarDay(value: string): Date | undefined {
  const match = DATE_ONLY.exec(value);
  if (!match) return undefined;
  const [, y, mo, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
    ? date
    : undefined;
}

/** `Intl` saat dilimini tanırsa adı döner. Tanımazsa sonuç vermez. Örnek: `Mars/Base`. */
function validTimeZone(timeZone: string | null | undefined): string | undefined {
  if (!timeZone) return undefined;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return timeZone;
  } catch {
    return undefined;
  }
}

/** `Intl` para kodunu tanırsa kodu döner. Tanımazsa `null` döner. Örnek: `XX`. */
function validCurrency(code: string | null | undefined): string | null {
  if (!code) return null;
  try {
    new Intl.NumberFormat(undefined, { style: 'currency', currency: code });
    return code;
  } catch {
    return null;
  }
}

/** Saat diliminin bir andaki farkı, milisaniye. Örnek: İstanbul için +3 saat. */
function zoneOffset(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat(undefined, {
    timeZone,
    hourCycle: 'h23',
    numberingSystem: 'latn',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const wall = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return wall - Math.floor(instant / 1000) * 1000;
}

/**
 * Frappe tarih-saat değerini sitenin saat dilimiyle okur.
 * Frappe değeri saat dilimi taşımaz. Örnek: `2026-11-27 09:05:00` İstanbul'da 06.05 UTC olur.
 * Saat dilimi verilmezse ya da tanınmazsa değer tarayıcının saat dilimiyle okunur.
 */
export function parseFrappeDatetime(
  value: string,
  timeZone: string | null | undefined,
): Date | undefined {
  const text = value.trim();
  // Saat farkı yazılı değer sunucudan kesin an olarak gelir. Örnek: `2026-11-27T06:05:00Z`.
  if (ZONED_DATETIME.test(text)) {
    const instant = Date.parse(text);
    return Number.isFinite(instant) ? new Date(instant) : undefined;
  }
  const match = FRAPPE_DATETIME.exec(text);
  if (!match) return undefined;
  const [y, mo, d, h, mi, s] = match.slice(1, 7).map((part) => Number(part ?? 0)) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const ms = Number((match[7] ?? '').padEnd(3, '0').slice(0, 3));
  const wall = Date.UTC(y, mo - 1, d, h, mi, s, ms);
  const check = new Date(wall);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mo - 1 ||
    check.getUTCDate() !== d ||
    check.getUTCHours() !== h ||
    check.getUTCMinutes() !== mi ||
    check.getUTCSeconds() !== s
  ) {
    return undefined;
  }
  const zone = validTimeZone(timeZone);
  if (!zone) return new Date(y, mo - 1, d, h, mi, s, ms);
  // Fark yaz saatine göre değişir. İlk tahminin farkı ikinci kez denetlenir.
  const first = wall - zoneOffset(wall, zone);
  const second = wall - zoneOffset(first, zone);
  return new Date(second);
}

/** Dil, saat dilimi ve para birimiyle biçimleyici kurar. */
export function createFormatter(settings: FormatSettings): Formatter {
  const intl = localeBundle(settings.locale ?? settings.language).intl;
  // Bozuk açılış verisi ekranı düşürmez. Tanınmayan saat dilimi ve para kodu yok sayılır.
  const timeZone = validTimeZone(settings.timeZone);
  const currencyCode = validCurrency(settings.currency);
  const zone = timeZone ? { timeZone } : {};
  const dayFormat = new Intl.DateTimeFormat(intl, { ...DAY, timeZone: 'UTC' });
  const timeFormat = new Intl.DateTimeFormat(intl, { ...TIME, ...zone });
  const dateTimeFormat = new Intl.DateTimeFormat(intl, { ...DAY, ...TIME, ...zone });
  const listFormat = new Intl.ListFormat(intl, { type: 'conjunction' });
  const parse = (value: string) => parseFrappeDatetime(value, timeZone);

  return {
    language: settings.language,
    intl,
    timeZone,
    currencyCode,
    number: (value, options) => new Intl.NumberFormat(intl, options).format(value),
    date: (value) => {
      const day = calendarDay(value);
      return day ? dayFormat.format(day) : value;
    },
    time: (value) => timeFormat.format(value),
    dateTime: (value) => dateTimeFormat.format(value),
    frappeDateTime: (value) => {
      const instant = parse(value);
      return instant ? dateTimeFormat.format(instant) : value;
    },
    parseFrappeDatetime: parse,
    currency: (value, code) => {
      const currency = code ? validCurrency(code) : currencyCode;
      return currency
        ? new Intl.NumberFormat(intl, { style: 'currency', currency }).format(value)
        : new Intl.NumberFormat(intl).format(value);
    },
    list: (items) => listFormat.format(items),
    lower: (text) => text.toLocaleLowerCase(intl),
    upper: (text) => text.toLocaleUpperCase(intl),
  };
}

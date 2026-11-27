/**
 * Date, time, number, currency and list formats (IC-13).
 * The format locale comes from the language context. The time zone and currency come from the boot data.
 * Components do not build `Intl` objects with a hard-coded locale; they use the `useFormat()` hook.
 */
import type { AppLanguage } from './language';
import { localeBundle } from './locale-map';

/** The boot data format fields that the UI uses. */
export interface SiteFormatting {
  /** The site's IANA time zone. Example: `Europe/Istanbul`. If absent, the browser's time zone is used. */
  time_zone?: string | null | undefined;
  /** The site's default currency. Example: `TRY`. If absent, the amount is written as a plain number. */
  currency?: string | null | undefined;
}

export interface FormatSettings {
  language: AppLanguage;
  timeZone?: string | null | undefined;
  currency?: string | null | undefined;
}

export interface Formatter {
  language: AppLanguage;
  /** `Intl` dil etiketi. */
  intl: string;
  /** The site's time zone. Undefined if the boot data has not arrived or the zone is not recognised. */
  timeZone: string | undefined;
  /** The site's currency. `null` if none is selected or it is not recognised. */
  currencyCode: string | null;
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** Calendar day. Example: `2026-11-27` -> "Friday, 27 November 2026". An unparseable value is returned as is. */
  date: (value: string) => string;
  /** Hour and minute, in the site's time zone. */
  time: (value: Date) => string;
  /** Day and time, in the site's time zone. */
  dateTime: (value: Date) => string;
  /** Frappe datetime value. The value is read in the site's time zone. An unparseable value is returned as is. */
  frappeDateTime: (value: string) => string;
  /** Parses a Frappe datetime value in the site's time zone. */
  parseFrappeDatetime: (value: string) => Date | undefined;
  /** Amount. If no currency is given, the site's currency is used. */
  currency: (value: number, code?: string | null) => string;
  /** List. Example: "a, b and c". */
  list: (items: readonly string[]) => string;
  /** Lower case according to the user's language. In Turkish `I` becomes dotless i (U+0131). */
  lower: (text: string) => string;
  /** Upper case according to the user's language. In Turkish `i` becomes dotted capital I (U+0130). */
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

/** Parses a calendar day as UTC midnight. An invalid day yields no result. */
function calendarDay(value: string): Date | undefined {
  const match = DATE_ONLY.exec(value);
  if (!match) return undefined;
  const [, y, mo, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
    ? date
    : undefined;
}

/** Returns the name if `Intl` recognises the time zone. Otherwise yields no result. Example: `Mars/Base`. */
function validTimeZone(timeZone: string | null | undefined): string | undefined {
  if (!timeZone) return undefined;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return timeZone;
  } catch {
    return undefined;
  }
}

/** Returns the code if `Intl` recognises the currency code. Otherwise returns `null`. Example: `XX`. */
function validCurrency(code: string | null | undefined): string | null {
  if (!code) return null;
  try {
    new Intl.NumberFormat(undefined, { style: 'currency', currency: code });
    return code;
  } catch {
    return null;
  }
}

/** The time zone's offset at a given instant, in milliseconds. Example: +3 hours for Istanbul. */
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
 * Parses a Frappe datetime value in the site's time zone.
 * The Frappe value carries no time zone. Example: `2026-11-27 09:05:00` in Istanbul is 06:05 UTC.
 * If no time zone is given or it is not recognised, the value is read in the browser's time zone.
 */
export function parseFrappeDatetime(
  value: string,
  timeZone: string | null | undefined,
): Date | undefined {
  const text = value.trim();
  // A value with a written offset comes from the server as an exact instant. Example: `2026-11-27T06:05:00Z`.
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
  // The offset changes with daylight saving time. The offset of the first guess is checked a second time.
  const first = wall - zoneOffset(wall, zone);
  const second = wall - zoneOffset(first, zone);
  return new Date(second);
}

/** Builds a formatter from the language, time zone and currency. */
export function createFormatter(settings: FormatSettings): Formatter {
  const intl = localeBundle(settings.language).intl;
  // Broken boot data does not crash the screen. Unrecognised time zones and currency codes are ignored.
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

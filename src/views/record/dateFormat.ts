import type { RecordLocale, SiteFormatting } from './types';

/** Sunucuya giden ve sunucudan gelen tarih kalıbı. Frappe değeri hep bu biçimdedir. */
export const SERVER_DATE_FORMAT = 'YYYY-MM-DD';
/** Sunucuya giden tarih ve saat kalıbı. */
export const SERVER_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

const LOCALE_DEFAULTS: Record<RecordLocale, { date: string; time: string }> = {
  tr: { date: 'DD.MM.YYYY', time: 'HH:mm:ss' },
  en: { date: 'MM-DD-YYYY', time: 'HH:mm:ss' },
};

// Frappe'nin izin verdiği tarih kalıbı: gün, ay ve yıl parçaları ile tek tür ayraç.
const FRAPPE_DATE_PATTERN = /^(dd|mm|yyyy)([./-])(dd|mm|yyyy)\2(dd|mm|yyyy)$/;
// Frappe saat kalıbı zaten gösterim kalıbıyla aynıdır: HH:mm veya HH:mm:ss.
const TIME_PATTERN = /^HH:mm(:ss)?$/;

/**
 * Frappe tarih kalıbını gösterim kalıbına çevirir.
 * Örnek: `dd.mm.yyyy` -> `DD.MM.YYYY`. Kalıp tanınmazsa `null` döner.
 */
export function frappeToDisplayFormat(pattern: string): string | null {
  const match = FRAPPE_DATE_PATTERN.exec(pattern.trim());
  if (!match) return null;
  const parts = [match[1], match[3], match[4]];
  if (new Set(parts).size !== 3) return null;
  const separator = match[2] ?? '-';
  return parts
    .map((part) => (part === 'dd' ? 'DD' : part === 'mm' ? 'MM' : 'YYYY'))
    .join(separator);
}

/**
 * Tarih ve saat alanının gösterim kalıbını seçer.
 * Kalıp kullanıcının dil ayarından gelir (açılış verisi `formatting`).
 * Ayar yoksa ya da tanınmazsa arayüz dilinin varsayılanı kullanılır.
 */
export function resolveDateFormats(
  formatting: SiteFormatting | undefined,
  locale: RecordLocale,
): { date: string; time: string } {
  const fallback = LOCALE_DEFAULTS[locale];
  const date =
    (formatting?.date_format ? frappeToDisplayFormat(formatting.date_format) : null) ??
    fallback.date;
  const timeSetting = formatting?.time_format?.trim();
  const time = timeSetting && TIME_PATTERN.test(timeSetting) ? timeSetting : fallback.time;
  return { date, time };
}

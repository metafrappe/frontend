/** Arayüzün desteklediği diller. Sıra önemsizdir. */
export const SUPPORTED_LANGUAGES = ['tr', 'en'] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Arayüzün tek yedek dili. Kullanıcı dili boşsa ya da desteklenmiyorsa bu dil kullanılır (IC-12).
 * Yedek dil İngiliz İngilizcesidir. Müşteri bu kararı 27 Kasım 2026 Cuma günü verdi (AJA-1407).
 * `en` dilinin biçim dili `en-GB` olur. Örnek: 27 Kasım 2026 tarihi `27/11/2026` görünür.
 * Biçim dili `locale-map.ts` dosyasında yazılır. Frappe sunucusunun yedek dili de İngilizcedir.
 */
export const FALLBACK_LANGUAGE: AppLanguage = 'en';

function isSupported(value: string): value is AppLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Açılış verisindeki kullanıcı dilini arayüz diline çevirir.
 * Örnek: `en-US` -> `en`. Boş ya da desteklenmeyen dil yedek dile düşer.
 */
export function resolveLanguage(raw: string | null | undefined): AppLanguage {
  const code = (raw ?? '').trim().toLowerCase();
  if (isSupported(code)) return code;
  const base = code.split(/[-_]/)[0] ?? '';
  return isSupported(base) ? base : FALLBACK_LANGUAGE;
}

/**
 * Dil düğmesinde sunulan diller (AJA-1772). Her dilin adı kendi dilinde yazılır.
 * `tag` tam dil etiketidir. Kullanıcı profiline ve `<html lang>` değerine yazılır (IC-14).
 * `language` arayüzün kullandığı metin kataloğudur. Almanca kataloğu henüz yoktur.
 * Çeviri işi katalog ekleyene kadar Almanca seçimde tarih, sayı ve Ant Design metinleri Almanca olur.
 * Uygulamanın kendi metinleri İngilizce katalogdan gelir (IC-16).
 */
export const UI_LOCALES = [
  { tag: 'en-GB', name: 'English (UK)', language: 'en' },
  { tag: 'tr-TR', name: 'Türkçe', language: 'tr' },
  { tag: 'de-DE', name: 'Deutsch', language: 'en' },
] as const satisfies readonly { tag: string; name: string; language: AppLanguage }[];

export type LocaleTag = (typeof UI_LOCALES)[number]['tag'];

/** Arayüzün tek yedek dili. Karar 44: İngiliz İngilizcesi. */
export const FALLBACK_LOCALE: LocaleTag = 'en-GB';

/**
 * Ham dil değerini sunulan bir dil etiketine eşler. Büyük ve küçük harf fark etmez.
 * Örnek: `de` için `de-DE`, `en-US` için `en-GB`. Sunulmayan dil `undefined` döner.
 */
export function matchLocale(raw: string | null | undefined): LocaleTag | undefined {
  const code = (raw ?? '').trim().replace('_', '-').toLowerCase();
  if (!code) return undefined;
  const exact = UI_LOCALES.find((entry) => entry.tag.toLowerCase() === code);
  if (exact) return exact.tag;
  const base = code.split('-')[0];
  return UI_LOCALES.find((entry) => entry.tag.toLowerCase().split('-')[0] === base)?.tag;
}

/**
 * Arayüz dilini seçer (AJA-1772). Sıra şöyledir: kullanıcı profili, kiracı ayarı, yedek dil.
 * Tarayıcı dili hiç okunmaz. Bu yüzden tarayıcı kayıtlı seçimi ezmez.
 */
export function resolveLocale(
  profile: string | null | undefined,
  tenant?: string | null | undefined,
): LocaleTag {
  return matchLocale(profile) ?? matchLocale(tenant) ?? FALLBACK_LOCALE;
}

/** Bir dilin metin kataloğu. Örnek: Almanca katalog gelene kadar `de-DE` için `en`. */
export function catalogLanguage(tag: LocaleTag): AppLanguage {
  return UI_LOCALES.find((entry) => entry.tag === tag)?.language ?? FALLBACK_LANGUAGE;
}

/** Bir katalog dilinin varsayılan etiketi. Örnek: `en` için `en-GB`. */
export function defaultLocaleOf(language: AppLanguage): LocaleTag {
  return UI_LOCALES.find((entry) => entry.language === language)?.tag ?? FALLBACK_LOCALE;
}

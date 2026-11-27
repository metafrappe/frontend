/** Languages supported by the UI. Order does not matter. */
export const SUPPORTED_LANGUAGES = ['tr', 'en'] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * The UI's single fallback language. Used when the user language is empty or unsupported (IC-12).
 * The fallback language is British English. The customer made this decision on Friday 27 November 2026 (AJA-1407).
 * The format locale of `en` is `en-GB`. Example: the date 27 November 2026 is shown as `27/11/2026`.
 * The format locale is set in `locale-map.ts`. The Frappe server's fallback language is also English.
 */
export const FALLBACK_LANGUAGE: AppLanguage = 'en';

function isSupported(value: string): value is AppLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Maps the user language from the boot data to a UI language.
 * Example: `en-US` -> `en`. An empty or unsupported language falls back to the fallback language.
 */
export function resolveLanguage(raw: string | null | undefined): AppLanguage {
  const code = (raw ?? '').trim().toLowerCase();
  if (isSupported(code)) return code;
  const base = code.split(/[-_]/)[0] ?? '';
  return isSupported(base) ? base : FALLBACK_LANGUAGE;
}

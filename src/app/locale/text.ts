import { FALLBACK_LANGUAGE } from './language';
import { localeBundle } from './locale-map';

/**
 * Search and sort in the user's language (GILT 10). Every UI search and sort goes through this file.
 * Product codes do not use the user's language. They go through `code.ts`.
 */

/** Format locale used when the language is unknown. The fallback language is British English (Decision 44). */
const FALLBACK_INTL = localeBundle(FALLBACK_LANGUAGE).intl;

const intlOrFallback = (intl: string | undefined) => intl || FALLBACK_INTL;

/**
 * Lower-cases text with the case rules of the user's language.
 * Example: in Turkish `Isparta` becomes `ısparta`. In British English it becomes `isparta`.
 */
export function foldText(text: string, intl?: string): string {
  return text.toLocaleLowerCase(intlOrFallback(intl));
}

/**
 * Does the text contain the search query? Case is compared in the user's language.
 * The query is trimmed. An empty query matches every text.
 * Example: in Turkish the query `istanbul` matches `İstanbul`.
 */
export function textMatches(text: string, query: string, intl?: string): boolean {
  const search = foldText(query.trim(), intl);
  return search === '' || foldText(text, intl).includes(search);
}

const collators = new Map<string, Intl.Collator>();

/**
 * Compare function that sorts text in the user's language. Numbers inside text sort as numbers.
 * Example: in Turkish `Çorum` comes after `Cide` and before `Denizli`.
 */
export function compareText(intl?: string): (a: string, b: string) => number {
  const locale = intlOrFallback(intl);
  let collator = collators.get(locale);
  if (!collator) {
    collator = new Intl.Collator(locale, { numeric: true });
    collators.set(locale, collator);
  }
  return collator.compare;
}

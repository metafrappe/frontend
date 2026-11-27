/**
 * Product codes, record names and URL segments do not depend on the user's language (GILT 10).
 * Example: the code `ABC-1` matches `abc-1` in every language.
 * This file has no imports. The initial-load chunk can use it without loading locale data.
 */

/**
 * Lower-cases a code with locale-independent rules. `toLowerCase` ignores the user's language.
 * The Turkish rule would turn `I` into a dotless i (U+0131). Codes never use that rule.
 */
export function foldCode(code: string): string {
  return code.trim().toLowerCase();
}

/** Upper-cases the first letter of a code word with locale-independent rules. Example: `selling` -> `Selling`. */
export function capitalizeCode(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Does the code contain the query? Case does not matter. The user's language is not used. */
export function codeMatches(code: string, query: string): boolean {
  return foldCode(code).includes(foldCode(query));
}

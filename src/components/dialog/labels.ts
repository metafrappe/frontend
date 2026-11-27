/**
 * Confirm labels that do not say the result. "OK" or "Cancel" alone does not tell the user
 * what the button does. A confirm button names its result instead, for example "Delete draft".
 */
const VAGUE = new Set([
  'tamam',
  'ok',
  'okay',
  'evet',
  'yes',
  'iptal',
  'cancel',
  'onayla',
  'confirm',
]);

/**
 * Lower case without a fixed language. The dot of "İ" is dropped, so "İptal" and "IPTAL"
 * both become "iptal".
 */
export function foldLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\u0307/g, '');
}

export function isVagueActionLabel(label: string): boolean {
  return VAGUE.has(foldLabel(label));
}

/** Throws in development when a confirm label does not say the result. */
export function assertResultLabel(label: string): void {
  if (import.meta.env.DEV && isVagueActionLabel(label)) {
    throw new Error(`Confirm label "${label}" does not say the result. Name the result instead.`);
  }
}

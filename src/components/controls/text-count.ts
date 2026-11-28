/**
 * Character counting for text inputs (AJA-1764, G-73).
 * A character here is a perceived character (grapheme cluster), not a UTF-16 code unit.
 * Example: the Hindi conjunct `क्षि` and the emoji `👩‍👩‍👧` each count as one character.
 * `string.length` would count them as 4 and 8.
 */
function segmenter(locale: string): Intl.Segmenter {
  return new Intl.Segmenter(locale, { granularity: 'grapheme' });
}

/** Number of perceived characters in the text for the given `Intl` language tag. */
export function countGraphemes(text: string, locale: string): number {
  let count = 0;
  for (const _ of segmenter(locale).segment(text)) count += 1;
  return count;
}

/** Keeps the first `max` perceived characters. The cut never falls inside a character. */
export function truncateGraphemes(text: string, max: number, locale: string): string {
  let count = 0;
  for (const { index } of segmenter(locale).segment(text)) {
    if (count === max) return text.slice(0, index);
    count += 1;
  }
  return text;
}

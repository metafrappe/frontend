/**
 * Pseudo languages for layout tests (GILT, AJA-1742).
 *
 * A pseudo language is not a translation. It only changes the shape of a label:
 * - `pseudoLong` swaps letters for accented ones and makes the label 2–3 times longer.
 * - `pseudoRtl` swaps Latin letters for Hebrew letters so the text runs right to left.
 * Both keep codes byte for byte. Example: `AB-120/XL` stays `AB-120/XL`.
 * Use these only in tests. Never ship pseudo text as a real translation.
 */

/** The long German compound noun from the customer brief (AJA-1728, section 2). */
export const GERMAN_COMPOUND = 'Betriebsumgebungstemperatur';

export const MIN_FACTOR = 2;
export const MAX_FACTOR = 3;
export const DEFAULT_FACTOR = 2.5;

export interface PseudoOptions {
  /** How many times longer the label becomes. Between 2 and 3. */
  factor?: number;
  /** Adds the extra length as one word with no break point. */
  unbreakable?: boolean;
}

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const ACCENT_LOWER = 'àƀçđéƒĝĥîĵķĺɱñöþǫŕšţûṽŵẋýž';
const ACCENT_UPPER = 'ÀƁÇĐÉƑĜĤÎĴĶĹṀÑÖÞǪŔŠŢÛṼŴẊÝŽ';
const HEBREW_FIRST = 0x05d0;
const HEBREW_COUNT = 27;

/** True when a word must stay as it is: codes, numbers, placeholders, links and acronyms. */
export function isCode(word: string): boolean {
  if (word === '') return false;
  if (/\d/.test(word)) return true;
  if (/^\{[^}]*\}$/.test(word) || /%[sd]/.test(word)) return true;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(word) || /\S@\S+\.\S/.test(word)) return true;
  if (/^[A-Z]{2,}$/.test(word)) return true;
  return /^[A-Z0-9]+([-/_.:][A-Z0-9]+)+$/.test(word);
}

function mapWords(text: string, letter: (char: string) => string): string {
  return text
    .split(/(\s+)/)
    .map((part) => (/^\s*$/.test(part) || isCode(part) ? part : [...part].map(letter).join('')))
    .join('');
}

function accent(char: string): string {
  const lower = LOWER.indexOf(char);
  if (lower >= 0) return [...ACCENT_LOWER][lower] ?? char;
  const upper = LOWER.toUpperCase().indexOf(char);
  if (upper >= 0) return [...ACCENT_UPPER][upper] ?? char;
  return char;
}

function hebrew(char: string): string {
  const index = LOWER.indexOf(char.toLowerCase());
  return index >= 0 ? String.fromCodePoint(HEBREW_FIRST + (index % HEBREW_COUNT)) : char;
}

function checkFactor(factor: number): number {
  if (!(factor >= MIN_FACTOR && factor <= MAX_FACTOR)) {
    throw new RangeError(`Factor must be between ${MIN_FACTOR} and ${MAX_FACTOR}: ${factor}`);
  }
  return factor;
}

/** Builds `size` filler characters. Without `unbreakable` the filler is split into words. */
function filler(size: number, source: string, unbreakable: boolean): string {
  if (size <= 0) return '';
  const letters = [...source];
  const take = (count: number, offset: number) =>
    Array.from({ length: count }, (_, i) => letters[(offset + i) % letters.length]).join('');
  if (unbreakable || size < 2) return take(size, 0);
  // A space, then words of at most 10 letters.
  let out = '';
  let offset = 0;
  while (out.length < size) {
    const room = size - out.length - 1;
    if (room <= 0) {
      out += take(1, offset);
      break;
    }
    const word = Math.min(10, room);
    out += ` ${take(word, offset)}`;
    offset += word;
  }
  return out;
}

function grow(base: string, original: string, options: PseudoOptions, source: string): string {
  const factor = checkFactor(options.factor ?? DEFAULT_FACTOR);
  const target = Math.ceil([...original].length * factor);
  return base + filler(target - [...base].length, source, options.unbreakable ?? false);
}

/** Makes a label 2–3 times longer with accented letters. Codes stay the same. */
export function pseudoLong(text: string, options: PseudoOptions = {}): string {
  if (text.trim() === '') return text;
  return grow(
    mapWords(text, accent),
    text,
    options,
    mapWords(GERMAN_COMPOUND.toLowerCase(), accent),
  );
}

/** Turns Latin letters into Hebrew letters. Codes stay the same. Adds length only when asked. */
export function pseudoRtl(text: string, options: PseudoOptions = {}): string {
  if (text.trim() === '') return text;
  const base = mapWords(text, hebrew);
  return options.factor === undefined
    ? base
    : grow(base, text, options, mapWords('pseudo', hebrew));
}

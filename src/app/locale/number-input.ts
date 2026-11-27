/**
 * Locale number entry (AJA-1765, G-73, IC-13).
 * The user types a number in the format of their region. Example: `1 234,56` in France.
 * The separators and digits come from `Intl.NumberFormat`. They are never written by hand.
 * The server gets a plain number that does not depend on the language. Example: `1234.56`.
 */
import type { AppLanguage } from './language';
import { localeBundle } from './locale-map';

export interface NumberSymbols {
  /** Thousands sign. Example: `.` in Germany, a narrow space in France. */
  group: string;
  /** Decimal sign. Example: `,` in Germany, `.` in Britain. */
  decimal: string;
  /** Minus sign of the region. */
  minus: string;
  /** The ten digits of the region, from zero to nine. */
  digits: readonly string[];
  /** Size of the last digit group. Usually 3. */
  primaryGroup: number;
  /** Size of the other digit groups. 3 in most regions, 2 in India. */
  secondaryGroup: number;
}

/** Result of reading the typed text. */
export type NumberEntry =
  | { kind: 'empty' }
  | { kind: 'valid'; value: number }
  /** The text can mean two values. Example: `1.234` is either 1234 or 1.234. The user picks one. */
  | { kind: 'ambiguous'; options: readonly [number, number] }
  | { kind: 'invalid' };

/**
 * Typed text that is not a number yet. A form keeps it in the draft instead of a number.
 * The form's validation finds it and does not save it. Nothing is saved silently.
 */
export class UnresolvedNumber {
  constructor(
    readonly text: string,
    readonly reason: 'ambiguous' | 'invalid',
  ) {}
}

export function isUnresolvedNumber(value: unknown): value is UnresolvedNumber {
  return value instanceof UnresolvedNumber;
}

/** Space characters. The French group sign is a narrow space. Users type a plain one. */
const SPACE = /[\s\u00a0\u202f]/;
/** Direction marks that `Intl` adds in some regions. Example: Arabic. They carry no value. */
const DIRECTION_MARKS = /[\u061c\u200e\u200f]/g;
/** Characters that some regions use as a decimal sign and others as a thousands sign. */
const DUAL_MARKS = new Set(['.', ',']);
const ASCII_MINUS = new Set(['-', '\u2212']);

const symbolCache = new Map<string, NumberSymbols>();

/** Reads the separators, minus sign, digits and group sizes of a region from `Intl`. */
export function numberSymbols(locale: string): NumberSymbols {
  const cached = symbolCache.get(locale);
  if (cached) return cached;
  const format = new Intl.NumberFormat(locale);
  const parts = format.formatToParts(-1234567890.5);
  const part = (type: Intl.NumberFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  const integers = parts.filter((item) => item.type === 'integer').map((item) => item.value);
  const digitFormat = new Intl.NumberFormat(locale, { useGrouping: false });
  const symbols: NumberSymbols = {
    group: part('group'),
    decimal: part('decimal'),
    minus: part('minusSign'),
    digits: Array.from({ length: 10 }, (_, digit) => digitFormat.format(digit)),
    primaryGroup: integers.at(-1)?.length ?? 3,
    secondaryGroup: integers.at(-2)?.length ?? integers.at(-1)?.length ?? 3,
  };
  symbolCache.set(locale, symbols);
  return symbols;
}

/** Returns the tag if `Intl` recognises it. Otherwise yields no result. */
function validLocale(tag: string | null | undefined): string | undefined {
  if (!tag) return undefined;
  try {
    return Intl.NumberFormat.supportedLocalesOf([tag]).length > 0 ? tag : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The locale for number entry. The region from the boot data comes first.
 * If the region is empty or broken, the language's format locale is used. Example: `en` -> `en-GB`.
 */
export function resolveNumberLocale(
  formatLocale: string | null | undefined,
  language: AppLanguage,
): string {
  return validLocale(formatLocale) ?? localeBundle(language).intl;
}

/** Checks the digit groups against the region. Example: `1.234.567` is right in Germany, `12.34` is not. */
function validGroups(groups: readonly string[], symbols: NumberSymbols): boolean {
  const [first = '', ...rest] = groups;
  if (rest.length === 0) return first.length > 0;
  const last = rest.at(-1) ?? '';
  const middle = rest.slice(0, -1);
  return (
    first.length >= 1 &&
    first.length <= symbols.secondaryGroup &&
    last.length === symbols.primaryGroup &&
    middle.every((group) => group.length === symbols.secondaryGroup)
  );
}

const toNumber = (negative: boolean, integer: string, fraction = '') =>
  Number(`${negative ? '-' : ''}${integer || '0'}${fraction ? `.${fraction}` : ''}`);

/** Reads the text a user typed in the format of the region. */
export function parseLocaleNumber(text: string, locale: string): NumberEntry {
  const symbols = numberSymbols(locale);
  const groupIsSpace = SPACE.test(symbols.group);
  let source = text.replace(DIRECTION_MARKS, '').trim();
  if (source.length === 0) return { kind: 'empty' };

  let negative = false;
  const first = source.charAt(0);
  if (first === symbols.minus || ASCII_MINUS.has(first)) {
    negative = true;
    source = source.slice(1);
  }

  // Each character becomes a digit, a group sign `G`, a decimal sign `D` or a dual mark `M`.
  let digits = '';
  let shape = '';
  let dual = '';
  for (const char of source) {
    const ascii = symbols.digits.indexOf(char);
    if (/[0-9]/.test(char) || ascii >= 0) {
      const digit = ascii >= 0 ? String(ascii) : char;
      digits += digit;
      shape += digit;
    } else if (char === symbols.decimal) {
      shape += 'D';
    } else if (char === symbols.group || (groupIsSpace && SPACE.test(char))) {
      shape += 'G';
    } else if (DUAL_MARKS.has(char)) {
      // A full stop or comma that is not a sign of this region. Example: `.` in France.
      shape += 'M';
      dual += char;
    } else {
      return { kind: 'invalid' };
    }
  }
  if (digits.length === 0) return { kind: 'invalid' };

  const [integerPart = '', fraction, ...rest] = shape.split('D');
  if (rest.length > 0 || (fraction !== undefined && !/^[0-9]+$/.test(fraction))) {
    return { kind: 'invalid' };
  }

  if (integerPart.includes('M')) {
    // A foreign mark is clear only when the whole value is `n.nnn` without any other sign.
    const [before = '', after = '', ...more] = integerPart.split('M');
    if (
      fraction === undefined &&
      dual.length === 1 &&
      more.length === 0 &&
      /^[0-9]{1,3}$/.test(before) &&
      /^[0-9]{3}$/.test(after)
    ) {
      return ambiguous(negative, before, after);
    }
    return { kind: 'invalid' };
  }

  const groups = integerPart.split('G');
  if (fraction === undefined && integerPart.length === 0) return { kind: 'invalid' };
  if (integerPart.length > 0 && !validGroups(groups, symbols)) return { kind: 'invalid' };

  // One group sign that is also a decimal sign elsewhere makes the value unclear. Example: `1.234` in Germany.
  const [head = '', tail = ''] = groups;
  if (
    fraction === undefined &&
    groups.length === 2 &&
    DUAL_MARKS.has(symbols.group) &&
    tail.length === 3
  ) {
    return ambiguous(negative, head, tail);
  }

  return { kind: 'valid', value: toNumber(negative, groups.join(''), fraction) };
}

function ambiguous(negative: boolean, before: string, after: string): NumberEntry {
  return {
    kind: 'ambiguous',
    options: [toNumber(negative, before + after), toNumber(negative, before, after)],
  };
}

/**
 * Writes a number in the format of the region for an input field.
 * With `precision`, the value shows exactly that many decimals. Example: `1 234,56` in France.
 */
export function formatNumberInput(value: number, locale: string, precision?: number): string {
  return new Intl.NumberFormat(locale, {
    useGrouping: true,
    minimumFractionDigits: precision ?? 0,
    maximumFractionDigits: precision ?? 20,
  }).format(value);
}

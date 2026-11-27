import { describe, expect, it } from 'vitest';

import {
  formatNumberInput,
  isUnresolvedNumber,
  numberSymbols,
  parseLocaleNumber,
  resolveNumberLocale,
  UnresolvedNumber,
} from './number-input';

/** The separators come from `Intl.NumberFormat`. The test reads them the same way. */
function intlSymbols(locale: string) {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234567.5);
  return {
    group: parts.find((part) => part.type === 'group')?.value,
    decimal: parts.find((part) => part.type === 'decimal')?.value,
  };
}

describe('locale number entry (AJA-1765)', () => {
  it('takes the separators from Intl.NumberFormat', () => {
    for (const locale of ['fr-FR', 'de-DE', 'en-GB', 'tr-TR', 'de-CH']) {
      const symbols = numberSymbols(locale);
      expect({ group: symbols.group, decimal: symbols.decimal }).toEqual(intlSymbols(locale));
    }
  });

  it('reads the French amount with a narrow space and with a plain space', () => {
    const typed = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(1234.56);
    expect(parseLocaleNumber(typed, 'fr-FR')).toEqual({ kind: 'valid', value: 1234.56 });
    expect(parseLocaleNumber('1 234,56', 'fr-FR')).toEqual({ kind: 'valid', value: 1234.56 });
    expect(parseLocaleNumber('1 234,56', 'fr-FR')).toEqual({ kind: 'valid', value: 1234.56 });
  });

  it('reads the German amount as the same value', () => {
    expect(parseLocaleNumber('1.234,56', 'de-DE')).toEqual({ kind: 'valid', value: 1234.56 });
    expect(parseLocaleNumber('1234,56', 'de-DE')).toEqual({ kind: 'valid', value: 1234.56 });
    expect(parseLocaleNumber('-1.234.567,5', 'de-DE')).toEqual({
      kind: 'valid',
      value: -1234567.5,
    });
  });

  it('marks a single group separator with three digits as ambiguous', () => {
    expect(parseLocaleNumber('1.234', 'de-DE')).toEqual({
      kind: 'ambiguous',
      options: [1234, 1.234],
    });
    expect(parseLocaleNumber('1,234', 'en-GB')).toEqual({
      kind: 'ambiguous',
      options: [1234, 1.234],
    });
    // In France the full stop is not a separator. It may be a German thousands sign or an English decimal sign.
    expect(parseLocaleNumber('1.234', 'fr-FR')).toEqual({
      kind: 'ambiguous',
      options: [1234, 1.234],
    });
  });

  it('does not mark a clear value as ambiguous', () => {
    expect(parseLocaleNumber('1 234', 'fr-FR')).toEqual({ kind: 'valid', value: 1234 });
    expect(parseLocaleNumber('1.234.567', 'de-DE')).toEqual({ kind: 'valid', value: 1234567 });
    expect(parseLocaleNumber('1.234', 'en-GB')).toEqual({ kind: 'valid', value: 1.234 });
  });

  it('rejects broken input', () => {
    for (const [text, locale] of [
      ['1,2,3', 'de-DE'],
      ['12.34,5', 'de-DE'],
      ['abc', 'fr-FR'],
      ['1,5', 'en-GB'],
      ['1 2', 'en-GB'],
    ] as const) {
      expect(parseLocaleNumber(text, locale), `${locale} ${text}`).toEqual({ kind: 'invalid' });
    }
    expect(parseLocaleNumber('   ', 'fr-FR')).toEqual({ kind: 'empty' });
  });

  it('reads the region digits', () => {
    const typed = new Intl.NumberFormat('ar-EG', { minimumFractionDigits: 2 }).format(1234.56);
    expect(parseLocaleNumber(typed, 'ar-EG')).toEqual({ kind: 'valid', value: 1234.56 });
  });

  it('writes the value back in the region format', () => {
    expect(formatNumberInput(1234.56, 'fr-FR', 2)).toBe(
      new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(1234.56),
    );
    expect(formatNumberInput(1234.56, 'de-DE')).toBe('1.234,56');
    for (const locale of ['fr-FR', 'de-DE', 'en-GB', 'tr-TR']) {
      const text = formatNumberInput(1234.56, locale, 2);
      expect(parseLocaleNumber(text, locale)).toEqual({ kind: 'valid', value: 1234.56 });
    }
  });

  it('marks unresolved text so a form does not save it', () => {
    const value = new UnresolvedNumber('1.234', 'ambiguous');
    expect(isUnresolvedNumber(value)).toBe(true);
    expect(isUnresolvedNumber(1234)).toBe(false);
  });

  it('uses the region locale and falls back to the language locale', () => {
    expect(resolveNumberLocale('fr-FR', 'en')).toBe('fr-FR');
    expect(resolveNumberLocale(undefined, 'en')).toBe('en-GB');
    expect(resolveNumberLocale('not a tag!', 'tr')).toBe('tr-TR');
  });
});

import { describe, expect, it } from 'vitest';

import { GERMAN_COMPOUND, isCode, pseudoLong, pseudoRtl } from './pseudo';

const length = (text: string) => [...text].length;

describe('pseudoLong', () => {
  it('makes a label at least two times longer', () => {
    for (const label of ['Save', 'Filter', 'Open menu', 'OK', 'Clear all filters']) {
      const result = pseudoLong(label);
      expect(length(result), result).toBeGreaterThanOrEqual(length(label) * 2);
    }
  });

  it('keeps the label at most three times longer', () => {
    for (const label of ['Save', 'Filter', 'Open menu', 'Clear all filters']) {
      expect(length(pseudoLong(label))).toBeLessThanOrEqual(length(label) * 3);
    }
  });

  it('accepts a factor between two and three', () => {
    expect(length(pseudoLong('Settings', { factor: 3 }))).toBe(24);
    expect(() => pseudoLong('Settings', { factor: 1.5 })).toThrow(RangeError);
    expect(() => pseudoLong('Settings', { factor: 3.5 })).toThrow(RangeError);
  });

  it('changes the letters so an untranslated label is easy to spot', () => {
    const result = pseudoLong('Save');
    expect(result.startsWith('Save')).toBe(false);
  });

  it('does not change the code AB-120/XL', () => {
    const result = pseudoLong('Order AB-120/XL now');
    expect(result.split(' ')).toContain('AB-120/XL');
  });

  it('keeps a code that stands alone byte for byte', () => {
    expect(pseudoLong('AB-120/XL')).toContain('AB-120/XL');
  });

  it('can add one long word that has no break point', () => {
    const result = pseudoLong('Save', { unbreakable: true });
    expect(result).not.toMatch(/\s/);
    expect(length(result)).toBeGreaterThanOrEqual(8);
  });

  it('keeps empty text empty', () => {
    expect(pseudoLong('')).toBe('');
    expect(pseudoLong('   ')).toBe('   ');
  });
});

describe('pseudoRtl', () => {
  it('turns Latin words into right-to-left letters', () => {
    const result = pseudoRtl('Save draft');
    expect(result).toMatch(/^[֐-׿\s]+$/);
  });

  it('does not change the code AB-120/XL', () => {
    const result = pseudoRtl('Order AB-120/XL now');
    expect(result.split(' ')).toContain('AB-120/XL');
    expect(result).not.toContain('Order');
  });

  it('can make the label longer too', () => {
    const result = pseudoRtl('Filter', { factor: 2 });
    expect(length(result)).toBeGreaterThanOrEqual(12);
  });
});

describe('isCode', () => {
  it('finds product codes, numbers and placeholders', () => {
    for (const code of [
      'AB-120/XL',
      'G-168',
      '42',
      '10:42',
      '{count}',
      'https://x.test/a',
      'SKU_9',
    ])
      expect(isCode(code), code).toBe(true);
  });

  it('does not treat words as codes', () => {
    for (const word of ['Save', 'Filter', 'menu', GERMAN_COMPOUND])
      expect(isCode(word), word).toBe(false);
  });
});

describe('GERMAN_COMPOUND', () => {
  it('is the long German noun from the brief', () => {
    expect(GERMAN_COMPOUND).toBe('Betriebsumgebungstemperatur');
  });
});

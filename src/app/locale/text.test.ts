import { describe, expect, it } from 'vitest';

import { localeBundle } from './locale-map';
import { capitalizeCode, codeMatches, foldCode } from './code';
import { compareText, foldText, textMatches } from './text';

const tr = localeBundle('tr').intl;
const en = localeBundle('en').intl;

describe('dile göre arama (GILT 10)', () => {
  it('Türkçede İzmir ve izmir aynı sonucu verir', () => {
    expect(textMatches('İzmir', 'izmir', tr)).toBe(true);
    expect(textMatches('izmir', 'İzmir', tr)).toBe(true);
    expect(textMatches('İstanbul', 'istanbul', tr)).toBe(true);
  });

  it('Türkçede Isparta ve ısparta aynı sonucu verir', () => {
    expect(textMatches('Isparta', 'ısparta', tr)).toBe(true);
    expect(textMatches('ısparta', 'ISPARTA', tr)).toBe(true);
    // Turkish keeps dotted and dotless i apart.
    expect(textMatches('Isparta', 'isparta', tr)).toBe(false);
  });

  it('İngiliz İngilizcesinde I harfi i olarak eşlenir', () => {
    expect(foldText('I', en)).toBe('i');
    expect(textMatches('Isparta', 'isparta', en)).toBe(true);
  });

  it('dil bilinmiyorsa en-GB kullanılır', () => {
    expect(foldText('I')).toBe(foldText('I', en));
    expect(textMatches('Isparta', 'isparta')).toBe(true);
    expect(textMatches('Isparta', 'isparta', '')).toBe(true);
  });

  it('boş arama her metne uyar, aranan metnin boşlukları kırpılır', () => {
    expect(textMatches('İzmir', '   ', tr)).toBe(true);
    expect(textMatches('İzmir', '  İZM  ', tr)).toBe(true);
    expect(textMatches('İzmir', 'ankara', tr)).toBe(false);
  });
});

describe('dile göre sıralama (GILT 10)', () => {
  it('Türkçede Ç harfi C harfinden sonra, D harfinden önce gelir', () => {
    const cities = ['Denizli', 'Çorum', 'Cide', 'Ödemiş', 'Ordu'];
    expect([...cities].sort(compareText(tr))).toEqual([
      'Cide',
      'Çorum',
      'Denizli',
      'Ordu',
      'Ödemiş',
    ]);
  });

  it('sıralama Intl.Collator ile yapılır ve sayıları sayı olarak dizer', () => {
    expect(compareText(tr)('a', 'b')).toBe(new Intl.Collator(tr).compare('a', 'b'));
    expect(['Kat 10', 'Kat 2'].sort(compareText(en))).toEqual(['Kat 2', 'Kat 10']);
  });

  it('dil bilinmiyorsa en-GB ile sıralar', () => {
    const words = ['b', 'a', 'C'];
    expect([...words].sort(compareText())).toEqual([...words].sort(compareText(en)));
  });
});

describe('ürün kodu dile bakmaz (GILT 10)', () => {
  it('ABC-1 kodu her dilde aynı sonucu verir', () => {
    expect(foldCode('ABC-1')).toBe('abc-1');
    expect(codeMatches('ABC-1', 'abc-1')).toBe(true);
    expect(codeMatches('ABC-1', 'ABC')).toBe(true);
    expect(codeMatches('ABC-1', 'xyz')).toBe(false);
  });

  it('kodda I harfi her zaman noktalı i olur', () => {
    // The Turkish rule would make a dotless i (U+0131). Codes never use it.
    expect(foldCode('INTEGRATIONS')).toBe('integrations');
    expect(codeMatches('LINE-I', 'line-i')).toBe(true);
  });

  it('kod sözcüğünün ilk harfi dile bakmadan büyür', () => {
    expect(capitalizeCode('integrations')).toBe('Integrations');
    expect(capitalizeCode('')).toBe('');
  });
});

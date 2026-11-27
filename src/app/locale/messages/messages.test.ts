import { describe, expect, it } from 'vitest';

import { createTranslator, formatMessage, MessageFormatError } from './format-message';

/**
 * Test kataloğu. Lehçe ve Arapça metin yalnız testte durur.
 * Ürün kataloğunda bu diller yoktur. Test, çoğul seçiminin dilin kuralına uyduğunu gösterir.
 */
const fixture = createTranslator({
  source: 'en-GB',
  catalogs: {
    'en-GB': {
      'files.count': '{count, plural, one {# file} other {# files}}',
      'door.action.open': 'Open',
      'door.status.open': 'Open',
      'greeting.named': 'Hello {name}, you have {count, plural, one {# task} other {# tasks}}.',
    },
    tr: {
      'files.count': '{count, plural, other {# dosya}}',
      'door.action.open': 'Aç',
      'door.status.open': 'Açık',
      'greeting.named': 'Merhaba {name}, {count, plural, other {# işiniz}} var.',
    },
    pl: {
      'files.count': '{count, plural, one {# plik} few {# pliki} many {# plików} other {# pliku}}',
    },
    ar: {
      'files.count':
        '{count, plural, zero {لا ملفات} one {ملف واحد} two {ملفان} few {ملفات قليلة} many {ملفات كثيرة} other {ملف}}',
    },
  },
});

describe('çoğul biçimi dilin kuralına uyar (Intl.PluralRules)', () => {
  it('Lehçe 1, 2 ve 5 için üç ayrı biçim çıkar', () => {
    const forms = [1, 2, 5].map((count) => fixture('pl', 'files.count', { count }));
    expect(forms).toEqual(['1 plik', '2 pliki', '5 plików']);
    expect(new Set(forms).size).toBe(3);
  });

  it('Arapça 0, 1, 2, 3, 11 ve 100 için doğru biçim çıkar', () => {
    const forms = [0, 1, 2, 3, 11, 100].map((count) => fixture('ar', 'files.count', { count }));
    expect(forms).toEqual(['لا ملفات', 'ملف واحد', 'ملفان', 'ملفات قليلة', 'ملفات كثيرة', 'ملف']);
  });

  it('kesin sayı biçimi kategoriden önce gelir', () => {
    expect(
      formatMessage('en-GB', '{n, plural, =0 {none} one {# item} other {# items}}', { n: 0 }),
    ).toBe('none');
  });

  it('# işareti sayıyı dilin biçimiyle yazar', () => {
    expect(formatMessage('en-GB', '{n, plural, other {# rows}}', { n: 12345 })).toBe('12,345 rows');
    expect(formatMessage('tr-TR', '{n, plural, other {# satır}}', { n: 12345 })).toBe(
      '12.345 satır',
    );
  });
});

describe('ileti tam cümle olarak çevrilir', () => {
  it('değişken cümlenin içindedir; sözcük sırası dile göre değişir', () => {
    expect(fixture('en-GB', 'greeting.named', { name: 'Ayşe', count: 2 })).toBe(
      'Hello Ayşe, you have 2 tasks.',
    );
    expect(fixture('tr', 'greeting.named', { name: 'Ayşe', count: 2 })).toBe(
      'Merhaba Ayşe, 2 işiniz var.',
    );
  });

  it('çeviri eksikse kaynak katalog (en-GB) metni görünür', () => {
    expect(fixture('pl', 'door.action.open')).toBe('Open');
  });

  it('anahtar hiçbir katalogda yoksa anahtarın kendisi görünür', () => {
    expect(fixture('tr', 'missing.key' as never)).toBe('missing.key');
  });
});

describe('değişkenin adı vardır', () => {
  it('adlı değişken yerine konur', () => {
    expect(formatMessage('en-GB', 'Hello {name}.', { name: 'Ayşe' })).toBe('Hello Ayşe.');
  });

  it('sırayla verilen değişken kabul edilmez', () => {
    expect(() => formatMessage('en-GB', 'Hello {0}.', { 0: 'Ayşe' })).toThrow(MessageFormatError);
  });

  it('çoğulda other biçimi zorunludur', () => {
    expect(() => formatMessage('en-GB', '{n, plural, one {# row}}', { n: 1 })).toThrow(
      MessageFormatError,
    );
  });

  it('kapanmayan ayraç hata verir', () => {
    expect(() => formatMessage('en-GB', 'Hello {name', { name: 'x' })).toThrow(MessageFormatError);
  });
});

describe('eylem ve durum ayrı anahtardır', () => {
  it('"Aç" düğmesi ve "Açık" durumu iki ayrı anahtardan gelir', () => {
    expect(fixture('tr', 'door.action.open')).toBe('Aç');
    expect(fixture('tr', 'door.status.open')).toBe('Açık');
    // İngilizcede iki söz aynı yazılır. Anahtarlar yine ayrıdır.
    expect(fixture('en-GB', 'door.action.open')).toBe(fixture('en-GB', 'door.status.open'));
  });
});

import { describe, expect, it } from 'vitest';

import { helpLinks, safeHelpHref } from './links';

describe('yardım bağlantısı denetimi', () => {
  it('https adresini ve site içi yolu kabul eder', () => {
    expect(safeHelpHref('https://docs.example.test/a?b=1')).toBe('https://docs.example.test/a?b=1');
    expect(safeHelpHref('/tours/invoice')).toBe('/tours/invoice');
  });

  it.each([
    null,
    '',
    '   ',
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'http://docs.example.test/',
    'data:text/html,x',
    '//evil.example.test/x',
    '/\\evil.example.test',
    'https://kisi:parola@docs.example.test/',
    'tours/invoice',
    '/tur\u0000a',
  ])('güvensiz ya da boş değeri atar: %j', (value) => {
    expect(safeHelpHref(value)).toBeNull();
  });

  it('yalnız verilen bağlantıları Tur, Belge, Destek talebi sırasıyla döner', () => {
    expect(
      helpLinks({ tour_url: null, doc_url: 'https://d.example.test/', support_url: '/destek' }),
    ).toEqual([
      { key: 'doc', href: 'https://d.example.test/' },
      { key: 'support', href: '/destek' },
    ]);
    expect(helpLinks({ tour_url: null, doc_url: null, support_url: null })).toEqual([]);
  });
});

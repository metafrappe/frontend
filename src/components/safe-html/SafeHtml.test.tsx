import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PrintPreview } from './PrintPreview.tsx';
import { SafeHtml } from './SafeHtml.tsx';
import { sanitizeHtml } from './sanitize.ts';

/** Bilinen saldırı örnekleri. Her biri temizlendikten sonra çalışan kod bırakmamalı. */
const ATTACKS = [
  '<img src="x" onerror="alert(1)">',
  '<script>alert(1)</script><p>metin</p>',
  '<a href="javascript:alert(1)">tıkla</a>',
  '<svg><script>alert(1)</script></svg>',
  '<iframe src="https://kotu.example"></iframe>',
  '<div style="background:url(javascript:alert(1))">x</div>',
  '<form action="https://kotu.example"><input name="q"></form>',
  '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
  '<p onclick="alert(1)">p</p>',
  '<object data="x.swf"></object><embed src="x.swf">',
];

describe('sanitizeHtml', () => {
  it.each(ATTACKS)('zararlı içeriği temizler: %s', (dirty) => {
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toMatch(/<script|<iframe|<object|<embed|<form|<svg|<math|<style/i);
    expect(clean).not.toMatch(/\son\w+=/i);
    expect(clean).not.toMatch(/javascript:/i);
    expect(clean).not.toMatch(/style=/i);
  });

  it('izin listesindeki biçimi korur', () => {
    const html =
      '<h2>Başlık</h2><p>Bir <strong>kalın</strong> ve <em>eğik</em> metin.</p>' +
      '<ul><li>bir</li></ul><a href="https://ornek.example/yol">bağlantı</a>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('dış bağlantıya rel ekler', () => {
    const clean = sanitizeHtml('<a href="https://ornek.example" target="_blank">x</a>');
    expect(clean).toContain('rel="noopener noreferrer"');
  });
});

describe('SafeHtml', () => {
  it('temiz içeriği basar, zararlı öğeyi basmaz', () => {
    const { container } = render(
      <SafeHtml html={'<p>merhaba</p><img src="x" onerror="alert(1)"><script>alert(1)</script>'} />,
    );
    expect(container.querySelector('p')).toHaveTextContent('merhaba');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('[onerror]')).toBeNull();
  });
});

describe('PrintPreview', () => {
  it('yazdırma önizlemesini kısıtlı iframe içinde açar', () => {
    const { container } = render(
      <PrintPreview title="Fatura önizlemesi" html={'<p>fatura</p><script>alert(1)</script>'} />,
    );
    const frame = container.querySelector('iframe');
    expect(frame).not.toBeNull();
    // Boş sandbox en kısıtlı kiptir: betik, form, açılır pencere ve aynı köken kapalıdır.
    expect(frame!.getAttribute('sandbox')).toBe('');
    expect(frame).toHaveAttribute('title', 'Fatura önizlemesi');
    const srcdoc = frame!.getAttribute('srcdoc') ?? '';
    expect(srcdoc).toContain('<p>fatura</p>');
    expect(srcdoc).not.toContain('<script');
  });
});

describe('sanitizeHtml öznitelikleri', () => {
  it('başlık ve tablo özniteliklerini korur', () => {
    const html =
      '<table><thead><tr><th scope="col" title="Tutar alanı">Tutar</th></tr></thead>' +
      '<tbody><tr><td colspan="2">10</td></tr></tbody></table>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('başka şemaları siler', () => {
    for (const href of [
      'data:text/html,x',
      'vbscript:x',
      'JaVaScRiPt:alert(1)',
      'java\tscript:x',
    ]) {
      expect(sanitizeHtml(`<a href="${href}">x</a>`)).toBe('<a>x</a>');
    }
  });

  it('_blank dışındaki hedefi siler', () => {
    expect(sanitizeHtml('<a href="/yol" target="_top">x</a>')).toBe('<a href="/yol">x</a>');
  });
});

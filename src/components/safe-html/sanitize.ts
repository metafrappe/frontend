import DOMPurify, { type Config } from 'dompurify';

/**
 * Tek HTML temizleyicisi (GV-2, AJA-2283).
 *
 * Dışarıdan gelen HTML yalnız bu izin listesiyle temizlenir. Listede olmayan öğe ve öznitelik silinir.
 * Betik, stil, form, gömülü çerçeve, SVG ve MathML listede yoktur. Olay öznitelikleri (`on...`) de yoktur.
 * Listeyi genişletmek güvenlik kararıdır. Yeni öğe için önce zararlı içerik testine örnek ekleyin.
 */
const CONFIG = {
  ALLOWED_TAGS: [
    'a',
    'abbr',
    'b',
    'blockquote',
    'br',
    'caption',
    'code',
    'del',
    'em',
    'h2',
    'h3',
    'h4',
    'hr',
    'i',
    'li',
    'ol',
    'p',
    'pre',
    's',
    'span',
    'strong',
    'sub',
    'sup',
    'table',
    'tbody',
    'td',
    'th',
    'thead',
    'tr',
    'u',
    'ul',
  ],
  ALLOWED_ATTR: ['href', 'title', 'colspan', 'rowspan', 'scope', 'target'],
  // İzinli adres türleri yalnız web, e-posta ve telefondur. `javascript:` ve `data:` silinir.
  // DOMPurify adres olmayan öznitelikleri de bu kalıpla sınar. Bu yüzden şemasız değer de geçer.
  // Örneğin `title` metni, `/yol` ve `_blank` geçer. Kalıp DOMPurify varsayılanının dar biçimidir.
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
} satisfies Config;

/** Paylaşılan DOMPurify örneğini değiştirmemek için ayrı bir örnek kurulur. */
const purifier = DOMPurify(window);

purifier.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName !== 'A' || !node.hasAttribute('target')) return;
  // Yeni sekme yalnız `_blank` olabilir. Açılan sayfa bu pencereye erişemez.
  if (node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  } else {
    node.removeAttribute('target');
  }
});

/** HTML'i izin listesiyle temizler ve metin döndürür. */
export function sanitizeHtml(dirty: string): string {
  return purifier.sanitize(dirty, CONFIG);
}

/**
 * Trusted Types ilkesi. Tarayıcı destekliyorsa HTML yuvalarına yalnız bu ilkenin çıktısı gider.
 * Başlık şimdilik rapor kipindedir (`vite/security-headers.ts`). Tarayıcı desteklemiyorsa temiz metin
 * döner.
 */
interface TrustedTypesFactory {
  createPolicy(
    name: string,
    rules: { createHTML: (input: string) => string },
  ): { createHTML: (input: string) => TrustedHTML };
}

const factory = (window as Window & { trustedTypes?: TrustedTypesFactory }).trustedTypes;
const policy = factory?.createPolicy('atonota-safe-html', {
  createHTML: sanitizeHtml,
});

/** Temizlenmiş HTML'i, varsa Trusted Types nesnesi olarak döndürür. */
export function toTrustedHtml(dirty: string): TrustedHTML | string {
  return policy ? policy.createHTML(dirty) : sanitizeHtml(dirty);
}

import type { ShellHelpAnswer } from '../view-data/context';

export type HelpLinkKey = 'tour' | 'doc' | 'support';

export interface HelpLink {
  key: HelpLinkKey;
  href: string;
}

// Denetim kod noktasıyla yapılır. Böylece kontrol karakteri düzenli ifadeye girmez.
const hasControl = (value: string) =>
  [...value].some((ch) => {
    const code = ch.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });

/**
 * Yardım bağlantısını denetler. Sunucu da aynı kuralı uygular (G-138). Bu denetim ikinci kattır.
 * Yalnız `https` adresi ya da site içi yol kabul edilir.
 * Boş değer, başka şema, `//` ile başlayan yol, ters eğik çizgi ve kimlik bilgisi atılır.
 * Örnek: `/tours/invoice` kabul edilir. `javascript:alert(1)` atılır.
 */
export function safeHelpHref(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const href = value.trim();
  if (!href || href !== value || hasControl(href) || href.includes('\\')) return null;
  if (href.startsWith('/')) return href.startsWith('//') ? null : href;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  return href;
}

/** Verilen ve güvenli bağlantıları Tur, Belge, Destek talebi sırasıyla döner. */
export function helpLinks(
  answer: Pick<ShellHelpAnswer, 'tour_url' | 'doc_url' | 'support_url'>,
): HelpLink[] {
  const pairs: [HelpLinkKey, string | null][] = [
    ['tour', answer.tour_url],
    ['doc', answer.doc_url],
    ['support', answer.support_url],
  ];
  return pairs.flatMap(([key, value]) => {
    const href = safeHelpHref(value);
    return href ? [{ key, href }] : [];
  });
}

import { useMemo } from 'react';

import { toTrustedHtml } from './sanitize.ts';

export interface SafeHtmlProps {
  /** Dışarıdan gelen HTML. Basılmadan önce izin listesiyle temizlenir. */
  html: string;
  className?: string;
}

/**
 * Ön yüzde HTML basan tek bileşen (GV-2, AJA-2283).
 *
 * `dangerouslySetInnerHTML` yalnız bu klasörde geçer. ESLint kuralı başka dosyayı reddeder.
 * Düz metin için bu bileşeni kullanmayın. React metni zaten güvenli basar.
 */
export function SafeHtml({ html, className }: SafeHtmlProps) {
  const trusted = useMemo(() => toTrustedHtml(html), [html]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: trusted }} />;
}

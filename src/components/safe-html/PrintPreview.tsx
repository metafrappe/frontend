import { useLayoutEffect, useRef } from 'react';

import { toTrustedHtml } from './sanitize.ts';

export interface PrintPreviewProps {
  /** Ekran okuyucunun okuyacağı çerçeve adı. Örneğin "Fatura önizlemesi". */
  title: string;
  /** Yazdırılacak belge. Basılmadan önce izin listesiyle temizlenir. */
  html: string;
  className?: string;
}

/**
 * Yazdırma önizlemesi (GV-2, AJA-2283).
 *
 * Belge boş `sandbox` özellikli çerçevede açılır. Bu en kısıtlı kiptir. Betik, form, açılır pencere
 * ve aynı köken kapalıdır. Belge ayrıca temizlenir. `srcdoc` bir HTML yuvasıdır. React 18 bu
 * özniteliği metne çevirir. Bu yüzden değer Trusted Types nesnesi olarak doğrudan yazılır.
 */
export function PrintPreview({ title, html, className }: PrintPreviewProps) {
  const frame = useRef<HTMLIFrameElement>(null);

  useLayoutEffect(() => {
    if (frame.current) {
      // Tür tanımı yalnız metin kabul eder. Tarayıcı TrustedHTML nesnesini de kabul eder.
      frame.current.srcdoc = toTrustedHtml(html) as string;
    }
  }, [html]);

  return <iframe ref={frame} className={className} title={title} sandbox="" />;
}

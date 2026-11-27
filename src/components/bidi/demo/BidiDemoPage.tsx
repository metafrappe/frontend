/**
 * Bidi demo page. It opens only in the e2e build at `/_demo/bidi`.
 * The route line is in `src/shell/routes.ts`.
 *
 * The right-to-left sentence is pseudo text (pseudo locale `qps-plocm`). It is not a translation.
 * The letters only give the sentence a right-to-left direction for the test.
 */
import { CommercialCode, Isolate } from '..';

import './demo.css';

const PSEUDO_RTL = 'qps-plocm';

export default function BidiDemoPage() {
  return (
    <section className="bidi-demo" aria-labelledby="bidi-demo-title">
      <h1 id="bidi-demo-title">Yazı yönü denemesi</h1>
      <p>Bu sayfadaki sağdan sola cümle sahte dildir. Gerçek bir çeviri değildir.</p>
      <p dir="rtl" lang={PSEUDO_RTL} data-testid="rtl-sentence">
        אבג דהו <CommercialCode data-testid="commercial-code">AB-120/XL</CommercialCode> זחט (
        <Isolate dir="ltr" data-testid="negative-value">
          −5
        </Isolate>
        ) יכל מנס.
      </p>
      <p dir="auto" data-testid="unknown-direction">
        AB-120/XL
      </p>
    </section>
  );
}

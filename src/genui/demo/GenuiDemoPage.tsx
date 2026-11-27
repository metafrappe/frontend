/**
 * AI surfaces demo page. Opens at `/_demo/genui` only in the e2e build.
 * The route line is in `src/shell/routes.ts`. The data are samples. No AI runs.
 */
import { GenUI } from '../GenUI';
import { parseBlocks } from '../schema';
import type { GenUIActionResult } from '../types';
import { SURFACE_SAMPLES, SURFACE_STATES } from './samples';

/** An unregistered block. The screen must not draw it. */
const UNREGISTERED = { type: 'kayitsiz_blok', body: 'kayitsiz_blok içeriği' };

const blocks = parseBlocks([...SURFACE_SAMPLES, UNREGISTERED]);
const states = parseBlocks(SURFACE_STATES);

const ignore = (): GenUIActionResult => 'accepted';

export default function GenuiDemoPage() {
  return (
    <div className="shell-page">
      <h1>Yapay zekâ yüzeyleri</h1>
      <p>Bu sayfadaki bloklar örnektir. Olaylar sunucudan gelmedi.</p>
      <h2>Örnek yanıt</h2>
      <div data-demo="genui">
        <GenUI blocks={blocks} onAction={ignore} />
      </div>
      <h2>Öteki durumlar</h2>
      <div data-demo="genui-states">
        <GenUI blocks={states} onAction={ignore} />
      </div>
    </div>
  );
}

/**
 * Yapay zekâ yüzeyleri deneme sayfası. Yalnız e2e derlemesinde `/_demo/genui` yolunda açılır.
 * Rota satırı `src/shell/routes.ts` içindedir. Veriler örnektir. Yapay zekâ çalışmaz.
 */
import { GenUI } from '../GenUI';
import { useGenuiStrings } from '../useGenuiStrings';
import { parseBlocks } from '../schema';
import type { GenUIActionResult } from '../types';
import { SURFACE_SAMPLES, SURFACE_STATES } from './samples';

/** Kayıtta olmayan bir blok. Ekran bu bloğu çizmemelidir. */
const UNREGISTERED = { type: 'kayitsiz_blok', body: 'kayitsiz_blok içeriği' };

const blocks = parseBlocks([...SURFACE_SAMPLES, UNREGISTERED]);
const states = parseBlocks(SURFACE_STATES);

const ignore = (): GenUIActionResult => 'accepted';

export default function GenuiDemoPage() {
  const text = useGenuiStrings();
  return (
    <div className="shell-page">
      <h1>{text.demo.title}</h1>
      <p>{text.demo.note}</p>
      <h2>{text.demo.sample}</h2>
      <div data-demo="genui">
        <GenUI blocks={blocks} onAction={ignore} />
      </div>
      <h2>{text.demo.states}</h2>
      <div data-demo="genui-states">
        <GenUI blocks={states} onAction={ignore} />
      </div>
    </div>
  );
}

import { useGenuiStrings } from '../useGenuiStrings';

/**
 * Güvenli JSON görünümü (U2). Bilinmeyen blok asla HTML olarak çizilmez.
 * İçerik yalnız metin düğümü olarak basılır.
 */
export function JsonView({ raw }: { raw: unknown }) {
  const strings = useGenuiStrings();
  let text: string;
  try {
    text = JSON.stringify(raw, null, 2) ?? String(raw);
  } catch {
    text = String(raw);
  }
  return (
    <section data-genui="json" className="genui-card genui-json">
      <span className="genui-muted-text">{strings.unknownBlock}</span>
      <pre>{text}</pre>
    </section>
  );
}

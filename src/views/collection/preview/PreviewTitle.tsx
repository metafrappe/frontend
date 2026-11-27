import { useCollectionText } from '../messages';

/** Sayfanın tek h1 başlığı. Başlık görünmez ama ekran okuyucu okur. Metin katalogdan gelir (IC-10). */
export function PreviewTitle() {
  const t = useCollectionText();
  return <h1 className="preview-title">{t('collection.preview.title')}</h1>;
}

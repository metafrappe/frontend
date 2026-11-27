import { ConfigProvider, theme } from 'antd';
import { SampleDataNotice } from '@/mocks/SampleDataNotice';

/**
 * Örnek veri yazısı ikincil metin tokenını kullanır. Açıklama tokenı açık temada 3,36 karşıtlık verir.
 * Ortak `SampleDataNotice` dosyası bu klasörün dışındadır. Bu yüzden düzeltme yalnız önizlemededir.
 */
export function PreviewNotice() {
  const { token } = theme.useToken();
  return (
    <ConfigProvider theme={{ token: { colorTextDescription: token.colorTextSecondary } }}>
      <SampleDataNotice />
    </ConfigProvider>
  );
}

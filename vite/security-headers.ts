/**
 * Ön yüz yanıtlarının güvenlik başlıkları (GV-2 ve GV-6, AJA-2283).
 *
 * Trusted Types önce rapor kipinde açılır. Tarayıcı HTML yuvasına giden düz metni engellemez.
 * Yalnız ihlali raporlar. İhlaller temizlenince başlık `Content-Security-Policy` adıyla zorunlu olur.
 *
 * Vite geliştirme ve önizleme sunucusu bu başlığı gönderir. Üretimde paneli sunan katman da aynı
 * başlığı göndermelidir. O katman bu deponun dışındadır.
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Content-Security-Policy-Report-Only': "require-trusted-types-for 'script'",
});

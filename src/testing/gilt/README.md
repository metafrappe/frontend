# GILT test aracı (`src/testing/gilt/`)

Bu araç ekranı zor koşullarda dener. Sonra her düğmeyi tek tek ölçer. Araç yalnız testte kullanılır. Ürüne girmez.

## Araç ne yapar

1. `applyPseudoLocale(page, 'long')` etiketleri sahte dille uzatır. Etiket 2 ile 3 kat uzar.
2. `applyPseudoLocale(page, 'rtl')` sağdan sola sahte dil verir. Sayfa `dir="rtl"` olur.
3. `applyPseudoLocale(page, 'german')` her etikete "Betriebsumgebungstemperatur" sözcüğünü ekler.
4. `openInNarrowContainer(page, seçici)` bileşeni 260 CSS px genişliğe indirir.
5. `scaleRootText(page)` kök yazıyı iki kat büyütür.

Sahte dil kodları değiştirmez. Örneğin `AB-120/XL` aynen kalır. Sayılar da aynen kalır. Örneğin rozetteki "12" uzamaz.

`translate="no"` taşıyan metin değişmez. Çevrilmeyen metni bu özellikle işaretleyin. Örneğin logodaki baş harf çevrilmez.

## İki denetim

1. `findClippedButtons(page)` kırpılan düğmeyi bulur. Üç durum sayılır:
   - Düğmenin bir parçası taşan içeriği gizler. Örneğin üç nokta ile kesilen etiket.
   - Yazının bir parçası düğmenin kutusunun dışına çıkar.
   - Gizleyen bir üst kutu düğmeyi keser. Kaydırılan kutu bu durumda sayılmaz.
2. `findSmallTargets(page)` küçük dokunma alanını bulur. Denetim düğmenin ortasından 44 × 44 CSS px kare çizer. Karenin dokuz noktası düğmenin kendisine ulaşmalıdır.

Sayfanın taşmaması tek başına kanıt sayılmaz. İki denetim her düğmenin kendi kutusunu ölçer.

## Rapor

`expectNoProblems(page, testInfo, 'clipping', sorunlar)` raporu yazar. Rapor şunları taşır:

- testin adı,
- düğmenin görünen metni,
- düğmenin erişilebilir adı,
- düğmenin ölçüsü ve sorunun nedeni,
- düğmenin ekran görüntüsü.

## Örnek

```ts
import { applyPseudoLocale, expectNoProblems, findClippedButtons } from '../playwright';

await applyPseudoLocale(page, 'long');
await expectNoProblems(page, test.info(), 'clipping', await findClippedButtons(page));
```

Testler `src/testing/gilt/e2e/gilt-araci.spec.ts` dosyasındadır. Birim testleri `pseudo.test.ts` dosyasındadır.

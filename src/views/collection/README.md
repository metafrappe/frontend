# Koleksiyon görünümleri

Koleksiyon varsayılan olarak yalnız tabloyu sunar.
Ana uygulama bağlantısını `foundation` ve `shell` işleri yapar.

## Kullanım

Bileşen, ortak tema ve React Router sağlayıcısının içinde çalışır.
Metadata tanımı `api-client` işinin `getDocType` çağrısından gelir.
Liste kaynağı ortak `listDocuments` istemcisine bağlanır:

```tsx
const docType = await apiClient.getDocType('Örnek Kayıt', undefined, { signal });
if (docType.status !== 'fresh') return;

const definition = createDefinition(docType.meta, {
  label: 'Örnek kayıtlar',
});
const source = createApiSource(apiClient);

<CollectionView definition={definition} source={source} mode="dark" />;
```

`apiClient.getDocType`, `/api/method/platform_core.api.meta.get_doctype` ucunu çağırır.
Özet veya zaman görünümlerinin alan rolleri `createDefinition` ikinci parametresinde verilir.
Bu roller `groupField`, `startField`, `endField` ve `durationField` alanlarıdır.

Başlık, `label` alanındaki Türkçe etiketten gelir.
Etiket verilmezse başlık “Kayıtlar” olur.
Tanım ve kaynak nesnelerini gereksiz yere yeniden oluşturmayın.
Oturum veya şirket değişirse yeni kaynak ve tanım sağlayın.
Yetki sürümü değişirse tanımı yeniden oluşturun.
Oturum kapanınca koleksiyon bileşenini kaldırın.
Üst bileşen, şirket ve kullanıcı kapsamını açıkça göstermelidir.

## Veri ve önbellek

`createDefinition`, `apiClient.getDocType` yanıtındaki `DocTypeMeta` nesnesini okur.
Katalog sürümleri 1 ve 2 desteklenir.
Bilinmeyen sürüm ve kesilmiş tanım reddedilir.
Gizli alanlar ve parola alanları gösterilmez.
Hassasiyet işareti korunur. Bu işaret kullanıcıya yetki vermez.
Bilinmeyen çizici güvenli düz metin gösterir.
Metne JSON tırnakları eklenmez. HTML çalıştırılmaz.

Liste ve sayfalama Frappe `/api/v2/document` ucunu kullanır.
`createApiSource` isteği ortak `listDocuments` istemcisine verir.
İstek gereken alanları, süzgeçleri, sıralamayı ve sayfa sınırını içerir.
Süzgeç yoksa `filters` alanı gönderilmez.
Eşit sıralama değerlerinde kayıt kimliği ikinci sırayı belirler.
İptal sinyali istemciye kadar aktarılır.

Frappe toplam kayıt sayısı vermez.
Bu yüzden arayüz toplam sayı göstermez.
“Sonraki sayfa” düğmesi yalnız `hasNextPage` doğruysa açıktır.
Sayfa yanıtı şu biçimdedir:

```ts
{
  data: [{ name: 'ORNEK-0001', title: 'Örnek veri 1' }],
  hasNextPage: true,
}
```

`createApiSource` hataları şöyle çevirir:

- `forbidden` ve `session_expired` hatası `CollectionError('unauthorized', ...)` olur.
- Öteki hatalar `CollectionError('error', ...)` olur. Kullanıcı yeniden deneyebilir.
- İptal hatası olduğu gibi geçer. Önbellek iptal edilen isteği yok sayar.

Hatalı sayfadan “Önceki sayfa” düğmesiyle dönülebilir.
Ham sunucu hatası gösterilmez. Geç yanıt yeni sonucu değiştirmez.

`query-cache.ts` geçici bir sorgu önbelleğidir.
Veriyi bileşen durumunun dışında, yalnız bellekte tutar.
Her koleksiyon kendi önbelleğini oluşturur.
Önbellek en fazla 20 sayfa saklar.
Aynı kapsamda önceki sayfaya dönüş yeni istek üretmez.
Kaynak veya tanım değişirse yeni önbellek oluşur.
Yetki hatası önceki sayfaları geçersiz kılar.
Bileşen kaldırılınca bekleyen istek iptal edilir.
Tarayıcı depolaması ve ortak kullanıcı önbelleği kullanılmaz.
Bu geçici çözüm süreye bağlı yenileme yapmaz.
Üst uygulama veri değişikliğinde kaynak veya tanımı yenilemelidir.
Ortak sorgu önbelleği sunulunca bu dosya onunla değiştirilmelidir.

## Örnek tanım ve testler

`sample.ts` yalnız örnek kayıt tanımını tutar. Veri tutmaz.
Tanım `sampleDocTypeMeta` nesnesine dayanır.
Alanlar sahte sunucudaki örnek kayıtlarla eşleşir: `title`, `status` ve `amount`.
Kayıtlar `@/mocks` içindeki `/api/v2/document` işleyicisinden gelir.
Testler ortak istemciyi bu sahte sunucuya (MSW) bağlar.
Yardımcı dosya `test-support/api.ts` konumundadır.
Üretim giriş dosyası `sample.ts` dosyasını içe aktarmaz.

Önizleme ekranı da ortak istemciyi ve sahte sunucuyu kullanır.
Sahte sunucu açıkken ekranda ortak “Örnek veri” bildirimi görünür.

## Özet görünümleri

`enableExperimentalCollectionViews` ayarının varsayılan değeri `false` değeridir.
Tablo dışındaki beş görünüm bu ayarla kapalıdır.
Bunlar Kanban, Pivot, Rapor, Gantt ve Timesheet görünümleridir.
Adres bu görünümlerden birini istese de tablo açılır.
Kapalı görünümün JavaScript dosyası indirilmez.

Gruplu sayım ve toplam için arka uç `platform_core.api.collection.group_summary` ucunu yazdı.
Bu ucun tipli istemcisi başka bir işte yazılıyor.
İstemci `main` dalına gelene kadar ayarı ana uygulamada açmayın.

Görünüm özet kaynağını `summarySource` özelliğinden alır.
Kaynağın tek işlevi vardır:

```ts
interface CollectionSummarySource {
  groupSummary(request: GroupSummaryRequest, signal: AbortSignal): Promise<unknown>;
}
```

İstek `toGroupSummaryRequest` ile kurulur.
İstekte `doctype`, `groupBy`, `filters` ve `limit` alanları vardır.
Süzgeçler liste isteğiyle aynıdır. Sayfa bilgisi gönderilmez.
`limit` değeri sözleşmedeki en büyük değerdir: 100.
`aggregate` alanı isteğe bağlıdır. Şimdilik görünümler bu alanı göndermez.

Yanıt `parseGroupSummary` ile doğrulanır.
Yanıt biçimi sözleşmedeki `message` nesnesidir.
Ad dönüşümü `listDocuments` ile aynıdır: `total_count` alanı `totalCount` olur.

```ts
{
  groups: [{ value: 'Açık', count: 16 }],
  totalCount: 23,
  truncated: false,
}
```

Tipli istemci gelince bağlantı tek satır olur.
Örneğin istemci işlevinin adı `getGroupSummary` olsun:

```ts
const summarySource = {
  groupSummary: (request, signal) => apiClient.getGroupSummary(request, { signal }),
};
```

Pivot ve Rapor görünümleri bu kaynağı kullanır:

- Kaynak yoksa yalnız gelen sayfa özetlenir. Ekran bunu açıkça yazar.
- Kaynak varsa sunucu sayıları gösterilir. Toplam, `totalCount` değeridir.
- `truncated` doğruysa ekran bazı grupların gösterilmediğini yazar.
- Özet alınamazsa sayfa özeti gösterilir. Ham sunucu hatası gösterilmez.
- Görünüm kalkınca ya da sorgu değişince eski özet isteği iptal edilir.

Kanban, Gantt ve Timesheet yalnız gelen sayfayı gösterir.
Örnek ekranda denemek için adrese `?experimentalViews=1` ekleyin.
Bu adres seçeneği yalnız `preview/main.tsx` dosyasında okunur.
Ana bileşen bu adres seçeneğini okumaz.
Gerçek uygulamada ayarı yalnız çağıran kod açabilir.

Seçim çubuğu seçilen kayıtları gösterir ve seçimi kaldırır.
Bu teslimde kayıt değiştiren toplu işlem yoktur.

## Dört parça

Her liste aynı dört parçayı bu sırayla çizer:

1. Görünüm satırı. Kayıtlı görünümler ve görünüm türü buradadır.
2. Süzgeç satırı. Etkin süzgeç etiketleri, arama, sıralama ve süzgeçler buradadır.
3. Toplu işlem satırı. Kayıt seçilince seçim çubuğu burada görünür.
4. Tablo.

Her parçanın `data-collection-part` alanı vardır. Değerler `views`, `filters`, `bulk` ve `table` olur.
Toplu işlem içeriği sonraki işte gelir.

## Kayıtlı görünüm

Kayıtlı görünümler `savedViews` özelliğinden gelir.
Örnek görünümler "Bekleyenler", "Bu ay" ve "Tümü" olabilir.
Özellik verilmezse liste yalnız "Tümü" görünümünü gösterir.

```ts
const savedViews = [
  { id: 'bekleyen', label: 'Bekleyenler', query: { filter: 'status', value: 'Açık' } },
  { id: 'tumu', label: 'Tümü', query: {} },
];
```

Görünüm seçilince arama, süzgeç ve sıralama baştan kurulur.
Sayfa boyutu ve görünüm türü korunur.
Kullanıcı süzgeci elle değiştirirse kayıtlı görünüm seçimi kalkar.
Adreste görünüm yoksa, sorgusu birebir uyan görünüm seçili görünür.

## Adres durumu

Adreste dokuz sorgu alanı bulunur. Bu alanlar `view`, `page`, `size`, `search`, `sort`, `direction`, `filter`, `value` ve `saved` alanlarıdır.
`saved` alanı seçilen kayıtlı görünümün kimliğini tutar.
Bilinmeyen alan, değer ya da görünüm kimliği yok sayılır. Liste bozulmaz.

Sayfa boyutu 10, 20 veya 50 kayıttır.
Arama ve süzgeç değişince ilk sayfa açılır.
Geri tuşu önceki sorguyu geri getirir.
Sorgu dışındaki adres alanları korunur.
Gizli bilgileri adres süzgeçlerine yazmayın.

## Ortak tasarım bağlantısı

Üretim bileşeni ana uygulamanın `ConfigProvider` temasını kullanır.
Koleksiyon ortak tema veya motor başlatmaz.
`collection-tokens.ts` yalnız koleksiyonun yerleşim ve renk eşlemesini yapar.
Ortak değişken adları `foundation` kaynağından okunmuştur.
Örnekler `--font-ui`, `--radius` ve `--shadow-dropdown` adlarıdır.
Hareket değişkenleri `--motion-duration-*` ve `--motion-easing-*` adlarını kullanır.
Dokunma motoru `--hit-t/r/b/l` değerlerini sağlar.
Odak modu `html[data-focus-mode="keyboard"]` alanından okunur.

Bu dalda `src/design/` ve `src/engines/` dışa aktarımları henüz boştur.
Bu yüzden iki geçici kopya duruyor.
Birincisi `collection.css` içindeki odak ve dokunma alanı kurallarıdır.
İkincisi `preview/` klasöründeki geçici köprü dosyalarıdır.
Her kopyanın başında kaldırma koşulu yazılıdır.
`foundation` işi `main` dalına girince bu kopyalar silinir.
Yerlerine şu ortak işlevler bağlanır:

- `buildAntdTheme`
- `ensureDesignStyles`
- `startFocusMode`
- `startHitAreaEngine`

Kontroller antd'nin açık bileşen alanlarını kullanır.
Stil kurallarında iç sınıf seçicisi veya öncelik zorlaması yoktur.
Azaltılmış harekette Select kapanış animasyonu başlatılmaz.
Dokunmatik kaydırmadan sonra tarayıcı hareketsiz bir `mousemove` olayı üretir.
Bu olay klavyeyle seçilen Select seçeneğini sıfırlamaz.
Gerçek fare hareketi seçeneği yine değiştirir.
Klavye odağı normal temada tek alt çizgiyle görünür.
Tablo kendi içinde yatay kayar. Sayfa yatay taşmaz.
Görünür metinler bu teslimde en az 14 CSS px değerindedir.

## Kontroller

Komutları depo kökünde çalıştırın:

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

Tarayıcı testleri `src/views/collection/e2e/*.spec.ts` konumundadır.
Kök `playwright.config.ts` bu dalda hâlâ yalnız `./tests/e2e` klasörünü koşar.
`foundation` kök ayarda `src/views/**/e2e` yolunu kapsamalı ve önizleme sunucusunu bağlamalıdır.
Yerel kontrol için `.pane/qa/collection.config.mjs` geçici ayarı kullanıldı. Bu ayar Git'e girmez.
Güncel komutlar ve sonuçlar `VERIFICATION.md` dosyasındadır.
Firefox proje kararı gereği çalıştırılmaz.
WebKit sonucu gerçek Safari sonucu değildir.
iPhone profili gerçek telefon denemesi değildir.

Önizlemeyi şu komutla çalıştırabilirsiniz:

```sh
node src/views/collection/qa/serve.mjs
```

Adres `http://127.0.0.1:4319/src/views/collection/preview/` biçimindedir.
Bu adres yalnız bu bilgisayarda çalışır.
Dolu porttaki başka servisi kapatmayın.
Bu teslim canlı dağıtım değildir.

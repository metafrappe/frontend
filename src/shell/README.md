# Uygulama kabuğu (`src/shell/`)

Bu klasör uygulamanın kabuğudur. Kabukta sidebar, sayfa başlığı ve yönlendirme vardır. Kararlar `design/source/control-size-config.json` dosyasından gelir.

## Telefon kararı: alt çubuk ve çekmece

Telefonda ekranın altında dört düğmeli bir çubuk vardır. Karar model belgesinin 6. bölümündedir (AJA-982b).

Düğmeler sırayla şunlardır:

1. "Bekleyenler": ana sayfayı açar.
2. "Ara": menüyü açar. Komut alanı "Ara" kipine geçer ve odak komut alanına gider.
3. "Asistan": asistan sayfasını açar.
4. "Menü": menüyü açar.

Menü kapanınca odak menüyü açan düğmeye döner. Menü Escape tuşuyla ve "Menüyü kapat" düğmesiyle kapanır.

Sidebar telefonda çekmece olarak kalır. Çekmece masaüstüyle aynı içeriği taşır. İçinde komut alanı, iş grupları ve çalışma alanı seçici vardır. Kimlik şeridindeki "Menüyü aç" düğmesi de aynı çekmeceyi açar.

Yatay telefonda alt çubuk sol kenara geçer. Kararı CSS verir: `(orientation: landscape) and (max-height: 499px)`. React ağacı değişmez. Bu yüzden yön değişince form verisi ve odak korunur. Sol çubuk kabuğun üst kenarından başlar. Kimlik şeridini ve kabuğun üstündeki notu örtmez.

Sanal klavye açılınca alt çubuk gizlenir. Karar `useVirtualKeyboard.ts` dosyasındadır. Görünür alan (`visualViewport`) pencerenin %20'sinden fazla küçülürse klavye açık sayılır. Yakınlaştırma klavye sayılmaz. Cihaz adı ve user-agent kullanılmaz.

Telefonda alt menü sağda açılmaz. Ekranda yer yoktur. Alt menü üst öğenin altında, çekmecenin içinde açılır. Açmak için üst öğeye dokunun. İkinci dokunuş alt menüyü kapatır. Klavye kuralları aynıdır.

## Ne zaman telefon kabuğu açılır

Telefon kabuğu şu sorguyla açılır: `(max-width: 767px), (max-height: 499px)`.

- Genişlik 767 px ya da altındaysa telefon kabuğu açılır.
- Yükseklik 499 px ya da altındaysa da telefon kabuğu açılır. Yatay telefon bu yüzden telefon kabuğunda kalır.
- Tablet ve masaüstü geniş kabuğu kullanır.

Sidebar her iki kabukta aynı DOM yerindedir. Kabuk değişince sidebar yeniden kurulmaz. Bu yüzden yön değişiminde açık panel ve odak korunur.

## Geniş ekran

- Solid varsayılandır. Genişlik 288 px olur.
- Rail isteğe bağlıdır. Genişlik 68 px olur. Anahtar sidebar başlığındadır.
- Rail tercihi tarayıcıda saklanır. Saklama kapalıysa tercih yalnız o oturumda kalır.
- Alt menü sağdaki panelde açılır. Kurallar F1–F6 maddeleridir.

Alt menü şu yollarla açılır:

1. Fare öğenin üzerine gelir. Panel 60 ms sonra açılır.
2. Klavye odağı öğeye gelir. Panel hemen açılır.
3. Kullanıcı öğeye tıklar ya da dokunur.

Klavye kuralları şunlardır:

- Sağ ok panelin ilk öğesine geçer.
- Aşağı ve yukarı ok panel içinde gezinir.
- Sol ok ya da Escape paneli kapatır. Odak üst öğeye döner.
- Üst öğede Escape paneli kapatır. Odak üst öğede kalır.

## Kayan hover zemini (G1–G3)

Fare menü öğesinin üzerine gelince açık renkli bir zemin belirir. Zemin öğeden öğeye kayar. Süre 200 ms'dir.

- Fare menüye dışarıdan girerse zemin hareketsiz yerleşir.
- Fare menüden çıkarsa zemin yerinde solar.
- Klavye odağı da zemini taşır.

## Sayfa başlığı

Varsayılan çeşit "Araç çubuklu" çeşittir. Kurallar HD1–HD6 ve VT1–VT3 maddeleridir.

Başlık yedi veri durumunu gösterir: normal, canlı, yükleniyor, boş, hata, seçim ve kaydedilmemiş.

Geniş ekranda başlık sabit kalır. Sayfa gövdesi başlığın altında kayar. Gövde kayınca başlığın altında gölge belirir.

Telefonda başlık sayfayla birlikte kayar. Telefon ekranı kısadır. Sabit başlık içeriğin çoğunu kapatırdı. Telefonda yalnız üst çubuk sabittir. Üst çubukta menü düğmesi vardır.

## Rotalar

Rota kaydı `routes.ts` dosyasındadır. Adres yardımcıları `paths.ts` dosyasındadır.

Her iş kendi sayfası için `lazyRoutes` listesine yalnız kendi satırını ekler. Başka işin satırı değiştirilmez. Satırın dört alanı vardır:

1. `path`: react-router yolu.
2. `label`: menü etiketi.
3. `icon`: Phosphor ikonu.
4. `load`: tembel yükleyici. Örnek: `() => import('@/modules/satis/TeklifPage')`.

Kuralın tamamı dosyanın başındaki yorumdadır. `routes.test.ts` biçimi denetler.

`ShellApp` rotaları şu sırayla ekler:

1. `lazyRoutes` satırları.
2. Koleksiyon yolları (`collectionRoutes`). Bu yolların sahibi kabuktur.
3. Bilinmeyen adres için "Sayfa bulunamadı".

Modül sayfaları `src/modules/registry.ts` dosyasındaki `moduleRegistrations` listesinden gelir. Kabuk her kaydı `lazyRoutes` listesine bir satır olarak ekler. Menü etiketi kaydın Türkçe adıdır. Modüller menüde "Asistan" bağlantısından sonra görünür. Sayfa dosyası yalnız sayfa açılınca istenir.

## Panel yolu

Canlıda panel `/panel/` yolunda sunulur. Yerel geliştirme kök yolda çalışır.

- Yolu derleme ayarı belirler: `vite/base-path.ts`. Üretim kipi `/panel/` kullanır. Geliştirme ve e2e kipi `/` kullanır.
- `ATONOTA_BASE` ortam değişkeni varsayılanı ezer. Örnek: `ATONOTA_BASE=/ npm run build`.
- Router `basename` değerini `import.meta.env.BASE_URL` değerinden alır. Rota kayıtları önek yazmaz.
- Kabuk rotalarındaki `/panel/ai` yolu canlıda `/panel/panel/ai` olur. Yol çalışır. Adı sadeleştirmek ayrı bir iştir.
- Uygulama içindeki yol `src/app/base-path.ts` ile bulunur. Örnek: `/panel/atonota-login` için `/atonota-login`.
- Girişten dönüş adresi tarayıcının tam yoludur. Yani canlıda `/panel/` öneki de gider.

## Menü verisi

Menü yalnız açılabilen sayfaları gösterir. Menüyü `nav.ts` dosyası kurar. Sıra şöyledir:

1. Rota kaydındaki parametresiz sayfalar gelir. Modül kayıtları da bu listededir.
2. Sonra sunucunun sidebar grupları gelir. Uygulama girişi grupları `viewData.navigation` alanıyla verir.

Gruplar açılış verisinden (`get_bootstrap`) gelir. Grupta yalnız DocType bağlantıları vardır. Sahte sunucunun açılış verisinde grup yoktur. Bu yüzden sahte sunucuyla menüde grup görünmez.

### Yetki süzgeci (G-94)

Menü, kullanıcının açamadığı sayfayı göstermez. Süzgeç `nav.ts` içindeki `permittedNav` işlevidir.

1. Modül kaydı, sayfanın okuduğu DocType adlarını `requires` alanında yazar. Örneğin "İzin talepleri" sayfası `Leave Application` türünü okur.
2. Kabuk bu türleri `viewData.navigation.loadReadable` ile sunucuya sorar.
3. Uygulama girişi her tür için tanım ucunu (`get_doctype`) çağırır. Sunucu okuma yetkisi yoksa 403 verir.
4. Sunucunun sidebar grupları Frappe'nin izin süzgecinden geçmiştir. Gruptaki türler okunabilir sayılır.
5. Rota bağlantıları ve sunucu grupları aynı süzgeçten geçer. Hızlı eylemler de süzülmüş gruplardan gelir.

Kodda rol adı yoktur. Yetki bilgisi gelmezse menü yetki isteyen sayfayı göstermez.

### Bayi menüsü (G-169, G-170)

Bayi rolleri yalnız "Hesap", "Site ve plan" ve "Müşteriler" gruplarını görür. Süzgeç yine `permittedNav` işlevidir.

1. "Müşteriler" sayfası `Reseller Customer Link` türünü ister (`requires`). Bu ad menüde bayi hesabının işaretidir.
2. Kiracı sayfaları aynı adı `excludes` alanında yazar. Bayi bu sayfaları görmez.
3. Kabuk bayi hesabını tanım ucuyla tanımaz. Tanım ucu bu türe bayiye de 403 verir (AJA-945).
4. Kabuk bunun yerine `viewData.navigation.loadAccountKind` işlevini çağırır. İşlev bayi müşteri listesi ucunu (`platform_core.api.reseller.list_customers`) çağırır.
5. Uç 200 dönerse hesap bayi hesabıdır. Boş liste de 200 sayılır. Kabuk o zaman `Reseller Customer Link` adını okunabilir sayar.
6. Uç 403 dönerse hesap kiracı hesabıdır.
7. Başka bir hata gelirse hesap bayi sayılmaz. Kabuk "Hesap türü denetlenemedi" notunu gösterir.
8. Modül sayfası menüyle aynı kuraldan geçer (`moduleAllowed`). Kural kapalıysa sayfada "Bu sayfayı açma yetkiniz yok" notu görünür.
9. Sayfa içindeki yazma düğmeleri rollere bakar (`src/modules/access.ts`). Örneğin "Reseller Assistant" yeni müşteri isteği düğmesini görmez.

Süzgeç yalnız ekranı düzenler. Yetkiyi sunucu her istekte yine denetler.

Canlı menüde uydurma sayı yoktur. Ajan listesi için sunucuda veri yoktur. Bu yüzden canlı menüde ajan bölümü gizlidir. Üst çubuktaki çalışma alanı adı da gizlidir.

Örnek gruplar ve örnek ajanlar yalnız deneme sayfasında görünür. Deneme sayfası `/_demo/shell` adresidir. Bu sayfa yalnız e2e derlemesinde vardır. Flyout, kayan zemin ve bağlantı odağı testleri bu sayfada koşar.

Modül sayfası `ModuleProvider` içinde açılır. Ortamı uygulama girişi `viewData.modules` alanıyla verir. Ortamı `createShellModuleEnvironment` kurar. Bu işlev istemciyi `createModuleClient` ile ortak API istemcisinden yapar. Örnek:

```tsx
<ShellApp
  viewData={{
    modules: createShellModuleEnvironment({ api: session.api, tenant, user }),
  }}
/>
```

`user` değeri Frappe kullanıcı kimliğidir. Bu değer açılış verisindeki `user.name` alanıdır. Ortam verilmezse modül sayfası "Modül bağlantısı kurulmadı" yazar.

Bazı ilk adres parçaları ayrılmıştır: `_demo` ve `panel`. Bu adresler koleksiyon ya da kayıt sayfasına hiçbir zaman düşmez. Örneğin `/_demo/tablo` adresinin satırı yoksa "Sayfa bulunamadı" görünür.

AI Studio satırı `/panel/ai` adresidir. Satır `shellFeatures.aiStudio` ayarının arkasındadır. Ayar açıktır. Yükleyici `src/ai/studio/AiStudioPage.tsx` dosyasını tembel yükler.

Sayfa dosyası yüklenemezse "Sayfa yüklenemedi" görünür. Örneğin ağ kopmuş ya da yeni sürüm yayımlanmış olabilir. "Yeniden dene" düğmesi sayfayı yeniden yükler. Kabuk bu sırada yerinde kalır.

Sayfalar `React.lazy` ile yüklenir. Kabuk hemen çizilir. Sayfa gelene kadar yalnız içerik alanı bekler.

Adres örnekleri şunlardır:

- `/` ana sayfadır.
- `/satis/teklif` bir koleksiyon sayfasıdır.
- `/satis/teklif?gorunum=kanban` aynı sayfanın Kanban görünümüdür.
- `/satis/teklif/TEK-0003` tek kayıt sayfasıdır.

## Görünümler ve veri bağlantısı

Koleksiyonu yalnız `views-collection` işinin `CollectionView` bileşeni çizer. Kabuk kendi tablosunu çizmez.

Liste rotası `/:module/:doctype` adresidir. Bu rota `pages/CollectionRoute.tsx` dosyasını tembel yükler. Dosya önce liste tanımını getirir. Sonra `CollectionView` bileşenini çizer.

Kabuk API istemcisi kurmaz. Veri bağlantısını uygulama girişi verir. Örnek:

```tsx
<ShellApp
  viewData={{
    collection: {
      loadDefinition: ({ module, doctype }, signal) => /* API ile tanımı getir */,
      source: apiCollectionSource,
    },
  }}
/>
```

Bağlantı verilmezse liste sayfası "Veri kaynağı bağlı değil" yazar.

Kayıt rotası için de aynı kural geçerlidir. Uygulama girişi kayıt rotasını `views-record` işinin `RecordView` bileşenine bağlar. Kayıt istekleri oturumun ortak API istemcisinden geçer. Sayfa çerçevesini (`shell-page`, `shell-body`) kabuk çizer. Kayıt bileşeni yalnız içeriği verir. Kayıt bağlantısı yoksa `pages/RecordPage.tsx` örnek formu gösterir. Bu yalnız deneme sayfasında olur.

Liste tablosunda kayıt adı kayda giden bağlantıdır. Adresi kabuk verir: `routes.record(module, doctype, name)`.

## Yan menünün sunucu verisi

Bu bölüm 24 Kasım 2026 Salı günü yazıldı. Canlı panelde örnek veri gösterilmez. Örnek veri yalnız `/_demo/shell` deneme sayfasında görünür.

### Çalışma alanı seçici

- Veri `viewData.workspaces` alanından gelir. Tür `ShellWorkspaceData` türüdür.
- Bu sürümde çalışma alanı oturumun kiracısıdır. Kiracı, oturumun Frappe sitesidir.
- Uygulama girişi adı site adresinden kurar. Örnek: `https://acme.atonota.net` adresi `acme.atonota.net` adını verir.
- Tek çalışma alanı varsa seçici açılır liste değildir. Ad sade görünür ve Tab sırasına girmez.
- Birden çok çalışma alanı varsa seçici açılır liste olur.
- Veri yoksa yalnız logo görünür.

### Hızlı eylemler

- Hızlı eylemler sunucunun sidebar gruplarından gelir. Gruplar Frappe'nin izin süzgecinden geçer.
- Bu yüzden kullanıcının açamadığı sayfa hızlı eylem olmaz.
- En çok 3 eylem görünür. Sayı `QUICK_ACTION_LIMIT` sabitindedir.
- Liste boşsa bölüm çizilmez.

### AI kredisi

- Sayaç `viewData.credit.load` işlevinden okur. Tür `ShellCreditData` türüdür.
- İşlev `null` döndürürse sayaç görünmez. İstek başarısız olursa da sayaç görünmez.
- Bağlantı yoksa sayaç görünmez. Uydurma sayı gösterilmez.

Arka uçta kredi ucu yoktur. Önerilen sözleşme şudur:

- Uç adresi `GET /api/method/platform_core.api.model.get_credit` olur.
- Yanıt örneği `{ "message": { "used": 250, "total": 1000 } }` biçimindedir.
- `used` ve `total` sıfır ya da daha büyük tam sayıdır. `total` sıfırsa sayaç görünmez.
- Kiracının kredisi yoksa yanıt `{ "message": null }` olur.

Bu uç OpenAPI sözleşmesinde yoktur. API istemcisi OpenAPI sözleşmesinden üretilir. Bu yüzden istemciye ve sahte sunucuya elle uç eklenmedi. Uç arka uca eklenince `api-client` işi istemciyi üretir. Sonra uygulama girişi `credit.load` işlevini bağlar.

### AI Studio

- Taşıyıcı `viewData.ai` alanından gelir. Tür `ShellAiData` türüdür.
- Bağlantı yoksa AI Studio "AI Studio bağlantısı kurulmadı" yazar. Sahte ajan çalışmaz.
- Sahte taşıyıcı yalnız e2e derlemesinde açılır. Ekran kaynağı "Sahte sunucu" diye yazar.

### Ana sayfa (Bekleyenler)

- Ana sayfanın adı "Bekleyenler" olur. Veri `get_home_summary` ucundan gelir.
- Bölüm sırası şöyledir: bekleyen onaylar, sorunlu kayıtlar, son değişiklikler, özet sayılar.
- Kullanıcı talebi bu ekranda onaylar ya da reddeder. Sonuç aynı satırda görünür.
- Sonucu ekran okuyucu da duyurur. Duyuru alanının adı "Karar sonucu" olur.
- Onay ya da ret hata verirse talep listede kalır. Hata satırda yazılır.
- Yükleme sırasında yüzde, sahte çubuk ve uydurma saat gösterilmez.
- Bağlantı `ShellHomeData` türündedir. `createShellModuleEnvironment` bağlantıyı da kurar.
- Uygulama girişi isterse bağlantıyı `viewData.home` alanıyla da verebilir.
- Bağlantı hiç yoksa sayfa bunu açıkça yazar. Örnek ajan gösterilmez.
- Testler: `pages/HomePage.test.tsx`, `view-data/home-client.test.ts`, `e2e/home.spec.ts`.

## Yardımcı panel

Yardımcı panelin yeri kabuktadır. Panelin içeriği `ai-studio` işinindir. İçerik `AppShell` bileşenine `assistant` özelliğiyle verilir. İçerik yoksa kısa bir not görünür.

- Kimlik şeridinde "Asistan" düğmesi vardır. Düğme paneli açar ve kapatır.
- Panel tıklama, dokunma, Enter ve Space ile açılır. Fare üstüne gelince panel açılmaz.
- Geniş ekranda panel sağdaki ızgara sütunudur. Genişliği `--shell-assist-w` tokenıdır. Sayfa içeriği daralır, örtülmez.
- Telefon kabuğunda panel alttan tam boy açılan iletişim kutusudur. Geri kalan kabuk etkileşime kapanır.
- Escape ve kapatma düğmesi paneli kapatır. Odak paneli açan düğmeye döner.
- Başka bir düğme de paneli açabilir. Düğme `useAssistPanel()` kancasını kullanır. Örneğin `toggle(e.currentTarget)`. Panel kapanınca odak o düğmeye döner.
- Reduced motion tercihinde panel hareketsiz açılır.

## Odak perdesi yalnız iletişim kutusundadır

Odak perdesini yalnız iletişim kutusu açar. Menü, alt menü paneli, çalışma alanı listesi, yardımcı panel ve sayfa perde açmaz. Telefon çekmecesi kendi arka zeminini kullanır.

## Geçici bağlantılar

`foundation` işi iki parçayı henüz `main` dalına koymadı. Kabuk bu parçaları geçici olarak kendisi kurar.

1. **Tokenlar.** `tokens.ts` değerleri kaynak dosyadan okur. `src/design/` dışa aktarımı gelince `tokens.ts` oradan okuyacak.
2. **Odak perdesi.** `focus-dim/` klasörü D1–D5 kararını uygular. `src/engines/focus-dim/` gelince `useFocusDim` o motoru çağıracak.

3. **Adlı değerler.** `shell.css` dosyasının başında adlı değer bölümü vardır. Kaynakta karşılığı olmayan boşluk, ölçü ve süreler oradadır. `foundation` boşluk ve hareket tokenlarını koyunca bölüm oraya taşınır. Bölüm dışında sabit değer yazılmaz. `shellCss.node.test.ts` bunu denetler.

Bileşenler yalnız `useFocusDim` kancasını ve `shellTokens` nesnesini kullanır. Bu yüzden geçişte bileşen kodu değişmez.

## Denemeler

Birim testleri `npm test` ile koşar.

Tarayıcı testleri `src/shell/e2e/` klasöründedir. Testler kabuk deneme sayfasında koşar. Deneme sayfası derlenmiş çıktıdır. Geliştirme sunucusu tembel sayfada sayfayı yeniden yüklüyordu. Bu da testleri kararsız yapıyordu.

Kök Playwright ayarı bu klasörün testlerini çalıştırır. `npm run test:e2e -- src/shell/e2e/` komutu kabuk testlerini başlatır.

Matris kök ayarla aynıdır: Chromium ve WebKit, iPhone 13 profili. Firefox koşulmaz.

Deneme sayfası `harness/` klasöründedir. Tema geçicidir. `?tema=acik` adresi açık temayı açar. `?yol=/satis/teklif/TEK-0003` adresi kabuğu bu yolda açar. Deneme sayfasında kayıt bağlantısı yoktur. Bu yüzden kayıt adresi örnek formu çizer. Örnek form testi bu yolu kullanır.

### Rozet ve dokunma alanı

Rozet yazısı merkezi `--color-text` rengini kullanır. Seçili rozetin zemini `--color-tint` rengidir.
Test, saydam zeminleri ve kayan fare üstü zeminini birlikte hesaplar.
Her durumda yazı kontrastı en az 4,5:1 olmalıdır.

Dokunmatik giriş varsa hedef alan `--hit-target` değerini kullanır.
Menü, arama, filtre ve sekmelerin görünen boyutu korunur.
Sekmelerin görünmez dokunma katmanı `::before` üzerindedir.
Ant Design, `::after` katmanını fare üstü görünümü için kullanır.
Görünüm sekmeleri arasındaki boşluk, dokunma alanlarının çakışmasını önler.
Kaydırma kutusundaki boşluk, bu alanların kırpılmasını önler.

`npm run test:e2e -- src/shell/e2e/hit-contrast.spec.ts` komutu bu kuralları sınar.
Test, gerçek dokunma noktalarını ve dış kenardan etkinleşmeyi kontrol eder.
WebKit'in 320 piksel projesinde dokunma ayrıca açılır.
Ekran genişliği tek başına dokunmatik giriş anlamına gelmez.

## Kimlik şeridi ve iş grupları

Kimlik şeridi kiracıyı, ortamı ve kipi gösterir.
Kiracı adı açık çalışma alanından gelir.
Ortam, uygulamanın verdiği `modules.mode` alanından gelir.
`example` değeri “Deneme”, `live` değeri “Canlı” olarak görünür.
Bu alan gelmediyse şerit “Doğrulanıyor” yazar.
Kabuk ortamı adresten veya derleme türünden tahmin etmez.
Kip, komut alanındaki seçimi gösterir.
Dar menüye geçince kip korunur.

Menü bağlantıları önce mevcut yetki süzgecinden geçer.
`groupNavigation` sonucu üç iş grubuna ayırır.
Gruplar “Bakmak ve onaylamak”, “İnsan kaynakları” ve “Yönetim” adlarını taşır.
Boş grup görünmez.
Aynı sayfa yalnız bir kez görünür.
İzin sayfası varsa genel izin listesi ayrıca gösterilmez.
Başka bir işi yapan bağlantı korunur.
Eski açılır menü örnekleri yalnız deneme sayfasında kalır.

Şerit telefonda üstte kalır.
Kabuk şeridin gerçek yüksekliğini ölçer.
Kaydırma payı bu ölçüye uyar.
Böylece şerit klavye odağını örtmez.
Menü bağlantılarında `tabIndex={0}` vardır.
Bu ayar macOS WebKit içinde Tab ile gezinmeyi sağlar.
Odak göstergesini yalnız ortak klavye modu açar.

En küçük kabuk metni 14 px, gövde metni 16 px olur.
Değerler `tokens.ts` dosyasındadır.
Telefon menüsünün bağlantı yüksekliği en az 48 px olur.
Düğmelerin görünmeyen dokunma alanı mevcut ortak kurala uyar.
Menü hareketi ortak simetrik eğriyi kullanır.

İlgili kontroller şu komutlarla çalışır:

```sh
npm run lint
npm run typecheck
npm test
npm run build
E2E_PORT=4199 npm run test:e2e -- src/shell/e2e/identity-navigation.spec.ts
E2E_PORT=4199 npm run test:e2e -- src/shell/e2e src/shell/sidebar/e2e --project=chromium-320 --project=chromium-desktop --project=webkit-320 --project=webkit-desktop --workers=3
```

Kimlik denemesi `identity/harness/` klasöründedir.
Bu deneme gerçek sunucuya bağlanmaz.
Üretim derlemesi bu deneme girişini içermez.
Görsel referans dosyaları bu işte değiştirilmez.

## Yardım kulakçığı (G-137)

Sayfanın sağ kenarında "Yardım" kulakçığı durur. Kulakçık bir düğmedir ve `aria-expanded` taşır.

- Panel sayfa yardımını, sık görevleri ve "Kendi kendine destek modu" anahtarını gösterir.
- Anahtar `role=switch` taşır. Tercih tarayıcıda `atonota.shell.selfHelp` anahtarıyla saklanır.
- Mod açıkken alan ve sayfa yardım işaretleri görünür. Mod kapalıyken işaret çizilmez.
- Alan işareti ekran okuyucuya alan adıyla duyurulur. Örnek: "Başlık alanının yardımı".
- Panel AI panelinin sağ yuvasını kullanır. Genişlik kaynaktaki `aiStudio.layout.right` değeridir.
- Panel yan yana sığmazsa tam ekran çekmece olur. Eşik sidebar, panel ve 600 px okunur içerik toplamıdır.
- Escape paneli kapatır. Odak paneli açan öğeye döner: kulakçık ya da alan işareti.
- Panel kapalıyken de DOM'da kalır. Böylece yön değişince açık panel, anahtar ve odak korunur.

Sunucu yardım içeriği henüz bağlı değildir. Alan yardımı şimdilik Frappe alan açıklamasından gelir. Sunucu sözleşmesi `platform_core-help.openapi.yaml` dosyasıdır (G-138). Sözleşme bu depoya `contracts:sync` ile alınınca panel `getFieldHelp` ucunu kullanır.

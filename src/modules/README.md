# Panel modülleri

Bu klasör altı sayfanın kayıtlarını ve ekranlarını içerir.
Kabuk, `moduleRegistrations` listesini okur.
Kabuk, seçilen sayfanın `load()` işlevini çağırır.
Sayfa kodu ancak bu çağrıyla yüklenir.

`ModuleProvider` siteyi, hesabı ve ortak istemciyi alır.
Hesap değişince sağlayıcı ekran durumunu sıfırlar.
Bekleyen okuma ve yazma istekleri iptal edilir.
İptal, sunucunun yazmayı geri aldığı anlamına gelmez.
Ekranlar yazmayı kendiliğinden yinelemez.

## Bağlantılar

- Hesap ekranı doğrulanmış profil bilgisini gösterir.
- Hesap silme bağlantısı Press üzerindeki `/account-deletion` sayfasını açar.
- Press kendi oturumunu ve güvenlik belirtecini kullanır.
- Press kimliği yeniden doğrular ve silme onayı alır.
- Panel başka köke silme isteği göndermez.
- İzin işlemleri okunan `modified` değerini değiştirmeden gönderir.
- Yapay zekâ onayı, açılan önerinin farkını ve özet değerini kullanır.
- Sunucu işlemi reddederse ekran başarı göstermez.
- Sunucu sonucu bilinmiyorsa ekran yeniden yazmayı önermez.
- Erişim açıklaması sunucunun kararını gösterir.

## Yapay zekâ sağlayıcıları

Sayfa `/administration/ai-providers` adresindedir. Sayfa Yönetim bölümünün alt sayfasıdır.

- Sayfa kayıtlı bağlantıları listeler. Her satırda durum ve son deneme zamanı görünür.
- "API ekle" formu sunucu kataloğundan çizilir. Kodda sağlayıcı listesi yoktur.
- Sunucu kataloğu 403 dönerse "API ekle" düğmesi görünmez. Rol denetimini sunucu yapar.
- Sır alanı maskelidir. Kaydettikten sonra sır ekranda ve durumda tutulmaz.
- Kayıt sonucu belirsiz kalabilir. Örneğin istek zaman aşımına uğrar. Bu durumda sayfa sır alanlarını temizler. Öteki alanlar formda kalır.
- Bazı sağlayıcıların zorunlu sır alanı vardır. Örnek: Anthropic. Bu sağlayıcılarda yönetici sırrı yeniden yazmadan ikinci kayıt isteği gitmez.
- Bazı sağlayıcıların sır alanı yoktur. Örnek: Ollama. Bu sağlayıcılarda belirsiz sonuçtan sonra "Kaydet" düğmesi yeniden çalışır. Sayfa bu durumda listeyi yeniden okur. Yönetici yeniden kaydetmeden önce bağlantıyı listede aramalıdır. Ekrandaki ileti de bunu söyler.
- Sunucu 409 yanıtı verirse kayıt yapılmamıştır. Bu durumda sır formda kalır. Yönetici biraz bekleyip yeniden kaydedebilir.
- "Kaydet" ve "Bağlantıyı dene" ayrı adımlardır. Deneme sırasında düğme bekler.
- Denemede 429 yanıtı "Çok sık denendi" iletisiyle görünür. Kayıtta aynı yanıt "Çok sık kaydedildi" iletisiyle görünür.
- Kayıt yanıtı bazen gelmez. Örneğin zaman aşımında ya da 5xx yanıtında yanıt gelmez. Sunucu kaydı yazmış olabilir. Bu durumda ekran "İşlem sonucu bilinmiyor" der ve listeyi yeniden okur. Ekran "yeniden deneyin" demez, çünkü her kayıt yeni bir bağlantı açar.
- Kayıttan sonra odak "Bağlantıyı dene" düğmesine gider. Form kapanınca odak "API ekle" düğmesine döner.
- Sağlayıcı uçları `src/api/provider-client.ts` dosyasındadır. Bu dosya ilk yüke girmez. Modül istemcisi onu `aiProviders()` çağrısında yükler.
- Ekran metinleri `ai-providers/messages.ts` dosyasındadır.

## Veri aktarımı

Sayfa `/data-transfer` adresindedir. Sayfa G-97 kaleminin 3. parçasıdır (AJA-2493).

- İçe aktarım Frappe'nin `Data Import` belgesiyle yapılır.
- Kullanıcı önce kayıt türünü seçer. Sonra şablonu indirir.
- Şablonda yalnız yazılabilir alanlar bulunur.
- Kullanıcı dosyayı yükler. Sayfa önce `Data Import` kaydını açar. Sonra dosyayı `File` kaydı olarak ekler.
- Frappe önizlemesi sütunları alanlarla eşler. Kullanıcı eşlemeyi değiştirebilir.
- "Aktarımı başlat" eşlemeyi `template_options` alanına yazar. Sonra aktarımı başlatır.
- Sonuç yalnız "Sonucu göster" düğmesiyle okunur. Sahte ilerleme yoktur.
- Hatalı satırlar "Hata raporu" listesinde satır numarasıyla görünür.
- Dışa aktarım yalnız tanım ucunun verdiği alanları yazar. Tanım ucu yalnız okunabilir alanları verir.
- Sunucu satırda fazladan alan gönderse bile o alan dosyaya yazılmaz. Test `data-transfer/model.test.ts` içindedir.
- Dışa aktarım en çok 5000 kayıt indirir. Fazlası varsa ekran bunu söyler.
- Formül gibi başlayan hücreye başta tek tırnak eklenir. Örnek: `=TOPLA(A1)` değeri `'=TOPLA(A1)` olur.
- "Kişisel verilerim" bölümü KVKK talebini açar. Talep `Personal Data Download Request` kaydıdır.
- Talep yalnız oturumdaki kullanıcı için açılır. Dosya hazır olunca Frappe e-postayla bağlantı gönderir.
- İstemci `data-transfer/client.ts` dosyasındadır. Bu dosya ilk yüke girmez.

## Eksik sözleşmeler

Kaynak, `.pane/backend-ref/backend/contracts/` klasöründeki sözleşmelerdir.
Bu kopyada aşağıdaki kullanıcı ekranları için yeterli sözleşme bulunmuyor:

- Profil düzenleme ve oturum listesi.
- Kullanıcı ve rol yönetimi.
- Site ve plan bilgileri.
- Ayrıntılı yapay zekâ işlem günlüğü.

Kimlik eşitleme uçları, kullanıcı yönetimi yerine kullanılmaz.
Press sözleşmesindeki ek uç listeleri, kullanıcıya açık API tanımı sayılmaz.
Bu ekranlar eksik bağlantıyı açıkça bildirir.
Öneri geçmişi, ayrıntılı işlem günlüğü gibi sunulmaz.
Arka uç sahibi sözleşmeleri tamamlayınca `api-client` sahibi istemciyi bağlar.

## Ortak istemciyi bağlama

`createModuleClient(session.api)` ortak istemciyi modüllere bağlar.
`ModuleProvider` bu istemciyi `client` alanında alır.
`tenant` alanı site kökünü taşır.
`user` alanı Frappe sistemindeki kullanıcı kimliğini taşır.
Bu değer, açılış verisindeki `user.name` alanıyla aynı olmalıdır.
Görünen kişi adı veya Keycloak kimliği burada kullanılmaz.
Kabuk profil bilgisini zaten okuduysa `profile` alanına verebilir.
Böylece profil için ikinci açılış isteği gerekmez.
`mode` alanı örnek veri ile canlı veriyi ayırır.
Sağlayıcı, `AuthGate` içinde kalmalıdır.
`AppProviders` ortak temayı, tasarım değerlerini ve klavye odağını sağlar.
Kabuk, modülleri bu ortak sağlayıcının içinde açmalıdır.
Modüller ortak odak kurallarını kendi içinde yeniden tanımlamaz.

Profil, kabuk başlangıç verisindeki kullanıcıdan okunur.
Okunan kullanıcı adı oturumdaki kullanıcı adıyla uyuşmalıdır.
`accountDeletionStatus` yalnız güvenilir sunucu bilgisini alır.
Bu alan sorgu parametresinden veya tarayıcı deposundan doldurulmaz.
Mevcut sözleşme bu bilgiyi sağlamadığı için kabuk alanı boş bırakır.
Alan dolarsa bekleyen silme durumu gösterilir.
Bu durum tamamlanmış silme anlamına gelmez.
`pressOrigin` verilirse ortak Press adres denetimi çalışır.
`accountSecurityUrl` verilirse adresin kimlik sunucusuna ait olduğu denetlenir.

## Doğrulama

Çalışma dizini depo köküdür.

- `npm test -- src/modules`
- `npm run lint`
- `npm run typecheck`
- `npm run test:e2e`

Türler katı TypeScript ayarlarıyla denetlenir.
Tasarım değerleri ortak tema ve CSS değişkenlerinden gelir.
Tarayıcı kabulü 320 CSS px genişlikten başlar.
Firefox bu projede kapsam dışıdır.

Gerçek okurla denenmedi.

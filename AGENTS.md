# atonota-web: ajan talimatları

Bu depo Atonota platformunun ayrı arayüzüdür. İngilizcesi "headless frontend" olarak geçer. Arayüz Frappe arka ucunu yalnız API ile kullanır. Arka uç ayrı bir depodadır: `frappesetup` deposunun `backend/` klasörü.

Bu dosya bütün ajanlar ve insanlar için geçerlidir. Kurallar kalıcıdır.

## Amaç

- Bu depo tam bir SaaS panelidir. Panel Frappe arka ucunun bütün arayüz ihtiyacını karşılar. Frappe'nin kendi masaüstü arayüzü kullanıcıya açılmaz.
- Arayüz önce yapay zekâ için tasarlanır. İngilizcesi "AI first" olarak geçer.
- Arayüz önce telefon ekranı için kurulur. Kabul 320 CSS px genişlikte başlar.
- Teslim cihazın yeteneğine uyarlanır. İngilizcesi "adaptive delivery" olarak geçer. Telefon gereksiz masaüstü kodunu indirmez.
- Bütün görsel kararlar `design/source/` klasöründeki dosyalardan gelir. Bu dosyalar projenin standardı, örneği ve tasarım dilidir.
- Kaynak dosyalar masaüstü örnekleriyle yazıldı. Telefonda aynı tasarım dili korunur. Yerleşim telefon için yeniden kurulur.

## Karar kaynakları

Bu üç dosya proje sahibinin kesin kararlarıdır:

1. `design/source/control-size-config.json`: ölçüler, renkler, gölgeler ve bileşen kuralları.
2. `design/source/design-system.json`: aynı kararların özeti ve bileşen envanteri.
3. `design/source/control-size-engine.html`: kararların çalışan örneği.

Mimari ve kod kuralları `docs/standards/headless-frontend-standartlari.md` dosyasındadır. Bu dosya `frappesetup` deposundaki proje standardının kopyasıdır. Görsel dil kaynak dosyalardan, mimari bu standarttan gelir.

Dosyalardaki "locked", "decision" ve "son karar" alanları değişmez. Bir karar bu dosyayla çelişirse kaynak dosya esas alınır. Bunun tek istisnası aşağıdaki "Ortak kurallarla ilişki" bölümüdür.

Örnek dosyalardaki kişi adları "Örnek Kişi" gibi etiketlerle değiştirildi. Arayüzde gerçek görünümlü kişi adı, telefon ya da e-posta kullanılmaz.

## Teknik kararlar

Bu kararlar orkestratörün kararlarıdır. Kayıt tarihi 23 Kasım 2026 Pazartesi günüdür.

| Konu | Karar |
| --- | --- |
| Arayüz kütüphanesi | React 18.3 ve TypeScript, katı mod |
| Derleme | Vite |
| Bileşenler | `antd` 5.29.3 ve `@ant-design/x` 1.6.1 |
| İkonlar | `@phosphor-icons/react`, ağırlık `regular` |
| Yazı tipi | Outfit (`@fontsource-variable/outfit`), kod için JetBrains Mono |
| Paket yöneticisi | npm ve `package-lock.json` |
| Birim testi | Vitest ve Testing Library |
| Tarayıcı testi | Playwright: Chromium, WebKit ve iPhone 13 profili. Firefox koşulmaz. |
| Erişilebilirlik testi | axe |
| Kimlik | Keycloak, OIDC ve PKCE. Sunucu `api.login.atonota.net` (AtonotA Login). |
| API istemcisi | Arka uç OpenAPI sözleşmelerinden üretilir. |
| Sahte sunucu | MSW. Geliştirme ve testler gerçek arka uca bağlı değildir. |

## Klasör sahipliği

Her iş yalnız kendi klasörünü değiştirir. Ortak dosya gerekiyorsa raporda istenir.

| Klasör | Sahip iş |
| --- | --- |
| `package.json`, `vite.config.ts`, `.github/`, `src/design/`, `src/engines/`, `src/app/`, `tests/setup/` | `foundation` |
| `src/components/controls/` | `controls` |
| `src/shell/` | `shell` |
| `src/ai/`, `src/genui/`, `src/mascot/` | `ai-studio` |
| `src/api/`, `src/auth/`, `contracts/`, `src/mocks/` | `api-client` |
| `src/views/collection/` | `views-collection` |
| `src/views/record/` | `views-record` |
| `src/modules/` | `modules` |
| `src/adaptive/`, `tests/perf/` | `adaptive` |

`package.json` ya da ayar dosyası değişikliği gerekiyorsa iş bunu raporda ister. `foundation` işi ekler.

### Ortak dosyalara tek satır ekleme kuralları

- **Sayfa yolları.** Yönlendirici ve rota sözleşmesi `src/shell/routes.ts` dosyasındadır. Shell işi bu dosyada tembel yüklenen rota listesini kurar. Her iş kendi sayfasını shell işinin rota listesine tek satırla ekler. Örnek: `/panel/ai` yolu `src/ai` sayfasını `import()` ile yükler. Başka işin satırına dokunulmaz. Ayrı yönlendirici kurulmaz. Sayfalar ve kabuk kendi parçasında tembel yüklenir; üretim paketi rotalara göre bölünür.
- **Deneme sayfaları.** Her iş deneme sayfasını `/_demo/<iş>` yolunda açar. Deneme rotası da shell işinin rota listesine eklenir. Koşul `import.meta.env.MODE === 'e2e'` olur. Bu koşul derleme zamanında sabittir. `vite build` çıktısına deneme sayfası girmez. `npm run build:e2e` ve `npm run dev:e2e` bu modu açar. `/_demo/` öneki hiçbir zaman koleksiyon sayfasına düşmez. Kayıtlı deneme sayfası yoksa yol "bulunamadı" sayfasına gider. Bu kuralı yönlendirici (shell işi) uygular. Yardımcı: `@/app` içindeki `DEMO_MODE`, `DEMO_PATH_PREFIX` ve `isDemoPath`.
- **Tarayıcı testleri.** Her iş testini `src/<klasör>/e2e/*.spec.ts` altına koyar. Kök Playwright ayarı `tests/e2e` ve `src/**/e2e/**/*.spec.ts` dosyalarının hepsini koşar. Ayrı Playwright ayar dosyası gerekmez. Testler `npm run test:e2e` ile e2e derlemesine ve sahte sunucuya karşı koşar.
- **Birim testleri.** `src/**/*.test.{ts,tsx}` dosyalarının hepsi `npm test` ile koşar.
- **CSS değişkenleri.** Liste ve kullanım kuralı `src/design/README.md` dosyasındadır. Yatay kayan tablo `data-scroll-x` kapsayıcısına alınır.

## Tasarım tokenları

- Tek kaynak `design/source/control-size-config.json` dosyasıdır.
- `src/design/` bu dosyadan antd teması ve CSS değişkenleri üretir.
- Bileşen içinde sabit renk, ölçü, gölge ya da süre yazılmaz. Değerler tokenlardan gelir.
- Açık ve koyu tema aynı tokenlardan üretilir.

## Köşe kuralları

Köşeler [radius.md yönergesine](https://github.com/karacaismail/frappesetup/blob/4b885f64f85a191f1a0800c8ddb30d419a00afe6/docs/standartlar/radius.md) uyar.
Bu karar önceki kart köşesi kararının yerine geçer.
Token, adı olan tasarım değeridir. Köşe tokenları kaynak JSON dosyasında tanımlıdır.
Kartlar ve GenUI kartları 21 px olur. Açılır paneller 9 px olur.
Kontroller her boyutta 5 px olur. Küçük öğeler 3 px olur.
Kenara dayalı kabuk 0 px olur. Yüzen kabuk en çok 29 px olur.
Bileşenler `--r-*` tokenlarını kullanır. `--r-ring` odak için kullanılmaz.
Çevreleyen odak halkası yasaktır. Mevcut klavye göstergesi korunur.

`outerRadius()` ve `innerRadius()` hesabı yönergenin 7.2 bölümünü uygular.
`npm run check:radius` yazılan köşe değerlerini denetler.
Kapı CSS dosyalarını, kaynak kodunu ve `control-size-config.json` dosyasını tarar.
İzinli basamaklar 0, 3, 5, 7, 9, 13, 17, 21, 25 ve 29 px olur.
Kapı hesaplanan değerleri denetlemez. Tokenlar ve kapsül yüzdeleri geçerlidir.
JSX `radius` özniteliği ve kısa nesne yazımı bu kapının kapsamı dışındadır.
JSON hataları alan yolunu gösterir. Satır numarası göstermez.
`npm test` ve `npm run lint` bu kapıyı çalıştırır.
Yeni bileşen bu kapıdan geçmelidir. Görsel referansları bağımsız QA inceler.

## Ortak kurallarla ilişki

Proje sahibinin genel kuralları bu depoda da geçerlidir. Orkestratör 26 Kasım 2026 Perşembe günü iki kararı değiştirdi (AJA-997). Kaynak model belgesinin 6. bölümüdür.

1. **Metin boyutu.** En küçük metin 14 CSS px'tir. 12 px istisnası geçersizdir. 10 px ve 9 px istisnaları da kalktı. Gövde metni 16 px olur. Tablo metni 14 px olur. Değerler `design/source/control-size-config.json` dosyasındaki `typography` bölümündedir. Test `src/design/ui-tokens.test.ts` içindedir.
2. **Hareket.** Dropdown için ayrı hareket eğrisi yoktur. Dropdown da genel eğriyi kullanır: `cubic-bezier(.65, 0, .35, 1)`. Eğilme hareketi kalktı. Dropdown süresi 140 ms'dir. Bu süre orta süreden (200 ms) kısadır. Bütün süre ve eğriler merkezi tokendadır. `prefers-reduced-motion` açıksa hareket durur. Hareket kapısı (`npm run lint`) `src/design/` dışında sabit süreyi, `cubic-bezier`, `steps` ve `ease`, `ease-in`, `ease-out`, `ease-in-out`, `linear` sözcüklerini reddeder. Kapı CSS'i bildirim bildirim tarar; JS nesne değerleri (`transition={{ duration: 0.3 }}`), `animate()` çağrıları ve sayı süreleri de yakalanır. Satır içi izin yorumu `motion-gate: allow sahip=<iş> neden=<metin>` biçimindedir; yalnız kendi bildirimini susturur. Kapı değişkende duran seçenek nesnesini bildirime bağlamaz; bu sınır `src/design/README.md` içinde yazılıdır. Hareket kitaplığı eklenince kural genişletilir.

Şu genel kurallar istisnasız geçerlidir:

- **Odak.** Çevreleyen odak halkası yasaktır. antd'nin varsayılan odak çerçevesi kapatılır. Klavye odağı çevrelemeyen tek bir göstergeyle görünür. Örneğin alt çizgi kullanılabilir. `forced-colors: active` iken yalnız `outline: 2px solid CanvasText` kullanılır.
- **Kavisli vurgu kenarı yasaktır.** Köşesi yuvarlak kutunun tek kenarına renkli çizgi çizilmez. Kenar göstergesi kullanılacaksa o köşeler radiussuz olur. Örnek: sidebar aktif öğesinin 3 px göstergesi.
- **Tablolar** kendi kapsayıcısında yatay kayar. Sözcük ortasından bölünmez. Sayfa yatay taşmaz.
- **Açılır listeler** antd `Select` ile yapılır. Tarayıcının yerel `<select>` öğesi kullanılmaz.
- **Dokunma alanı** kaynak dosyadaki R1–R10 kurallarına uyar. Görünen alan × 1.12 olur. Dokunma alanı ayrıca bir tokendır: `--hit-target`. Bu token ince işaretçide 44 px olur. Dokunmatik ekranda (`any-pointer: coarse`) en az 48 px olur. Görünen kontrol boyutu ayrı tokendır: `--control-h-sm`, `--control-h-md` ve `--control-h-lg`.
- **Hover** hiçbir eylemin tek yolu değildir.

## Yapay zekâ kuralları

- Asistan yanıtı `{ text, steps, ui[] }` biçimindedir. Kurallar kaynak dosyadaki U1–U6 maddeleridir.
- `ui` blokları yalnız kayıtlı bileşenlerle çizilir. Bilinmeyen blok güvenli JSON görünümüne düşer.
- Onaysız eylem yoktur. Onay ve form blokları kullanıcı onayı olmadan işlem yapmaz.
- Sahte ilerleme gösterilmez. Gerçek araç olayı yoksa ilerleme çubuğu gösterilmez.
- Kodda model adı ya da model sağlayıcı kitaplığı yazılmaz. Arayüz arka ucun model geçidini kullanır.

## Test ve teslim

- Yeni ve anlamlı davranışta önce test yazılır. Test önce başarısız olmalıdır.
- Her bileşen 320, 360, 375, 390 px, yatay telefon, tablet ve masaüstünde denenir.
- Teslimden önce şu dört kapı geçmelidir: `npm run lint`, `npm run typecheck`, `npm test` ve `npm run test:e2e`.
- Çalıştırılmayan denetim `not_run` diye raporlanır.

## Git

- Commit'in yazarı ve committer'ı şu kimliktir: `karacaismail <35493655+karacaismail@users.noreply.github.com>`.
- Yapay zekâ ortak yazar satırı ve imzası eklenmez.
- Pane panelinde commit şu önekle atılır: `env -u GIT_COMMITTER_NAME -u GIT_COMMITTER_EMAIL git commit`.
- `--no-verify` kullanılmaz. Yazar koruması atlatılmaz.
- Secret, gerçek `.env` ve kişisel veri depoya girmez.
- Depo herkese açıktır. Lisans sonraki iştir. Proje sahibi söylemeden lisans dosyası eklenmez ve lisans sorulmaz.

## Trunk tabanlı akış

- Ana dal `main` dalıdır. Bütün işler buraya sık ve küçük parçalarla birleşir.
- Her iş kısa ömürlü bir dalda çalışır. Dal adı iş adıdır. Örnek: `foundation`.
- İşçi push etmez. Orkestratör incelemeden ve kapılardan geçen işi `main` dalına birleştirir.
- Orkestratör her birleşmeden sonra `main` dalını hemen GitHub'a gönderir.
- Uzun süren iş de parça parça birleşir. Bitmemiş özellik varsayılan olarak kapalı bir ayarın arkasında durur.

## Türetilmiş kararlar

Bu kararlar kaynak dosyada yoktu. Orkestratör 23 Kasım 2026 Pazartesi günü onayladı. Değerler kodda sabit yazılmaz. Her değer kaynak karardan programatik türetilir ve testle sabitlenir.

1. **Koyu temada birincil düğme zemini ve metni.** Kaynak karar zemini #00aacc %14 (hover %22, basılı %28) ve dinlenme metnini #00aacc %85 yapar. Yarı saydam zeminde kontrast alttaki yüzeye bağlı kalır. antd pencere ve çekmeceyi yükseltilmiş zeminde (#2A2A30) çizer; orada 4.5:1 sağlanmaz. WCAG 2.2 AA önce gelir. Bu yüzden koyu temada birincil düğme zemini saydam olmayan bir renktir. Renk, kaynaktaki koyu tema tonunun yerleşim zemini (#17171A) üzerine bindirilmesiyle türetilir: normal %14, hover %22, basılı 6. maddedeki değer. Dinlenme metni bu düz zemin üzerinde 4.5:1 veren en küçük opaklığa çıkar. Hover ve basılı metin %100'dür; klavyeyle basılı durumda da %100'dür. Normal, hover, basılı ve klavyeyle basılı durumların hepsi yerleşim, panel ve yükseltilmiş zeminde en az 4.5:1 verir. Hesap `src/design/tokens.ts` içindedir. Test `src/design/antd-theme.test.ts` ve `tests/e2e/erisilebilirlik.spec.ts` (sayfa, kart ve pencere içindeki düğme) içindedir.
2. **Bağlantı ve vurgu rengi.** Açık temada #00aacc yazı rengi olmaz. Bu renk yalnız düğme zemininde kullanılır. #00aacc beyaz üzerinde 2.76:1 verir. Bağlantı, vurgu metni ve odak göstergesi için koyu mavi token vardır: `primary.ink` (26 Kasım 2026, AJA-997). Kaynak değer açık temada #00728a, koyu temada #00aacc olur. Değer sayfa, panel, ikinci yüzey ve vurgu zemini üstünde 4.5:1 verene kadar ayarlanır. Bugün açık temada #006f86, koyu temada #16b1d0 olur. Değişken `--color-ink` ve `--color-link` olur. Butonlar ve zeminler #00aacc kalır.
3. **Metin bağlantıları altı çizilidir.** Renk tek ayırt edici olmaz (WCAG 1.4.1). Buton, menü ve sekme görünümlü bağlantılar bunun dışındadır.
4. **Odak göstergesi.** Klavye modunda odaklanan kontrolün alt kenarında 2 px çizgi görünür. Çizginin rengi vurgu rengidir (`--color-ink`). Çevreleyen halka yoktur. Kalınlık proje kararıdır.
5. **Temel hareket süreleri.** antd'nin hızlı, orta ve yavaş süreleri 100, 200 ve 300 ms'dir. Bu değerler yalnız `src/design/motion.ts` içindedir. Kaynaktaki süreler (dropdown 140 ms, odak perdesi 320 ms) aynen kullanılır.
6. **Koyu temada basılı düğme zemini.** Kaynak %28 der. %100 metinle bile 4.09:1 kalır. Basılı ton, yerleşim zeminine bindirildiğinde %100 metinle 4.5:1 veren en büyük opaklığa iner. Bugün bu değer %23'tür. Sonuç 1. maddedeki gibi düz renge çevrilir. Basılı CSS kuralı metni de %100 yapar; böylece fare olmadan (Space tuşu) basılan düğme de 4.5:1 verir. Hesap `src/design/tokens.ts` içindedir.
7. **Boşluk, katman ve yerleşim ölçüleri.** Boşluk ölçeği antd takma tokenlarından gelir: 4, 8, 12, 16, 24, 32 ve 48 px. Perde katmanı antd açılır katmanının bir altındadır. Okuma genişliği antd `screenLG` değeridir. Bileşen bu sayıları yazmaz. Bileşen `--space-*`, `--z-*` ve `--content-max-width` kullanır.
8. **Tablo sütunu en küçük genişlikleri.** Eylem 84, sayı 96, tarih 126, metin 168 ve başlık 210 px. Değerler orta buton yüksekliğinden (42 px) türetilir. Sütun sıkışmaz. Tablo `data-scroll-x` kapsayıcısında kayar.
9. **Metin bağlantısı rengi ve altı çizgi** 2. ve 3. maddededir. **Odak göstergesi** 4. maddededir. Yüksek kontrast modunda (`forced-colors: active`) gösterge yalnız `outline: 2px solid CanvasText` olur.
10. **Yer tutucu metni.** antd varsayılanı siyah %25 ve beyaz %25'tir. Bu değer 4.5:1 vermez. Yer tutucu opaklığı, giriş zemininde 4.5:1 veren en küçük değere çıkar. Hesap `src/design/tokens.ts` içindedir.
11. **Açık Select'te seçili metin.** Aramasız Select açıkken antd seçili metni yer tutucu rengine soldurur. Bu projede seçili metin solmaz. Kural `src/design/css-variables.ts` içindedir.
12. **Dar form sütunu.** Giriş ve kısa ayar formları en çok 420 px genişler. Kaynakta form genişliği yoktur. Değer ölçü ölçeğinden türetilir: orta buton yüksekliğinin (42 px) 10 katı. Değişken `--form-max-width` olur. Test `src/design/css-variables.test.ts` içindedir.
13. **Tehlike (danger) düğmesi rengi.** Kaynakta tehlike rengi yoktur; antd'nin tema hata rengi kullanılır. Açık tema zeminleri 26 Kasım 2026'dan beri kaynaktaki açık paletten gelir. antd aynı `colorError` tokenını iki işte kullanır: düz düğmede zemin, kenarlıklı, metin, bağlantı, dolgulu ve hayalet düğmede yazı rengi. Bu yüzden iki ayrı türetme vardır. Düz zemin: antd kırmızısı beyaz metinle açık temada 3.27:1, koyu temada 4.24:1 verir; zemin beyaz metinle 4.5:1 verene kadar koyulaştırılır, ton korunur. Üzerine gelme zemini 5.2:1, basılı zemin 6:1 veren daha koyu basamaktır. Metin her durumda beyazdır. Bugün açık temada zemin #d44042, koyu temada #cf4042 olur. Bu değerler `--danger-bg`, `--danger-bg-hover` ve `--danger-bg-active` değişkenleriyle yalnız `.ant-btn-dangerous.ant-btn-variant-solid` düğmesine uygulanır. Yazı rengi: aynı antd kırmızısı, yazının durabileceği her zeminde 4.5:1 verene kadar açık temada koyulaştırılır, koyu temada açılır. Zeminler yerleşim, panel, yükseltilmiş zemin ve antd'nin kırmızımsı durum zeminleridir (`colorErrorBg*`). Üzerine gelme 5.2:1, basılı 6:1 basamağıdır. Bugün açık temada yazı #ab3335, koyu temada #e88182 olur. Bu değerler antd Button `colorError`, `colorErrorHover` ve `colorErrorActive` tokenlarına gider. Tehlikeli birincil düğme (`type="primary" danger`) birincil düğme kurallarının dışındadır; seçici `.ant-btn-primary:not(.ant-btn-dangerous)` olur. antd, düz düğmenin üzerine gelme metnini `primaryColor` tokenından alır; bu yüzden düz tehlike düğmesinin üzerine gelme ve basılı metni `--danger-text` değişkeniyle beyaz tutulur. Hesap `src/design/tokens.ts` içindedir. Test `src/design/antd-theme.test.ts`, `src/design/css-variables.test.ts` ve `tests/e2e/erisilebilirlik.spec.ts` (iki tema, dört tür, üç durum, sayfa, kart ve pencere) içindedir.

14. **Seçili radyo kartının zemini.** Kaynak örnek zeminde birincil rengi %8 oranında kullanır. Uygulama, antd temasının `colorPrimaryBg` adlı açık zemin rengini kullanır. Bu renk açık ve koyu temada seçili kartı diğer kartlardan ayırır.
15. **Koyu temada kapalı anahtarın üzerine gelme rengi.** Uygulama, anahtarın normal zemin rengini %80 oranında kullanır. Kalan %20, antd'nin üzerine gelme renginden gelir. Karışım renk değişimini korur ve “Kapalı” yazısına en az 4.5:1 kontrast sağlar.

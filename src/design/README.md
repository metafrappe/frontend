# Tasarım katmanı: tokenlar ve CSS değişkenleri

Tek karar kaynağı `design/source/control-size-config.json` dosyasıdır. Bu klasör o dosyadan antd temasını, CSS değişkenlerini ve hareket tokenlarını üretir. Değerler kodda ikinci kez yazılmaz.

## Kullanım kuralları

1. Bileşen içinde sabit renk, ölçü, gölge, süre ya da eğri yazmayın. CSS değişkenini ya da `@/design` tokenını kullanın.
2. CSS değişkenleri `AppProviders` ile sayfaya her zaman yüklenir. Ek içe aktarma gerekmez.
3. Koyu tema `html[data-theme="dark"]` ile açılır. Tema farkı olan değişkenler orada yeniden tanımlıdır.
4. Hareket için yalnız `--motion-*` değişkenlerini kullanın. `src/design/` dışında sabit süre, `cubic-bezier`, `steps` ya da `ease`, `ease-in`, `ease-out`, `ease-in-out`, `linear` sözcüğü yazılırsa `npm run lint` başarısız olur (`scripts/motion-gate.mjs`). Kapı CSS'i bildirim bildirim tarar; Prettier'in satırlara böldüğü değerler, JS nesne değerleri (`transition={{ duration: 0.3, ease: 'linear' }}`), `el.animate(kareler, { duration: 200 })` çağrıları ve sayı süreleri (`transitionDuration: 200`) de yakalanır. Geçici istisna için iki yol vardır. Dosya düzeyinde `scripts/motion-gate.allow.json` kaydı (dosya, sahip, neden). Bildirim düzeyinde bildirimin içine `/* motion-gate: allow sahip=<iş> neden=<en az 10 karakter> */` yorumu. Yorum yalnız kendi bildirimini susturur; sahip ya da neden eksikse kapı yine ihlal verir. Bilinen sınır: kapı değişkende duran seçenek nesnesini bildirime bağlamaz (`const o = { duration: 300 }; el.animate(k, o);` ihlal vermez). Projede bugün hareket kitaplığı yoktur; kitaplık eklenince kural genişletilir.
5. antd bileşenleri temayı `AppProviders` içinden alır. antd'nin kendi odak çerçevesi tema düzeyinde kapalıdır. Ek odak stili yazmayın.
6. Yatay kayması gereken tablo ya da geniş içeriği `data-scroll-x` kapsayıcısına alın. Kapsayıcıya `tabIndex={0}`, `role="region"` ve erişilebilir ad verin. Taşma testi bu kapsayıcının içini saymaz.
7. Metin bağlantılarının altı çizilidir. Odaklanınca çizgi 2 px vurgu rengi (`--color-ink`) olur. Menü görünümlü bağlantı bu kuralın dışındadır. Böyle bir bağlantıya `data-nav-link` özelliğini verin. Örnek: kabuk menüsünün bağlantıları. Bu bağlantı kendi tek odak göstergesini taşır.

## Değişken listesi

| Grup | Değişkenler | Kaynak |
| --- | --- | --- |
| Yazı tipi | `--font-ui`, `--font-code` | Outfit kararı |
| Metin boyutu | `--font-min` (14, en küçük metin ve tablo), `--font-default` ve `--font-body` (16, gövde), `--font-h1/h2/h3` (26/20/18). 14 px altında metin tokenı yoktur. | `typography` |
| Buton | `--btn-h-sm/md/lg` (36/42/48), `--btn-fs-sm/md/lg` (14/16/18), `--btn-lh-sm/md/lg` (22/24/26) | `sizes` |
| Giriş | `--input-h-sm/md/lg`, `--input-fs-sm/md/lg`, `--input-lh-sm/md/lg` | `sizes` |
| Ağırlık | `--font-weight-sm/md/lg` (400/500/600) | `fontWeight` |
| Renk | `--color-primary`, `--color-primary-hover`, `--color-primary-active` | `primary` |
| Tehlike | `--danger-text` (beyaz), `--danger-bg`, `--danger-bg-hover`, `--danger-bg-active`: düz (solid) tehlike düğmesinin metni ve zemini. Zemin beyaz metinle 4.5:1, 5.2:1 ve 6:1 verir. antd Button tokenları `colorError`, `colorErrorHover`, `colorErrorActive` bu projede yazı rengidir (kenarlıklı, metin, bağlantı, dolgulu ve hayalet tür); yerleşim, panel, yükseltilmiş zemin ve antd'nin kırmızımsı durum zeminlerinde 4.5:1, 5.2:1 ve 6:1 verir. Hepsi `@/design` içindeki `danger` tokenından gelir. | antd hata rengi, türetilmiş karar 13 |
| Birincil metin | `--primary-text`, `--primary-text-hover`. Koyu temada ek olarak `--primary-bg`, `--primary-bg-hover`, `--primary-bg-active` (düz renk; kaynak tonun yerleşim zeminine bindirilmiş hali) | `primary.light` ve `primary.dark` |
| Koyu zeminler | `--bg-layout`, `--bg-panel`, `--bg-elevated`, `--bg-input`, `--bg-button` (yalnız koyu tema) | `darkPalette` |
| Tema renkleri | `--color-bg-layout`, `--color-bg-panel`, `--color-bg-panel-alt`, `--color-bg-elevated`, `--color-bg-input`, `--color-bg-button`, `--color-bg-button-hover`, `--color-text`, `--color-text-quiet`, `--color-text-secondary` (antd soluk yazısı, tema sarmalayıcısı dışında da), `--color-line`, `--color-ink` (vurgu metni), `--color-tint` (vurgu zemini), `--color-ok`, `--color-warn`, `--color-draft-bg`, `--color-draft-text`, `--color-link`, `--color-link-hover`, `--color-link-active`. Açık ve koyu tema aynı adları üretir. Açık temada #00aacc yazı rengi olmaz. | `lightPalette`, `darkPalette`, `textPalette`, `primary.ink` |
| Köşe | `--r-*` (yönerge basamakları), `--radius` (5), `--card-radius` (21) | `radius`, `cards` |
| Gölge | `--shadow-card` (7 katman), `--shadow-button` (flat), `--shadow-input` (iç), `--shadow-dropdown` (9 katman) | `derived.shadowCss` / `shadowCssDark` |
| Boşluk | `--space-xxs/xs/sm/md/lg/xl/xxl` (4/8/12/16/24/32/48) | antd takma tokenları |
| Yerleşim | `--menu-width` (240), `--assist-width` (416), `--bar-height` (64, telefon alt çubuğu), `--rail-width` (88), `--icon-size` (20), `--content-max-width`, `--form-max-width` (420, dar form sütunu), `--topbar-height` (50, telefon üst çubuğu ve sayfanın kaydırma payı), `--sidebar-width` (288), `--sidebar-rail-width` (68), `--card-padding` (24) | antd ekran eşiği, buton ölçeği, `sidebar`, `cards`, `layoutTokens` |
| Katman | `--z-popup-base`, `--z-dim-overlay`, `--z-dim-source` | antd `zIndexPopupBase` |
| Tablo | `--table-col-min-action/number/date/text/title` | buton ölçeğinden türetilir |
| Dokunma | `--hit-target` (44, dokunmatik ekranda 48), `--hit-expand` (0.12), `--hit-min-target` (24). Görünen kontrol boyutu ayrıdır: `--control-h-sm/md/lg` (36/42/48). | `hitArea.target`, `hitArea`, `sizes` |
| Odak | `--focus-indicator-color` (vurgu rengi, iki tema), `--focus-indicator-size` (2 px) | `primary.ink`, türetilmiş karar |
| Perde | `--focus-dim-color`, `--focus-dim-transparent`, `--focus-dim-blur` | `focusDim` |
| Hareket eğrisi | `--motion-easing-standard` (genel S eğrisi), `--motion-easing-dropdown` (genel S eğrisinin aynısı; ayrı eğri yoktur), `--motion-easing-owl-pop`, `--motion-easing-glide` (kayan hover zemini), `--motion-easing-linear` (dönen simge ve `visibility` gibi anahtar geçişler) | `focusDim.easing`, `dropdown.animation`, `owlAssist.badge.animation`, kaynak örnek sayfadaki `.glide` ve `.spin` kuralları |
| Hareket süresi | `--motion-duration-fast` (100), `--motion-duration-mid` (200), `--motion-duration-slow` (300), `--motion-duration-dropdown` (140), `--motion-duration-focus-dim` (320), `--motion-duration-flyout` (180), `--motion-duration-rail` (520), `--motion-duration-owl-pop` (420), `--motion-duration-glide` (200), `--motion-duration-glide-fade` (150), `--motion-duration-skeleton` (1200), `--motion-duration-spin` (900) | `motion.ts`; kabuk süreleri kaynak örnek sayfadaki `.glide`, `.skel` ve `.spin` kurallarından |
| Anında geçiş | `--motion-duration-instant` (0). Yalnız `visibility` gibi anahtar özelliklerde kullanılır. Hareket süresi değildir; hareket süreleri pozitiftir. | `motion.ts` (`instantMs`) |

**Solma eğrisi kararı.** Kayan hover zemininin solması kaynak örnek sayfada `.15s ease` idi. `ease` sözcüğü genel hareket sözleşmesinde yoktur ve hareket kapısı onu reddeder. Bu yüzden solma, süresini kaynaktan alır (`--motion-duration-glide-fade`, 150 ms). Eğrisi genel S eğrisidir (`--motion-easing-standard`). Karar `src/shell/shell.css` içindeki `--shell-glide-fade-ease` değişkenindedir.

Kabuk süreleri (`glide`, `glideFade`, `skeleton`, `spin`) `motion.ts` içinde sayı olarak yazılıdır. Kaynak JSON dosyasında bu süreler yoktur; yalnız örnek sayfanın CSS kurallarında vardır. Değerler o kurallarla aynıdır.

Açıklama metni rengi antd `colorTextDescription` tokenıyla verilir. antd varsayılanı açık temada 3.29:1, koyu temada 4.47:1 verir. Opaklık her zeminde 4.5:1 veren en küçük değere çıkar. Hesap `tokens.ts` içindeki `textDescription` tokenıdır.

Dropdown açılış hareketi için `@keyframes atonota-dropdown-in` tanımlıdır. Hareket solma ve kısa kaymadır; eğilme yoktur. Süre `--motion-duration-dropdown` (140 ms), eğri `--motion-easing-dropdown` olur. Bu eğri genel eğridir: `cubic-bezier(.65, 0, .35, 1)`.

## TypeScript tokenları

`@/design` şunları dışa aktarır: `designSource`, `buildAntdTheme(mode)`, `buildDesignCss()`, `ensureDesignStyles()`, `tokens` (`sizes`, `primary`, `danger`, `link`, `palette`, `hitTarget`, `radius`, `shadows`, `darkPalette`, `space`, `layer`, `layout`, `table`, `hitArea`, `focusDim`, `focusIndicator`), `motion` (`duration`, `easing`, `dropdownAnimation`) ve renk yardımcıları (`hexToRgba`, `contrastRatio`, `darkenToContrast`, `lightenToContrast`, `blendOver`, `minAlphaForContrast`).

## Motorlar

- `@/engines/hit-area` dokunma alanı motorudur (R1–R11). Input için `<Input suffix={<HitSuffix />} />` kullanın.
- `@/engines/focus-mode` görünür odak modudur. Tab açar, pointerdown kapatır.
- `@/engines/focus-dim` odak perdesidir. `useFocusDim(open, key)` kancasını çağırın. Açan öğeye `focus-dim-source` sınıfı verin.

## Deneme sayfaları ve testler

- Birim testleri `src/**/*.test.{ts,tsx}` altındadır. `npm test` hepsini koşar.
- Tarayıcı testleri `tests/e2e/*.spec.ts` ve `src/<klasör>/e2e/*.spec.ts` altındadır. `npm run test:e2e` hepsini koşar. Ayrı Playwright ayarı gerekmez.
- Deneme sayfaları yalnız e2e derlemesinde açılır: `import.meta.env.MODE === 'e2e'` koşulu ve `/_demo/<iş>` yolu. `npm run build:e2e` ve `npm run dev:e2e` bu modu açar. Üretim derlemesine girmez; bunu `src/app/build-output.node.test.ts` gerçek `vite build` ile denetler. Deneme rotası shell işinin rota listesine eklenir; `/_demo/` öneki koleksiyon sayfasına düşmez (`isDemoPath`).
- Temel deneme sayfası `/_demo/foundation` yolundadır.

/**
 * Semantik tasarım tokenları. Her değer kaynak dosyadan türetilir.
 * Burada yeni görsel değer icat edilmez; yalnız kaynaktaki kararlar adlandırılır.
 */
import { theme as antdThemeApi } from 'antd';

import {
  blendOver,
  contrastRatio,
  darkenToContrast,
  hexToRgba,
  lightenToContrast,
  minAlphaForContrast,
} from './color';
import { designSource, type SizeKey, type ThemeMode } from './source';

const s = designSource;

export const SIZE_KEYS: readonly SizeKey[] = ['sm', 'md', 'lg'];

export const fontFamily = {
  /** Outfit kalıcı karardır. Değişken font dosyası "Outfit Variable" adıyla gelir. */
  ui: "'Outfit Variable', Outfit, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  code: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
} as const;

/**
 * Yazı boyutları. En küçük metin 14 px, gövde 16 px (AJA-997, model 6. bölüm).
 * 12, 10 ve 9 px istisnaları kaldırıldı. Başlıklar kaynaktaki `typography.headings` değeridir.
 */
export const typography = {
  min: s.typography.min,
  default: s.typography.default,
  headings: s.typography.headings,
  /** Satır kutusu = metin + 8 px. */
  lineBoxFor: (fontSize: number): number => fontSize + 8,
  /** antd oran ister: satır kutusu / metin. */
  lineHeightRatioFor: (fontSize: number): number => (fontSize + 8) / fontSize,
} as const;

/**
 * Koyu temada birincil düğme zemini saydam değildir (türetilmiş karar 1).
 * Kaynak karar zemini #00aacc %14 (hover %22, basılı %28) olarak yarı saydam verir. Yarı saydam
 * zeminde kontrast alttaki yüzeye bağlı kalır; antd pencere ve çekmeceyi yükseltilmiş zeminde
 * (#2A2A30) çizer ve orada 4.5:1 sağlanmaz. WCAG 2.2 AA önce gelir. Bu yüzden kaynaktaki ton,
 * yerleşim zemini (#17171A) üzerine bindirilir ve düz renk olarak kullanılır. Böylece kontrast
 * yerleşim, panel ve yükseltilmiş zeminde aynıdır.
 */
const DARK_PRIMARY_BG = blendOver(s.primary.color, s.primary.dark.background, s.darkPalette.layout);
const DARK_PRIMARY_BG_HOVER = blendOver(
  s.primary.color,
  s.primary.dark.hoverBackground,
  s.darkPalette.layout,
);

/** Dinlenme metni: düz zemin üzerinde 4.5:1 veren en küçük opaklık (kaynak %85'ten başlar). */
const DARK_TEXT_OPACITY = minAlphaForContrast({
  text: s.primary.dark.text,
  startAlpha: s.primary.dark.opacity,
  background: DARK_PRIMARY_BG,
  backgroundAlpha: 1,
  surfaces: [DARK_PRIMARY_BG],
});

/**
 * Basılı durum zemini (türetilmiş karar 6). Kaynak %28 der; %100 metinle bile 4.09:1 kalır.
 * Yerleşim zeminine bindirilmiş tonun %100 metinle 4.5:1 verdiği en büyük opaklığa (≤ kaynak) iner.
 * Basılı durumda metin fare ve klavyede %100 olur; CSS basılı kuralı rengi de verir.
 */
function maxBackgroundAlphaForContrast(startAlpha: number, surface: string): number {
  let alpha = Math.round(startAlpha * 100);
  const ok = (a: number) => {
    const bg = blendOver(s.primary.color, a / 100, surface);
    return contrastRatio(blendOver(s.primary.dark.text, 1, bg), bg) >= 4.5;
  };
  while (alpha > 0 && !ok(alpha)) alpha -= 1;
  return alpha / 100;
}
const DARK_ACTIVE_BG_ALPHA = maxBackgroundAlphaForContrast(s.primary.dark.activeBackground, s.darkPalette.layout);
const DARK_PRIMARY_BG_ACTIVE = blendOver(s.primary.color, DARK_ACTIVE_BG_ALPHA, s.darkPalette.layout);

export const primary = {
  color: s.primary.color,
  hover: s.primary.hover,
  active: s.primary.active,
  /** Açık tema: zemin birincil renk, metin siyah %85, hover %100. */
  light: {
    text: hexToRgba(s.primary.light.text, s.primary.light.opacity),
    textHover: hexToRgba(s.primary.light.text, s.primary.light.hoverOpacity),
  },
  /**
   * Koyu tema: zemin kaynaktaki tonun (%14, hover %22, basılı ≤ %28) yerleşim zeminine bindirilmiş
   * düz rengidir. Dinlenme metni kaynakta %85'tir; AA (4.5:1) için gereken en küçük değere çıkar.
   * Hover ve basılı metin %100'dür (klavyeyle basılı durum dahil).
   */
  dark: {
    textOpacity: DARK_TEXT_OPACITY,
    text: hexToRgba(s.primary.dark.text, DARK_TEXT_OPACITY),
    textHover: hexToRgba(s.primary.dark.text, s.primary.dark.hoverOpacity),
    textActiveOpacity: s.primary.dark.hoverOpacity,
    background: DARK_PRIMARY_BG,
    backgroundHover: DARK_PRIMARY_BG_HOVER,
    backgroundActiveOpacity: DARK_ACTIVE_BG_ALPHA,
    backgroundActive: DARK_PRIMARY_BG_ACTIVE,
  },
} as const;

/** Kontrol kenarlık kalınlığı. antd varsayılanı 1 px; kaynaktaki padding hesabı bunu düşer. */
export const border = {
  width: 1,
} as const;

/**
 * Açık ve koyu tema zeminleri, metin, çizgi ve durum renkleri. İki tema aynı adları taşır.
 * Açık zeminler `lightPalette`, koyu zeminler `darkPalette`, metin ve durum renkleri `textPalette` kaynağındandır.
 * `panelAlt` ikinci yüzeydir; koyu temada yükseltilmiş zemindir. `ink` vurgu ve bağlantı metnidir.
 */
function paletteFor(mode: ThemeMode) {
  const dark = mode === 'dark';
  const text = s.textPalette[mode];
  const surfaces = dark
    ? {
        layout: s.darkPalette.layout,
        panel: s.darkPalette.panel,
        panelAlt: s.darkPalette.elevated,
        elevated: s.darkPalette.elevated,
        input: s.darkPalette.input,
        button: s.darkPalette.button,
        buttonHover: s.darkPalette.buttonHover,
      }
    : { ...s.lightPalette };
  const tint = hexToRgba(s.primary.color, text.tintAlpha);
  // Vurgu metni sayfa, panel, ikinci yüzey ve vurgu zemini (tint) üstünde en az 4.5:1 verir.
  // Kaynak değer başlangıçtır; gerekirse açık temada koyulaşır, koyu temada açılır.
  const inkSurfaces = [surfaces.layout, surfaces.panel, surfaces.panelAlt, surfaces.elevated];
  const allSurfaces = [...inkSurfaces, ...inkSurfaces.map((bg) => blendOver(s.primary.color, text.tintAlpha, bg))];
  const adjust = dark ? lightenToContrast : darkenToContrast;
  const ink = allSurfaces.reduce((c, bg) => adjust(c, bg), s.primary.ink[mode]);
  return {
    ...surfaces,
    text: text.text,
    textQuiet: text.textQuiet,
    line: text.line,
    ink,
    tint,
    /** Vurgu metninin denendiği zeminler; test aynı listeyi kullanır. */
    inkSurfaces: allSurfaces,
    ok: text.ok,
    warn: text.warn,
    draftBg: text.draftBg,
    draftText: text.draftText,
  };
}

export const palette = {
  light: paletteFor('light'),
  dark: paletteFor('dark'),
} as const;

/** Açık tema sayfa zemini kaynaktaki açık paletten gelir. Kontrast bu zemine göre hesaplanır. */
const LIGHT_SURFACES: string[] = palette.light.inkSurfaces;
const darkenOnLight = (c: string) => LIGHT_SURFACES.reduce((acc, bg) => darkenToContrast(acc, bg), c);

/**
 * Metin bağlantısı renkleri. Koyu temada birincil renk yeterli kontrast verir.
 * Açık temada birincil renk beyaz üzerinde 2.76:1 kalır; WCAG 2.2 AA 4.5:1 ister.
 * Bu yüzden açık tema bağlantı rengi birincil renkten koyulaştırılarak türetilir.
 * Butonlar ve zeminler birincil rengi aynen kullanır.
 */
export const link = {
  light: {
    /** Açık temada #00aacc yazı rengi olmaz. Bağlantı kaynaktaki koyu mavi vurgu rengidir (AJA-997). */
    color: palette.light.ink,
    hover: darkenOnLight(s.primary.hover),
    active: darkenOnLight(s.primary.active),
  },
  dark: { color: palette.dark.ink, hover: s.primary.hover, active: s.primary.active },
} as const;

const WHITE = '#ffffff';

/**
 * Tehlike düğmesi kontrast basamakları: normal, üzerine gelme ve basılı durum en az bu oranı verir.
 * Düz düğmede ölçü beyaz metinle zemindir; diğer türlerde yazı rengiyle en kötü zemindir.
 */
export const DANGER_CONTRAST = { normal: 4.5, hover: 5.2, active: 6 } as const;

/**
 * Tehlike (danger) rengi. Kaynak dosyada tehlike rengi yoktur; antd'nin tema hata rengi kullanılır.
 * antd kırmızısı beyaz metinle açık temada 3.27:1, koyu temada 4.24:1 verir; WCAG 2.2 AA 4.5:1 ister.
 *
 * İki ayrı türetme vardır, çünkü antd aynı `colorError` tokenını iki işte kullanır:
 * - Düz (solid) düğme zemini: antd rengi beyaz metinle 4.5:1 verene kadar koyulaştırılır (ton korunur).
 *   Üzerine gelme ve basılı zemin aynı tonun daha koyu basamaklarıdır (5.2:1 ve 6:1). Metin beyazdır.
 *   Bu değerler CSS değişkenleriyle (`--danger-bg*`) yalnız düz düğmeye uygulanır.
 * - Yazı rengi (kenarlıklı, kesikli, metin, bağlantı, dolgulu ve hayalet tür): aynı antd rengi, yazının
 *   durabileceği her zeminde 4.5:1 verene kadar açık temada koyulaştırılır, koyu temada açılır.
 *   Zeminler yerleşim, panel, yükseltilmiş zemin ve antd'nin kırmızımsı durum zeminleridir
 *   (`colorErrorBg*`, metin ve dolgulu türün üzerine gelme ve basılı zemini). Üzerine gelme ve basılı
 *   yazı aynı yönde 5.2:1 ve 6:1 basamağıdır. Bu değerler antd Button `colorError*` tokenlarına gider.
 * Tehlikeli birincil düğme birincil düğme kurallarının dışındadır (`src/design/css-variables.ts`).
 */
function dangerFor(mode: ThemeMode) {
  const t = antdThemeApi.getDesignToken({
    algorithm: mode === 'dark' ? antdThemeApi.darkAlgorithm : antdThemeApi.defaultAlgorithm,
  });
  const seed: string = t.colorError;
  const background = darkenToContrast(seed, WHITE, DANGER_CONTRAST.normal);
  const surfaces: string[] =
    mode === 'dark'
      ? [s.darkPalette.layout, s.darkPalette.panel, s.darkPalette.elevated]
      : [s.lightPalette.panel, s.lightPalette.layout, s.lightPalette.panelAlt];
  surfaces.push(t.colorErrorBg, t.colorErrorBgHover, t.colorErrorBgActive, t.colorErrorBgFilledHover);
  const adjust = mode === 'dark' ? lightenToContrast : darkenToContrast;
  // Her zemin için sırayla ayarlanır; yön tek olduğundan son renk bütün zeminlerde sınırı sağlar.
  const ink = (minRatio: number) => surfaces.reduce((c, bg) => adjust(c, bg, minRatio), seed);
  return {
    /** Düz düğme metni. */
    solidText: WHITE,
    /** Düz düğme zemini: normal, üzerine gelme, basılı. */
    background,
    backgroundHover: darkenToContrast(background, WHITE, DANGER_CONTRAST.hover),
    backgroundActive: darkenToContrast(background, WHITE, DANGER_CONTRAST.active),
    /** Yazı rengi (düz olmayan türler): normal, üzerine gelme, basılı. */
    color: ink(DANGER_CONTRAST.normal),
    colorHover: ink(DANGER_CONTRAST.hover),
    colorActive: ink(DANGER_CONTRAST.active),
    /** Yazı renginin denendiği zeminler; test aynı listeyi kullanır. */
    surfaces,
  };
}

export const danger = {
  light: dangerFor('light'),
  dark: dangerFor('dark'),
} as const;

/**
 * Yer tutucu metni. antd varsayılanı siyah %25 ve beyaz %25'tir; AA (4.5:1) sınırının altındadır.
 * Opaklık, giriş zemininde 4.5:1 veren en küçük değere programatik çıkar.
 * Açık temada zemin kaynaktaki açık giriş zeminidir; koyu temada kaynak giriş zemini.
 */
export const placeholder = {
  light: hexToRgba(
    '#000000',
    minAlphaForContrast({
      text: '#000000',
      startAlpha: 0.25,
      background: s.lightPalette.input,
      backgroundAlpha: 1,
      surfaces: [s.lightPalette.input],
    }),
  ),
  dark: hexToRgba(
    '#ffffff',
    minAlphaForContrast({
      text: '#ffffff',
      startAlpha: 0.25,
      background: s.darkPalette.input,
      backgroundAlpha: 1,
      surfaces: [s.darkPalette.input],
    }),
  ),
} as const;

/**
 * Açıklama metni (antd `colorTextDescription`). antd `Result` alt metni ve benzer yardımcı metinler
 * bu rengi kullanır. antd varsayılanı açık temada siyah %45 (yerleşim zemininde 3.29:1), koyu temada
 * beyaz %45'tir (4.47:1); WCAG 2.2 AA 4.5:1 ister. Opaklık, metnin durabileceği her zeminde 4.5:1
 * veren en küçük değere programatik çıkar. Zeminler: açık temada yerleşim, kapsayıcı ve yükseltilmiş
 * zemin (kaynaktaki açık palet); koyu temada kaynak yerleşim, panel ve yükseltilmiş zemini.
 */
function textDescriptionFor(mode: ThemeMode) {
  const dark = mode === 'dark';
  const t = antdThemeApi.getDesignToken({
    algorithm: dark ? antdThemeApi.darkAlgorithm : antdThemeApi.defaultAlgorithm,
  });
  const text = dark ? '#ffffff' : '#000000';
  const surfaces: string[] = dark
    ? [s.darkPalette.layout, s.darkPalette.panel, s.darkPalette.elevated]
    : [s.lightPalette.layout, s.lightPalette.panel, s.lightPalette.panelAlt, s.lightPalette.elevated];
  // antd varsayılan opaklığı (rgba(..., 0.45)) başlangıçtır.
  const startAlpha = Number(/,\s*([\d.]+)\)$/.exec(t.colorTextDescription)?.[1] ?? 0.45);
  // Zemin saydamlığı 0: metin doğrudan her zeminin üstündedir.
  const opacity = minAlphaForContrast({
    text,
    startAlpha,
    background: text,
    backgroundAlpha: 0,
    surfaces,
  });
  return { color: hexToRgba(text, opacity), opacity, surfaces };
}

export const textDescription = {
  light: textDescriptionFor('light'),
  dark: textDescriptionFor('dark'),
} as const;

export const radius = {
  ...s.radius.tokens,
  control: s.radius.default,
  card: s.cards.radius,
} as const;

export interface ControlSize {
  height: number;
  fontSize: number;
  lineBox: number;
  paddingBlock: number;
  fontWeight: number;
}

function controlSize(kind: 'button' | 'input', key: SizeKey): ControlSize {
  const { height, fontSize } = s.sizes[key][kind];
  const lineBox = typography.lineBoxFor(fontSize);
  return {
    height,
    fontSize,
    lineBox,
    paddingBlock: (height - lineBox - 2 * border.width) / 2,
    fontWeight: s.fontWeight[key],
  };
}

export const sizes = {
  button: { sm: controlSize('button', 'sm'), md: controlSize('button', 'md'), lg: controlSize('button', 'lg') },
  input: { sm: controlSize('input', 'sm'), md: controlSize('input', 'md'), lg: controlSize('input', 'lg') },
} as const;

export const fontWeight = {
  sm: s.fontWeight.sm,
  md: s.fontWeight.md,
  lg: s.fontWeight.lg,
  lgFallback: s.fontWeight.lgFallback,
  strong: s.fontWeight.lg,
} as const;

export const shadows = {
  light: s.derived.shadowCss,
  dark: s.derived.shadowCssDark,
} as const;

export const darkPalette = {
  layout: s.darkPalette.layout,
  panel: s.darkPalette.panel,
  elevated: s.darkPalette.elevated,
  input: s.darkPalette.input,
  button: s.darkPalette.button,
  buttonHover: s.darkPalette.buttonHover,
  buttonBorder: s.darkPalette.buttonBorder,
  border: s.darkPalette.border,
  borderSecondary: s.darkPalette.borderSecondary,
} as const;

/**
 * Dokunma alanı tokenı. Görünen kontrol boyutundan (`sizes`) ayrıdır.
 * İnce işaretçide en az `fine`, dokunmatik ekranda (`any-pointer: coarse`) en az `coarse` px.
 */
export const hitTarget = {
  fine: s.hitArea.target.fine,
  coarse: s.hitArea.target.coarse,
} as const;


export const hitArea = {
  expand: s.hitArea.expand,
  minTarget: s.hitArea.minTarget,
  css: s.hitArea.css,
  rules: s.hitArea.rules,
} as const;

export const focusDim = {
  light: { color: hexToRgba(s.focusDim.color, s.focusDim.opacity), transparent: hexToRgba(s.focusDim.color, 0) },
  dark: {
    color: hexToRgba(s.focusDim.dark.color, s.focusDim.dark.opacity),
    transparent: hexToRgba(s.focusDim.dark.color, 0),
  },
  blur: s.focusDim.blur,
  duration: s.focusDim.duration,
  easing: s.focusDim.easing,
} as const;

/**
 * Klavye odak göstergesi. Çevreleyen halka yasaktır; gösterge alt kenarda tek çizgidir.
 * Renk vurgu rengidir: açık temada koyu mavi, koyu temada birincil renk (AJA-997).
 * Kalınlık proje kararıdır (kaynakta tanımlı değil): 2 px.
 */
export const focusIndicator = {
  light: { color: palette.light.ink },
  dark: { color: palette.dark.ink },
  size: 2,
} as const;

export const choice = {
  checkbox: s.choice.checkbox,
  radio: s.choice.radio,
  switch: s.choice.switch,
  tabs: s.choice.tabs,
  tag: s.choice.tag,
} as const;

export const sidebar = {
  widthExpanded: s.sidebar.widthExpanded,
  widthCollapsed: s.sidebar.widthCollapsed,
  item: s.sidebar.item,
  flyout: s.sidebar.flyout,
} as const;

export const dropdown = {
  style: s.dropdown.defaultStyle,
  styles: s.dropdown.styles,
  joinedItems: s.dropdown.joinedItems.value,
  attachedSelect: s.dropdown.attachedSelect.value,
  attachedButton: s.dropdown.attachedButton.value,
} as const;

/** antd varsayılan takma tokenları: boşluk, katman sırası ve ekran eşikleri. Algoritmadan bağımsızdır. */
const antdDefaults = antdThemeApi.getDesignToken();

/**
 * Boşluk ölçeği. antd takma tokenlarından türetilir; bileşenler sayı yazmaz.
 * xxs 4, xs 8, sm 12, md 16, lg 24, xl 32, xxl 48 px.
 */
export const space = {
  xxs: antdDefaults.paddingXXS,
  xs: antdDefaults.paddingXS,
  sm: antdDefaults.paddingSM,
  md: antdDefaults.padding,
  lg: antdDefaults.paddingLG,
  xl: antdDefaults.paddingXL,
  xxl: antdDefaults.paddingXL + antdDefaults.padding,
} as const;

/** Katman sırası. Perde antd açılır katmanının hemen altında, açan öğe antd katmanında. */
export const layer = {
  popupBase: antdDefaults.zIndexPopupBase,
  dimOverlay: antdDefaults.zIndexPopupBase - 1,
  dimSource: antdDefaults.zIndexPopupBase,
} as const;

/** Okuma genişliği ve içerik eşikleri (antd ekran eşikleri). */
export const layout = {
  contentMaxWidth: antdDefaults.screenLG,
  screenSM: antdDefaults.screenSM,
  screenMD: antdDefaults.screenMD,
  screenLG: antdDefaults.screenLG,
  screenXL: antdDefaults.screenXL,
  sidebarWidth: s.sidebar.widthExpanded,
  sidebarRailWidth: s.sidebar.widthCollapsed,
  cardPadding: s.cards.padding,
  /** Kabuk ölçüleri (onaylı taslak): menü, yardımcı paneli, telefon alt çubuğu, dar menü ve simge. */
  menuWidth: s.layoutTokens.menuWidth,
  assistWidth: s.layoutTokens.assistWidth,
  barHeight: s.layoutTokens.barHeight,
  railWidth: s.layoutTokens.railWidth,
  iconSize: s.layoutTokens.iconSize,
  /** Dar form sütunu (giriş, parola, kısa ayar). Kaynak ölçeğinden türetilir: 10 orta buton yüksekliği = 420 px. */
  formMaxWidth: sizes.button.md.height * 10,
  /**
   * Telefon kabuğunun yapışkan üst çubuğu: orta buton ve üstte, altta en küçük boşluk (42 + 2 × 4 px).
   * Sayfanın kaydırma payı (`scroll-padding-top`) bu değerdir; odaklanan öğe çubuğun altında kalmaz.
   */
  topbarHeight: sizes.button.md.height + 2 * space.xxs,
} as const;

/**
 * Tablo sütunu en küçük genişlikleri (içerik türüne göre). Sütunlar sıkışmaz; tablo kendi
 * kapsayıcısında yatay kayar. Değerler buton ölçeğinden türetilir: md yükseklik 42 px.
 */
export const table = {
  columnMinWidth: {
    action: sizes.button.md.height * 2,
    number: sizes.button.md.height * 2 + space.sm,
    date: sizes.button.md.height * 3,
    text: sizes.button.md.height * 4,
    title: sizes.button.md.height * 5,
  },
} as const;

export function shadowsFor(mode: ThemeMode) {
  return mode === 'dark' ? shadows.dark : shadows.light;
}

export type { SizeKey, ThemeMode };

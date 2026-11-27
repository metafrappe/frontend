/**
 * Semantic design tokens. Every value is derived from the source file.
 * No new visual value is invented here; only the source decisions are named.
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
  /** Outfit is a standing decision. The variable font file comes with the name "Outfit Variable". */
  ui: "'Outfit Variable', Outfit, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  code: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
} as const;

/**
 * Font sizes. Smallest text 14 px, body 16 px (AJA-997, model section 6).
 * The 12, 10 and 9 px exceptions were removed. Headings use the source `typography.headings` value.
 */
export const typography = {
  min: s.typography.min,
  default: s.typography.default,
  headings: s.typography.headings,
  /** Line box = text + 8 px. */
  lineBoxFor: (fontSize: number): number => fontSize + 8,
  /** antd wants a ratio: line box / text. */
  lineHeightRatioFor: (fontSize: number): number => (fontSize + 8) / fontSize,
} as const;

/**
 * In the dark theme the primary button background is not transparent (derived decision 1).
 * The source decision gives a semi-transparent background: #00aacc at 14% (hover 22%, pressed 28%).
 * On a semi-transparent background the contrast depends on the surface below; antd draws modals and
 * drawers on the elevated background (#2A2A30), where 4.5:1 is not met. WCAG 2.2 AA comes first.
 * So the source tint is laid over the layout background (#17171A) and used as a solid colour.
 * This keeps the contrast the same on the layout, panel and elevated backgrounds.
 */
const DARK_PRIMARY_BG = blendOver(s.primary.color, s.primary.dark.background, s.darkPalette.layout);
const DARK_PRIMARY_BG_HOVER = blendOver(
  s.primary.color,
  s.primary.dark.hoverBackground,
  s.darkPalette.layout,
);

/** Resting text: the lowest opacity giving 4.5:1 on the solid background (the source starts at 85%). */
const DARK_TEXT_OPACITY = minAlphaForContrast({
  text: s.primary.dark.text,
  startAlpha: s.primary.dark.opacity,
  background: DARK_PRIMARY_BG,
  backgroundAlpha: 1,
  surfaces: [DARK_PRIMARY_BG],
});

/**
 * Pressed state background (derived decision 6). The source says 28%; even with 100% text that gives
 * only 4.09:1. It drops to the highest opacity (≤ source) at which the tint over the layout background
 * gives 4.5:1 with 100% text. In the pressed state text is 100% for mouse and keyboard; the CSS
 * pressed rule also sets the colour.
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
  /** Light theme: primary colour background, text 85% black, hover 100%. */
  light: {
    text: hexToRgba(s.primary.light.text, s.primary.light.opacity),
    textHover: hexToRgba(s.primary.light.text, s.primary.light.hoverOpacity),
  },
  /**
   * Dark theme: the background is the solid colour of the source tint (14%, hover 22%, pressed ≤ 28%)
   * laid over the layout background. Resting text is 85% in the source; it rises to the lowest value
   * needed for AA (4.5:1). Hover and pressed text is 100% (including pressed via keyboard).
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

/** Control border width. antd default is 1 px; the source padding calculation subtracts it. */
export const border = {
  width: 1,
} as const;

/**
 * Light and dark theme backgrounds, text, line and status colours. Both themes use the same names.
 * Light backgrounds come from `lightPalette`, dark ones from `darkPalette`, text and status colours from `textPalette`.
 * `panelAlt` is the second surface; in the dark theme it is the elevated background. `ink` is accent and link text.
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
  // Accent text gives at least 4.5:1 on the page, panel, second surface and accent background (tint).
  // The source value is the start; if needed it darkens in the light theme and lightens in the dark theme.
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
    /** Backgrounds the accent text is checked on; the test uses the same list. */
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

/** The light theme page background comes from the source light palette. Contrast is measured on it. */
const LIGHT_SURFACES: string[] = palette.light.inkSurfaces;
const darkenOnLight = (c: string) => LIGHT_SURFACES.reduce((acc, bg) => darkenToContrast(acc, bg), c);

/**
 * Text link colours. In the dark theme the primary colour gives enough contrast.
 * In the light theme the primary colour gives only 2.76:1 on white; WCAG 2.2 AA needs 4.5:1.
 * So the light theme link colour is derived by darkening the primary colour.
 * Buttons and backgrounds use the primary colour as is.
 */
export const link = {
  light: {
    /** No #00aacc text colour in the light theme. Links use the source dark blue accent colour (AJA-997). */
    color: palette.light.ink,
    hover: darkenOnLight(s.primary.hover),
    active: darkenOnLight(s.primary.active),
  },
  dark: { color: palette.dark.ink, hover: s.primary.hover, active: s.primary.active },
} as const;

const WHITE = '#ffffff';

/**
 * Danger button contrast steps: normal, hover and pressed states give at least this ratio.
 * For the solid button it is measured as white text on the background; for other variants as the
 * text colour on the worst background.
 */
export const DANGER_CONTRAST = { normal: 4.5, hover: 5.2, active: 6 } as const;

/**
 * Danger colour. The source file has no danger colour; antd's theme error colour is used.
 * antd red with white text gives 3.27:1 in the light theme and 4.24:1 in the dark theme; WCAG 2.2 AA needs 4.5:1.
 *
 * There are two separate derivations, because antd uses the same `colorError` token for two jobs:
 * - Solid button background: the antd colour is darkened until it gives 4.5:1 with white text (hue kept).
 *   Hover and pressed backgrounds are darker steps of the same hue (5.2:1 and 6:1). Text is white.
 *   These values apply only to the solid button, via CSS variables (`--danger-bg*`).
 * - Text colour (outlined, dashed, text, link, filled and ghost variants): the same antd colour is
 *   darkened in the light theme and lightened in the dark theme until it gives 4.5:1 on every
 *   background the text can sit on. These are the layout, panel, elevated background and antd's
 *   reddish status backgrounds (`colorErrorBg*`, the hover and pressed backgrounds of the text and
 *   filled variants). Hover and pressed text are the 5.2:1 and 6:1 steps in the same direction.
 *   These values go to the antd Button `colorError*` tokens.
 * The dangerous primary button is outside the primary button rules (`src/design/css-variables.ts`).
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
  // Adjusted for each background in turn; since the direction is one-way, the last colour meets the limit on all of them.
  const ink = (minRatio: number) => surfaces.reduce((c, bg) => adjust(c, bg, minRatio), seed);
  return {
    /** Solid button text. */
    solidText: WHITE,
    /** Solid button background: normal, hover, pressed. */
    background,
    backgroundHover: darkenToContrast(background, WHITE, DANGER_CONTRAST.hover),
    backgroundActive: darkenToContrast(background, WHITE, DANGER_CONTRAST.active),
    /** Text colour (non-solid variants): normal, hover, pressed. */
    color: ink(DANGER_CONTRAST.normal),
    colorHover: ink(DANGER_CONTRAST.hover),
    colorActive: ink(DANGER_CONTRAST.active),
    /** Backgrounds the text colour is checked on; the test uses the same list. */
    surfaces,
  };
}

export const danger = {
  light: dangerFor('light'),
  dark: dangerFor('dark'),
} as const;

/**
 * Placeholder text. The antd default is 25% black and 25% white; both are below the AA (4.5:1) limit.
 * The opacity is raised in code to the lowest value giving 4.5:1 on the input background.
 * In the light theme the background is the source light input background; in the dark theme the source input background.
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
 * Description text (antd `colorTextDescription`). The antd `Result` subtitle and similar helper text
 * use this colour. The antd default is 45% black in the light theme (3.29:1 on the layout background)
 * and 45% white in the dark theme (4.47:1); WCAG 2.2 AA needs 4.5:1. The opacity is raised in code to
 * the lowest value giving 4.5:1 on every background the text can sit on. Backgrounds: in the light
 * theme the layout, container and elevated backgrounds (source light palette); in the dark theme the
 * source layout, panel and elevated backgrounds.
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
  // The antd default opacity (rgba(..., 0.45)) is the start.
  const startAlpha = Number(/,\s*([\d.]+)\)$/.exec(t.colorTextDescription)?.[1] ?? 0.45);
  // Background opacity 0: the text sits directly on each background.
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
 * Touch area token. Separate from the visible control size (`sizes`).
 * At least `fine` px with a fine pointer, at least `coarse` px on touch screens (`any-pointer: coarse`).
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
 * Keyboard focus indicator. A surrounding ring is forbidden; the indicator is a single line on the bottom edge.
 * The colour is the accent colour: dark blue in the light theme, the primary colour in the dark theme (AJA-997).
 * The thickness is a project decision (not defined in the source): 2 px.
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

/** antd default alias tokens: spacing, layer order and screen breakpoints. Independent of the algorithm. */
const antdDefaults = antdThemeApi.getDesignToken();

/**
 * Spacing scale. Derived from antd alias tokens; components do not write numbers.
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

/** Layer order. The dim layer sits just below the antd popup layer; the opening element is on the antd layer. */
export const layer = {
  popupBase: antdDefaults.zIndexPopupBase,
  dimOverlay: antdDefaults.zIndexPopupBase - 1,
  dimSource: antdDefaults.zIndexPopupBase,
} as const;

/** Reading width and content breakpoints (antd screen breakpoints). */
export const layout = {
  contentMaxWidth: antdDefaults.screenLG,
  screenSM: antdDefaults.screenSM,
  screenMD: antdDefaults.screenMD,
  screenLG: antdDefaults.screenLG,
  screenXL: antdDefaults.screenXL,
  sidebarWidth: s.sidebar.widthExpanded,
  sidebarRailWidth: s.sidebar.widthCollapsed,
  cardPadding: s.cards.padding,
  /** Shell sizes (approved draft): menu, assistant panel, phone bottom bar, narrow menu and icon. */
  menuWidth: s.layoutTokens.menuWidth,
  assistWidth: s.layoutTokens.assistWidth,
  barHeight: s.layoutTokens.barHeight,
  railWidth: s.layoutTokens.railWidth,
  iconSize: s.layoutTokens.iconSize,
  /** Narrow form column (login, password, short settings). Derived from the source scale: 10 mid button heights = 420 px. */
  formMaxWidth: sizes.button.md.height * 10,
  /**
   * Sticky top bar of the phone shell: a mid button plus the smallest gap above and below (42 + 2 × 4 px).
   * The page scroll padding (`scroll-padding-top`) is this value, so a focused element is not hidden under the bar.
   */
  topbarHeight: sizes.button.md.height + 2 * space.xxs,
} as const;

/**
 * Minimum table column widths (by content type). Columns do not squeeze; the table scrolls
 * horizontally in its own container. Values are derived from the button scale: md height 42 px.
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

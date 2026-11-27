/**
 * Builds the CSS variables and base style rules from the source decisions.
 * The source `derived.css` is the starting point; the same names are kept here and
 * light/dark values are split into the right blocks.
 */
import { readCspNonce } from './csp-nonce';
import { dropdownAnimation, duration, easing, instantMs } from './motion';
import type { ThemeMode } from './source';
import {
  danger,
  darkPalette,
  layer,
  layout,
  space,
  table,
  focusDim,
  focusIndicator,
  fontFamily,
  fontWeight,
  hitArea,
  hitTarget,
  link,
  palette,
  primary,
  textDescription,
  radius,
  shadowsFor,
  sizes,
  typography,
} from './tokens';

const px = (n: number) => `${n}px`;
const ms = (n: number) => `${n}ms`;

function block(selector: string, lines: Record<string, string>): string {
  const body = Object.entries(lines)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  return `${selector} {\n${body}\n}`;
}

/** Background, text, line, status, link and focus colours. Light and dark themes produce the same names. */
function paletteVars(mode: ThemeMode): Record<string, string> {
  const p = palette[mode];
  return {
    '--color-bg-layout': p.layout,
    '--color-bg-panel': p.panel,
    '--color-bg-panel-alt': p.panelAlt,
    '--color-bg-elevated': p.elevated,
    '--color-bg-input': p.input,
    '--color-bg-button': p.button,
    '--color-bg-button-hover': p.buttonHover,
    '--color-text': p.text,
    '--color-text-quiet': p.textQuiet,
    '--color-text-secondary': textDescription[mode].color,
    '--color-line': p.line,
    '--color-ink': p.ink,
    '--color-tint': p.tint,
    '--color-ok': p.ok,
    '--color-warn': p.warn,
    '--color-draft-bg': p.draftBg,
    '--color-draft-text': p.draftText,
    '--color-link': link[mode].color,
    '--color-link-hover': link[mode].hover,
    '--color-link-active': link[mode].active,
    '--focus-indicator-color': focusIndicator[mode].color,
  };
}

function shadowVars(mode: ThemeMode): Record<string, string> {
  const sh = shadowsFor(mode);
  return {
    '--shadow-card': sh.card,
    '--shadow-button': sh.button,
    '--shadow-input': sh.input,
    '--shadow-dropdown': sh.dropdown,
  };
}

/** Theme-independent variables. */
export function rootVariables(): Record<string, string> {
  const { button, input } = sizes;
  return {
    '--font-ui': fontFamily.ui,
    '--font-code': fontFamily.code,
    '--font-min': px(typography.min),
    '--font-default': px(typography.default),
    '--font-body': px(typography.default),
    '--font-h1': px(typography.headings.h1),
    '--font-h2': px(typography.headings.h2),
    '--font-h3': px(typography.headings.h3),
    '--control-h-sm': px(button.sm.height),
    '--control-h-md': px(button.md.height),
    '--control-h-lg': px(button.lg.height),
    '--btn-h-sm': px(button.sm.height),
    '--btn-fs-sm': px(button.sm.fontSize),
    '--btn-lh-sm': px(button.sm.lineBox),
    '--input-h-sm': px(input.sm.height),
    '--input-fs-sm': px(input.sm.fontSize),
    '--input-lh-sm': px(input.sm.lineBox),
    '--btn-h-md': px(button.md.height),
    '--btn-fs-md': px(button.md.fontSize),
    '--btn-lh-md': px(button.md.lineBox),
    '--input-h-md': px(input.md.height),
    '--input-fs-md': px(input.md.fontSize),
    '--input-lh-md': px(input.md.lineBox),
    '--btn-h-lg': px(button.lg.height),
    '--btn-fs-lg': px(button.lg.fontSize),
    '--btn-lh-lg': px(button.lg.lineBox),
    '--input-h-lg': px(input.lg.height),
    '--input-fs-lg': px(input.lg.fontSize),
    '--input-lh-lg': px(input.lg.lineBox),
    '--font-weight-sm': String(fontWeight.sm),
    '--font-weight-md': String(fontWeight.md),
    '--font-weight-lg': String(fontWeight.lg),
    '--color-primary': primary.color,
    '--color-primary-hover': primary.hover,
    '--color-primary-active': primary.active,
    '--primary-text': primary.light.text,
    '--primary-text-hover': primary.light.textHover,
    '--danger-text': danger.light.solidText,
    '--danger-bg': danger.light.background,
    '--danger-bg-hover': danger.light.backgroundHover,
    '--danger-bg-active': danger.light.backgroundActive,
    '--radius': px(radius.control),
    '--card-radius': px(radius.card),
    '--hit-expand': String(hitArea.expand),
    '--hit-min-target': px(hitArea.minTarget),
    '--hit-target': px(hitTarget.fine),
    '--focus-indicator-size': px(focusIndicator.size),
    '--focus-dim-color': focusDim.light.color,
    '--focus-dim-transparent': focusDim.light.transparent,
    '--focus-dim-blur': px(focusDim.blur),
    '--motion-easing-standard': easing.standard,
    '--motion-easing-dropdown': easing.dropdown,
    '--motion-easing-owl-pop': easing.owlPop,
    '--motion-easing-glide': easing.glide,
    '--motion-easing-linear': easing.linear,
    '--motion-duration-fast': ms(duration.fast),
    '--motion-duration-mid': ms(duration.mid),
    '--motion-duration-slow': ms(duration.slow),
    '--motion-duration-dropdown': ms(duration.dropdown),
    '--motion-duration-focus-dim': ms(duration.focusDim),
    '--motion-duration-flyout': ms(duration.flyout),
    '--motion-duration-rail': ms(duration.rail),
    '--motion-duration-owl-pop': ms(duration.owlPop),
    '--motion-duration-glide': ms(duration.glide),
    '--motion-duration-glide-fade': ms(duration.glideFade),
    '--motion-duration-skeleton': ms(duration.skeleton),
    '--motion-duration-spin': ms(duration.spin),
    '--motion-duration-instant': ms(instantMs),
    '--space-xxs': px(space.xxs),
    '--space-xs': px(space.xs),
    '--space-sm': px(space.sm),
    '--space-md': px(space.md),
    '--space-lg': px(space.lg),
    '--space-xl': px(space.xl),
    '--space-xxl': px(space.xxl),
    '--z-popup-base': String(layer.popupBase),
    '--z-dim-overlay': String(layer.dimOverlay),
    '--z-dim-source': String(layer.dimSource),
    '--content-max-width': px(layout.contentMaxWidth),
    '--form-max-width': px(layout.formMaxWidth),
    '--topbar-height': px(layout.topbarHeight),
    '--sidebar-width': px(layout.sidebarWidth),
    '--sidebar-rail-width': px(layout.sidebarRailWidth),
    '--card-padding': px(layout.cardPadding),
    '--menu-width': px(layout.menuWidth),
    '--assist-width': px(layout.assistWidth),
    '--bar-height': px(layout.barHeight),
    '--rail-width': px(layout.railWidth),
    '--icon-size': px(layout.iconSize),
    '--table-col-min-action': px(table.columnMinWidth.action),
    '--table-col-min-number': px(table.columnMinWidth.number),
    '--table-col-min-date': px(table.columnMinWidth.date),
    '--table-col-min-text': px(table.columnMinWidth.text),
    '--table-col-min-title': px(table.columnMinWidth.title),
    ...paletteVars('light'),
    ...shadowVars('light'),
  };
}

/** Variables that change only in the dark theme. */
export function darkVariables(): Record<string, string> {
  return {
    '--primary-text': primary.dark.text,
    '--primary-text-hover': primary.dark.textHover,
    '--danger-text': danger.dark.solidText,
    '--danger-bg': danger.dark.background,
    '--danger-bg-hover': danger.dark.backgroundHover,
    '--danger-bg-active': danger.dark.backgroundActive,
    '--primary-bg': primary.dark.background,
    '--primary-bg-hover': primary.dark.backgroundHover,
    '--primary-bg-active': primary.dark.backgroundActive,
    '--bg-layout': darkPalette.layout,
    '--bg-panel': darkPalette.panel,
    '--bg-elevated': darkPalette.elevated,
    '--bg-input': darkPalette.input,
    '--bg-button': darkPalette.button,
    '--focus-dim-color': focusDim.dark.color,
    '--focus-dim-transparent': focusDim.dark.transparent,
    ...paletteVars('dark'),
    ...shadowVars('dark'),
  };
}

/** Line box and height fixes from the source (same as derived.css). */
function controlFixCss(): string {
  const { button, input } = sizes;
  return [
    '/* Input satır kutusu = fontSize + 8; yükseklik sistem boyutuna sabit */',
    `.ant-input, .ant-input-affix-wrapper, .ant-input-affix-wrapper > input.ant-input { line-height: ${px(input.md.lineBox)}; }`,
    `.ant-input-sm, .ant-input-affix-wrapper.ant-input-affix-wrapper-sm, .ant-input-affix-wrapper-sm > input.ant-input { line-height: ${px(input.sm.lineBox)}; }`,
    `.ant-input-lg, .ant-input-affix-wrapper.ant-input-affix-wrapper-lg, .ant-input-affix-wrapper-lg > input.ant-input { line-height: ${px(input.lg.lineBox)}; }`,
    `.ant-input-affix-wrapper { height: ${px(input.md.height)}; }`,
    `.ant-input-affix-wrapper.ant-input-affix-wrapper-sm { height: ${px(input.sm.height)}; }`,
    `.ant-input-affix-wrapper.ant-input-affix-wrapper-lg { height: ${px(input.lg.height)}; }`,
    `.ant-select-sm .ant-select-selection-item, .ant-select-sm .ant-select-selection-placeholder { font-size: ${px(input.sm.fontSize)}; }`,
    `.ant-btn { font-size: ${px(button.md.fontSize)}; line-height: ${px(button.md.lineBox)}; }`,
    `.ant-btn.ant-btn-sm { font-size: ${px(button.sm.fontSize)}; line-height: ${px(button.sm.lineBox)}; }`,
    `.ant-btn.ant-btn-lg { font-size: ${px(button.lg.fontSize)}; line-height: ${px(button.lg.lineBox)}; }`,
    '.ant-btn:not(:disabled):active, .ant-btn.ant-dropdown-open { box-shadow: none; }',
    '/* Aramasız Select açıkken seçili metin solmaz: yazma yoktur, değer okunur kalır (AA). */',
    '.ant-select-single:not(.ant-select-show-search).ant-select-open .ant-select-selection-item { color: inherit; }',
    '/* Soluk yazı (Typography type="secondary") tema sarmalayıcısı dışında da 4.5:1 verir (AJA-1007). */',
    ':root .ant-typography.ant-typography-secondary { color: var(--color-text-secondary); }',
    '/* Seçili kenarlıklı radyo düğmesi yazısını colorPrimary tokenından alır. Yazı vurgu rengidir (AJA-1007). */',
    '/* Dolu (solid) grupta zemin birincil renktir; yazısı antd kuralında kalır. */',
    ':not(.ant-radio-group-solid) > .ant-radio-button-wrapper-checked:not(.ant-radio-button-wrapper-disabled) { color: var(--color-ink); }',
    '/* Fare üstü ve basılı radyo düğmesi yazısı colorPrimary ve colorPrimaryHover alır (2.5:1). Yazı bağlantı rengidir (AJA-1023). */',
    ':not(.ant-radio-group-solid) > .ant-radio-button-wrapper:not(.ant-radio-button-wrapper-disabled):hover { color: var(--color-link-hover); }',
    ':not(.ant-radio-group-solid) > .ant-radio-button-wrapper:not(.ant-radio-button-wrapper-disabled):active { color: var(--color-link-active); }',
    '.ant-btn, .ant-input, .ant-select-selection-item { font-weight: var(--font-weight-md); }',
    '.ant-btn-sm, .ant-input-sm, .ant-input-affix-wrapper-sm .ant-input, .ant-select-sm .ant-select-selection-item { font-weight: var(--font-weight-sm); }',
    '.ant-btn-lg, .ant-input-lg, .ant-input-affix-wrapper-lg .ant-input, .ant-select-lg .ant-select-selection-item { font-weight: var(--font-weight-lg); }',
  ].join('\n');
}

/**
 * Primary button text and dark theme background (source: primary.light / primary.dark; the dark
 * background is a solid colour). The dangerous primary button (`danger`) also has the
 * `ant-btn-primary` class; the rules leave it out. The solid danger button takes its background from
 * the `--danger-bg*` variables and its text from `--danger-text`. In this project antd's
 * `colorError*` tokens are text colours (tokens.ts: danger); the solid background is kept apart from
 * those tokens so that outlined, text and link variants give 4.5:1 text.
 */
function primaryButtonCss(): string {
  const primary = '.ant-btn-primary:not(.ant-btn-dangerous):not(:disabled):not(.ant-btn-disabled)';
  const dangerSolid = '.ant-btn-dangerous.ant-btn-variant-solid:not(:disabled):not(.ant-btn-disabled)';
  return [
    `${primary} { color: var(--primary-text); }`,
    `${primary}:hover { color: var(--primary-text-hover); }`,
    `[data-theme="dark"] ${primary} { background: var(--primary-bg); color: var(--primary-text); }`,
    `[data-theme="dark"] ${primary}:hover { background: var(--primary-bg-hover); color: var(--primary-text-hover); }`,
    '/* Basılı: klavyeyle (Space) basılınca üzerine gelme yoktur; metin yine %100 olur (AA). */',
    `[data-theme="dark"] ${primary}:active { background: var(--primary-bg-active); color: var(--primary-text-hover); }`,
    '/* Düz tehlike düğmesi: zemin kendi basamaklarından gelir; antd düz düğmenin üzerine gelme metnini primaryColor yapar, burada beyaz kalır. */',
    `${dangerSolid} { background: var(--danger-bg); color: var(--danger-text); }`,
    `${dangerSolid}:hover { background: var(--danger-bg-hover); color: var(--danger-text); }`,
    `${dangerSolid}:active { background: var(--danger-bg-active); color: var(--danger-text); }`,
  ].join('\n');
}

/**
 * Focus indicator. A surrounding ring is forbidden. The indicator is a single line on the bottom edge.
 * Visible focus mode is turned on only by the keyboard: `html[data-focus-mode="keyboard"]`.
 */
/**
 * Text link selector. Links styled as buttons, menus and tabs are excluded (derived decision 3).
 * Features with their own menu component give the link the `data-nav-link` attribute (e.g. the shell menu).
 */
const TEXT_LINK = 'a:not(.ant-btn):not(.ant-menu-item):not(.ant-tabs-tab):not([data-nav-link])';

function focusCss(): string {
  const on = 'html[data-focus-mode="keyboard"]';
  const bar = 'inset 0 calc(var(--focus-indicator-size) * -1) 0 0 var(--focus-indicator-color)';
  return [
    '/* Çevreleyen odak halkası yasak: tarayıcı ve antd outline kapalı. Gösterge aşağıda. */',
    ':focus { outline: none; }',
    ':focus-visible { outline: none; }',
    '/* antd düğme kuralı 0 px solid bırakır; stil de kapatılır (hesaplanmış outline-style: none). */',
    '.ant-btn.ant-btn:not(:disabled):focus-visible, .ant-btn.ant-btn:focus-visible { outline: none; }',
    '/* Radyo düğmesi: giriş görünmezdir; antd odağı görünen etikete outline olarak çizer. Kapatılır. */',
    '.ant-radio-button-wrapper.ant-radio-button-wrapper:has(:focus-visible) { outline: none; }',
    `${on} :focus-visible { box-shadow: ${bar}; }`,
    '/* Odaklı metin bağlantısı: seçici metin bağlantısı kuralından daha özgüldür; kalınlık ve renk ezilmez. Menü bağlantısı (data-nav-link) kendi tek göstergesini taşır. */',
    `${on} ${TEXT_LINK}:focus-visible { box-shadow: none; text-decoration: underline; text-decoration-thickness: var(--focus-indicator-size); text-underline-offset: 0.2em; text-decoration-color: var(--focus-indicator-color); }`,
    `${on} [data-nav-link]:focus-visible { box-shadow: none; }`,
    `${on} .ant-btn:focus-visible { box-shadow: var(--shadow-button), ${bar}; }`,
    `${on} .ant-input:focus-visible, ${on} .ant-input-affix-wrapper:focus-within { box-shadow: var(--shadow-input), ${bar}; }`,
    `${on} .ant-input-affix-wrapper > .ant-input:focus-visible { box-shadow: none; }`,
    `${on} .ant-select.ant-select.ant-select-focused:not(.ant-select-disabled):not(.ant-select-customize-input) .ant-select-selector, ${on} .ant-select.ant-select.ant-select:focus-within:not(.ant-select-disabled):not(.ant-select-customize-input) .ant-select-selector { box-shadow: var(--shadow-input), ${bar}; }`,
    `${on} .ant-select .ant-select-selection-search-input:focus-visible { box-shadow: none; }`,
    `${on} .ant-checkbox-input:focus-visible, ${on} .ant-radio-input:focus-visible, ${on} .ant-radio-button-input:focus-visible { box-shadow: none; }`,
    `${on} .ant-checkbox-wrapper:focus-within, ${on} .ant-radio-wrapper:focus-within, ${on} .ant-radio-button-wrapper.ant-radio-button-wrapper:has(:focus-visible), ${on} .ant-switch:focus-visible, ${on} .ant-segmented-item:focus-within { box-shadow: ${bar}; }`,
    '/* Yüksek kontrast: gölge çizilmez; yalnız 2 px CanvasText outline. antd kurallarından daha özgül seçiciler. */',
    '@media (forced-colors: active) {',
    `  ${on} :focus-visible, ${on} .ant-btn:not(:disabled):focus-visible, ${on} .ant-btn.ant-btn:focus-visible { outline: 2px solid CanvasText; outline-offset: 0; box-shadow: none; }`,
    `  ${on} .ant-input-affix-wrapper.ant-input-affix-wrapper:focus-within, ${on} .ant-select.ant-select.ant-select-focused:not(.ant-select-disabled):not(.ant-select-customize-input) .ant-select-selector, ${on} .ant-select.ant-select.ant-select:focus-within:not(.ant-select-disabled):not(.ant-select-customize-input) .ant-select-selector, ${on} .ant-checkbox-wrapper:focus-within, ${on} .ant-radio-wrapper:focus-within, ${on} .ant-radio-button-wrapper.ant-radio-button-wrapper:has(:focus-visible), ${on} .ant-segmented-item:focus-within { outline: 2px solid CanvasText; outline-offset: 0; }`,
    `  ${on} .ant-input-affix-wrapper.ant-input-affix-wrapper > .ant-input.ant-input:focus-visible, ${on} .ant-input-affix-wrapper.ant-input-affix-wrapper > .ant-input.ant-input:focus, ${on} .ant-select .ant-select-selection-search-input:focus-visible, ${on} .ant-select .ant-select-selection-search-input:focus, ${on} .ant-checkbox-input:focus-visible, ${on} .ant-radio-input:focus-visible, ${on} .ant-radio-button-input:focus-visible, ${on} .ant-segmented-item-input:focus-visible { outline: none; }`,
    '}',
  ].join('\n');
}

/**
 * Dropdown opening motion (source: dropdown.animation). The Controls task uses this name.
 * The curve is the default curve; the duration is the short dropdown duration (AJA-997). There is no tilt.
 */
function dropdownMotionCss(): string {
  const frames = Object.entries(dropdownAnimation.keyframes).map(([at, rule]) => `  ${at} { ${rule}; }`);
  return [`@keyframes atonota-dropdown-in {`, ...frames, `}`].join('\n');
}

/** On touch screens the touch area token grows. The visible control size does not change. */
function hitTargetCss(): string {
  return `@media (any-pointer: coarse) { :root { --hit-target: ${px(hitTarget.coarse)}; } }`;
}

function reducedMotionCss(): string {
  return [
    '/* Azaltılmış hareket: geçiş ve animasyon tamamen durur. Süre 0 s olur; 0.01 ms gibi kısa bir',
    '   geçiş bile açılır panel konum ölçümünü (getBoundingClientRect) ara değerde yakalar. */',
    '@media (prefers-reduced-motion: reduce) {',
    '  *, *::before, *::after {',
    '    animation-duration: 0s !important;',
    '    animation-delay: 0s !important;',
    '    animation-iteration-count: 1 !important;',
    '    transition-duration: 0s !important;',
    '    transition-delay: 0s !important;',
    '    scroll-behavior: auto !important;',
    '  }',
    '}',
  ].join('\n');
}

function baseCss(): string {
  return [
    'html { font-family: var(--font-ui); font-size: 100%; -webkit-text-size-adjust: 100%; }',
    'body { margin: 0; font-family: var(--font-ui); font-size: var(--font-body); line-height: calc(var(--font-body) + 8px); min-width: 320px; }',
    '/* Tablolar kendi kapsayıcısında kayar; başlık ve ilk sütun sözcük ortasından bölünmez. */',
    '[data-scroll-x] { overflow-x: auto; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; }',
    '.ant-table-thead > tr > th, .ant-table-tbody > tr > td:first-child { word-break: normal; overflow-wrap: normal; white-space: nowrap; }',
    'code, kbd, pre, samp { font-family: var(--font-code); }',
    '*, *::before, *::after { box-sizing: border-box; }',
    'img, svg, video { max-width: 100%; height: auto; }',
    '/* Metin bağlantıları altı çizilidir: renk tek ayırt edici olmaz (WCAG 1.4.1). */',
    '/* Özgüllük (0,3,1) antd\'nin `a { text-decoration: none }` kuralını geçer; `:where()` ile sıfırlanırsa antd kazanır. */',
    `${TEXT_LINK} { text-decoration: underline; text-underline-offset: 0.15em; }`,
  ].join('\n');
}

export const DESIGN_STYLE_ID = 'atonota-design';

/** All design CSS: variables, base rules, focus, touch area, motion. */
export function buildDesignCss(): string {
  return [
    block(':root', rootVariables()),
    block('[data-theme="dark"]', darkVariables()),
    baseCss(),
    controlFixCss(),
    primaryButtonCss(),
    focusCss(),
    hitArea.css,
    hitTargetCss(),
    dropdownMotionCss(),
    reducedMotionCss(),
  ].join('\n\n');
}

/** Adds the CSS to the document once. A repeat call updates the same element. */
export function ensureDesignStyles(doc: Document = document): HTMLStyleElement {
  let el = doc.getElementById(DESIGN_STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = doc.createElement('style');
    el.id = DESIGN_STYLE_ID;
    // If the server gave a CSP nonce, the style element carries it too (src/app/csp-nonce.ts).
    const nonce = readCspNonce(doc);
    if (nonce) el.nonce = nonce;
    doc.head.appendChild(el);
  }
  const css = buildDesignCss();
  if (el.textContent !== css) {
    el.textContent = css;
  }
  return el;
}

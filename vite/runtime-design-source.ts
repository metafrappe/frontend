import source from '../design/source/control-size-config.json' with { type: 'json' };

const { defaultColor, defaultHoverColor } = source.derived.antdTheme.components.Button;
// Karar metinleri (decision) çalışma verisine girmez.
const { decision: _lightPaletteDecision, ...lightPalette } = source.lightPalette;
const { decision: _layoutDecision, ...layoutTokens } = source.layoutTokens;

// Keep documentation, examples, and test fixtures out of the runtime design data.
export const runtimeDesignSource = {
  typography: {
    min: source.typography.min,
    default: source.typography.default,
    headings: source.typography.headings,
  },
  primary: source.primary,
  lightPalette,
  textPalette: { light: source.textPalette.light, dark: source.textPalette.dark },
  layoutTokens,
  radius: { default: source.radius.default, tokens: source.radius.tokens },
  sizes: { sm: source.sizes.sm, md: source.sizes.md, lg: source.sizes.lg },
  fontWeight: {
    sm: source.fontWeight.sm,
    md: source.fontWeight.md,
    lg: source.fontWeight.lg,
    lgFallback: source.fontWeight.lgFallback,
  },
  darkPalette: source.darkPalette,
  cards: { radius: source.cards.radius, padding: source.cards.padding },
  hitArea: {
    expand: source.hitArea.expand,
    minTarget: source.hitArea.minTarget,
    css: source.hitArea.css,
    rules: source.hitArea.rules,
    target: { fine: source.hitArea.target.fine, coarse: source.hitArea.target.coarse },
  },
  focusDim: source.focusDim,
  choice: {
    checkbox: source.choice.checkbox,
    radio: source.choice.radio,
    switch: source.choice.switch,
    tabs: source.choice.tabs,
    tag: source.choice.tag,
  },
  sidebar: {
    widthExpanded: source.sidebar.widthExpanded,
    widthCollapsed: source.sidebar.widthCollapsed,
    item: source.sidebar.item,
    flyout: source.sidebar.flyout,
    railToggle: { motion: source.sidebar.railToggle.motion },
  },
  dropdown: {
    defaultStyle: source.dropdown.defaultStyle,
    animation: source.dropdown.animation,
    styles: source.dropdown.styles,
    joinedItems: { value: source.dropdown.joinedItems.value },
    attachedSelect: { value: source.dropdown.attachedSelect.value },
    attachedButton: { value: source.dropdown.attachedButton.value },
  },
  owlAssist: {
    badge: { animation: source.owlAssist.badge.animation },
    dwell: source.owlAssist.dwell,
  },
  derived: {
    antdTheme: { components: { Button: { defaultColor, defaultHoverColor } } },
    shadowCss: source.derived.shadowCss,
    shadowCssDark: source.derived.shadowCssDark,
  },
};

/**
 * Builds the antd theme from the source decisions. Light and dark themes come from the same tokens.
 * The starting point is the source `derived.antdTheme` object; the test compares against it.
 */
import { theme as antdTheme, type ThemeConfig } from 'antd';

import { duration, easing, seconds } from './motion';
import { designSource, type ThemeMode } from './source';
import {
  border,
  danger,
  darkPalette,
  fontFamily,
  fontWeight,
  link,
  palette,
  placeholder,
  primary,
  radius,
  shadowsFor,
  sizes,
  textDescription,
  typography,
} from './tokens';

export interface BuildThemeOptions {
  /** antd motion turns off while `prefers-reduced-motion: reduce` is on. */
  reducedMotion?: boolean;
}

const derivedButton = designSource.derived.antdTheme.components.Button;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildAntdTheme(mode: ThemeMode, options: BuildThemeOptions = {}): ThemeConfig {
  const dark = mode === 'dark';
  const shadow = shadowsFor(mode);
  const { button, input } = sizes;

  const token: NonNullable<ThemeConfig['token']> = {
    colorPrimary: primary.color,
    colorPrimaryHover: primary.hover,
    colorPrimaryActive: primary.active,
    colorLink: link[mode].color,
    colorLinkHover: link[mode].hover,
    colorLinkActive: link[mode].active,
    colorInfo: primary.color,
    // Primary and info text use the accent colour (AJA-997, QA AJA-1007). antd derives them from
    // colorPrimary, which gives #00aacc text in the light theme (2.76:1). The link colour values are used.
    colorPrimaryText: link[mode].color,
    colorPrimaryTextHover: link[mode].hover,
    colorPrimaryTextActive: link[mode].active,
    colorInfoText: link[mode].color,
    colorInfoTextHover: link[mode].hover,
    colorInfoTextActive: link[mode].active,
    // Muted text (Typography type="secondary"): same as description text, 4.5:1 on every background.
    colorTextSecondary: textDescription[mode].color,
    colorTextPlaceholder: placeholder[mode],
    colorTextDescription: textDescription[mode].color,
    fontFamily: fontFamily.ui,
    fontFamilyCode: fontFamily.code,
    fontSize: typography.default,
    fontSizeSM: typography.min,
    fontSizeLG: input.lg.fontSize,
    lineHeight: typography.lineHeightRatioFor(typography.default),
    lineHeightSM: typography.lineHeightRatioFor(typography.min),
    lineHeightLG: typography.lineHeightRatioFor(input.lg.fontSize),
    fontWeightStrong: fontWeight.strong,
    controlHeight: button.md.height,
    controlHeightSM: button.sm.height,
    controlHeightLG: button.lg.height,
    borderRadius: radius.control,
    borderRadiusSM: Math.max(radius.control - 1, 2),
    borderRadiusLG: radius.control + 2,
    boxShadowSecondary: shadow.dropdown,
    lineWidth: border.width,
    // Focus: a surrounding ring or frame is forbidden. CSS draws the indicator as an underline.
    lineWidthFocus: 0,
    controlOutlineWidth: 0,
    controlOutline: 'transparent',
    // Motion: all curves come from the central tokens.
    motion: !options.reducedMotion,
    motionDurationFast: seconds(duration.fast),
    motionDurationMid: seconds(duration.mid),
    motionDurationSlow: seconds(duration.slow),
    motionEaseInOut: easing.standard,
    motionEaseInOutCirc: easing.standard,
    motionEaseOut: easing.standard,
    motionEaseOutCirc: easing.standard,
    motionEaseOutBack: easing.standard,
    motionEaseInBack: easing.standard,
    motionEaseInQuint: easing.standard,
    motionEaseOutQuint: easing.standard,
  };

  if (!dark) {
    // Light theme backgrounds come from the source light palette; built from the same tokens as the dark theme.
    Object.assign(token, {
      colorBgLayout: palette.light.layout,
      colorBgContainer: palette.light.panel,
      colorBgElevated: palette.light.elevated,
    });
  }

  if (dark) {
    Object.assign(token, {
      colorBgLayout: darkPalette.layout,
      colorBgContainer: darkPalette.panel,
      colorBgElevated: darkPalette.elevated,
      colorBorder: darkPalette.border,
      colorBorderSecondary: darkPalette.borderSecondary,
      colorSplit: darkPalette.borderSecondary,
    });
  }

  const components: NonNullable<ThemeConfig['components']> = {
    Button: {
      controlHeight: button.md.height,
      controlHeightSM: button.sm.height,
      controlHeightLG: button.lg.height,
      contentFontSize: button.md.fontSize,
      contentFontSizeSM: button.sm.fontSize,
      contentFontSizeLG: button.lg.fontSize,
      contentLineHeight: round2(button.md.lineBox / button.md.fontSize),
      contentLineHeightSM: round2(button.sm.lineBox / button.sm.fontSize),
      contentLineHeightLG: round2(button.lg.lineBox / button.lg.fontSize),
      fontWeight: fontWeight.md,
      primaryShadow: shadow.button,
      defaultShadow: shadow.button,
      dangerShadow: shadow.button,
      primaryColor: dark ? primary.dark.text : primary.light.text,
      // Danger button (tokens.ts: danger). antd uses the `colorError*` tokens as the background of the
      // solid button and as the text colour of other variants. Here they get the text colour: at least
      // 4.5:1 on every background. The solid button background comes from the `--danger-bg*` CSS
      // variables (css-variables.ts); its text is white.
      dangerColor: danger[mode].solidText,
      colorError: danger[mode].color,
      colorErrorHover: danger[mode].colorHover,
      colorErrorActive: danger[mode].colorActive,
      ...(dark
        ? {
            defaultBg: darkPalette.button,
            defaultHoverBg: darkPalette.buttonHover,
            defaultActiveBg: darkPalette.buttonHover,
            defaultBorderColor: darkPalette.buttonBorder,
            defaultHoverBorderColor: darkPalette.buttonBorder,
            defaultActiveBorderColor: darkPalette.buttonBorder,
            defaultColor: derivedButton.defaultColor,
            defaultHoverColor: derivedButton.defaultHoverColor,
          }
        : {
            // In antd the hover and pressed text of the outlined button is colorPrimaryHover and
            // colorPrimaryActive (2.5:1 on white). The text uses the link colour; the border keeps the
            // antd rule (AJA-1023).
            defaultHoverColor: link.light.hover,
            defaultActiveColor: link.light.active,
          }),
    },
    Input: {
      controlHeight: input.md.height,
      controlHeightSM: input.sm.height,
      controlHeightLG: input.lg.height,
      inputFontSize: input.md.fontSize,
      inputFontSizeSM: input.sm.fontSize,
      inputFontSizeLG: input.lg.fontSize,
      paddingBlock: input.md.paddingBlock,
      paddingBlockSM: input.sm.paddingBlock,
      paddingBlockLG: input.lg.paddingBlock,
      ...(dark ? { colorBgContainer: darkPalette.input, activeBg: darkPalette.input, hoverBg: darkPalette.input } : {}),
    },
    InputNumber: dark
      ? { colorBgContainer: darkPalette.input, activeBg: darkPalette.input, hoverBg: darkPalette.input }
      : {},
    Select: {
      controlHeight: input.md.height,
      controlHeightSM: input.sm.height,
      controlHeightLG: input.lg.height,
      fontSize: input.md.fontSize,
      fontSizeLG: input.lg.fontSize,
      optionFontSize: input.md.fontSize,
      ...(dark ? { selectorBg: darkPalette.input, colorBgContainer: darkPalette.input } : {}),
    },
    Dropdown: { fontSize: typography.default },
    /** Table text is the smallest text: 14 px (model section 4). Body stays 16 px. */
    Table: { fontSize: typography.min },
    Card: { borderRadiusLG: radius.card },
  };

  return {
    cssVar: { key: 'atonota' },
    hashed: false,
    algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token,
    components,
  };
}

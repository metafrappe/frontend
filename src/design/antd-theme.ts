/**
 * antd temasını kaynak kararlardan üretir. Açık ve koyu tema aynı tokenlardan çıkar.
 * Başlangıç noktası kaynaktaki `derived.antdTheme` nesnesidir; test bununla karşılaştırır.
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
  /** `prefers-reduced-motion: reduce` açıkken antd hareketi kapanır. */
  reducedMotion?: boolean;
}

const anchorAllSizes = {
  borderRadius: radius.control,
  borderRadiusSM: radius.control,
  borderRadiusLG: radius.control,
};

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
    // Birincil ve bilgi yazısı vurgu rengidir (AJA-997, QA AJA-1007). antd bunları colorPrimary'den
    // türetir; açık temada #00aacc yazı olur (2.76:1). Bağlantı renkleriyle aynı değerler kullanılır.
    colorPrimaryText: link[mode].color,
    colorPrimaryTextHover: link[mode].hover,
    colorPrimaryTextActive: link[mode].active,
    colorInfoText: link[mode].color,
    colorInfoTextHover: link[mode].hover,
    colorInfoTextActive: link[mode].active,
    // Soluk yazı (Typography type="secondary"): açıklama metniyle aynı, her zeminde 4.5:1.
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
    borderRadiusXS: radius.micro,
    borderRadiusSM: radius.control,
    borderRadiusLG: radius.menu,
    borderRadiusOuter: radius.control,
    boxShadowSecondary: shadow.dropdown,
    lineWidth: border.width,
    // Odak: çevreleyen halka ve çerçeve yasak. Gösterge CSS'te alt çizgi olarak verilir.
    lineWidthFocus: 0,
    controlOutlineWidth: 0,
    controlOutline: 'transparent',
    // Hareket: bütün eğriler merkezi tokendan gelir.
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
    // Açık tema zeminleri kaynaktaki açık paletten gelir; koyu tema ile aynı tokenlardan üretilir.
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
      ...anchorAllSizes,
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
      // Tehlike düğmesi (tokens.ts: danger). antd `colorError*` tokenlarını düz düğmede zemin, diğer
      // türlerde yazı rengi yapar. Burada yazı rengi verilir: her zeminde en az 4.5:1. Düz düğmenin
      // zemini `--danger-bg*` CSS değişkenlerinden gelir (css-variables.ts); metni beyazdır.
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
            // Kenarlıklı düğmenin fare üstü ve basılı yazısı antd'de colorPrimaryHover ve colorPrimaryActive
            // olur (beyazda 2.5:1). Yazı bağlantı rengidir; kenarlık antd kuralında kalır (AJA-1023).
            defaultHoverColor: link.light.hover,
            defaultActiveColor: link.light.active,
          }),
    },
    Input: {
      ...anchorAllSizes,
      controlHeight: input.md.height,
      controlHeightSM: input.sm.height,
      controlHeightLG: input.lg.height,
      inputFontSize: input.md.fontSize,
      inputFontSizeSM: input.sm.fontSize,
      inputFontSizeLG: input.lg.fontSize,
      paddingBlock: input.md.paddingBlock,
      paddingBlockSM: input.sm.paddingBlock,
      paddingBlockLG: input.lg.paddingBlock,
      ...(dark
        ? {
            colorBgContainer: darkPalette.input,
            activeBg: darkPalette.input,
            hoverBg: darkPalette.input,
          }
        : {}),
    },
    InputNumber: {
      ...anchorAllSizes,
      ...(dark
        ? {
            colorBgContainer: darkPalette.input,
            activeBg: darkPalette.input,
            hoverBg: darkPalette.input,
          }
        : {}),
    },
    Select: {
      ...anchorAllSizes,
      controlHeight: input.md.height,
      controlHeightSM: input.sm.height,
      controlHeightLG: input.lg.height,
      fontSize: input.md.fontSize,
      fontSizeLG: input.lg.fontSize,
      optionFontSize: input.md.fontSize,
      ...(dark ? { selectorBg: darkPalette.input, colorBgContainer: darkPalette.input } : {}),
    },
    Dropdown: { fontSize: typography.default },
    /** Tablo metni en küçük metindir: 14 px (model 4. bölüm). Gövde 16 px kalır. */
    Table: { fontSize: typography.min },
    DatePicker: anchorAllSizes,
    Cascader: anchorAllSizes,
    Mentions: anchorAllSizes,
    Tag: { borderRadiusSM: radius.micro },
    Checkbox: { borderRadiusSM: radius.micro },
    Segmented: {
      borderRadius: radius.ring,
      borderRadiusSM: radius.control,
      borderRadiusLG: radius.ring,
    },
    Popover: { borderRadiusLG: radius['surface-lg'] },
    Card: { borderRadiusLG: radius.panel, borderRadiusSM: radius['surface-lg'] },
    Modal: { borderRadiusLG: radius.panel },
    Notification: { borderRadiusLG: radius['surface-lg'] },
    Message: { borderRadiusLG: radius['surface-lg'] },
  };

  return {
    cssVar: { key: 'atonota' },
    hashed: false,
    algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token,
    components,
  };
}

/**
 * GEÇİCİ / BORC(foundation): Kayıt ekranı tasarım token bağdaştırıcısı.
 *
 * Kaldırma koşulu: `foundation` işinin `src/design` modülü `main` dalına birleştiğinde
 * bu dosya tamamen silinecek ve `RecordView` doğrudan `src/design` temasını ve CSS
 * değişkenlerini kullanacaktır (Review 2 Önemli 5).
 *
 * Tek kaynak: `design/source/control-size-config.json`.
 */
import controlSizeConfig from '@design-source/control-size-config.json';
import { theme as antdTheme, type ThemeConfig } from 'antd';
import type { CSSProperties } from 'react';
import { danger, focusIndicator, hitTarget, primary as accessiblePrimary } from '@/design/tokens';

export type RecordThemeMode = 'light' | 'dark';

const LIGHT_SHADOWS = controlSizeConfig.derived.shadowCss;
const DARK_SHADOWS = controlSizeConfig.derived.shadowCssDark;
const BASE_ANTD_TOKENS = antdTheme.getDesignToken();

/**
 * Central phone breakpoint (<= screenSMMax) and link search debounce delay from design tokens.
 * The design source has no dedicated search-delay token yet. The debounce reuses the shortest
 * interaction delay in the source (`sidebar.flyout.closeDelay`, 180 ms) so the value stays central.
 * Kaldırma koşulu: `foundation` ortak bir arama bekleme tokenı eklerse bu değer ona bağlanır.
 */
export const RECORD_PHONE_MAX_WIDTH_PX: number = BASE_ANTD_TOKENS.screenSMMax;
export const RECORD_LINK_SEARCH_DEBOUNCE_MS: number = controlSizeConfig.sidebar.flyout.closeDelay;

/**
 * Takvimin dokunma hedefi (AJA-476). Gün hücresi ve ay okları en az bu kadar olur.
 * Değer WCAG 2.5.5 hedefidir: 44 px. Yedi gün sütunu 308 px eder ve 320 px ekrana sığar.
 * Tasarım kaynağındaki `hitArea.minTarget` 24 px'tir. O değer WCAG 2.5.8 alt sınırıdır.
 * 24 px'lik hücre parmakla zor seçilir. Bu yüzden takvim kendi hedefini kullanır.
 * Kaldırma koşulu: `foundation` kaynağa bir dokunma hedefi tokenı eklerse bu değer ona bağlanır.
 */
export const RECORD_PICKER_TOUCH_TARGET_PX = Math.max(controlSizeConfig.hitArea.minTarget, 44);

/** Takvim panelinin dar ekrandaki kenar boşluğu. antd `paddingXXS` değeridir: 4 px. */
export const RECORD_PICKER_PANEL_PAD_PX: number = BASE_ANTD_TOKENS.paddingXXS;

/**
 * antd gün hücresine üstten ve alttan `paddingXXS * 1.5` boşluk verir.
 * Hücre satırı bu boşlukla birlikte dokunma hedefi kadar olur.
 */
const PICKER_CELL_PAD_Y_PX = BASE_ANTD_TOKENS.paddingXXS * 1.5;

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Derives Ant Design ConfigProvider tokens directly from design/source/control-size-config.json (AD-1).
 * Surrounding focus rings are disabled (`lineWidthFocus: 0`, `controlOutlineWidth: 0`).
 */
export function buildRecordAntdTheme(mode: RecordThemeMode): ThemeConfig {
  const isDark = mode === 'dark';
  const primary = controlSizeConfig.primary;
  const darkPalette = controlSizeConfig.darkPalette;
  const sizes = controlSizeConfig.sizes;
  const radius = controlSizeConfig.radius.default;

  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: primary.color,
      colorPrimaryHover: primary.hover,
      colorPrimaryActive: primary.active,
      colorLink: primary.color,
      colorLinkHover: primary.hover,
      colorLinkActive: primary.active,
      colorInfo: primary.color,
      fontFamily: "'Outfit Variable', 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
      fontFamilyCode: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: controlSizeConfig.typography.default,
      fontSizeSM: controlSizeConfig.typography.min,
      fontSizeLG: sizes.lg.input.fontSize,
      controlHeight: sizes.md.input.height,
      controlHeightSM: sizes.sm.input.height,
      controlHeightLG: sizes.lg.input.height,
      borderRadius: radius,
      controlOutline: 'transparent',
      controlOutlineWidth: 0,
      lineWidthFocus: 0,
      ...(isDark
        ? {
            colorBgLayout: darkPalette.layout,
            colorBgContainer: darkPalette.panel,
            colorBgElevated: darkPalette.elevated,
            colorBorder: darkPalette.border,
            colorBorderSecondary: darkPalette.borderSecondary,
            colorSplit: darkPalette.borderSecondary,
          }
        : {}),
    },
    components: {
      Button: {
        controlHeight: sizes.md.button.height,
        controlHeightSM: sizes.sm.button.height,
        controlHeightLG: sizes.lg.button.height,
        contentFontSize: sizes.md.button.fontSize,
        contentFontSizeSM: sizes.sm.button.fontSize,
        contentFontSizeLG: sizes.lg.button.fontSize,
        fontWeight: controlSizeConfig.fontWeight.md,
        primaryColor: accessiblePrimary[mode].text,
        primaryShadow: isDark ? DARK_SHADOWS.button : LIGHT_SHADOWS.button,
        defaultShadow: isDark ? DARK_SHADOWS.button : LIGHT_SHADOWS.button,
        dangerShadow: isDark ? DARK_SHADOWS.button : LIGHT_SHADOWS.button,
        ...(isDark
          ? {
              colorPrimaryBg: hexToRgba(primary.color, primary.dark.background),
              defaultBg: darkPalette.button,
              defaultHoverBg: darkPalette.buttonHover,
              defaultActiveBg: darkPalette.buttonHover,
              defaultBorderColor: darkPalette.buttonBorder,
              defaultHoverBorderColor: darkPalette.buttonBorder,
              defaultActiveBorderColor: darkPalette.buttonBorder,
            }
          : {}),
      },
      Input: {
        activeBorderColor: isDark ? darkPalette.border : BASE_ANTD_TOKENS.colorBorder,
        controlHeight: sizes.md.input.height,
        controlHeightSM: sizes.sm.input.height,
        controlHeightLG: sizes.lg.input.height,
        inputFontSize: sizes.md.input.fontSize,
        inputFontSizeSM: sizes.sm.input.fontSize,
        inputFontSizeLG: sizes.lg.input.fontSize,
        activeShadow: 'none',
        ...(isDark
          ? {
              colorBgContainer: darkPalette.input,
              activeBg: darkPalette.input,
              hoverBg: darkPalette.input,
              activeBorderColor: darkPalette.border,
            }
          : {}),
      },
      // Tarih alanı (panel sorunu 3). Ölçü ve renkler metin kutusuyla aynıdır.
      DatePicker: {
        // Takvim hücresi dokunma hedefinden gelir (AJA-476). antd hücreyi controlHeightSM'den
        // hesaplardı: 36 × 1.5 = 54 px. Panel 414 px olur ve 320 px ekrana sığmazdı.
        cellWidth: RECORD_PICKER_TOUCH_TARGET_PX,
        cellHeight: RECORD_PICKER_TOUCH_TARGET_PX - PICKER_CELL_PAD_Y_PX * 2,
        // Odakta kenarlık rengi değişmez. Odak göstergesi yalnız alttaki çizgidir.
        activeBorderColor: isDark ? darkPalette.border : BASE_ANTD_TOKENS.colorBorder,
        controlHeight: sizes.md.input.height,
        controlHeightSM: sizes.sm.input.height,
        controlHeightLG: sizes.lg.input.height,
        inputFontSize: sizes.md.input.fontSize,
        inputFontSizeSM: sizes.sm.input.fontSize,
        inputFontSizeLG: sizes.lg.input.fontSize,
        activeShadow: 'none',
        ...(isDark
          ? {
              colorBgContainer: darkPalette.input,
              colorBgElevated: darkPalette.elevated,
              activeBg: darkPalette.input,
              hoverBg: darkPalette.input,
              activeBorderColor: darkPalette.border,
            }
          : {}),
      },
      InputNumber: {
        activeBorderColor: isDark ? darkPalette.border : BASE_ANTD_TOKENS.colorBorder,
        controlHeight: sizes.md.input.height,
        controlHeightSM: sizes.sm.input.height,
        controlHeightLG: sizes.lg.input.height,
        inputFontSize: sizes.md.input.fontSize,
        activeShadow: 'none',
        ...(isDark
          ? {
              colorBgContainer: darkPalette.input,
              activeBg: darkPalette.input,
              hoverBg: darkPalette.input,
              activeBorderColor: darkPalette.border,
            }
          : {}),
      },
      Select: {
        activeBorderColor: isDark ? darkPalette.border : BASE_ANTD_TOKENS.colorBorder,
        controlHeight: sizes.md.input.height,
        controlHeightSM: sizes.sm.input.height,
        controlHeightLG: sizes.lg.input.height,
        fontSize: sizes.md.input.fontSize,
        fontSizeLG: sizes.lg.input.fontSize,
        optionFontSize: controlSizeConfig.typography.default,
        activeOutlineColor: 'transparent',
        ...(isDark
          ? {
              selectorBg: darkPalette.input,
              colorBgContainer: darkPalette.input,
              activeBorderColor: darkPalette.border,
            }
          : {}),
      },
      Tabs: {
        titleFontSize: controlSizeConfig.choice.tabs.fontSize,
        horizontalItemGutter: controlSizeConfig.choice.tabs.gap,
        itemSelectedColor: isDark ? primary.hover : hexToRgba(primary.light.text, 1),
        itemHoverColor: isDark ? primary.hover : hexToRgba(primary.light.text, 1),
        inkBarColor: primary.color,
      },
      Card: {
        borderRadiusLG: controlSizeConfig.cards.radius,
      },
    },
  };
}

/**
 * Generates CSS custom properties strictly from control-size-config.json and resolved antd tokens (ST-2).
 */
export function buildRecordCssVariables(mode: RecordThemeMode): CSSProperties {
  const isDark = mode === 'dark';
  const themeConfig = buildRecordAntdTheme(mode);
  const resolved = antdTheme.getDesignToken(themeConfig);
  const sizes = controlSizeConfig.sizes;
  const typo = controlSizeConfig.typography;
  const primary = controlSizeConfig.primary;
  const darkPalette = controlSizeConfig.darkPalette;
  const shadows = isDark ? DARK_SHADOWS : LIGHT_SHADOWS;
  const headerCfg = controlSizeConfig.header.settings;
  const lineHeightDelta = Number.parseInt(typo.lineHeightRule.replace(/[^0-9]/g, ''), 10);

  const vars: Record<string, string> = {
    '--rv-color-primary': primary.color,
    '--rv-color-primary-hover': primary.hover,
    '--rv-color-primary-active': primary.active,
    '--rv-color-bg': resolved.colorBgLayout,
    '--rv-color-panel': resolved.colorBgContainer,
    '--rv-color-elevated': resolved.colorBgElevated,
    '--rv-color-input': isDark ? darkPalette.input : resolved.colorBgContainer,
    '--rv-color-border': resolved.colorBorder,
    '--rv-color-border-secondary': resolved.colorBorderSecondary,
    '--rv-color-text': resolved.colorText,
    '--rv-color-text-secondary': resolved.colorTextSecondary,
    '--rv-color-danger': danger[mode].color,
    '--rv-focus-color': focusIndicator[mode].color,
    '--rv-color-danger-bg': resolved.colorErrorBg,
    '--rv-color-warning': resolved.colorWarningText,
    '--rv-color-warning-bg': resolved.colorWarningBg,
    '--rv-color-dirty-dot': resolved.colorWarning,
    '--rv-btn-primary-fg': accessiblePrimary[mode].text,
    '--rv-btn-primary-hover-fg': accessiblePrimary[mode].textHover,
    '--rv-btn-primary-dark-bg': accessiblePrimary.dark.background,
    '--rv-btn-primary-dark-hover-bg': accessiblePrimary.dark.backgroundHover,
    '--rv-btn-primary-dark-active-bg': accessiblePrimary.dark.backgroundActive,
    '--rv-pill-primary-fg': isDark ? primary.hover : hexToRgba(primary.light.text, 1),
    '--rv-pill-primary-bg': hexToRgba(primary.color, primary.dark.background),
    // The active date segment uses the brand tint instead of WebKit's native focus ring.
    '--rv-date-segment-bg': hexToRgba(primary.color, primary.dark.background),
    '--rv-pill-success-fg': resolved.colorSuccessText,
    '--rv-pill-success-bg': resolved.colorSuccessBg,
    '--rv-pill-warning-fg': isDark ? resolved.colorWarningText : hexToRgba(primary.light.text, 1),
    '--rv-pill-warning-bg': resolved.colorWarningBg,
    '--rv-pill-danger-fg': resolved.colorErrorText,
    '--rv-pill-danger-bg': resolved.colorErrorBg,
    '--rv-font-min': `${typo.min}px`,
    '--rv-font-ui': resolved.fontFamily,
    '--rv-font-section': `${typo.headings.h2}px`,
    '--rv-font-section-lh': `${typo.headings.h2 + lineHeightDelta}px`,
    '--rv-hit-target': `${hitTarget.coarse}px`,
    '--rv-font-min-lh': `${typo.min + lineHeightDelta}px`,
    '--rv-font-body': `${typo.default}px`,
    '--rv-font-body-lh': `${typo.default + lineHeightDelta}px`,
    '--rv-font-control-md': `${sizes.md.input.fontSize}px`,
    '--rv-font-control-md-lh': `${sizes.md.input.fontSize + lineHeightDelta}px`,
    '--rv-font-title': `${typo.headings.h1}px`,
    '--rv-font-title-lh': `${typo.headings.h1 + lineHeightDelta}px`,
    '--rv-font-title-mobile': `${typo.headings.h1}px`,
    '--rv-font-title-mobile-lh': `${typo.headings.h1 + lineHeightDelta}px`,
    '--rv-font-weight-sm': String(controlSizeConfig.fontWeight.sm),
    '--rv-font-weight-md': String(controlSizeConfig.fontWeight.md),
    '--rv-font-weight-lg': String(controlSizeConfig.fontWeight.lg),
    '--rv-font-mono': resolved.fontFamilyCode,
    '--rv-control-h-sm': `${sizes.sm.input.height}px`,
    '--rv-control-h-md': `${sizes.md.input.height}px`,
    '--rv-control-h-lg': `${sizes.lg.input.height}px`,
    '--rv-checkbox-h': `${controlSizeConfig.choice.checkbox.height}px`,
    '--rv-tag-h': `${controlSizeConfig.choice.tag.height}px`,
    '--rv-radius': `${controlSizeConfig.radius.default}px`,
    '--rv-card-radius': `${controlSizeConfig.cards.radius}px`,
    '--rv-space-2xs': `${resolved.paddingXXS}px`,
    '--rv-space-xs': `${resolved.paddingXS}px`,
    '--rv-space-sm': `${resolved.paddingSM}px`,
    '--rv-space-md': `${resolved.padding}px`,
    '--rv-space-lg': `${resolved.paddingMD}px`,
    '--rv-space-xl': `${controlSizeConfig.cards.padding}px`,
    '--rv-table-col-check-min': `${sizes.sm.input.height * 2}px`,
    '--rv-table-col-num-min': `${sizes.sm.input.height * 4}px`,
    '--rv-table-col-date-min': `${sizes.sm.input.height * 4.5}px`,
    '--rv-table-col-text-min': `${sizes.sm.input.height * 5}px`,
    '--rv-table-col-action-w': `${sizes.sm.button.height * 1.5}px`,
    '--rv-color-input-w': `${sizes.sm.input.height * 4}px`,
    '--rv-signature-w': `${sizes.lg.input.height * 6}px`,
    '--rv-signature-h': `${sizes.lg.input.height * 2.5}px`,
    '--rv-signature-font-size': `${headerCfg.titleSize}px`,
    '--rv-signature-pad-x': `${resolved.padding}px`,
    '--rv-shadow-card': shadows.card,
    '--rv-shadow-button': shadows.button,
    '--rv-shadow-input': shadows.input,
    '--rv-shadow-header': resolved.boxShadowSecondary,
    '--rv-motion-duration': `${controlSizeConfig.focusDim.duration}ms`,
    '--rv-motion-easing': controlSizeConfig.focusDim.easing,
    '--rv-focus-line-size': `${resolved.lineWidthBold}px`,
    '--rv-picker-touch-target': `${RECORD_PICKER_TOUCH_TARGET_PX}px`,
    '--rv-picker-panel-pad': `${RECORD_PICKER_PANEL_PAD_PX}px`,
  };

  return vars as CSSProperties;
}

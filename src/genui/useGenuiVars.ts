import { theme } from 'antd';
import type { ThemeConfig } from 'antd';
import type { CSSProperties } from 'react';
import { useMemo } from 'react';

import { aiCssVars } from '@/ai/tokens';

/**
 * CSS variables of the AI area.
 *
 * Shared values are not copied. Styles read them straight from the foundation
 * variables: `--font-ui`, `--font-code`, `--font-default`,
 * `--font-min`, `--radius`, `--card-radius`, `--color-primary`, `--btn-h-sm`,
 * `--motion-easing-standard` and `--motion-duration-focus-dim`.
 *
 * Colours and spacing are read from the running antd theme. The foundation sets up the theme.
 */
export function useGenuiVars(): CSSProperties {
  const { token } = theme.useToken();
  return useMemo(
    () =>
      ({
        ...aiCssVars(),
        '--ai-primary-bg': token.colorPrimaryBg,
        '--ai-primary-bg-hover': token.colorPrimaryBgHover,
        '--ai-text': token.colorText,
        '--ai-text-2': token.colorTextSecondary,
        '--ai-text-3': token.colorTextTertiary,
        '--ai-bg': token.colorBgLayout,
        '--ai-bg-c': token.colorBgContainer,
        '--ai-bg-e': token.colorBgElevated,
        '--ai-fill': token.colorFillSecondary,
        '--ai-border': token.colorBorderSecondary,
        '--ai-border-control': token.colorBorder,
        '--ai-success': token.colorSuccess,
        '--ai-success-bg': token.colorSuccessBg,
        '--ai-error': token.colorError,
        '--ai-error-bg': token.colorErrorBg,
        '--ai-error-border': token.colorErrorBorder,
        '--ai-warning': token.colorWarning,
        '--ai-warning-bg': token.colorWarningBg,
        '--ai-warning-border': token.colorWarningBorder,
        '--ai-shadow-card': token.boxShadowTertiary,
        '--ai-font-lg': `${token.fontSizeLG}px`,
        '--ai-font-xl': `${token.fontSizeXL}px`,
        '--ai-gap-xs': `${token.paddingXXS}px`,
        '--ai-gap-sm': `${token.paddingXS}px`,
        '--ai-gap': `${token.paddingSM}px`,
        '--ai-gap-md': `${token.padding}px`,
        '--ai-gap-lg': `${token.paddingLG}px`,
      }) as CSSProperties,
    [token],
  );
}

/**
 * Focus theme for inputs and selects inside GenUI.
 *
 * General rule: surrounding focus is forbidden. On focus antd paints all four edges
 * in the accent colour and draws a ring shadow. This theme sets the focus border colour
 * to the resting colour and turns the ring off. Values come from the running theme's tokens.
 * The keyboard indicator (a single line on the bottom edge) is in `genui.css`.
 */
export function useGenuiFocusTheme(): ThemeConfig {
  const { token } = theme.useToken();
  return useMemo(
    () => ({
      components: {
        Select: {
          activeBorderColor: token.colorBorder,
          activeOutlineColor: 'transparent',
        },
        Input: {
          activeBorderColor: token.colorBorder,
          activeShadow: 'none',
        },
      },
    }),
    [token.colorBorder],
  );
}

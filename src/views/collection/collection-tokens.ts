import type { theme } from 'antd';
import type { CSSProperties } from 'react';
import source from '../../../design/source/control-size-config.json';

export function collectionVariables(
  token: ReturnType<typeof theme.useToken>['token'],
  mode: 'dark' | 'light',
): CSSProperties {
  return {
    '--collection-bg': token.colorBgLayout,
    '--collection-surface': token.colorBgContainer,
    '--collection-elevated': token.colorBgElevated,
    '--collection-text': token.colorText,
    '--collection-muted': token.colorTextSecondary,
    '--collection-primary': source.primary.color,
    '--collection-focus': mode === 'light' ? source.primary.light.text : source.primary.color,
    '--collection-selected': token.colorPrimaryBg,
    '--collection-border': token.colorBorderSecondary,
    '--collection-gap': source.cards.padding / 2 + 'px',
    '--collection-padding': source.cards.padding + 'px',
    '--collection-radius': 'var(--radius)',
    '--collection-font': 'var(--font-default)',
    '--collection-title': source.header.settings.titleSize + 'px',
    '--collection-line': source.typography.default + 8 + 'px',
    '--collection-control': 'var(--btn-h-md)',
    '--collection-hit': 'var(--hit-target, var(--btn-h-md))',
    // Satır yüksekliği üç düzeydir: 36, 42 ve 48 px. Değerler denetim boyutlarından gelir.
    '--collection-row-sm': source.sizes.sm.input.height + 'px',
    '--collection-row-md': source.sizes.md.input.height + 'px',
    '--collection-row-lg': source.sizes.lg.input.height + 'px',
    // Telefon araç çubuğu: dört düğme 320 px'te tek satıra sığar (AJA-880 taslağı).
    '--collection-chip-font': source.sizes.sm.button.fontSize + 'px',
    '--collection-chip-hit': source.sizes.lg.button.height + 'px',
    '--collection-chip-pad': source.cards.padding / 3 + 'px',
    '--collection-chip-gap': source.cards.padding / 6 + 'px',
    '--collection-icon': source.layoutTokens.iconSize + 'px',
    '--collection-column': source.sizes.md.input.height * 4 + 'px',
    '--collection-number': source.sizes.md.input.height * 3 + 'px',
    '--collection-lane': source.sizes.md.input.height * 6 + 'px',
    '--collection-timeline': source.sizes.md.input.height * 12 + 'px',
    '--collection-mark': 'var(--focus-indicator-size)',
    '--collection-duration': 'var(--motion-duration-mid)',
    '--collection-ease': 'var(--motion-easing-standard)',
    '--collection-dropdown-duration': 'var(--motion-duration-dropdown)',
    '--collection-dropdown-ease': 'var(--motion-easing-dropdown)',
    '--collection-shadow': 'var(--shadow-dropdown)',
  } as CSSProperties;
}
export const collectionViewOptions = source.header.viewTypes
  .filter((view) => view.value !== 'form')
  .map(({ value, label }) => ({ value, label }));

/** Satır yüksekliği düzeyleri. Dokunmatik ekranda satır en az `lg` olur. */
export type CollectionRowHeight = 'sm' | 'md' | 'lg';
/**
 * Koleksiyon bu genişliğin altında telefon düzenine geçer. Birim rem'dir.
 * Değer onaylı AJA-880 taslağındaki telefon kırılımıdır (47.99rem).
 * Ölçü pencereye değil koleksiyonun kendi genişliğine bakar.
 */
export const collectionPhoneMaxRem = 48;

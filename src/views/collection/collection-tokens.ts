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

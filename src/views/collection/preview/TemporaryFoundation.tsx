import { ConfigProvider } from 'antd';
import { useRef, useSyncExternalStore } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useLocaleBundle } from '@/app/locale';

import source from '../../../../design/source/control-size-config.json';
import { collectionTheme } from './temporary-theme';
import { useTemporaryInteractions } from './useTemporaryInteractions';
import './temporary-foundation.css';

function subscribe(callback: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
function snapshot() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
/**
 * Preview-only bridge. Remove this file and both temporary adapters when foundation
 * exports buildAntdTheme, ensureDesignStyles, startFocusMode and startHitAreaEngine.
 * Variable names match foundation/src/design/css-variables.ts.
 */
export function TemporaryFoundation({
  children,
  mode,
}: {
  children: ReactNode;
  mode: 'light' | 'dark';
}) {
  const root = useRef<HTMLDivElement>(null);
  const { antd: locale } = useLocaleBundle();
  useTemporaryInteractions(root);
  const reduced = useSyncExternalStore(subscribe, snapshot, () => false);
  const variables = {
    '--font-ui': 'Outfit Variable, Outfit, sans-serif',
    '--font-default': source.typography.default + 'px',
    '--btn-h-md': source.sizes.md.button.height + 'px',
    '--hit-target-fine': source.hitArea.target.fine + 'px',
    '--hit-target-coarse': source.hitArea.target.coarse + 'px',
    '--radius': source.radius.default + 'px',
    '--focus-indicator-size': '2px',
    '--motion-duration-mid': '200ms',
    '--motion-easing-standard': 'cubic-bezier(.65, 0, .35, 1)',
    '--motion-duration-dropdown': source.dropdown.animation.duration + 'ms',
    '--motion-easing-dropdown': source.dropdown.animation.easing,
    '--shadow-dropdown': (mode === 'light'
      ? source.derived.shadowCss
      : source.derived.shadowCssDark
    ).dropdown,
  } as CSSProperties;
  return (
    <ConfigProvider
      locale={locale}
      theme={collectionTheme(mode, reduced)}
      wave={{ disabled: true }}
    >
      <div ref={root} data-collection-preview data-theme={mode} style={variables}>
        {children}
      </div>
    </ConfigProvider>
  );
}

import { ConfigProvider } from 'antd';
import type { ReactNode } from 'react';

import type { ChoiceKey } from './choice-shared';
import { noWave, themes } from './choice-shared';

import './controls.css';

/** Seçim bileşenlerinin ortak tema sarmalı. Bileşenler kendi dosyalarından bunu kullanır. */
export function Themed({ name, children }: { name: ChoiceKey; children: ReactNode }) {
  return (
    <ConfigProvider theme={themes[name]} wave={noWave}>
      {children}
    </ConfigProvider>
  );
}

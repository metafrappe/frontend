import type { ThemeConfig } from 'antd';
import type { CSSProperties } from 'react';

import { designSource } from '@/design';

/**
 * Seçim bileşenlerinin ortak parçaları. Her bileşen kendi dosyasından alınabilsin diye ayrıdır.
 * Örneğin `Switch` tek başına alınınca `Radio` ve `Checkbox` pakete girmez.
 */
export const choice = designSource.choice;
export type ChoiceKey = 'checkbox' | 'radio' | 'switch' | 'tabs' | 'tag';

/**
 * Source `choice.<control>.antdTheme` blocks carry size and color tokens. Colors stay with the
 * Foundation theme (light and dark contrast decisions), so only size and type tokens are layered.
 */
function sizeOnly(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !/color/i.test(key)));
}

function choiceTheme(key: ChoiceKey): ThemeConfig {
  const { token, components } = choice[key].antdTheme;
  return {
    token: sizeOnly(token),
    components: Object.fromEntries(
      Object.entries(components as Record<string, Record<string, unknown>>).map(([name, value]) => [
        name,
        sizeOnly(value),
      ]),
    ),
  };
}

export const themes: Record<ChoiceKey, ThemeConfig> = {
  checkbox: choiceTheme('checkbox'),
  radio: choiceTheme('radio'),
  switch: choiceTheme('switch'),
  tabs: choiceTheme('tabs'),
  tag: choiceTheme('tag'),
};

/** Row heights from C3: the visible control is centred inside the locked row. */
export const rowStyle = (height: number, style?: CSSProperties): CSSProperties => ({
  minBlockSize: height,
  alignItems: 'center',
  ...style,
});

export function classes(...names: (string | undefined | false)[]) {
  return names.filter(Boolean).join(' ');
}

/**
 * antd's click wave runs a fixed 0.4 s box-shadow and 2 s fade outside the shared motion tokens.
 * The source has no wave, so choice controls turn it off.
 */
export const noWave = { disabled: true };

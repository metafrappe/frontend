import { Desktop, Moon, Sun } from '@phosphor-icons/react';
import { Segmented } from 'antd';

import { useThemeMode, type ThemeModeChoice } from './theme-mode';

const OPTIONS: { label: string; value: ThemeModeChoice; icon: JSX.Element }[] = [
  { label: 'Açık', value: 'light', icon: <Sun weight="regular" aria-hidden="true" /> },
  { label: 'Koyu', value: 'dark', icon: <Moon weight="regular" aria-hidden="true" /> },
  { label: 'Sistem', value: 'system', icon: <Desktop weight="regular" aria-hidden="true" /> },
];

/** Theme switch: light, dark and system. The choice is applied immediately and saved. */
export function ThemeModeSwitch() {
  const { choice, setChoice } = useThemeMode();
  return (
    <Segmented<ThemeModeChoice>
      aria-label="Tema"
      value={choice}
      onChange={(v) => setChoice(v)}
      options={OPTIONS.map((o) => ({ label: o.label, value: o.value, icon: o.icon }))}
    />
  );
}

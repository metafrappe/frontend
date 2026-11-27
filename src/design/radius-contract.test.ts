import { readFileSync } from 'node:fs';

import source from '@design-source/control-size-config.json';
import { describe, expect, it } from 'vitest';

import { buildAntdTheme } from './antd-theme';
import { rootVariables } from './css-variables';

const steps = {
  none: 0,
  micro: 3,
  control: 5,
  ring: 7,
  menu: 9,
  surface: 13,
  'surface-lg': 17,
  panel: 21,
  'shell-sm': 25,
  shell: 29,
};

describe('radius guideline contract', () => {
  it('publishes every semantic step without changing legacy control aliases', () => {
    const vars = rootVariables();
    for (const [name, value] of Object.entries(steps)) {
      expect(vars[`--r-${name}`], name).toBe(`${value}px`);
    }
    expect(vars['--radius']).toBe('5px');
    expect(vars['--card-radius']).toBe('21px');
  });

  it.each(['light', 'dark'] as const)('maps %s Ant Design controls and surfaces', (mode) => {
    const { token, components } = buildAntdTheme(mode);
    expect(token).toMatchObject({
      borderRadiusXS: 3,
      borderRadius: 5,
      borderRadiusSM: 5,
      borderRadiusLG: 9,
    });
    for (const name of [
      'Button',
      'Input',
      'InputNumber',
      'Select',
      'DatePicker',
      'Cascader',
      'Mentions',
    ] as const) {
      expect(components?.[name], name).toMatchObject({
        borderRadius: 5,
        borderRadiusSM: 5,
        borderRadiusLG: 5,
      });
    }
    expect(components?.Card).toMatchObject({ borderRadiusLG: 21, borderRadiusSM: 17 });
    expect(components?.Checkbox).toMatchObject({ borderRadiusSM: 3 });
    expect(components?.Tag).toMatchObject({ borderRadiusSM: 3 });
    expect(components?.Modal).toMatchObject({ borderRadiusLG: 21 });
    expect(components?.Popover).toMatchObject({ borderRadiusLG: 17 });
    expect(token?.controlOutlineWidth).toBe(0);
    expect(token?.lineWidthFocus).toBe(0);
  });

  it('records the same radius decisions in the source configuration', () => {
    expect(source.radius).toMatchObject({ default: 5, tokens: steps });
    expect(source.cards.radius).toBe(21);
    expect(source.choice.checkbox.radius).toBe(3);
    expect(source.derived.antdTheme.token).toMatchObject({
      borderRadius: 5,
      borderRadiusSM: 5,
      borderRadiusLG: 9,
    });
    expect(source.derived.antdTheme.components.Card).toMatchObject({
      borderRadiusLG: 21,
      borderRadiusSM: 17,
    });
    expect(source.derived.css).not.toContain('--card-radius: 10px');
  });

  it('documents the guideline and the real rejection gate for new components', () => {
    const instructions = readFileSync('AGENTS.md', 'utf8');
    expect(instructions).toContain('docs/standartlar/radius.md');
    expect(instructions).toContain('npm run check:radius');
    expect(instructions).toContain('`--r-ring` odak için kullanılmaz');
  });

  it('distinguishes full-bleed shell, popup, small leaf and card corners', () => {
    const css = readFileSync('src/shell/shell.css', 'utf8');
    for (const [selector, token] of [
      ['.shell', 'none'],
      ['.shell-fly', 'menu'],
      ['.shell-badge', 'micro'],
      ['.shell-stat', 'panel'],
    ] as const) {
      const rule = css.slice(css.indexOf(`${selector} {`)).split('}')[0];
      expect(rule, selector).toContain(`border-radius: var(--r-${token})`);
    }
  });
});

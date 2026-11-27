import designSource from '@design-source/control-size-config.json';
import designSystem from '@design-source/design-system.json';
import { theme as antdThemeApi, type ThemeConfig } from 'antd';
import { describe, expect, it } from 'vitest';

import { buildRecordAntdTheme, buildRecordCssVariables } from '../views/record/tokens';
import { buildAntdTheme } from './antd-theme';
import { darkVariables, rootVariables } from './css-variables';
import { radiusLadder, radiusViolations } from './radius';

/** Karar 45: `radius.md` yönergesindeki basamak listesi. */
const YONERGE = [0, 3, 5, 7, 9, 13, 17, 21, 25, 29];

/** JSON içinde adı "radius" geçen bütün sayı alanlarını yoluyla döndürür. */
function radiusNumbers(node: unknown, path = ''): [string, number][] {
  if (Array.isArray(node)) return node.flatMap((v, i) => radiusNumbers(v, `${path}[${i}]`));
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([k, v]) => {
      const p = `${path}.${k}`;
      if (typeof v === 'number' && /radius/i.test(k)) return [[p, v] as [string, number]];
      return radiusNumbers(v, p);
    });
  }
  return [];
}

/** JSON içindeki metinlerde geçen CSS köşe değerleri ve "N px radius" ifadeleri. */
function radiusInStrings(node: unknown): string[] {
  if (typeof node === 'string') {
    const css = [...node.matchAll(/radius\s*:\s*([^;\n}]+)/gi)].flatMap((m) =>
      radiusViolations(m[1] ?? ''),
    );
    const prose = [...node.matchAll(/(\d+)\s*px radius/gi)]
      .map((m) => Number(m[1]))
      .filter((n) => !YONERGE.includes(n))
      .map((n) => `${n} px radius`);
    return [...css, ...prose];
  }
  if (Array.isArray(node)) return node.flatMap(radiusInStrings);
  if (node && typeof node === 'object') return Object.values(node).flatMap(radiusInStrings);
  return [];
}

/** antd'nin çözdüğü bütün köşe tokenları: global ve bileşen düzeyi. */
function themeRadii(config: ThemeConfig): [string, unknown][] {
  const global = Object.entries(antdThemeApi.getDesignToken(config)).filter(([k]) =>
    /^borderRadius/.test(k),
  );
  const components = Object.entries(config.components ?? {}).flatMap(([name, tokens]) =>
    Object.entries(tokens as Record<string, unknown>)
      .filter(([k]) => /radius/i.test(k))
      .map(([k, v]) => [`${name}.${k}`, v] as [string, unknown]),
  );
  return [...global, ...components];
}

const offLadder = (pairs: [string, unknown][]) =>
  pairs.filter(([, v]) => typeof v !== 'number' || !YONERGE.includes(v));

describe('köşe basamakları (Karar 45, radius.md)', () => {
  it('kaynaktaki basamak listesi yönergeyle aynıdır', () => {
    expect([...radiusLadder]).toEqual(YONERGE);
  });

  it('denetim izinsiz değeri reddeder, kapsülü ve tokenı ayırır', () => {
    expect(radiusViolations('10px')).toEqual(['10px']);
    expect(radiusViolations('4px 21px')).toEqual(['4px']);
    expect(radiusViolations('21px')).toEqual([]);
    expect(radiusViolations('0')).toEqual([]);
    expect(radiusViolations('var(--card-radius) var(--radius) 0 0')).toEqual([]);
    expect(radiusViolations('50%')).toEqual([]);
    expect(radiusViolations('calc(var(--tag-h) / 2)')).toEqual([]);
    expect(radiusViolations('calc(var(--radius) + 5px)')).toEqual(['calc(var(--radius) + 5px)']);
  });

  it.each([
    ['control-size-config.json', designSource],
    ['design-system.json', designSystem],
  ])('%s içindeki bütün köşe sayıları basamak listesindedir', (_name, json) => {
    expect(offLadder(radiusNumbers(json))).toEqual([]);
  });

  it.each([
    ['control-size-config.json', designSource],
    ['design-system.json', designSystem],
  ])('%s içindeki CSS ve açıklama metinlerinde izinsiz köşe yoktur', (_name, json) => {
    expect(radiusInStrings(json)).toEqual([]);
  });

  it('24 px iç boşluklu kart 21 px köşe alır', () => {
    expect(designSource.cards.padding).toBe(24);
    expect(designSource.cards.radius).toBe(21);
    expect(rootVariables()['--card-radius']).toBe('21px');
    expect(buildRecordCssVariables('light')).toMatchObject({ '--rv-card-radius': '21px' });
  });

  it('köşe CSS değişkenleri basamaktadır', () => {
    const all = {
      ...rootVariables(),
      ...darkVariables(),
      ...buildRecordCssVariables('light'),
      ...buildRecordCssVariables('dark'),
    };
    const vars = Object.entries(all).filter(([k]) => /radius/.test(k));
    expect(vars.length).toBeGreaterThan(0);
    expect(vars.flatMap(([, v]) => radiusViolations(String(v)))).toEqual([]);
  });

  it.each(['light', 'dark'] as const)('%s antd temasının bütün köşe tokenları basamaktadır', (mode) => {
    const built = buildAntdTheme(mode);
    expect(offLadder(themeRadii(built))).toEqual([]);
    expect(built.components?.Card?.borderRadiusLG).toBe(21);
  });

  it.each(['light', 'dark'] as const)('%s kayıt temasının bütün köşe tokenları basamaktadır', (mode) => {
    expect(offLadder(themeRadii(buildRecordAntdTheme(mode)))).toEqual([]);
  });

  it('kontrol köşesi her boyutta 5 px kalır (Kural 1)', () => {
    const { components } = buildAntdTheme('light');
    for (const name of ['Button', 'Input', 'InputNumber', 'Select', 'DatePicker'] as const) {
      const c = components?.[name] as Record<string, unknown> | undefined;
      for (const key of ['borderRadius', 'borderRadiusSM', 'borderRadiusLG']) {
        expect(c?.[key], `${name}.${key}`).toBe(5);
      }
    }
  });
});

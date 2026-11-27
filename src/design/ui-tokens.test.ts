/**
 * UI refresh 1a (AJA-997): new visual language tokens.
 * The decisions are in section 6 of the model document: smallest text 14 px, body 16 px,
 * no #00aacc text colour in the light theme, the touch area is a separate token, dropdown uses the default curve.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { theme as antdThemeApi } from 'antd';
import { describe, expect, it } from 'vitest';

import { buildAntdTheme } from './antd-theme';
import { blendOver, contrastRatio } from './color';
import { buildDesignCss, darkVariables, rootVariables } from './css-variables';
import { dropdownAnimation, duration, easing } from './motion';
import { designSource } from './source';
import { focusIndicator, hitTarget, link, palette, textDescription, typography } from './tokens';

const STANDARD_EASING = 'cubic-bezier(.65,0,.35,1)';
const squash = (v: string) => v.replace(/\s/g, '').toLowerCase();
const pxValue = (v: string) => Number(/^(\d+(?:\.\d+)?)px$/.exec(v)?.[1] ?? NaN);

/** Lays an `rgba(r,g,b,a)` or `#rrggbb` colour over the given background and returns a solid colour. */
function solid(color: string, surface: string): string {
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(color);
  if (!m) return color;
  const hex = `#${[m[1], m[2], m[3]].map((c) => Number(c).toString(16).padStart(2, '0')).join('')}`;
  return blendOver(hex, Number(m[4]), surface);
}

describe('en küçük metin ve gövde metni', () => {
  it('tipografi tokenı 14 px altına inmez, gövde 16 px olur', () => {
    expect(typography.min).toBe(14);
    expect(typography.default).toBe(16);
    expect(typography).not.toHaveProperty('special');
    expect(typography).not.toHaveProperty('exception');
  });

  it('hiçbir yazı boyutu CSS değişkeni 14 px altında değildir', () => {
    const vars = { ...rootVariables(), ...darkVariables() };
    const fontVars = Object.entries(vars).filter(([name]) => /^--(font|btn-fs|input-fs|text)-/.test(name));
    const sizes = fontVars.filter(([, v]) => /px$/.test(v));
    expect(sizes.length).toBeGreaterThan(8);
    for (const [name, value] of sizes) {
      expect(pxValue(value), name).toBeGreaterThanOrEqual(14);
    }
    expect(vars['--font-body']).toBe('16px');
    expect(vars).not.toHaveProperty('--font-special');
    expect(vars).not.toHaveProperty('--font-exception');
  });

  it('antd temasında hiçbir yazı boyutu 14 px altında değildir; gövde 16 px olur', () => {
    for (const mode of ['light', 'dark'] as const) {
      const theme = buildAntdTheme(mode);
      expect(theme.token?.fontSize).toBe(16);
      const all: [string, unknown][] = [
        ...Object.entries(theme.token ?? {}),
        ...Object.entries(theme.components ?? {}).flatMap(([c, t]) =>
          Object.entries(t as object).map(([k, v]) => [`${c}.${k}`, v] as [string, unknown]),
        ),
      ];
      const fonts = all.filter(([k, v]) => /fontsize/i.test(k) && typeof v === 'number');
      for (const [k, v] of fonts) expect(v as number, `${mode} ${k}`).toBeGreaterThanOrEqual(14);
    }
  });

  it('kaynak dosyadaki bileşen yazı boyutları 14 px altında değildir', () => {
    for (const st of designSource.dropdown.styles) expect(st.fontSize, st.key).toBeGreaterThanOrEqual(14);
    for (const [key, c] of Object.entries(designSource.choice)) {
      const size = 'labelSize' in c ? c.labelSize : 'fontSize' in c ? c.fontSize : undefined;
      if (size !== undefined) expect(size, key).toBeGreaterThanOrEqual(14);
    }
  });
});

describe('renk kontrastı', () => {
  for (const mode of ['light', 'dark'] as const) {
    it(`${mode} temada metin tokenları her zeminde en az 4.5:1 verir`, () => {
      const p = palette[mode];
      const surfaces = [p.layout, p.panel, p.panelAlt, p.elevated];
      const texts: Record<string, string> = {
        text: p.text,
        textQuiet: p.textQuiet,
        ink: p.ink,
        ok: p.ok,
        warn: p.warn,
        link: link[mode].color,
        linkHover: link[mode].hover,
        linkActive: link[mode].active,
      };
      for (const surface of surfaces) {
        for (const [name, color] of Object.entries(texts)) {
          expect(contrastRatio(solid(color, surface), surface), `${mode} ${name} / ${surface}`).toBeGreaterThanOrEqual(
            4.5,
          );
        }
        // Accent text on the accent background (tint) also stays readable.
        const tinted = solid(p.tint, surface);
        expect(contrastRatio(p.ink, tinted), `${mode} ink / tint`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrastRatio(p.draftText, p.draftBg), `${mode} draft`).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('açık temada #00aacc hiçbir metin tokenında kullanılmaz', () => {
    const primary = designSource.primary.color.toLowerCase();
    const p = palette.light;
    const lightTexts = [
      p.text,
      p.textQuiet,
      p.ink,
      p.ok,
      p.warn,
      p.draftText,
      link.light.color,
      link.light.hover,
      link.light.active,
      focusIndicator.light.color,
    ];
    for (const c of lightTexts) expect(c.toLowerCase()).not.toBe(primary);
    const light = rootVariables();
    for (const name of ['--color-text', '--color-text-quiet', '--color-ink', '--color-link', '--focus-indicator-color']) {
      expect(light[name]?.toLowerCase(), name).not.toBe(primary);
    }
    expect(buildAntdTheme('light').token?.colorLink?.toLowerCase()).not.toBe(primary);
    // The button background stays the primary colour.
    expect(light['--color-primary']).toBe(designSource.primary.color);
  });

  it('bağlantı ve odak için açık temada daha koyu mavi token vardır', () => {
    expect(link.light.color).toBe(palette.light.ink);
    expect(focusIndicator.light.color).toBe(palette.light.ink);
    expect(focusIndicator.dark.color).toBe(palette.dark.ink);
    expect(darkVariables()['--focus-indicator-color']).toBe(palette.dark.ink);
    expect(contrastRatio(palette.light.ink, palette.light.layout)).toBeGreaterThan(
      contrastRatio(designSource.primary.color, palette.light.layout),
    );
  });

  it('açık ve koyu tema zeminleri aynı tokenlardan üretilir', () => {
    const lightKeys = Object.keys(palette.light).sort();
    expect(Object.keys(palette.dark).sort()).toEqual(lightKeys);
    const root = rootVariables();
    const dark = darkVariables();
    for (const name of ['--color-bg-layout', '--color-bg-panel', '--color-text', '--color-ink', '--color-line']) {
      expect(root[name], name).toBeTruthy();
      expect(dark[name], name).toBeTruthy();
    }
    expect(buildAntdTheme('light').token?.colorBgLayout).toBe(palette.light.layout);
    expect(buildAntdTheme('dark').token?.colorBgLayout).toBe(palette.dark.layout);
  });
});

describe('dokunma alanı', () => {
  it('görünen kontrol boyutu ile dokunma alanı ayrı tokendır; telefonda en az 48 px olur', () => {
    expect(hitTarget.coarse).toBeGreaterThanOrEqual(48);
    expect(hitTarget.fine).toBeGreaterThanOrEqual(24);
    const vars = rootVariables();
    expect(vars['--hit-target']).toBe(`${hitTarget.fine}px`);
    expect(vars['--control-h-md']).toBe(`${designSource.sizes.md.button.height}px`);
    const css = squash(buildDesignCss());
    expect(css).toContain(squash(`@media (any-pointer: coarse) { :root { --hit-target: ${hitTarget.coarse}px;`));
  });
});

describe('dropdown hareketi', () => {
  it('dropdown ayrı eğri kullanmaz: varsayılan eğri ve daha kısa süre tokenı', () => {
    expect(squash(easing.dropdown)).toBe(STANDARD_EASING);
    expect(squash(easing.standard)).toBe(STANDARD_EASING);
    expect(duration.dropdown).toBeGreaterThan(0);
    expect(duration.dropdown).toBeLessThan(duration.mid);
    expect(squash(rootVariables()['--motion-easing-dropdown'] ?? '')).toBe(STANDARD_EASING);
    expect(rootVariables()['--motion-duration-dropdown']).toBe(`${duration.dropdown}ms`);
    const frames = JSON.stringify(dropdownAnimation.keyframes);
    expect(frames).not.toMatch(/skew/);
    expect(squash(designSource.dropdown.animation.easing)).toBe(STANDARD_EASING);
  });
});

describe('AGENTS.md ortak kurallarla ilişki', () => {
  const agents = readFileSync(resolve(__dirname, '../../AGENTS.md'), 'utf8');
  const section = agents.split('## Ortak kurallarla ilişki')[1]?.split('\n## ')[0] ?? '';

  it('12 px ve ayrı dropdown eğrisi istisnası kalmaz', () => {
    expect(section).not.toBe('');
    // The sentence removed on the next line ("the 12 px exception is void") is the decision itself;
    // no other 12 px remains.
    expect(agents.replace('12 px istisnası geçersizdir', '')).not.toMatch(/\b12 px\b/);
    expect(agents).not.toMatch(/cubic-bezier\(\.2, \.9/);
    expect(agents).not.toMatch(/Skew \+ Scale/);
    expect(section).toMatch(/14 CSS px/);
    expect(section).toMatch(/12 px istisnası geçersizdir/);
    expect(section).toMatch(/Dropdown için ayrı hareket eğrisi yoktur/);
  });
});

describe('antd yazı tokenları (QA AJA-1007)', () => {
  const textTokens = (mode: 'light' | 'dark') => {
    const t = antdThemeApi.getDesignToken(buildAntdTheme(mode)) as unknown as Record<string, unknown>;
    return Object.entries(t).filter(
      ([k, v]) => /^color.*Text(Hover|Active)?$|^colorText(Secondary)?$/.test(k) && typeof v === 'string',
    ) as [string, string][];
  };

  it('açık temada antd hiçbir yazı tokenını #00aacc üretmez', () => {
    const primary = designSource.primary.color.toLowerCase();
    const tokens = textTokens('light');
    expect(tokens.length).toBeGreaterThan(10);
    for (const [k, v] of tokens) expect(v.toLowerCase(), k).not.toBe(primary);
  });

  for (const mode of ['light', 'dark'] as const) {
    it(`${mode} temada birincil, bilgi ve soluk yazı tokenları her zeminde 4.5:1 verir`, () => {
      const p = palette[mode];
      const tokens = textTokens(mode).filter(([k]) => /^color(Primary|Info)Text|^colorTextSecondary$/.test(k));
      expect(tokens.map(([k]) => k)).toEqual(expect.arrayContaining(['colorPrimaryText', 'colorInfoText', 'colorTextSecondary']));
      for (const surface of [p.layout, p.panel, p.panelAlt, p.elevated]) {
        for (const [k, v] of tokens) {
          const c = v.startsWith('rgba') ? solid(v.replace(/\s/g, ''), surface) : v;
          expect(contrastRatio(c, surface), `${mode} ${k} / ${surface}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }

  it('seçili radyo düğmesinin yazısı vurgu rengini kullanır', () => {
    const css = squash(buildDesignCss());
    expect(css).toContain(squash(':not(.ant-radio-group-solid) > .ant-radio-button-wrapper-checked:not(.ant-radio-button-wrapper-disabled) { color: var(--color-ink); }'));
  });
});

describe('soluk yazı tema sarmalayıcısı dışında da okunur (QA AJA-1007)', () => {
  it('soluk yazı rengi iki temada CSS değişkenidir ve antd soluk yazısına uygulanır', () => {
    expect(rootVariables()['--color-text-secondary']).toBe(textDescription.light.color);
    expect(darkVariables()['--color-text-secondary']).toBe(textDescription.dark.color);
    expect(squash(buildDesignCss())).toContain(
      squash(':root .ant-typography.ant-typography-secondary { color: var(--color-text-secondary); }'),
    );
  });
});

describe('fare üstü ve basılı yazı vurgu rengidir (QA AJA-1023)', () => {
  const button = (mode: 'light' | 'dark') => {
    const t = antdThemeApi.getDesignToken(buildAntdTheme(mode)) as unknown as Record<string, unknown>;
    const c = buildAntdTheme(mode).components?.Button as Record<string, unknown> | undefined;
    return {
      hover: (c?.defaultHoverColor ?? t.colorPrimaryHover) as string,
      active: (c?.defaultActiveColor ?? t.colorPrimaryActive) as string,
    };
  };

  for (const mode of ['light', 'dark'] as const) {
    it(`${mode} temada kenarlıklı düğmenin fare üstü ve basılı yazısı her zeminde 4.5:1 verir`, () => {
      const p = palette[mode];
      const { hover, active } = button(mode);
      for (const surface of [p.layout, p.panel, p.panelAlt, p.elevated]) {
        for (const [k, v] of [['hover', hover], ['active', active]] as const) {
          const c = v.startsWith('rgba') ? solid(v.replace(/\s/g, ''), surface) : v;
          expect(contrastRatio(c, surface), `${mode} ${k} / ${surface}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }

  it('açık temada kenarlıklı düğmenin fare üstü ve basılı yazısı bağlantı rengidir', () => {
    expect(button('light')).toEqual({ hover: link.light.hover, active: link.light.active });
  });

  it('kenarlıklı radyo düğmesinin fare üstü ve basılı yazısı bağlantı rengidir', () => {
    const css = squash(buildDesignCss());
    const wrapper = ':not(.ant-radio-group-solid) > .ant-radio-button-wrapper:not(.ant-radio-button-wrapper-disabled)';
    expect(css).toContain(squash(`${wrapper}:hover { color: var(--color-link-hover); }`));
    expect(css).toContain(squash(`${wrapper}:active { color: var(--color-link-active); }`));
  });
});

import designSource from '@design-source/control-size-config.json';
import { theme as antdThemeApi } from 'antd';
import { describe, expect, it } from 'vitest';

import { antdComponentConfig, buildAntdTheme } from './antd-theme';
import { blendOver, contrastRatio, darkenToContrast } from './color';
import { danger, palette, primary, textDescription } from './tokens';

/** `rgba(r,g,b,a)` -> blendOver için renk ve opaklık. */
function parseRgba(value: string): [string, number] {
  const m = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(value);
  if (!m) throw new Error(`rgba bekleniyordu: ${value}`);
  const hex = [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
  return [`#${hex}`, Number(m[4])];
}

const derived = designSource.derived.antdTheme;

describe('buildAntdTheme', () => {
  it('kontrol yükseklikleri kaynak dosyayla aynıdır', () => {
    const { token } = buildAntdTheme('light');
    expect(token?.controlHeight).toBe(designSource.sizes.md.button.height);
    expect(token?.controlHeightSM).toBe(designSource.sizes.sm.button.height);
    expect(token?.controlHeightLG).toBe(designSource.sizes.lg.button.height);
    expect(token?.controlHeight).toBe(derived.token.controlHeight);
  });

  it('koyu tema kaynaktaki derived.antdTheme tokenlarıyla örtüşür', () => {
    const { token } = buildAntdTheme('dark');
    for (const [key, value] of Object.entries(derived.token)) {
      expect(token?.[key as keyof typeof token], key).toBe(value);
    }
  });

  it('koyu tema bileşen tokenları kaynakla örtüşür', () => {
    const { components } = buildAntdTheme('dark');
    for (const [name, tokens] of Object.entries(derived.components)) {
      const built = components?.[name as keyof typeof components] as Record<string, unknown> | undefined;
      for (const [key, value] of Object.entries(tokens)) {
        expect(built?.[key], `${name}.${key}`).toBe(value);
      }
    }
  });

  it.each(['light', 'dark'] as const)(
    '%s temada açıklama metni (colorTextDescription) her zeminde en az 4.5:1 verir (Ö5)',
    (mode) => {
      const { token } = buildAntdTheme(mode);
      const value = String(token?.colorTextDescription);
      expect(value).toBe(textDescription[mode].color);
      for (const surface of textDescription[mode].surfaces) {
        expect(
          contrastRatio(blendOver(...parseRgba(value), surface), surface),
          `${mode} ${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it('açıklama metni antd varsayılanından başlar ve yalnız gerektiği kadar koyulaşır (Ö5)', () => {
    // antd varsayılanı açık temada siyah %45, koyu temada beyaz %45'tir; ikisi de 4.5:1 vermez.
    expect(textDescription.light.opacity).toBeGreaterThan(0.45);
    expect(textDescription.dark.opacity).toBeGreaterThan(0.45);
    expect(textDescription.light.surfaces).toContain(designSource.lightPalette.layout);
    expect(textDescription.dark.surfaces).toContain(designSource.darkPalette.layout);
  });

  it('açık tema bağlantı rengi beyaz üzerinde en az 4.5:1 kontrast verir', () => {
    const { token } = buildAntdTheme('light');
    const layout = designSource.lightPalette.layout;
    expect(contrastRatio(String(token?.colorLink), layout)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(String(token?.colorLink), '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(buildAntdTheme('dark').token?.colorLink).toBe(palette.dark.ink);
  });

  it('koyu birincil düğme zemini saydam değildir ve kaynak tondan türetilir', () => {
    const { dark } = primary;
    const layout = designSource.darkPalette.layout;
    // Saydam olmayan renk: zemin ne olursa olsun kontrast aynı kalır.
    expect(dark.background).toMatch(/^#[0-9a-f]{6}$/);
    expect(dark.backgroundHover).toMatch(/^#[0-9a-f]{6}$/);
    expect(dark.backgroundActive).toMatch(/^#[0-9a-f]{6}$/);
    // Türetme: kaynaktaki koyu tema tonu (%14, %22 ve basılı) yerleşim zemini üzerine bindirilir.
    expect(dark.background).toBe(blendOver(designSource.primary.color, designSource.primary.dark.background, layout));
    expect(dark.backgroundHover).toBe(
      blendOver(designSource.primary.color, designSource.primary.dark.hoverBackground, layout),
    );
    expect(dark.backgroundActive).toBe(blendOver(designSource.primary.color, dark.backgroundActiveOpacity, layout));
    expect(dark.backgroundActiveOpacity).toBeLessThanOrEqual(designSource.primary.dark.activeBackground);
    expect(dark.textHover).toBe('rgba(0,170,204,1)');
    expect(dark.textOpacity).toBeGreaterThanOrEqual(designSource.primary.dark.opacity);
    expect(buildAntdTheme('dark').components?.Button?.primaryColor).toBe(primary.dark.text);
  });

  it('koyu birincil düğme her durumda ve her zeminde en az 4.5:1 verir', () => {
    const { dark } = primary;
    const text = designSource.primary.dark.text;
    const states = [
      { name: 'normal', bg: dark.background, textAlpha: dark.textOpacity },
      { name: 'üzerine gelme', bg: dark.backgroundHover, textAlpha: 1 },
      { name: 'basılı (fare)', bg: dark.backgroundActive, textAlpha: 1 },
      // Klavyeyle basılı: üzerine gelme yoktur; metin yine %100 olur (CSS basılı kuralı rengi de verir).
      { name: 'basılı (klavye)', bg: dark.backgroundActive, textAlpha: dark.textActiveOpacity },
    ];
    const surfaces = [
      designSource.darkPalette.layout,
      designSource.darkPalette.panel,
      designSource.darkPalette.elevated,
    ];
    for (const state of states) {
      for (const surface of surfaces) {
        const bg = blendOver(state.bg, 1, surface);
        const ratio = contrastRatio(blendOver(text, state.textAlpha, bg), bg);
        expect(ratio, `${state.name} / ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('tehlikeli birincil düğme kendi kırmızısını korur; beyaz metin her durumda en az 4.5:1 verir', () => {
    const white = '#ffffff';
    for (const mode of ['light', 'dark'] as const) {
      const btn = buildAntdTheme(mode).components?.Button as Record<string, unknown>;
      const seed = antdThemeApi.getDesignToken({
        algorithm: mode === 'dark' ? antdThemeApi.darkAlgorithm : antdThemeApi.defaultAlgorithm,
      }).colorError;
      expect(btn?.['dangerColor'], mode).toBe(white);
      expect(danger[mode].solidText, mode).toBe(white);
      const { background: bg, backgroundHover: hover, backgroundActive: active } = danger[mode];
      // Türetme: antd hata rengi beyaz metinle 4.5:1 verene kadar koyulaşır. Ton korunur.
      expect(bg, mode).toBe(darkenToContrast(seed, white, 4.5));
      // Tehlike rengi birincil rengin tonu değildir: kırmızı kanal baskındır.
      const [r, g, b] = [bg.slice(1, 3), bg.slice(3, 5), bg.slice(5, 7)].map((h) => parseInt(h, 16));
      expect(r, mode).toBeGreaterThan(g!);
      expect(r, mode).toBeGreaterThan(b!);
      expect(bg, mode).not.toBe(primary.dark.background);
      // Normal, üzerine gelme ve basılı: hepsi en az 4.5:1; her durum bir öncekinden koyudur.
      const ratios = [bg, hover, active].map((c) => contrastRatio(white, c));
      for (const ratio of ratios) expect(ratio, mode).toBeGreaterThanOrEqual(4.5);
      expect(ratios[1], `${mode} üzerine gelme`).toBeGreaterThan(ratios[0]!);
      expect(ratios[2], `${mode} basılı`).toBeGreaterThan(ratios[1]!);
    }
  });

  it('kenarlıklı, metin ve bağlantı türü tehlike düğmesinin yazısı her zeminde en az 4.5:1 verir; düz zemin bozulmaz', () => {
    for (const mode of ['light', 'dark'] as const) {
      const btn = buildAntdTheme(mode).components?.Button as Record<string, string>;
      const t = antdThemeApi.getDesignToken({
        algorithm: mode === 'dark' ? antdThemeApi.darkAlgorithm : antdThemeApi.defaultAlgorithm,
      });
      // antd bu tokenları kenarlıklı, metin, bağlantı ve dolgulu türde yazı rengi olarak kullanır.
      const ink = { normal: btn['colorError']!, hover: btn['colorErrorHover']!, active: btn['colorErrorActive']! };
      expect(ink.normal, mode).toBe(danger[mode].color);
      expect(ink.hover, mode).toBe(danger[mode].colorHover);
      expect(ink.active, mode).toBe(danger[mode].colorActive);
      // Yazının durduğu zeminler: yerleşim, panel, yükseltilmiş zemin ve antd'nin kırmızımsı durum zeminleri.
      const dark = designSource.darkPalette;
      const surfaces =
        mode === 'dark'
          ? [dark.layout, dark.panel, dark.elevated]
          : [t.colorBgContainer, t.colorBgLayout];
      surfaces.push(t.colorErrorBg, t.colorErrorBgHover, t.colorErrorBgActive, t.colorErrorBgFilledHover);
      const worst = (c: string) => Math.min(...surfaces.map((bg) => contrastRatio(c, bg)));
      for (const [state, color] of Object.entries(ink)) {
        for (const bg of surfaces) {
          expect(contrastRatio(color, bg), `${mode} ${state} / ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
        const [r, g, b] = [color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)].map((h) => parseInt(h, 16));
        expect(r, `${mode} ${state} kırmızı kalır: ${color}`).toBeGreaterThan(g!);
        expect(r, `${mode} ${state} kırmızı kalır: ${color}`).toBeGreaterThan(b!);
      }
      // Durumlar ayırt edilir: üzerine gelme ve basılı en kötü zeminde bir öncekinden daha çok kontrast verir.
      expect(worst(ink.hover), `${mode} üzerine gelme`).toBeGreaterThan(worst(ink.normal));
      expect(worst(ink.active), `${mode} basılı`).toBeGreaterThan(worst(ink.hover));
      // Düz (solid) zemin yazı renginden ayrıdır ve önceki türetmesini korur.
      expect(danger[mode].background, mode).not.toBe(ink.normal);
      expect(contrastRatio('#ffffff', danger[mode].background), mode).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('yer tutucu rengi her iki temada en az 4.5:1 verir', () => {
    const lightBg = antdThemeApi.getDesignToken().colorBgContainer;
    const light = String(buildAntdTheme('light').token?.colorTextPlaceholder);
    const dark = String(buildAntdTheme('dark').token?.colorTextPlaceholder);
    const alpha = (rgba: string) => Number(rgba.match(/[\d.]+/g)?.[3] ?? 1);
    expect(contrastRatio(blendOver('#000000', alpha(light), lightBg), lightBg)).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(blendOver('#ffffff', alpha(dark), designSource.darkPalette.input), designSource.darkPalette.input),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('açık tema koyu paleti taşımaz; zeminler açık paletten gelir (AJA-997)', () => {
    const { token, components } = buildAntdTheme('light');
    expect(token?.colorBgLayout).toBe(designSource.lightPalette.layout);
    expect(token?.colorBgContainer).toBe(designSource.lightPalette.panel);
    expect((components?.Input as Record<string, unknown>)?.['colorBgContainer']).toBeUndefined();
  });

  it('yazı tipi Outfit ile başlar ve kod için JetBrains Mono kullanır', () => {
    const { token } = buildAntdTheme('light');
    expect(token?.fontFamily?.startsWith("'Outfit Variable'")).toBe(true);
    expect(token?.fontFamilyCode).toContain('JetBrains Mono');
  });

  it('çevreleyen odak çerçevesini kapatır', () => {
    const { token } = buildAntdTheme('light');
    expect(token?.lineWidthFocus).toBe(0);
    expect(token?.controlOutlineWidth).toBe(0);
  });

  it('hareket eğrileri merkezi tokendan gelir ve reduced motion ile kapanır', () => {
    const normal = buildAntdTheme('light');
    expect(normal.token?.motion).toBe(true);
    expect(normal.token?.motionEaseInOut).toBe(designSource.focusDim.easing);
    const reduced = buildAntdTheme('light', { reducedMotion: true });
    expect(reduced.token?.motion).toBe(false);
  });

  it('satır kutusu = metin + 8 kuralını oran olarak verir', () => {
    const { token } = buildAntdTheme('light');
    expect(token?.lineHeight).toBeCloseTo(24 / 16, 6);
    expect(token?.lineHeightSM).toBeCloseTo(22 / 14, 6);
    expect(token?.lineHeightLG).toBeCloseTo(26 / 18, 6);
  });

  it('Select açılır paneli köşesini ConfigProvider üzerinden menü radius değişkeninden alır (AD-2)', () => {
    expect(antdComponentConfig.select?.styles?.popup?.root).toEqual({
      borderRadius: 'var(--r-menu)',
    });
  });
});

import { afterEach, describe, expect, it } from 'vitest';

import {
  DESIGN_STYLE_ID,
  buildDesignCss,
  darkVariables,
  ensureDesignStyles,
  rootVariables,
} from './css-variables';
import { designSource } from './source';
import { danger } from './tokens';

describe('CSS değişkenleri', () => {
  afterEach(() => {
    document.getElementById(DESIGN_STYLE_ID)?.remove();
  });

  it('kök değişkenler kaynak kararlarını taşır', () => {
    const vars = rootVariables();
    expect(vars['--radius']).toBe(`${designSource.radius.default}px`);
    expect(vars['--btn-h-md']).toBe(`${designSource.sizes.md.button.height}px`);
    expect(vars['--color-primary']).toBe(designSource.primary.color);
    expect(vars['--hit-expand']).toBe(String(designSource.hitArea.expand));
    expect(vars['--shadow-input']).toBe(designSource.derived.shadowCss.input);
    expect(vars['--motion-duration-dropdown']).toBe(`${designSource.dropdown.animation.duration}ms`);
    expect(vars['--focus-dim-color']).toBe('rgba(100,116,139,0.33)');
  });

  it('kabuk hareket tokenları merkezi değişkenlerle çıkar', () => {
    const vars = rootVariables();
    expect(vars['--motion-duration-glide']).toBe('200ms');
    expect(vars['--motion-duration-glide-fade']).toBe('150ms');
    expect(vars['--motion-duration-skeleton']).toBe('1200ms');
    expect(vars['--motion-duration-spin']).toBe('900ms');
    expect(vars['--motion-duration-instant']).toBe('0ms');
    expect(String(vars['--motion-easing-glide']).replace(/\s/g, '')).toBe('cubic-bezier(.2,0,0,1)');
    expect(vars['--motion-easing-linear']).toBe('linear');
  });

  it('odaklı bağlantı kuralı metin bağlantısı kuralından daha özgüldür', () => {
    const css = buildDesignCss();
    const link = 'a:not(.ant-btn):not(.ant-menu-item):not(.ant-tabs-tab):not([data-nav-link])';
    const rest = css.split('\n').find((line) => line.includes('text-underline-offset: 0.15em'));
    expect(rest?.startsWith(`${link} {`)).toBe(true);
    const focus = css.split('\n').find((line) => line.includes('text-decoration-thickness'));
    expect(focus).toContain(`html[data-focus-mode="keyboard"] ${link}:focus-visible`);
  });

  it('koyu tema gölgeleri ve perde rengini değiştirir', () => {
    const vars = darkVariables();
    expect(vars['--shadow-input']).toBe(designSource.derived.shadowCssDark.input);
    expect(vars['--focus-dim-color']).toBe('rgba(50,58,70,0.66)');
    // Koyu birincil düğme zemini saydam değildir (türetilmiş karar 1).
    expect(vars['--primary-bg']).toMatch(/^#[0-9a-f]{6}$/);
    expect(vars['--primary-bg-hover']).toMatch(/^#[0-9a-f]{6}$/);
    expect(vars['--primary-bg-active']).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('koyu basılı düğme kuralı metni de %100 yapar (klavyeyle basılı durum)', () => {
    const css = buildDesignCss();
    const active = css
      .split('\n')
      .find((line) => line.includes('[data-theme="dark"] .ant-btn-primary') && line.includes(':active'));
    expect(active).toBeDefined();
    expect(active).toContain('background: var(--primary-bg-active)');
    expect(active).toContain('color: var(--primary-text-hover)');
  });

  it('birincil düğme kuralları tehlikeli (danger) düğmeyi dışarıda bırakır', () => {
    const rules = buildDesignCss()
      .split('\n')
      .filter((line) => line.includes('.ant-btn-primary') && !line.trim().startsWith('/*'));
    expect(rules.length).toBeGreaterThanOrEqual(5);
    for (const rule of rules) {
      expect(rule, rule).toContain('.ant-btn-primary:not(.ant-btn-dangerous)');
    }
    // antd düz düğmenin üzerine gelme metnini primaryColor yapar; tehlike düğmesi beyaz kalır.
    expect(rootVariables()['--danger-text']).toBe('#ffffff');
    expect(darkVariables()['--danger-text']).toBe('#ffffff');
    // Düz zemin CSS değişkeninden gelir; antd Button `colorError` tokenı artık yazı rengidir.
    expect(rootVariables()['--danger-bg']).toBe(danger.light.background);
    expect(rootVariables()['--danger-bg-hover']).toBe(danger.light.backgroundHover);
    expect(rootVariables()['--danger-bg-active']).toBe(danger.light.backgroundActive);
    expect(darkVariables()['--danger-bg']).toBe(danger.dark.background);
    expect(darkVariables()['--danger-bg-hover']).toBe(danger.dark.backgroundHover);
    expect(darkVariables()['--danger-bg-active']).toBe(danger.dark.backgroundActive);
    const solidRules = buildDesignCss()
      .split('\n')
      .filter((line) => line.includes('.ant-btn-dangerous.ant-btn-variant-solid'));
    const rest = solidRules.find((line) => !line.includes(':hover') && !line.includes(':active'));
    const hover = solidRules.find((line) => line.includes(':hover'));
    const active = solidRules.find((line) => line.includes(':active'));
    expect(rest).toContain('background: var(--danger-bg)');
    expect(hover).toContain('background: var(--danger-bg-hover)');
    expect(hover).toContain('color: var(--danger-text)');
    expect(active).toContain('background: var(--danger-bg-active)');
    expect(active).toContain('color: var(--danger-text)');
  });

  it('menü görünümlü bağlantılar (data-nav-link) altı çizili metin bağlantısı sayılmaz (K1)', () => {
    const css = buildDesignCss();
    const rest = css.split('\n').find((line) => line.includes('text-underline-offset: 0.15em'));
    expect(rest).toContain(':not([data-nav-link])');
    // Odaklı bağlantı kuralı yalnız metin bağlantısına uygulanır. Menü bağlantısının kendi tek
    // göstergesi vardır; çıplak `a:focus-visible` ikinci bir gösterge eklerdi.
    const focus = css.split('\n').find((line) => line.includes('text-decoration-thickness'));
    expect(focus).not.toMatch(/keyboard"\] a:focus-visible/);
  });

  it('üst çubuk yüksekliği orta buton yüksekliği ile iki küçük boşluktan türer (Ö6)', () => {
    const vars = rootVariables();
    expect(vars['--topbar-height']).toBe(
      `${designSource.sizes.md.button.height + 2 * Number.parseInt(String(vars['--space-xxs']), 10)}px`,
    );
  });

  it('dar form sütunu değişkeni orta buton yüksekliğinin 10 katıdır', () => {
    const vars = rootVariables();
    expect(vars['--form-max-width']).toBe(`${designSource.sizes.md.button.height * 10}px`);
    expect(vars['--form-max-width']).toBe('420px');
  });

  it('kaynaktaki dokunma alanı CSS’ini aynen içerir', () => {
    expect(buildDesignCss()).toContain(designSource.hitArea.css);
  });

  it('çevreleyen odak halkasını kapatır ve klavye modunda alt çizgi verir', () => {
    const css = buildDesignCss();
    expect(css).toContain(':focus-visible { outline: none; }');
    expect(css).toContain('html[data-focus-mode="keyboard"] :focus-visible { box-shadow: inset 0');
    expect(css).toContain('@media (forced-colors: active)');
  });

  it('Select açılır paneli için antd iç sınıfına köşe vermez (AD-2)', () => {
    // Select köşesi ConfigProvider `select.styles.popup.root` alanından gelir (antd-theme.ts).
    expect(buildDesignCss()).not.toContain('.ant-select-dropdown');
  });

  it('reduced motion bloğu içerir', () => {
    expect(buildDesignCss()).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('stil öğesini bir kez ekler', () => {
    const a = ensureDesignStyles();
    const b = ensureDesignStyles();
    expect(a).toBe(b);
    expect(document.querySelectorAll(`#${DESIGN_STYLE_ID}`)).toHaveLength(1);
    expect(a.textContent).toContain('--radius: 5px');
  });
});

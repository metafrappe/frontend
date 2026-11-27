// With Vitest `css: false`, `?raw` returns empty. The file is read with Node.
// The name ends in `.node.test.ts`, so Node types apply only to this test.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(`${process.cwd()}/src/shell/shell.css`, 'utf8');

/**
 * Important 2 and 3: no hard-coded values are written in the stylesheet.
 * Hard-coded values live only in the named-values section at the top of the file.
 */

const START = '/* @adli-degerler:basla */';
const END = '/* @adli-degerler:bitir */';

function body(): string {
  const a = css.indexOf(START);
  const b = css.indexOf(END);
  expect(a).toBeGreaterThanOrEqual(0);
  expect(b).toBeGreaterThan(a);
  const rest = css.slice(0, a) + css.slice(b + END.length);
  // Comments are not checked. Query conditions are not checked: CSS variables
  // do not work in `@media` and `@container` conditions.
  return rest.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@(media|container)[^{]*\{/g, '{');
}

describe('shell.css', () => {
  it('adlı değer bölümü dışında sabit px değeri yoktur', () => {
    const hits = body().match(/(?<![\w-])-?\d*\.?\d+px\b/g) ?? [];
    expect(hits).toEqual([]);
  });

  it('adlı değer bölümü dışında sabit süre yoktur', () => {
    const hits = body().match(/(?<![\w-])\d*\.?\d+m?s\b/g) ?? [];
    expect(hits).toEqual([]);
  });

  it('sabit renk yoktur', () => {
    const hits = body().match(/#[0-9a-f]{3,8}\b|rgba?\(/gi) ?? [];
    expect(hits).toEqual([]);
  });

  it('köşe yarıçapı yalnız tokendır ya da daire içindir', () => {
    const values = [...body().matchAll(/border(?:-[a-z-]+)?-radius:\s*([^;]+);/g)].map((m) =>
      m[1]?.trim(),
    );
    for (const v of values) {
      expect(['var(--shell-radius)', '50%', '0']).toContain(v);
    }
  });
});

/**
 * Review 2, Minor 1: the gliding background's easing and fade duration come from the source sample.
 * Source: `.glide{transition:transform .2s cubic-bezier(.2,0,0,1), ..., opacity .15s ease}`.
 */
describe('kayan zemin hareketi', () => {
  const decl = (name: string) =>
    new RegExp(`${name}:\\s*([^;]+);`)
      .exec(css)?.[1]
      ?.trim()
      .replace(/\s+/g, '')
      // The formatter writes `.2` as `0.2`. Both are the same number.
      .replace(/(?<![\d.])0\./g, '.');

  it('adlı değerler merkezi hareket tokenlarına bağlıdır', () => {
    // Durations stay as in the source. The shell uses the approved symmetric easing.
    expect(decl('--shell-glide-dur')).toBe('var(--motion-duration-glide)');
    expect(decl('--shell-glide-ease')).toBe('var(--motion-easing-standard)');
    expect(decl('--shell-glide-fade-dur')).toBe('var(--motion-duration-glide-fade)');
    expect(decl('--shell-glide-fade-ease')).toBe('var(--motion-easing-standard)');
    expect(decl('--shell-skel-dur')).toBe('var(--motion-duration-skeleton)');
    expect(decl('--shell-spin-dur')).toBe('var(--motion-duration-spin)');
    expect(decl('--shell-instant')).toBe('var(--motion-duration-instant)');
  });

  it('yerel süre, eğri ve anahtar sözcük yoktur', () => {
    const text = body();
    expect(text.match(/(?<![\w-])\d*\.?\d+m?s(?![\w-])/g) ?? []).toEqual([]);
    expect(text).not.toMatch(/cubic-bezier\(|steps\(/);
    expect(text).not.toMatch(/(?<![\w-])(ease-in-out|ease-in|ease-out|ease|linear)(?![\w-])/);
  });

  it('zemin geçişi rail eğrisini kullanmaz', () => {
    const rules = [...css.matchAll(/\.shell-glide(?:\[[^\]]+\])?\s*\{([^}]*)\}/g)].map((m) => m[1]);
    const transitions = rules.filter((r) => r?.includes('transition'));
    expect(transitions.length).toBeGreaterThan(0);
    for (const r of transitions) {
      expect(r).not.toContain('--shell-ease');
      expect(r).toContain('opacity var(--shell-glide-fade-dur) var(--shell-glide-fade-ease)');
    }
  });

  it('flyout listesinin de kayan zemini vardır', () => {
    expect(css).toMatch(/\.shell-fly-list\s*>\s*li\s*>\s*\.shell-item/);
  });
});

/** AJA-1222: home page icon size and colour come from a central token. */
describe('ana sayfa simgeleri', () => {
  const rule = (selector: string) => {
    const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|\\n)${esc}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  };

  it('simge ölçüsü menü simgesi tokenıdır', () => {
    expect(rule('.shell-home-ic')).toMatch(/font-size:\s*var\(--shell-item-icon\);/);
  });

  it('uyarı simgesinin rengi uyarı tokenıdır', () => {
    expect(rule(".shell-home-ic[data-tone='warn']")).toMatch(/color:\s*var\(--shell-warn\);/);
  });
});

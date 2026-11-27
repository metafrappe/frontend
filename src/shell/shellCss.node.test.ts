// Vitest `css: false` ayarıyla `?raw` boş döner. Dosya Node ile okunur.
// Ad `.node.test.ts` ile biter. Böylece Node türleri yalnız bu testte geçerlidir.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(`${process.cwd()}/src/shell/shell.css`, 'utf8');

/**
 * Önemli 2 ve 3: stil dosyasında sabit değer yazılmaz.
 * Sabit değerler yalnız dosya başındaki adlı değer bölümünde durur.
 */

const START = '/* @adli-degerler:basla */';
const END = '/* @adli-degerler:bitir */';

function body(): string {
  const a = css.indexOf(START);
  const b = css.indexOf(END);
  expect(a).toBeGreaterThanOrEqual(0);
  expect(b).toBeGreaterThan(a);
  const rest = css.slice(0, a) + css.slice(b + END.length);
  // Yorumlar denetlenmez. Sorgu koşulları denetlenmez: CSS değişkeni
  // `@media` ve `@container` koşulunda çalışmaz.
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
      expect([
        'var(--shell-radius)',
        '50%',
        '0',
        ...[
          'none',
          'micro',
          'control',
          'ring',
          'menu',
          'surface',
          'surface-lg',
          'panel',
          'shell-sm',
          'shell',
        ].map((name) => `var(--r-${name})`),
      ]).toContain(v);
    }
  });
});

/**
 * İnceleme 2, Küçük 1: kayan zeminin eğrisi ve solma süresi kaynak örnekten gelir.
 * Kaynak: `.glide{transition:transform .2s cubic-bezier(.2,0,0,1), ..., opacity .15s ease}`.
 */
describe('kayan zemin hareketi', () => {
  const decl = (name: string) =>
    new RegExp(`${name}:\\s*([^;]+);`)
      .exec(css)?.[1]
      ?.trim()
      .replace(/\s+/g, '')
      // Biçimlendirici `.2` değerini `0.2` yazar. İkisi aynı sayıdır.
      .replace(/(?<![\d.])0\./g, '.');

  it('adlı değerler merkezi hareket tokenlarına bağlıdır', () => {
    // Süreler kaynakta kalır. Kabuk onaylı simetrik eğriyi kullanır.
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

/** AJA-1222: ana sayfa simgelerinin ölçüsü ve rengi merkezi tokendan gelir. */
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

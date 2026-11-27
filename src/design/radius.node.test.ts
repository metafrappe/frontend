// Stil dosyaları Node ile okunur. Vitest `css: false` ayarıyla `?raw` boş döner.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { radiusViolations } from './radius.ts';

const root = join(process.cwd(), 'src');

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return cssFiles(p);
    return e.name.endsWith('.css') ? [p] : [];
  });
}

describe('stil dosyalarında köşe (Karar 45, radius.md)', () => {
  it('bütün border-radius değerleri basamak listesinden, köşe tokenından ya da kapsülden gelir', () => {
    const files = cssFiles(root);
    expect(files.length).toBeGreaterThan(0);
    const hits = files.flatMap((file) => {
      const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      return [...css.matchAll(/border(?:-[a-z]+)*-radius\s*:\s*([^;}]+)/g)].flatMap((m) =>
        radiusViolations(m[1] ?? '').map((v) => `${file.slice(root.length + 1)}: ${v}`),
      );
    });
    expect(hits).toEqual([]);
  });
});

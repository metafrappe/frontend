// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { GENUI_TRANSLATIONS } from './strings';

/**
 * `src/genui` has no hard-coded Turkish UI text (AJA-1859).
 * Every visible text and screen reader name comes from `strings.ts`.
 */
const GENUI = import.meta.dirname;

/** The text table. Every language's texts live only here. */
const TABLE = 'strings.ts';

/**
 * Sample data of the demo page. It is assistant content, not UI text.
 * The assistant writes it in the user's language. Example: the card title.
 */
const SAMPLE_DATA = ['demo/samples.ts'];

/** Letters found only in Turkish among the supported languages. */
const TURKISH_LETTER = /[çğıöşüÇĞİÖŞÜ]/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'e2e' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** Removes comments. Comments are written in English and are not UI text. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

/** String literals and JSX text that contain a Turkish letter. */
function turkishTexts(source: string): string[] {
  const code = stripComments(source);
  const literals = code.match(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g) ?? [];
  const jsxText = code.match(/>[^<>{}]+</g) ?? [];
  return [...literals, ...jsxText].filter((text) => TURKISH_LETTER.test(text));
}

function checked(): { path: string; source: string }[] {
  return sourceFiles(GENUI)
    .map((path) => relative(GENUI, path))
    .filter((path) => path !== TABLE && !SAMPLE_DATA.includes(path))
    .map((path) => ({ path, source: readFileSync(join(GENUI, path), 'utf8') }));
}

/** Every Turkish text of the table, including nested ones. */
function tableTexts(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(tableTexts);
  return [];
}

describe('src/genui içinde sabit Türkçe arayüz metni yoktur', () => {
  it('kaynak dosyalarda Türkçe harfli metin yoktur', () => {
    const offenders = checked().flatMap(({ path, source }) =>
      turkishTexts(source).map((text) => `${path}: ${text}`),
    );
    expect(offenders).toEqual([]);
  });

  it('Türkçe tablodaki metinler kaynak dosyalara kopyalanmaz', () => {
    // Catches Turkish words without Turkish letters. Example: 'Kaynak', 'Kip', 'Sor'.
    const words = tableTexts(GENUI_TRANSLATIONS.tr).filter((text) => text.length >= 3);
    const offenders = checked().flatMap(({ path, source }) => {
      const code = stripComments(source);
      return words
        .filter((word) =>
          [`'${word}'`, `"${word}"`, `>${word}<`, `"${word}`].some((form) => code.includes(form)),
        )
        .map((word) => `${path}: ${word}`);
    });
    expect(offenders).toEqual([]);
  });

  it('denetim örnek yazımları yakalar (olumsuz örnek)', () => {
    expect(turkishTexts("const a = 'Süresi doldu';")).toHaveLength(1);
    expect(turkishTexts('<dt>Risk düzeyi</dt>')).toHaveLength(1);
    expect(turkishTexts('aria-label="Değişecek alanlar"')).toHaveLength(1);
    expect(turkishTexts('`Kararınızı bekleyen ${count} iş var`')).toHaveLength(1);
    expect(turkishTexts('// Türkçe yorum\nconst a = text.approve;')).toEqual([]);
    expect(turkishTexts('const pattern = /g(u|ü)ven/i;')).toEqual([]);
  });
});

// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..', '..');

/** Dil eşleme dosyası. Ant Design ve Day.js dil nesneleri yalnız burada içe aktarılır. */
const LOCALE_MAP = 'app/locale/locale-map.ts';

/** Sabit dil nesnesi aktarımı. Örnek: `antd/locale/tr_TR`, `antd/es/locale/en_US`, `dayjs/locale/tr`. */
const HARDCODED_LOCALE =
  /from\s+['"](?:antd\/(?:es\/|lib\/)?locale\/\w+|dayjs\/locale\/[\w-]+)['"]|import\s+['"]dayjs\/locale\//;

/**
 * Dil değerinin sabit yazımı. Örnek: `locale: 'tr'`, `locale="tr"`, `language: 'tr'`.
 * Varsayılan değer (`props.locale ?? 'tr'`, `{ locale = 'tr' }`) bu kurala girmez; o yazım bileşenin yedeğidir.
 */
const HARDCODED_LOCALE_VALUE = /\b(?:locale|language)(?:\s*:\s*|=\{?\s*)['"](?:tr|en)['"]/;

/**
 * Biçimde sabit dil (IC-13). Örnek: `new Intl.NumberFormat('tr-TR')`, `'en-US'`,
 * `toLocaleString('tr')`, `toLocaleLowerCase('tr')`. Biçim dili dil bağlamından gelir.
 */
const HARDCODED_FORMAT_LOCALE =
  /['"][a-z]{2}-[A-Z]{2}['"]|new\s+Intl\.\w+\(\s*['"]|\.toLocale\w*\(\s*['"]/;

/**
 * Örnek sunucunun açılış verisi. Kullanıcı dili orada veridir, arayüz ayarı değildir.
 * Sahte asistan sunucusu da örnek sunucudur. Türkçe anahtar sözcükleri Türkçe harf kuralıyla arar.
 */
const SAMPLE_DATA = ['mocks/', 'ai/agent/mockTransport.ts'];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('sabit dil yalnız eşleme dosyasındadır', () => {
  it('bileşenler antd ve Day.js dil nesnesini doğrudan almaz', () => {
    const offenders = sourceFiles(SRC)
      .map((path) => relative(SRC, path))
      .filter((path) => path !== LOCALE_MAP)
      .filter((path) => HARDCODED_LOCALE.test(readFileSync(join(SRC, path), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('eşleme dosyası iki dili de içe aktarır', () => {
    const map = readFileSync(join(SRC, LOCALE_MAP), 'utf8');
    expect(map).toMatch(/antd\/(?:es\/)?locale\/tr_TR/);
    // Arayüzün İngilizcesi İngiliz İngilizcesidir (AJA-1407).
    expect(map).toMatch(/antd\/(?:es\/)?locale\/en_GB/);
    expect(map).toMatch(/dayjs\/locale\/en-gb/);
  });

  it('oturum açılınca modül ortamına sabit dil verilmez', () => {
    const root = readFileSync(join(SRC, 'app/Root.tsx'), 'utf8');
    expect(root).not.toMatch(/locale:\s*['"](?:tr|en)['"]/);
  });

  it('bileşene ve bağdaştırıcıya dil sabit yazılmaz', () => {
    const offenders = sourceFiles(SRC)
      .map((path) => relative(SRC, path))
      .filter((path) => !path.startsWith('app/locale/'))
      .filter((path) => !SAMPLE_DATA.some((dir) => path.startsWith(dir)))
      .filter((path) => HARDCODED_LOCALE_VALUE.test(readFileSync(join(SRC, path), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('sabit dil denetimi örnek yazımları yakalar (olumsuz örnek)', () => {
    for (const sample of [
      "createFrappeRecordAdapter({ api, locale: 'tr' })",
      '<RecordView locale="tr" />',
      "<RecordView locale={'en'} />",
      "getDocTypeMeta({ doctype, language: 'tr', signal })",
    ]) {
      expect(HARDCODED_LOCALE_VALUE.test(sample), sample).toBe(true);
    }
    expect(HARDCODED_LOCALE_VALUE.test('<RecordView locale={language} />')).toBe(false);
    expect(HARDCODED_LOCALE_VALUE.test("{ locale = 'tr', name }")).toBe(false);
    expect(HARDCODED_LOCALE_VALUE.test('getDocTypeMeta({ doctype, language, signal })')).toBe(
      false,
    );
  });

  it('tarih, sayı ve harf dönüşümünde dil sabit yazılmaz (IC-13)', () => {
    const offenders = sourceFiles(SRC)
      .map((path) => relative(SRC, path))
      .filter((path) => path !== LOCALE_MAP)
      .filter((path) => !SAMPLE_DATA.some((dir) => path.startsWith(dir)))
      .filter((path) => HARDCODED_FORMAT_LOCALE.test(readFileSync(join(SRC, path), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('biçim denetimi örnek yazımları yakalar (olumsuz örnek)', () => {
    for (const sample of [
      "new Intl.NumberFormat('tr-TR')",
      "new Intl.DateTimeFormat('en', { weekday: 'long' })",
      "locale === 'tr' ? 'tr-TR' : 'en-US'",
      "value.toLocaleString('tr')",
      "text.toLocaleLowerCase('tr')",
      'word.toLocaleUpperCase("en")',
    ]) {
      expect(HARDCODED_FORMAT_LOCALE.test(sample), sample).toBe(true);
    }
    expect(HARDCODED_FORMAT_LOCALE.test('new Intl.NumberFormat(format.intl)')).toBe(false);
    expect(HARDCODED_FORMAT_LOCALE.test('text.toLocaleLowerCase(format.intl)')).toBe(false);
    expect(HARDCODED_FORMAT_LOCALE.test("timeZone: 'Europe/Istanbul'")).toBe(false);
  });

  it('dile bakmayan arama ve sıralama ortak yardımcıdan geçer (GILT 10)', () => {
    const offenders = sourceFiles(SRC)
      .map((path) => relative(SRC, path))
      .filter((path) => !path.startsWith('app/locale/'))
      .filter((path) => !SAMPLE_DATA.some((dir) => path.startsWith(dir)))
      .filter((path) => !CASE_ALLOWED.has(path))
      .filter((path) => BARE_CASE_OR_SORT.test(readFileSync(join(SRC, path), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('aramalı antd seçim kutusu kendi süzgecini verir (GILT 10)', () => {
    // The built-in antd filter upper-cases with `toUpperCase()`. That rule ignores the user's language.
    const offenders = sourceFiles(SRC)
      .map((path) => relative(SRC, path))
      .filter((path) => {
        const source = readFileSync(join(SRC, path), 'utf8');
        return countMatches(source, /\bshowSearch\b/g) > countMatches(source, /\bfilterOption=/g);
      });
    expect(offenders).toEqual([]);
  });

  it('ortak yardımcı denetimi örnek yazımları yakalar (olumsuz örnek)', () => {
    for (const sample of [
      'label.toLowerCase().includes(txt)',
      'name.toUpperCase()',
      'a.name.localeCompare(b.name)',
      'new Intl.Collator(intl)',
    ]) {
      expect(BARE_CASE_OR_SORT.test(sample), sample).toBe(true);
    }
    expect(BARE_CASE_OR_SORT.test('textMatches(item.label, txt, format.intl)')).toBe(false);
    expect(BARE_CASE_OR_SORT.test('foldCode(name)')).toBe(false);
  });
});

/**
 * Bare case conversion or sorting (GILT 10). Search and sort go through `app/locale/text.ts`.
 * Product codes and URL segments go through `app/locale/code.ts`.
 */
const BARE_CASE_OR_SORT = /\.(?:toLowerCase|toUpperCase|localeCompare)\(|new\s+Intl\.Collator\b/;

/** Files that change case for a reason other than search or sort. Each entry gives the reason. */
const CASE_ALLOWED = new Set([
  // HTML tag names are ASCII and case-insensitive by the HTML standard.
  'design/csp-nonce.ts',
  // HTML entity names are ASCII. The map key is lower case.
  'views/record/adapter.ts',
  // The sample record name prefix is built from the DocType name. This is sample data.
  'shell/sampleData.ts',
]);

function countMatches(source: string, pattern: RegExp): number {
  return source.match(pattern)?.length ?? 0;
}

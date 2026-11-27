// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..', '..');

/** The locale map file. Ant Design and Day.js locale objects are imported only here. */
const LOCALE_MAP = 'app/locale/locale-map.ts';

/** Hard-coded locale object import. Example: `antd/locale/tr_TR`, `antd/es/locale/en_US`, `dayjs/locale/tr`. */
const HARDCODED_LOCALE =
  /from\s+['"](?:antd\/(?:es\/|lib\/)?locale\/\w+|dayjs\/locale\/[\w-]+)['"]|import\s+['"]dayjs\/locale\//;

/**
 * Hard-coded language value. Example: `locale: 'tr'`, `locale="tr"`, `language: 'tr'`.
 * A default value (`props.locale ?? 'tr'`, `{ locale = 'tr' }`) is not covered by this rule; that form is the component's fallback.
 */
const HARDCODED_LOCALE_VALUE = /\b(?:locale|language)(?:\s*:\s*|=\{?\s*)['"](?:tr|en)['"]/;

/**
 * Hard-coded locale in formatting (IC-13). Example: `new Intl.NumberFormat('tr-TR')`, `'en-US'`,
 * `toLocaleString('tr')`, `toLocaleLowerCase('tr')`. The format locale comes from the language context.
 */
const HARDCODED_FORMAT_LOCALE =
  /['"][a-z]{2}-[A-Z]{2}['"]|new\s+Intl\.\w+\(\s*['"]|\.toLocale\w*\(\s*['"]/;

/**
 * Boot data of the sample server. The user language there is data, not a UI setting.
 * The mock assistant server is also a sample server. It matches Turkish keywords using Turkish case rules.
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
    // The UI's English is British English (AJA-1407).
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
});

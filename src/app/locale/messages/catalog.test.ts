import { describe, expect, it } from 'vitest';

import { CATALOGS, SOURCE_CATALOG, translate } from './index';
import { messageArguments } from './format-message';

const source = CATALOGS[SOURCE_CATALOG];

describe('ürün kataloğu', () => {
  it('kaynak katalog en-GB kataloğudur', () => {
    expect(SOURCE_CATALOG).toBe('en-GB');
  });

  it('anahtarlar İngilizce ve ASCII yazılır', () => {
    for (const key of Object.keys(source))
      expect(key).toMatch(/^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)+$/);
  });

  it('her katalogdaki her ileti çözülür ve değişkenleri kaynakla aynıdır', () => {
    for (const [id, catalog] of Object.entries(CATALOGS)) {
      for (const [key, message] of Object.entries(catalog)) {
        expect(key in source, `${id}: ${key} kaynakta yok`).toBe(true);
        const expected = messageArguments(source[key as keyof typeof source]).sort();
        expect(messageArguments(message as string).sort(), `${id}: ${key}`).toEqual(expected);
      }
    }
  });

  it('ileti parça değildir: başta ve sonda boşluk yoktur', () => {
    for (const catalog of Object.values(CATALOGS))
      for (const message of Object.values(catalog))
        expect(message).toBe((message as string).trim());
  });
});

describe('taşınan Türkçe metinler aynen kalır', () => {
  it.each([
    ['genui.json.unknownBlock', {}, 'Bu blok tanınmadı. Ham veri gösteriliyor.'],
    ['genui.kpis.label', {}, 'Göstergeler'],
    ['genui.source.title', {}, 'Kaynak'],
    ['genui.choices.label', {}, 'Öneriler'],
    ['genui.table.rowCount', { count: 3 }, '3 satır'],
    ['genui.table.rowCount', { count: 1 }, '1 satır'],
  ] as const)('%s', (key, values, text) => {
    expect(translate('tr', key, values)).toBe(text);
  });

  it('İngilizce satır sayısı tekil ve çoğulu ayırır', () => {
    expect(translate('en', 'genui.table.rowCount', { count: 1 })).toBe('1 row');
    expect(translate('en', 'genui.table.rowCount', { count: 3 })).toBe('3 rows');
  });
});

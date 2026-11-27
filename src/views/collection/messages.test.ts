import { describe, expect, it } from 'vitest';

import { COLLECTION_MESSAGES, formatCollectionMessage } from './messages';

describe('liste dil kataloğu (IC-9, IC-11)', () => {
  it('katalog anahtarları İngilizce ve ASCII yazılır', () => {
    for (const key of Object.keys(COLLECTION_MESSAGES.tr))
      expect(key).toMatch(/^collection(?:\.[a-z][A-Za-z0-9]*)+$/);
  });

  it('sayılı metin yer tutucu ve çoğul kuralıyla yazılır', () => {
    expect(formatCollectionMessage('tr', 'collection.bulk.selectedCount', { count: 3 })).toBe(
      '3 kayıt seçildi',
    );
    expect(formatCollectionMessage('tr', 'collection.bulk.selectedCount', { count: 1 })).toBe(
      '1 kayıt seçildi',
    );
    expect(
      formatCollectionMessage('tr', 'collection.bulk.previewSummary', { count: 2, names: 'A, B' }),
    ).toBe('2 kayıt onaylanır: A, B.');
  });

  it('deneme sayfası başlığı katalogdan gelir (AJA-1621)', () => {
    expect(COLLECTION_MESSAGES.tr).toHaveProperty(
      ['collection.preview.title'],
      'Koleksiyon örneği',
    );
  });

  it('çevirisi olmayan dil kaynak metne düşer, metin uydurulmaz', () => {
    expect(formatCollectionMessage('en', 'collection.bulk.cancel')).toBe('Vazgeç');
  });
});

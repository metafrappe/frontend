// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { COLLECTION_MESSAGES, formatCollectionMessage } from './messages';

const DIR = import.meta.dirname;

function read(name: string) {
  return readFileSync(join(DIR, name), 'utf8');
}

/**
 * AJA-1195 ile eklenen görünen metinler. Bu metinler dil kataloğundan gelir (IC-10).
 * Metin bileşende tırnak içinde ya da JSX metni olarak yazılmamalıdır.
 */
const MOVED: Record<string, readonly string[]> = {
  'BulkActions.tsx': [
    'Kayıtlar değişmedi. Onay işlemi henüz bağlı değil.',
    'Toplu işlem',
    'kayıt seçildi',
    'Seçilenleri onayla',
    'Seçimi kaldır',
    'Toplu işlem önizlemesi',
    'Önizleme.',
    'kayıt onaylanır',
    'Risk düzeyi: R2 Orta. Çok kaydı değiştirir.',
    'Önizlemeyi okudum.',
    'Onayla',
    'Vazgeç',
  ],
  'CardView.tsx': [' kayıtları', ' seç'],
  'TableView.tsx': ['Bu sayfadaki tüm kayıtları seç', ' seç'],
  'CollectionView.tsx': [
    'Kayıtlı görünüm',
    'Görünüm',
    'Liste araçları',
    'Süzgeç',
    'Sırala',
    'Seç',
    'Tablo',
    'İstenen görünüm şu anda kapalı. Tablo gösteriliyor.',
    'süzgeç etkin',
    'Etkin süzgeç yok.',
    'Etkin süzgeçler',
    'Kaldır',
    'Süzgeçleri temizle',
    'Kayıt ara',
    'Ara',
    'Sıralama alanı',
    'Sıralama yönü',
    'Artan',
    'Azalan',
    'Tümü',
    'Arama: ',
    'Aramayı kaldır',
    ' süzgecini kaldır',
    'Koleksiyon içeriği',
  ],
};

/** Metnin bileşende gömülü yazımı: tırnak içinde ya da iki JSX etiketi arasında. */
function embedded(source: string, text: string) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`['"\`]${escaped}|${escaped}['"\`]|>\\s*${escaped}\\s*<`).test(source);
}

describe('liste metinleri dil kataloğundan gelir (IC-9, IC-10, IC-11)', () => {
  it('bileşenler AJA-1195 metinlerini gömülü yazmaz', () => {
    const offenders = Object.entries(MOVED).flatMap(([file, texts]) =>
      texts.filter((text) => embedded(read(file), text)).map((text) => `${file}: ${text}`),
    );
    expect(offenders).toEqual([]);
  });

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

  it('çevirisi olmayan dil kaynak metne düşer, metin uydurulmaz', () => {
    expect(formatCollectionMessage('en', 'collection.bulk.cancel')).toBe('Vazgeç');
  });
});

/** Sınıf adıyla öğe bulma. Örnek: `locator('.collection-select')`, `querySelector('.x')`. */
const CLASS_LOCATOR = /(?:locator|querySelector(?:All)?(?:<[^>]+>)?)\(\s*['"`][^'"`]*\.[a-z][\w-]*/;

/** AJA-1195 ile eklenen e2e dosyaları. Bu dosyaların bütün satırları yenidir. */
const NEW_SPEC_FILES = ['list-parts.spec.ts', 'phone.spec.ts', 'phone-helpers.ts', 'bulk.spec.ts'];

/**
 * `collection.spec.ts` eski bir dosyadır. AJA-1195 bu dosyaya iki açma satırı ekledi.
 * Eski satırlara dokunulmaz (KR-2). Bu yüzden yalnız eklenen iki satır denetlenir.
 */
const NEW_COLLECTION_LINES = [/filter\(\{ has: popupOwner \}\)/, /filter\(\{ has: viewType \}\)/];

describe('yeni e2e testleri öğeyi rol ve etiketle bulur (TE-4)', () => {
  it('yeni satırlarda sınıf adıyla öğe bulunmaz', () => {
    const lines = [
      ...NEW_SPEC_FILES.flatMap((file) =>
        read('e2e/' + file)
          .split('\n')
          .map((line) => `${file}: ${line.trim()}`),
      ),
      ...read('e2e/collection.spec.ts')
        .split('\n')
        .filter((line) => NEW_COLLECTION_LINES.some((pattern) => pattern.test(line)))
        .map((line) => `collection.spec.ts: ${line.trim()}`),
    ];
    // Axe taramasının kapsamı CSS seçicisiyle verilir. Bu satır öğe bulmaz, taranacak alanı söyler.
    const offenders = lines.filter((line) => CLASS_LOCATOR.test(line) && !/AxeBuilder/.test(line));
    expect(offenders).toEqual([]);
  });
});

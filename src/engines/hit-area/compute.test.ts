import { describe, expect, it } from 'vitest';

import designSource from '@design-source/control-size-config.json';

import { box, computeHitAreas, idealExtension, type HitTarget } from './compute';

const E = designSource.hitArea.expand;

function target(id: string, b: ReturnType<typeof box>, extra: Partial<HitTarget> = {}): HitTarget {
  return { id, box: b, active: true, ...extra };
}

describe('dokunma alanı hesabı (R1–R10)', () => {
  it('kaynaktaki genişleme oranı %12’dir', () => {
    expect(E).toBe(0.12);
  });

  it('R1 Ölçek: tıklanabilir alan = görünen alan × 1.12', () => {
    const [r] = computeHitAreas([target('a', box(0, 0, 100, 42))]);
    expect(r?.hit.width).toBeCloseTo(100 * (1 + E), 6);
    expect(r?.hit.height).toBeCloseTo(42 * (1 + E), 6);
  });

  it('R2 Simetri: dört kenar eşit bölünür (w·E/2, h·E/2)', () => {
    const ext = idealExtension(box(0, 0, 100, 42), E);
    expect(ext.l).toBeCloseTo(6, 6);
    expect(ext.r).toBeCloseTo(6, 6);
    expect(ext.t).toBeCloseTo(2.52, 6);
    expect(ext.b).toBeCloseTo(2.52, 6);
  });

  it('R2: kaynaktaki ölçek tablosuyla aynı sonucu verir', () => {
    for (const row of designSource.hitArea.scale) {
      const [r] = computeHitAreas([target(row.size, box(0, 0, 200, row.visibleHeight))]);
      expect(r?.hit.height).toBeCloseTo(row.hitHeight, 2);
      expect(r?.extension.t).toBeCloseTo(row.extendTopBottom, 2);
      expect(r?.meetsMinTarget).toBe(row.meetsWcag258);
    }
  });

  it('R3 Komşu: aynı satırdaki komşuya bakan kenar boşluğun yarısını aşamaz', () => {
    // a: 0..100, b: 106..206 → gap 6 px, limit 3 px (ideal 6 px)
    const [a, b] = computeHitAreas([
      target('a', box(0, 0, 100, 42)),
      target('b', box(106, 0, 100, 42)),
    ]);
    expect(a?.extension.r).toBeCloseTo(3, 6);
    expect(a?.extension.l).toBeCloseTo(6, 6);
    expect(b?.extension.l).toBeCloseTo(3, 6);
    expect(a?.limitedByNeighbour).toBe(true);
    // no point belongs to two elements
    expect(100 + a!.extension.r).toBeLessThanOrEqual(106 - b!.extension.l + 1e-9);
  });

  it('R3: aynı sütundaki komşu dikey kenarı sınırlar', () => {
    const [a, b] = computeHitAreas([
      target('a', box(0, 0, 100, 42)),
      target('b', box(0, 44, 100, 42)),
    ]);
    expect(a?.extension.b).toBeCloseTo(1, 6);
    expect(b?.extension.t).toBeCloseTo(1, 6);
    expect(a?.extension.r).toBeCloseTo(6, 6);
  });

  it('R3: çapraz komşu dokunmaz', () => {
    const [a] = computeHitAreas([
      target('a', box(0, 0, 100, 42)),
      target('b', box(103, 50, 100, 42)),
    ]);
    expect(a?.extension).toEqual(idealExtension(box(0, 0, 100, 42), E));
    expect(a?.limitedByNeighbour).toBe(false);
  });

  it('R3: engel de komşu sayılır ama kendisi genişlemez', () => {
    const results = computeHitAreas(
      [target('a', box(0, 0, 100, 42))],
      [{ box: box(104, 0, 20, 20), active: true }],
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.extension.r).toBeCloseTo(2, 6);
  });

  it('R4 Bitişik: boşluk 0 veya negatifse o kenarda genişleme 0 olur', () => {
    const [a, b] = computeHitAreas([
      target('a', box(0, 0, 100, 42)),
      target('b', box(99, 0, 100, 42)),
    ]);
    expect(a?.extension.r).toBe(0);
    expect(b?.extension.l).toBe(0);
    expect(a?.extension.l).toBeCloseTo(6, 6);
    expect(b?.extension.r).toBeCloseTo(6, 6);
  });

  it('R4: üst üste binen kutularda yön merkez uzaklığına göre seçilir', () => {
    // Vertical stack, 1 px overlap (vertical Space.Compact)
    const [a, b] = computeHitAreas([
      target('a', box(0, 0, 100, 42)),
      target('b', box(0, 41, 100, 42)),
    ]);
    expect(a?.extension.b).toBe(0);
    expect(b?.extension.t).toBe(0);
    expect(a?.extension.l).toBeCloseTo(6, 6);
  });

  it('R5 İç içe: başka hedefin içindeki hedef hesaba girmez', () => {
    const results = computeHitAreas([
      target('outer', box(0, 0, 200, 42)),
      target('inner', box(160, 5, 32, 32), { parentId: 'outer' }),
    ]);
    expect(results.map((r) => r.id)).toEqual(['outer']);
    expect(results[0]?.extension.r).toBeCloseTo(12, 6);
  });

  it('R6 Pasif: disabled kontrol genişlemez ve komşuyu sınırlamaz', () => {
    const [a, b] = computeHitAreas([
      target('a', box(0, 0, 100, 42), { active: false }),
      target('b', box(104, 0, 100, 42)),
    ]);
    expect(a?.extension).toEqual({ t: 0, r: 0, b: 0, l: 0 });
    expect(a?.hit).toEqual({ width: 100, height: 42 });
    expect(b?.extension.l).toBeCloseTo(6, 6);
  });

  it('R6: boyutsuz kontrol genişlemez', () => {
    const [a] = computeHitAreas([target('a', box(0, 0, 0, 0), { active: false })]);
    expect(a?.hit).toEqual({ width: 0, height: 0 });
  });

  it('R8 Kenarlık: kenarlık kalınlığı offset’e eklenir, ölçüm değişmez', () => {
    const [a] = computeHitAreas([
      target('a', box(0, 0, 100, 42), { border: { t: 1, r: 1, b: 1, l: 1 } }),
    ]);
    expect(a?.extension.t).toBeCloseTo(2.52, 6);
    expect(a?.offset.t).toBeCloseTo(3.52, 6);
    expect(a?.offset.l).toBeCloseTo(7, 6);
    expect(a?.hit.height).toBeCloseTo(42 * (1 + E), 6);
  });

  it('R10 Doğrulama: tıklanabilir yükseklik 24 px altında kalırsa raporlar', () => {
    const [link, button] = computeHitAreas([
      target('link', box(0, 0, 71.56, 20)),
      target('button', box(0, 100, 130, 42)),
    ]);
    expect(link?.hit.height).toBeCloseTo(22.4, 6);
    expect(link?.meetsMinTarget).toBe(false);
    expect(button?.meetsMinTarget).toBe(true);
    expect(designSource.hitArea.minTarget).toBe(24);
  });

  it('kaynaktaki ölçümlerle örtüşür: "Yeni sipariş" butonu', () => {
    // Source: visible 140.43 × 41.99, limited by neighbours, hit 148.42 × 47.03
    const measured = designSource.hitArea.measurements.find((m) => m.label === 'Yeni sipariş');
    expect(measured).toBeDefined();
    const [r] = computeHitAreas([
      target('export', box(0, 0, 130.74, 41.99)),
      target('new', box(138.72, 0, 140.43, 41.99)),
      target('more', box(287.13, 0, 41.99, 41.99)),
    ]).filter((x) => x.id === 'new');
    expect(r?.hit.height).toBeCloseTo(47.03, 1);
    expect(r?.extension.l).toBeCloseTo(3.99, 2);
    expect(r?.extension.r).toBeCloseTo(3.99, 2);
  });
});

describe('sayfa kenarı sınırı', () => {
  it('genişleme sayfa kenarını aşamaz', () => {
    const bounds = { left: 0, right: 320 };
    const [a, b] = computeHitAreas(
      [target('a', box(0, 0, 100, 42)), target('b', box(300, 0, 20, 42))],
      [],
      { bounds },
    );
    expect(a?.extension.l).toBe(0);
    expect(a?.extension.r).toBeCloseTo(6, 6);
    expect(b?.extension.r).toBe(0);
    expect(a?.limitedByNeighbour).toBe(true);
  });

  it('kenardan uzak kontrol etkilenmez', () => {
    const [a] = computeHitAreas([target('a', box(50, 0, 100, 42))], [], {
      bounds: { left: 0, right: 320 },
    });
    expect(a?.extension.l).toBeCloseTo(6, 6);
    expect(a?.extension.r).toBeCloseTo(6, 6);
  });
});

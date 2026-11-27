import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GenUI } from './GenUI';
import { GENUI_REGISTRY } from './registry';
import { parseBlock, parseBlocks } from './schema';
import type { GenUIActionResult } from './types';
import { SURFACE_SAMPLES, SURFACE_STATES } from './demo/samples';

/**
 * Six AI surfaces (AJA-1156): scope strip, tool event list, source card,
 * change review, decision queue and result card.
 */
const accept = () => vi.fn((): GenUIActionResult => 'accepted');

function draw(raw: unknown[]) {
  return render(<GenUI blocks={parseBlocks(raw)} onAction={accept()} />);
}

const SURFACE_TYPES = ['scope', 'events', 'source', 'review', 'queue', 'result'] as const;

describe('Yüzey kaydı', () => {
  it('altı yüzeyi onaylı kayıtta tutar', () => {
    for (const type of SURFACE_TYPES) expect(GENUI_REGISTRY).toHaveProperty(type);
  });

  it('deneme örneklerinin hepsi şemadan geçer', () => {
    for (const sample of [...SURFACE_SAMPLES, ...SURFACE_STATES]) {
      expect(parseBlock(sample).type, sample.type).not.toBe('unknown');
    }
  });

  it('kayıtta olmayan blok tipini hiç çizmez', () => {
    const { container } = draw([{ type: 'html', body: '<b>x</b>' }]);
    expect(container.querySelector('[data-genui]')).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('kayıtta olmayan blok yanındaki kayıtlı yüzeyi bozmaz', () => {
    const { container } = draw([
      { type: 'html', body: '<b>x</b>' },
      { type: 'result', outcome: 'succeeded', summary: 'Kayıt güncellendi.' },
    ]);
    expect(container.querySelectorAll('[data-genui]')).toHaveLength(1);
    expect(container.querySelector('[data-genui="result"]')).not.toBeNull();
  });
});

describe('Güven yüzdesi ve iç düşünce', () => {
  const extras = [
    { confidence: 0.92 },
    { confidencePercent: 92 },
    { guven: 92 },
    { reasoning: 'Önce kaydı okudum.' },
    { thinking: 'Önce kaydı okudum.' },
  ];

  it.each(SURFACE_TYPES)('%s yüzeyi fazladan alanı reddeder', (type) => {
    const sample = SURFACE_SAMPLES.find((block) => block.type === type);
    expect(sample).toBeDefined();
    for (const extra of extras) {
      expect(parseBlock({ ...sample, ...extra }).type).toBe('unknown');
    }
  });

  it('kaynak satırındaki güven alanını da reddeder', () => {
    const block = {
      type: 'source',
      items: [{ title: 'İzin talebi İZN-0041', url: '/hr/leave/IZN-0041', confidence: 0.8 }],
    };
    expect(parseBlock(block).type).toBe('unknown');
  });

  it('reddedilen yüzeyin ham verisini ekrana basmaz', () => {
    const { container } = draw([
      { type: 'result', outcome: 'succeeded', summary: 'Bitti.', confidence: 0.92 },
    ]);
    expect(container.textContent).not.toContain('0.92');
    expect(container.querySelector('[data-genui]')).toBeNull();
  });
});

describe('Kapsam şeridi', () => {
  it('kiracıyı, ortamı, kipi ve kapsamı yazıyla gösterir', () => {
    draw([
      {
        type: 'scope',
        tenant: 'Örnek Şirket',
        environment: 'Deneme',
        mode: 'act',
        scope: 'İnsan kaynakları',
      },
    ]);
    const strip = screen.getByRole('group', { name: 'Kapsam' });
    expect(within(strip).getByText('Kiracı')).toBeTruthy();
    expect(within(strip).getByText('Örnek Şirket')).toBeTruthy();
    expect(within(strip).getByText('Deneme')).toBeTruthy();
    expect(within(strip).getByText('İşlem yap')).toBeTruthy();
    expect(within(strip).getByText('İnsan kaynakları')).toBeTruthy();
  });

  it('tanımsız kipi reddeder', () => {
    expect(
      parseBlock({ type: 'scope', tenant: 'A', environment: 'Deneme', mode: 'auto' }).type,
    ).toBe('unknown');
  });
});

describe('Araç olayı listesi', () => {
  it('olayları sırayla, araç adı ve durum yazısıyla gösterir', () => {
    draw([
      {
        type: 'events',
        items: [
          { id: 'e1', tool: 'izin_talebi.oku', summary: 'İZN-0041 okundu.', status: 'done' },
          { id: 'e2', tool: 'oneri.ac', summary: 'Öneri açılıyor.', status: 'running' },
          { id: 'e3', tool: 'bildirim.gonder', summary: 'Gönderilemedi.', status: 'failed' },
        ],
      },
    ]);
    const list = screen.getByRole('list', { name: 'Araç olayları' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]?.textContent).toContain('izin_talebi.oku');
    expect(items[0]?.textContent).toContain('Bitti');
    expect(items[1]?.textContent).toContain('Sürüyor');
    expect(items[2]?.textContent).toContain('Başarısız');
  });

  it('olay kimlikleri tekil değilse reddeder', () => {
    const item = { id: 'e1', tool: 'a.b', summary: 'x', status: 'done' };
    expect(parseBlock({ type: 'events', items: [item, item] }).type).toBe('unknown');
  });
});

describe('Kaynak kartı', () => {
  it('kaynağın adını ve bağlantısını gösterir', () => {
    draw([
      {
        type: 'source',
        items: [{ title: 'İzin talebi İZN-0041', url: '/hr/leave/IZN-0041' }],
      },
    ]);
    const link = screen.getByRole('link', { name: /İzin talebi İZN-0041/ });
    expect(link.getAttribute('href')).toBe('/hr/leave/IZN-0041');
  });

  it('bağlantısı olmayan kaynağın adını düz metin yazar', () => {
    draw([{ type: 'source', items: [{ title: 'Kullanıcı listesi' }] }]);
    expect(screen.getByText('Kullanıcı listesi')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('kaynak yoksa "Kaynak yok" yazar', () => {
    draw([{ type: 'source', items: [] }]);
    expect(screen.getByText('Kaynak yok.')).toBeTruthy();
  });

  it('güvensiz bağlantı biçimini reddeder', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,x', '//evil.example', 'ftp://a.b']) {
      expect(parseBlock({ type: 'source', items: [{ title: 'X', url }] }).type).toBe('unknown');
    }
  });

  it('dış bağlantıyı yeni sekmede ve yönlendiren bilgisi olmadan açar', () => {
    draw([{ type: 'source', items: [{ title: 'Yönetmelik', url: 'https://example.org/a' }] }]);
    const link = screen.getByRole('link', { name: /Yönetmelik/ });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.textContent).toContain('yeni sekmede açılır');
  });
});

describe('Değişiklik incelemesi', () => {
  const review = {
    type: 'review',
    summary: 'İZN-0041 talebinin bitiş tarihi bir gün öne alınır.',
    risk: 'R1',
    target: 'İzin talebi İZN-0041, Örnek Kişi 3',
    reversible: 'Kendiliğinden geri alınmaz.',
    changes: [
      { field: 'Bitiş tarihi', before: '12 Aralık 2026', after: '11 Aralık 2026' },
      { field: 'Gün sayısı', before: '5', after: '4' },
    ],
    sources: [{ title: 'İzin talebi İZN-0041', url: '/hr/leave/IZN-0041' }],
  };

  it('özeti, risk düzeyini, hedefi, önce ve sonra tablosunu ve kaynağı gösterir', () => {
    draw([review]);
    const group = screen.getByRole('group', { name: 'Değişiklik önerisi' });
    expect(within(group).getByText(review.summary)).toBeTruthy();
    expect(within(group).getByText('R1 Düşük')).toBeTruthy();
    expect(within(group).getByText(review.target)).toBeTruthy();
    expect(within(group).getByText(review.reversible)).toBeTruthy();
    expect(within(group).getByRole('table', { name: 'Değişecek alanlar' })).toBeTruthy();
    expect(within(group).getByText('11 Aralık 2026')).toBeTruthy();
    expect(within(group).getByRole('link', { name: /İZN-0041/ })).toBeTruthy();
  });

  it('onay düğmesi taşımaz', () => {
    draw([review]);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('kaynak listesi yoksa "Kaynak yok" yazar', () => {
    const { sources: _omit, ...withoutSources } = review;
    draw([withoutSources]);
    expect(screen.getByText('Kaynak yok.')).toBeTruthy();
  });

  it('değişiklik listesi boşsa reddeder', () => {
    expect(parseBlock({ ...review, changes: [] }).type).toBe('unknown');
  });

  it('tanımsız risk düzeyini reddeder', () => {
    expect(parseBlock({ ...review, risk: 'R9' }).type).toBe('unknown');
  });
});

describe('Karar kuyruğu', () => {
  it('bekleyen kararları sayısıyla listeler', () => {
    draw([
      {
        type: 'queue',
        items: [
          { id: 'q1', title: 'Örnek Kişi 3: Yıllık izin', detail: '5 gün.', risk: 'R1' },
          { id: 'q2', title: 'Örnek Kişi 5: Mazeret izni', risk: 'R1' },
        ],
      },
    ]);
    expect(screen.getByRole('heading', { name: 'Kararınızı bekleyen 2 iş var' })).toBeTruthy();
    const list = screen.getByRole('list', { name: 'Bekleyen kararlar' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText('5 gün.')).toBeTruthy();
  });

  it('boş kuyrukta "Bekleyen karar yok" yazar', () => {
    draw([{ type: 'queue', items: [] }]);
    expect(screen.getByText('Kararınızı bekleyen iş yok.')).toBeTruthy();
  });

  it('onay düğmesi taşımaz', () => {
    draw([{ type: 'queue', items: [{ id: 'q1', title: 'A', risk: 'R2' }] }]);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Sonuç kartı', () => {
  it.each([
    ['succeeded', 'Sonuç: başarılı.'],
    ['failed', 'Sonuç: başarısız.'],
    ['unknown', 'Sonuç: bilinmiyor.'],
  ])('%s sonucunu yazıyla gösterir', (outcome, label) => {
    draw([{ type: 'result', outcome, summary: 'İZN-0041 güncellendi.' }]);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain(label);
    expect(status.textContent).toContain('İZN-0041 güncellendi.');
  });

  it('tanımsız sonucu reddeder', () => {
    expect(parseBlock({ type: 'result', outcome: 'partial', summary: 'x' }).type).toBe('unknown');
  });
});

describe('Yüzey metinleri', () => {
  it('örneklerde yüzde işareti ve güven sözcüğü geçmez', () => {
    const { container } = render(
      <GenUI blocks={parseBlocks(SURFACE_SAMPLES)} onAction={accept()} />,
    );
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/%|güven/i);
  });
});

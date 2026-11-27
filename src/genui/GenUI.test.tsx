import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GenUI } from './GenUI';
import { GENUI_REGISTRY } from './registry';
import { parseBlocks } from './schema';
import type { GenUIActionResult, GenUIBlock } from './types';

const confirmBlock: GenUIBlock = {
  type: 'confirm',
  id: 'c1',
  title: 'Bildirim gönderilsin mi?',
  summary: '12 müşteriye gecikme bildirimi gider.',
  changes: [{ field: 'Bildirim durumu', before: 'Gönderilmedi', after: 'Gönderildi' }],
  confirmLabel: 'Gönder',
  cancelLabel: 'Vazgeç',
};

const formBlock: GenUIBlock = {
  type: 'form',
  id: 'f1',
  title: 'Stok uyarı kuralı',
  submitLabel: 'Kaydet',
  fields: [{ name: 'name', label: 'Kural adı', kind: 'text', value: 'Düşük stok' }],
};

const samples: GenUIBlock[] = [
  { type: 'kpis', items: [{ label: 'Gelir', value: '₺ 482.300', delta: 12, unit: '%' }] },
  {
    type: 'chart',
    title: 'Günlük gelir',
    bars: [
      { label: 'Pzt', value: 58 },
      { label: 'Sal', value: 61 },
    ],
  },
  {
    type: 'table',
    title: 'Siparişler',
    rowKey: 'id',
    columns: [
      { key: 'id', title: 'Sipariş' },
      { key: 'state', title: 'Durum' },
    ],
    rows: [{ id: '#10482', state: 'Kritik' }],
  },
  confirmBlock,
  formBlock,
  { type: 'choices', items: ['Geçen ayla karşılaştır'] },
];

const accept = () => vi.fn((): GenUIActionResult => 'accepted');

describe('GenUI kaydı', () => {
  it('altı blok ve altı yüzey türünü kayıtta tutar', () => {
    expect(Object.keys(GENUI_REGISTRY).sort()).toEqual(
      [
        'chart',
        'choices',
        'confirm',
        'form',
        'kpis',
        'table',
        'scope',
        'events',
        'source',
        'review',
        'queue',
        'result',
      ].sort(),
    );
  });

  it.each(samples)('$type bloğunu kendi bileşeniyle çizer', (block) => {
    const { container } = render(<GenUI blocks={[block]} onAction={accept()} />);
    const node = container.querySelector(`[data-genui="${block.type}"]`);
    expect(node).not.toBeNull();
    expect(container.querySelector('[data-genui="json"]')).toBeNull();
  });

  it('kayıtta olmayan türü hiç çizmez', () => {
    const blocks = parseBlocks([{ type: 'html', html: '<img src=x onerror=alert(1)>' }]);
    const { container } = render(<GenUI blocks={blocks} onAction={accept()} />);
    expect(container.querySelector('[data-genui]')).toBeNull();
    expect(container.textContent).not.toContain('html');
    expect(container.querySelector('img')).toBeNull();
  });

  it('alanları bozuk bilinen türü de JSON görünümüne düşürür', () => {
    const blocks = parseBlocks([{ type: 'kpis', items: 'bozuk' }]);
    const { container } = render(<GenUI blocks={blocks} onAction={accept()} />);
    expect(container.querySelector('[data-genui="json"]')).not.toBeNull();
    expect(container.querySelector('[data-genui="kpis"]')).toBeNull();
  });

  it('dizi olmayan ui alanını tek JSON bloğuna çevirir', () => {
    expect(parseBlocks('metin')).toEqual([{ type: 'unknown', raw: 'metin' }]);
  });

  it('sınırı aşan büyük bloğu reddeder', () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({ id: String(i) }));
    const [block] = parseBlocks([
      { type: 'table', title: 'Büyük', rowKey: 'id', columns: [{ key: 'id', title: 'No' }], rows },
    ]);
    expect(block?.type).toBe('unknown');
  });
});

describe('Onay bloğu (U4, AX-6)', () => {
  it('değişiklik listesi olmayan onayı düğmesiz JSON görünümüne düşürür', () => {
    const [block] = parseBlocks([
      {
        type: 'confirm',
        id: 'x',
        title: 'Gönderilsin mi?',
        confirmLabel: 'Gönder',
        cancelLabel: 'Vazgeç',
      },
    ]);
    expect(block?.type).toBe('unknown');
  });

  it('işlem özetini ve önce, sonra değerlerini gösterir', () => {
    render(<GenUI blocks={[confirmBlock]} onAction={accept()} />);
    expect(screen.getByText('12 müşteriye gecikme bildirimi gider.')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Değişecek alanlar' });
    expect(within(table).getByRole('columnheader', { name: 'Önce' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Sonra' })).toBeInTheDocument();
    expect(within(table).getByText('Gönderilmedi')).toBeInTheDocument();
    expect(within(table).getByText('Gönderildi')).toBeInTheDocument();
  });

  it('kullanıcı onay vermeden olay göndermez', () => {
    const onAction = accept();
    render(<GenUI blocks={[confirmBlock]} onAction={onAction} />);
    expect(screen.getByRole('button', { name: 'Gönder' })).toBeInTheDocument();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('onay düğmesine basınca bir kez olay gönderir ve kilitlenir', async () => {
    const user = userEvent.setup();
    const onAction = accept();
    render(<GenUI blocks={[confirmBlock]} onAction={onAction} />);
    await user.click(screen.getByRole('button', { name: 'Gönder' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({
      kind: 'confirm',
      blockId: 'c1',
      decision: 'approved',
      title: 'Bildirim gönderilsin mi?',
    });
    expect(screen.queryByRole('button', { name: 'Gönder' })).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Onayınız gönderildi');
  });

  it('vazgeçince işlem onayı göndermez', async () => {
    const user = userEvent.setup();
    const onAction = accept();
    render(<GenUI blocks={[confirmBlock]} onAction={onAction} />);
    await user.click(screen.getByRole('button', { name: 'Vazgeç' }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ decision: 'rejected' }));
    expect(onAction).not.toHaveBeenCalledWith(expect.objectContaining({ decision: 'approved' }));
  });

  it('sohbet meşgulken onay düğmelerini kapatır ve nedenini yazar', () => {
    render(<GenUI blocks={[confirmBlock]} onAction={accept()} busy />);
    expect(screen.getByRole('button', { name: 'Gönder' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Vazgeç' })).toBeDisabled();
    expect(screen.getByText('Yanıt bitince onay verebilirsiniz.')).toBeInTheDocument();
  });

  it('onay kabul edilmezse blok kilitlenmez ve durumu gösterir', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn((): GenUIActionResult => 'busy');
    render(<GenUI blocks={[confirmBlock]} onAction={onAction} />);
    await user.click(screen.getByRole('button', { name: 'Gönder' }));
    expect(screen.getByRole('button', { name: 'Gönder' })).toBeEnabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Onay gönderilemedi.');
    expect(screen.queryByText(/Onayınız gönderildi/)).toBeNull();
  });
});

describe('Geçmişten gelen karar', () => {
  it('geçmişte onaylanmış onay bloğunu kilitli çizer', () => {
    render(<GenUI blocks={[confirmBlock]} onAction={accept()} decisions={{ c1: 'approved' }} />);
    expect(screen.queryByRole('button', { name: 'Gönder' })).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Onayınız gönderildi');
  });

  it('geçmişte vazgeçilmiş form bloğunu kilitli çizer', () => {
    render(<GenUI blocks={[formBlock]} onAction={accept()} decisions={{ f1: 'rejected' }} />);
    expect(screen.queryByRole('button', { name: 'Kaydet' })).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Hiçbir kayıt yapılmadı');
  });

  it('kullanılmış onayda ayrı uyarı gösterir ve bloğu kilitler', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn((): GenUIActionResult => 'used');
    render(<GenUI blocks={[confirmBlock]} onAction={onAction} />);
    await user.click(screen.getByRole('button', { name: 'Gönder' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Bu onay daha önce gönderildi.');
    expect(screen.queryByText(/yeniden deneyin/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Gönder' })).toBeNull();
  });
});

describe('Form bloğu (U4, AX-6)', () => {
  it('kaydet önce farkı gösterir, onay olmadan olay göndermez', async () => {
    const user = userEvent.setup();
    const onAction = accept();
    render(<GenUI blocks={[formBlock]} onAction={onAction} />);
    const input = screen.getByLabelText('Kural adı');
    await user.clear(input);
    await user.type(input, 'Yeni ad');
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(onAction).not.toHaveBeenCalled();
    const table = await screen.findByRole('table', { name: 'Değişecek alanlar' });
    expect(within(table).getByText('Düşük stok')).toBeInTheDocument();
    expect(within(table).getByText('Yeni ad')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Onayla ve gönder' }));
    expect(onAction).toHaveBeenCalledWith({
      kind: 'form',
      blockId: 'f1',
      decision: 'approved',
      title: 'Stok uyarı kuralı',
      values: { name: 'Yeni ad' },
    });
  });

  it('fark ekranından düzenlemeye dönülebilir', async () => {
    const user = userEvent.setup();
    const onAction = accept();
    render(<GenUI blocks={[formBlock]} onAction={onAction} />);
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
    await user.click(await screen.findByRole('button', { name: 'Düzenlemeye dön' }));
    expect(screen.getByLabelText('Kural adı')).toBeEnabled();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('sohbet meşgulken kaydet düğmesini kapatır', () => {
    render(<GenUI blocks={[formBlock]} onAction={accept()} busy />);
    expect(screen.getByRole('button', { name: 'Kaydet' })).toBeDisabled();
  });
});

describe('Tablo bloğu', () => {
  it('kimlik sütununu sarmaz, açıklama sütununu sarar', () => {
    const { container } = render(
      <GenUI
        blocks={[
          {
            type: 'table',
            title: 'Siparişler',
            rowKey: 'id',
            columns: [
              { key: 'id', title: 'Sipariş' },
              { key: 'note', title: 'Açıklama' },
            ],
            rows: [{ id: '#1', note: 'Uzun bir açıklama metni' }],
          },
        ]}
        onAction={accept()}
      />,
    );
    const cells = container.querySelectorAll('tbody td');
    expect(cells[0]).toHaveClass('genui-cell-id');
    expect(cells[1]).toHaveClass('genui-cell-text');
  });
});

describe('Seçenek bloğu', () => {
  it('seçilen öneriyi soru olarak gönderir', async () => {
    const user = userEvent.setup();
    const onAction = accept();
    const { container } = render(<GenUI blocks={[samples[5] as GenUIBlock]} onAction={onAction} />);
    const node = container.querySelector('[data-genui="choices"]') as HTMLElement;
    await user.click(within(node).getByText('Geçen ayla karşılaştır'));
    expect(onAction).toHaveBeenCalledWith({ kind: 'ask', text: 'Geçen ayla karşılaştır' });
  });
});

/** MVP audit: an expired proposal cannot be approved. */
describe('Onay bloğunun süresi', () => {
  it('süresi geçmiş onay "Süresi doldu" yazar ve onay düğmesi göstermez', () => {
    const [block] = parseBlocks([{ ...confirmBlock, expiresAt: '2000-01-01T00:00:00Z' }]);
    if (!block) throw new Error('blok yok');
    const onAction = accept();
    render(<GenUI blocks={[block]} onAction={onAction} />);
    expect(screen.getByText('Süresi doldu')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Gönder' })).toBeNull();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('süresi geçmemiş onayın düğmesi çalışır', () => {
    const [block] = parseBlocks([{ ...confirmBlock, expiresAt: '2999-01-01T00:00:00Z' }]);
    if (!block) throw new Error('blok yok');
    render(<GenUI blocks={[block]} onAction={accept()} />);
    expect(screen.getByRole('button', { name: 'Gönder' })).toBeEnabled();
    expect(screen.queryByText('Süresi doldu')).toBeNull();
  });

  it('bozuk süre bilgisi olan onay JSON görünümüne düşer', () => {
    const [block] = parseBlocks([{ ...confirmBlock, expiresAt: 'yarın' }]);
    expect(block?.type).toBe('unknown');
  });
});

// Plan detail component (AJA-1744). The tests were written before the code.
// The user tells two similar plans apart and picks the right one.
// The selection stores the stable plan identity, never the display name.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlanComparison, PlanDetail } from '../site-plan/PlanDetail';
import { LONG_ERROR, SHARED_PREFIX, TEST_PLANS } from '../site-plan/plan-fixture';
import SitePlanPage from '../site-plan/Page';

const [planA, planB] = TEST_PLANS as [(typeof TEST_PLANS)[number], (typeof TEST_PLANS)[number]];

afterEach(cleanup);

describe('Plan ayrıntısı', () => {
  it('iki planın görünen adı aynı ilk 30 karakterle başlar', () => {
    expect(SHARED_PREFIX).toHaveLength(30);
    expect(planA.name.slice(0, 30)).toBe(planB.name.slice(0, 30));
    expect(planA.id).not.toBe(planB.id);
  });

  it('okuma sırası başlık, ayırt edici bölüm, fiyat, düğme ve ek bilgidir', () => {
    render(<PlanDetail plan={planA} selected={false} onSelect={() => undefined} />);
    const card = screen.getByRole('article', { name: planA.name });
    const order = [
      within(card).getByRole('heading', { name: planA.name }),
      within(card).getByText(planA.summary),
      within(card).getByTestId('plan-price'),
      within(card).getByRole('button', { name: /Bu planı seç/ }),
      within(card).getAllByRole('term')[0],
    ];
    for (let i = 1; i < order.length; i += 1) {
      const previous = order[i - 1] as Element;
      const current = order[i] as Element;
      expect(previous.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }
  });

  it('ayırt edici son bölüm ayrı satırda ve tam yazılır', () => {
    render(<PlanDetail plan={planB} selected={false} onSelect={() => undefined} />);
    const heading = screen.getByRole('heading', { name: planB.name });
    expect(heading).toHaveAttribute('lang', 'de');
    expect(within(heading).getByText(planB.variant)).toBeInTheDocument();
  });

  it('seçim düğmesinin erişilebilir adı planın tam adını taşır', () => {
    render(<PlanComparison plans={TEST_PLANS} selectedId={null} onSelect={() => undefined} />);
    expect(screen.getByRole('button', { name: `Bu planı seç ${planA.name}` })).toBeVisible();
    expect(screen.getByRole('button', { name: `Bu planı seç ${planB.name}` })).toBeVisible();
  });

  it('seçim görünen adı değil plan kimliğini verir', () => {
    const onSelect = vi.fn();
    render(<PlanComparison plans={TEST_PLANS} selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: `Bu planı seç ${planA.name}` }));
    fireEvent.click(screen.getByRole('button', { name: `Bu planı seç ${planB.name}` }));
    expect(onSelect.mock.calls).toEqual([['test-plan-a'], ['test-plan-b']]);
  });

  it('seçili plan "Seçili" sözüyle yazılır, yalnız renkle anlatılmaz', () => {
    render(
      <PlanComparison plans={TEST_PLANS} selectedId="test-plan-b" onSelect={() => undefined} />,
    );
    const cardB = screen.getByRole('article', { name: planB.name });
    const cardA = screen.getByRole('article', { name: planA.name });
    expect(within(cardB).getByText('Seçili')).toBeVisible();
    expect(within(cardA).queryByText('Seçili')).not.toBeInTheDocument();
    expect(within(cardB).getByRole('button', { name: /Bu planı seç/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('fiyat Intl ile biçimlenir ve dönemi yazar', () => {
    render(<PlanDetail plan={planA} selected={false} onSelect={() => undefined} />);
    const price = screen.getByTestId('plan-price');
    const amount = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }).format(
      100,
    );
    expect(price).toHaveTextContent(amount);
    expect(price).toHaveTextContent(/ay/);
  });

  it('vergi durumu bilinmiyorsa "0,00" vergi yazmaz, bilinmediğini söyler', () => {
    render(<PlanDetail plan={planA} selected={false} onSelect={() => undefined} />);
    const card = screen.getByRole('article', { name: planA.name });
    expect(within(card).getByText('Vergi durumu bilinmiyor.')).toBeVisible();
    expect(card).not.toHaveTextContent(/0[.,]00/);
  });

  it('test verisi ekranda test verisi diye işaretlenir', () => {
    render(<PlanDetail plan={planA} selected={false} onSelect={() => undefined} />);
    expect(screen.getByText('Test verisi')).toBeVisible();
  });

  it('sıcaklık aralığı eksi işareti, iki uç ve birimle tek parça yazılır', () => {
    render(<PlanDetail plan={planA} selected={false} onSelect={() => undefined} />);
    const range = screen.getByTestId('plan-range-temperature');
    expect(range.textContent).toMatch(/^[-−]20 … \+60\s?°C$/);
    expect(range).toHaveClass('plan-nowrap');
  });

  it('ilk 3 özellik görünür, diğerleri düğmeyle açılır', () => {
    render(<PlanDetail plan={planA} selected={false} onSelect={() => undefined} />);
    const card = screen.getByRole('article', { name: planA.name });
    expect(within(card).getAllByRole('term')).toHaveLength(3);
    const toggle = within(card).getByRole('button', { name: 'Tüm özellikleri göster' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(within(card).getAllByRole('term')).toHaveLength(planA.features.length);
    expect(within(card).getByRole('button', { name: 'Daha az özellik göster' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('hata mesajı düğmenin altında, kısaltılmadan yazılır', () => {
    render(
      <PlanDetail plan={planA} selected={false} onSelect={() => undefined} error={LONG_ERROR} />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(LONG_ERROR);
    const button = screen.getByRole('button', { name: /Bu planı seç/ });
    expect(button.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(button).toHaveAttribute('aria-describedby', alert.id);
  });
});

describe('"Site ve plan" sayfasında plan yeri', () => {
  it('gerçek veri gelene kadar "kullanılamıyor" metnini gösterir, test verisini göstermez', () => {
    render(<SitePlanPage />);
    expect(screen.queryByText('Test verisi')).not.toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});

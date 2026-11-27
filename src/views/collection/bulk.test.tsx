import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CollectionView } from './CollectionView';
import { mockServer } from '@/mocks/node';
import { resetMockState } from '@/mocks/handlers';
import { sampleDefinition } from './sample';
import { sampleSource } from './test-support/api';
import type { CollectionSource } from './types';

function mount(source: CollectionSource = sampleSource()) {
  return render(
    <MemoryRouter>
      <CollectionView definition={sampleDefinition} source={source} />
    </MemoryRouter>,
  );
}
async function openSelection() {
  await screen.findByText('ORNEK-0001');
  fireEvent.click(screen.getByRole('button', { name: 'Seç' }));
}
beforeAll(() => {
  mockServer.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  mockServer.resetHandlers();
  resetMockState();
});
afterAll(() => {
  mockServer.close();
});

describe('bulk action bar', () => {
  it('shows row checkboxes only after "Seç" turns selection mode on', async () => {
    mount();
    await screen.findByText('ORNEK-0001');
    const toggle = screen.getByRole('button', { name: 'Seç' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('checkbox', { name: 'ORNEK-0001 seç' })).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('checkbox', { name: 'ORNEK-0001 seç' })).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.queryByRole('checkbox', { name: 'ORNEK-0001 seç' })).not.toBeInTheDocument();
  });

  it('hides the bar until a record is selected and counts selected records', async () => {
    mount();
    await openSelection();
    expect(screen.queryByRole('region', { name: 'Toplu işlem' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'ORNEK-0001 seç' }));
    const bar = screen.getByRole('region', { name: 'Toplu işlem' });
    expect(bar).toHaveTextContent('1 kayıt seçildi');
    fireEvent.click(screen.getByRole('checkbox', { name: 'ORNEK-0002 seç' }));
    expect(bar).toHaveTextContent('2 kayıt seçildi');
    expect(within(bar).getByRole('button', { name: 'Seçilenleri onayla' })).toBeInTheDocument();
    fireEvent.click(within(bar).getByRole('button', { name: 'Seçimi kaldır' }));
    expect(screen.queryByRole('region', { name: 'Toplu işlem' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'ORNEK-0001 seç' })).not.toBeChecked();
  });

  it('previews the risk and keeps "Onayla" off until the preview is read', async () => {
    const list = vi.fn(sampleSource().list);
    mount({ list });
    await openSelection();
    fireEvent.click(screen.getByRole('checkbox', { name: 'ORNEK-0001 seç' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'ORNEK-0002 seç' }));
    fireEvent.click(screen.getByRole('button', { name: 'Seçilenleri onayla' }));
    const preview = screen.getByRole('region', { name: 'Toplu işlem önizlemesi' });
    expect(preview).toHaveTextContent('2 kayıt onaylanır: ORNEK-0001, ORNEK-0002.');
    expect(preview).toHaveTextContent('Risk düzeyi: R2 Orta. Çok kaydı değiştirir.');
    const ack = within(preview).getByRole('checkbox', { name: 'Önizlemeyi okudum.' });
    expect(ack).toHaveFocus();
    const confirm = within(preview).getByRole('button', { name: 'Onayla' });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(within(preview).getByRole('status')).toBeEmptyDOMElement();
    fireEvent.click(ack);
    expect(confirm).toBeEnabled();
    const calls = list.mock.calls.length;
    fireEvent.click(confirm);
    // Değişiklik ucu yok. Sonuç alanı bunu açıkça yazar. Başarı ya da ilerleme gösterilmez.
    expect(within(preview).getByRole('status')).toHaveTextContent(
      'Kayıtlar değişmedi. Onay işlemi henüz bağlı değil.',
    );
    expect(preview).not.toHaveTextContent(/onaylandı|başarı/i);
    expect(within(preview).queryByRole('progressbar')).not.toBeInTheDocument();
    expect(list.mock.calls.length).toBe(calls);
  });

  it('"Vazgeç" closes the preview, keeps records and returns focus to the opener', async () => {
    mount();
    await openSelection();
    fireEvent.click(screen.getByRole('checkbox', { name: 'ORNEK-0001 seç' }));
    const opener = screen.getByRole('button', { name: 'Seçilenleri onayla' });
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }));
    expect(
      screen.queryByRole('region', { name: 'Toplu işlem önizlemesi' }),
    ).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(screen.getByText('ORNEK-0001')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'ORNEK-0001 seç' })).toBeChecked();
    expect(screen.getByRole('region', { name: 'Toplu işlem' })).toHaveTextContent(
      '1 kayıt seçildi',
    );
  });

  it('Escape closes the preview and returns focus to the opener', async () => {
    mount();
    await openSelection();
    fireEvent.click(screen.getByRole('checkbox', { name: 'ORNEK-0001 seç' }));
    const opener = screen.getByRole('button', { name: 'Seçilenleri onayla' });
    fireEvent.click(opener);
    fireEvent.keyDown(screen.getByRole('checkbox', { name: 'Önizlemeyi okudum.' }), {
      key: 'Escape',
    });
    expect(
      screen.queryByRole('region', { name: 'Toplu işlem önizlemesi' }),
    ).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('closes a stale preview when the selection changes', async () => {
    mount();
    await openSelection();
    fireEvent.click(screen.getByRole('checkbox', { name: 'ORNEK-0001 seç' }));
    fireEvent.click(screen.getByRole('button', { name: 'Seçilenleri onayla' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'ORNEK-0002 seç' }));
    expect(
      screen.queryByRole('region', { name: 'Toplu işlem önizlemesi' }),
    ).not.toBeInTheDocument();
  });

  it('"Seçimi kaldır" moves focus to "Seç" and turning the mode off clears selection', async () => {
    mount();
    await openSelection();
    fireEvent.click(screen.getByRole('checkbox', { name: 'ORNEK-0001 seç' }));
    fireEvent.click(screen.getByRole('button', { name: 'Seçimi kaldır' }));
    const toggle = screen.getByRole('button', { name: 'Seç' });
    expect(toggle).toHaveFocus();
    fireEvent.click(screen.getByRole('checkbox', { name: 'ORNEK-0001 seç' }));
    fireEvent.click(toggle);
    expect(screen.queryByRole('region', { name: 'Toplu işlem' })).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByRole('checkbox', { name: 'ORNEK-0001 seç' })).not.toBeChecked();
  });
});

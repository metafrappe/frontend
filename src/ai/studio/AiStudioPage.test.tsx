import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ViewDataProvider } from '@/shell/view-data';

import AiStudioPage from './AiStudioPage';

/**
 * MVP check: the live panel has no mock agent.
 * If no model gateway connection is given, the screen says so clearly. No fake progress shows.
 */
describe('AiStudioPage bağlantısı', () => {
  it('bağlantı yoksa "bağlantı kurulmadı" yazar, sahte sunucu açılmaz', () => {
    render(
      <ViewDataProvider value={null}>
        <AiStudioPage />
      </ViewDataProvider>,
    );
    expect(screen.getByRole('heading', { name: 'AI Studio bağlantısı kurulmadı' })).toBeVisible();
    expect(screen.queryByText(/Sahte sunucu/)).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('bağlantı verilirse sohbet o kaynağı kullanır', () => {
    const transport = vi.fn();
    render(
      <ViewDataProvider
        value={{ ai: { transport, source: { label: 'Model geçidi', simulated: false } } }}
      >
        <AiStudioPage />
      </ViewDataProvider>,
    );
    expect(screen.queryByRole('heading', { name: 'AI Studio bağlantısı kurulmadı' })).toBeNull();
    expect(screen.getAllByText(/Model geçidi/).length).toBeGreaterThan(0);
  });
});

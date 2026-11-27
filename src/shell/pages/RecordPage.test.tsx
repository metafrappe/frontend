import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { RecordAddress, ShellViewData } from '../view-data';
import { ViewDataProvider } from '../view-data';
import RecordPage from './RecordPage';

function mount(data: ShellViewData | null, path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ViewDataProvider value={data}>
        <Routes>
          <Route path="/:module/:doctype/:name" element={<RecordPage />} />
        </Routes>
      </ViewDataProvider>
    </MemoryRouter>,
  );
}

function LiveRecord({ module, doctype, name }: RecordAddress) {
  return <p>{`canlı ${module} ${doctype} ${name}`}</p>;
}

describe('RecordPage', () => {
  it('kayıt bağlantısı varsa kaydı onunla çizer', () => {
    mount({ record: { Component: LiveRecord } }, '/hr/leave-application/HR-LAP-2026-00001');
    expect(screen.getByText('canlı hr leave-application HR-LAP-2026-00001')).toBeInTheDocument();
  });

  it('canlı kaydı kabuğun sayfa çerçevesi içinde çizer', () => {
    // The record component supplies only the content. The page frame belongs to the shell (review 2, K3).
    mount({ record: { Component: LiveRecord } }, '/hr/leave-application/HR-LAP-2026-00001');
    const text = screen.getByText('canlı hr leave-application HR-LAP-2026-00001');
    expect(text.closest('.shell-page > .shell-body')).not.toBeNull();
  });

  it('kayıt bağlantısı yoksa örnek kaydı arar', () => {
    mount(null, '/hr/leave-application/HR-LAP-2026-00001');
    expect(screen.queryByText(/canlı/)).not.toBeInTheDocument();
  });

  it('tutar alanının okları Türkçe adlıdır ve değeri değiştirir (K4)', () => {
    mount(null, '/satis/teklif/TEK-0003');
    expect(screen.queryByLabelText('Increase Value')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Decrease Value')).not.toBeInTheDocument();
    const amount = screen.getByLabelText<HTMLInputElement>('Tutar');
    const before = Number(amount.value.replace(/\D/g, ''));
    fireEvent.click(screen.getByRole('button', { name: 'Artır' }));
    expect(Number(amount.value.replace(/\D/g, ''))).toBe(before + 1);
    fireEvent.click(screen.getByRole('button', { name: 'Azalt' }));
    expect(Number(amount.value.replace(/\D/g, ''))).toBe(before);
  });
});

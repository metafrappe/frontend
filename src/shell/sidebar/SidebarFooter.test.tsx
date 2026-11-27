import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { sampleUser } from '../sampleData';
import { ViewDataProvider } from '../view-data';
import { SidebarFooter } from './SidebarFooter';

describe('SidebarFooter kullanıcı kartı', () => {
  it('oturumdaki kişiyi gösterir, örnek kişiyi göstermez', () => {
    render(
      <ViewDataProvider
        value={{ account: { fullName: 'Deneme Kullanıcı', user: 'deneme@example.test' } }}
      >
        <SidebarFooter rail={false} />
      </ViewDataProvider>,
    );
    expect(screen.getByText('Deneme Kullanıcı')).toBeInTheDocument();
    expect(screen.getByText('deneme@example.test')).toBeInTheDocument();
    expect(screen.getByText('DK')).toBeInTheDocument();
    expect(screen.queryByText(sampleUser.name)).toBeNull();
  });

  it('ad yoksa kullanıcı kimliğini ad olarak gösterir', () => {
    render(
      <ViewDataProvider value={{ account: { user: 'deneme@example.test' } }}>
        <SidebarFooter rail={false} />
      </ViewDataProvider>,
    );
    expect(screen.getAllByText('deneme@example.test').length).toBeGreaterThan(0);
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('bağlantı yoksa deneme sayfasındaki örnek kişiyi gösterir', () => {
    render(<SidebarFooter rail={false} />);
    expect(screen.getByText(sampleUser.name)).toBeInTheDocument();
  });
});

describe('SidebarFooter oturumu kapatma (B1)', () => {
  const account = { fullName: 'Deneme Kullanıcı', user: 'deneme@example.test' };

  it('"Oturumu kapat" düğmesi oturumu kapatma işlevini bir kez çağırır', async () => {
    const signOut = vi.fn(() => new Promise<void>(() => undefined));
    render(
      <ViewDataProvider value={{ account, signOut }}>
        <SidebarFooter rail={false} />
      </ViewDataProvider>,
    );
    const button = screen.getByRole('button', { name: 'Oturumu kapat' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('status')).toHaveTextContent('Oturum kapatılıyor.');
  });

  it('dar kipte de düğmenin erişilebilir adı vardır', () => {
    render(
      <ViewDataProvider value={{ account, signOut: vi.fn(() => Promise.resolve()) }}>
        <SidebarFooter rail />
      </ViewDataProvider>,
    );
    expect(screen.getByRole('button', { name: 'Oturumu kapat' })).toBeInTheDocument();
  });

  it('istek başarısız olursa yalın Türkçe hata gösterir ve düğme yeniden çalışır', async () => {
    const signOut = vi.fn(() => Promise.reject(new Error('ağ')));
    render(
      <ViewDataProvider value={{ account, signOut }}>
        <SidebarFooter rail={false} />
      </ViewDataProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Oturumu kapat' }));
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Oturum kapatılamadı. Oturumunuz açık. Biraz sonra yeniden deneyin.',
    );
    expect(screen.getByText('Deneme Kullanıcı')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Oturumu kapat' }));
    });
    expect(signOut).toHaveBeenCalledTimes(2);
  });

  it('dar kipte istek başarısız olursa hata gözle görünür bir uyarıda çıkar (Ö-2)', async () => {
    const signOut = vi.fn(() => Promise.reject(new Error('ağ')));
    render(
      <ViewDataProvider value={{ account, signOut }}>
        <SidebarFooter rail />
      </ViewDataProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Oturumu kapat' }));
    });
    const text = 'Oturum kapatılamadı. Oturumunuz açık. Biraz sonra yeniden deneyin.';
    const visible = await screen.findAllByText(text);
    // The text is visible in at least one place, not only in a screen-reader-only region.
    expect(visible.some((node) => !node.closest('.shell-vh'))).toBe(true);
    // The screen reader announces the error once.
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('oturum bağlantısı yoksa düğme çizilmez', () => {
    render(<SidebarFooter rail={false} />);
    expect(screen.queryByRole('button', { name: 'Oturumu kapat' })).toBeNull();
  });
});

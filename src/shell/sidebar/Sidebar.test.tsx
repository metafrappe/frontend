import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@ant-design/x', () => import('../testing/antdXMock'));

import { FocusDimProvider } from '../focus-dim';
import { routeNav } from '../nav';
import type { Agent } from '../sampleData';
import { sampleAgents, sampleNav, sampleWorkspaces } from '../sampleData';
import { Sidebar } from './Sidebar';

/** Demo menu: route links and sample groups. The live menu shows no sample groups. */
const demoNav = [...routeNav, ...sampleNav];
/** Sample workspaces of the demo page. The live panel does not show them. */
const demoWorkspaces = { items: sampleWorkspaces, current: 'a' };

function setup(variant: 'solid' | 'rail' = 'solid', agents: Agent[] = sampleAgents) {
  const onVariantChange = vi.fn();
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/']}>
      <FocusDimProvider>
        <Sidebar
          variant={variant}
          onVariantChange={onVariantChange}
          nav={demoNav}
          agents={agents}
          workspaces={demoWorkspaces}
        />
      </FocusDimProvider>
    </MemoryRouter>,
  );
  return { user, onVariantChange };
}

describe('Sidebar', () => {
  it('S1: gezinme öğeleri etiketli düğme ve bağlantıdır', () => {
    setup();
    expect(screen.getByRole('navigation', { name: 'Ana gezinme' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ana sayfa' })).toBeInTheDocument();
    const group = screen.getByRole('button', { name: 'Satış' });
    expect(group).toHaveAttribute('aria-expanded', 'false');
    expect(group).toHaveAttribute('aria-controls');
  });

  it('S2: etkin sayfa aria-current taşır', () => {
    setup();
    expect(screen.getByRole('link', { name: 'Ana sayfa' })).toHaveAttribute('aria-current', 'page');
  });

  it('F5: odak flyout açar, sağ ok içeri girer, Escape kapatır', async () => {
    const { user } = setup();
    const parent = screen.getByRole('button', { name: 'Satış' });
    act(() => parent.focus());
    const fly = await screen.findByRole('group', { name: 'Satış' });
    expect(parent).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{ArrowRight}');
    const first = screen.getByRole('link', { name: /^Teklifler/ });
    expect(first).toHaveFocus();
    expect(fly).toContainElement(first);

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('link', { name: 'Siparişler' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Satış' })).not.toBeInTheDocument();
    expect(parent).toHaveFocus();
    expect(parent).toHaveAttribute('aria-expanded', 'false');
  });

  it('F5: üst öğede Escape flyout kapatır ve odak öğede kalır', async () => {
    const { user } = setup();
    const parent = screen.getByRole('button', { name: 'Satış' });
    act(() => parent.focus());
    await screen.findByRole('group', { name: 'Satış' });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Satış' })).not.toBeInTheDocument();
    expect(parent).toHaveFocus();
  });

  it('dokunma ve tıklama flyout açar, ikinci tıklama kapatır', async () => {
    const { user } = setup();
    const parent = screen.getByRole('button', { name: 'Stok' });
    await user.click(parent);
    expect(await screen.findByRole('group', { name: 'Stok' })).toBeInTheDocument();
    await user.click(parent);
    expect(screen.queryByRole('group', { name: 'Stok' })).not.toBeInTheDocument();
  });

  it('odak perdesi flyout açıkken açılmaz: perde yalnız iletişim kutusundadır', async () => {
    setup();
    const parent = screen.getByRole('button', { name: 'Satış' });
    act(() => parent.focus());
    await screen.findByRole('group', { name: 'Satış' });
    expect(document.body).not.toHaveAttribute('data-focus-dim');
  });

  it('RT2: rail anahtarı başlıktadır ve varyantı değiştirir', async () => {
    const { user, onVariantChange } = setup('solid');
    const toggle = screen.getByRole('button', { name: 'Dar görünüme geç' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(onVariantChange).toHaveBeenCalledWith('rail');
  });

  it('Rail varyantında etiketler görünmez ama erişilebilir adlar kalır', () => {
    setup('rail');
    expect(screen.getByRole('button', { name: 'Geniş görünüme geç' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Ana sayfa' })).toBeInTheDocument();
  });

  it('W1: çalışma alanı seçici tıklanınca liste açar', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Çalışma alanı:\s*Örnek Şirket A/ }));
    expect(await screen.findByRole('menuitem', { name: /Örnek Şirket B/ })).toBeInTheDocument();
  });

  it('ajan flyout durumu metinle gösterir', async () => {
    setup();
    const agent = screen.getByRole('button', { name: /Teklif ajanı/ });
    act(() => agent.focus());
    const fly = await screen.findByRole('group', { name: /Teklif ajanı/ });
    expect(fly).toHaveTextContent('Çalışıyor');
  });

  it('G1: flyout panelinde de kayan zemin vardır ve odakla taşınır', async () => {
    const { user } = setup();
    const parent = screen.getByRole('button', { name: 'Satış' });
    act(() => parent.focus());
    const fly = await screen.findByRole('group', { name: 'Satış' });
    const glide = fly.querySelector('.shell-glide');
    expect(glide).not.toBeNull();
    expect(glide).toHaveAttribute('data-on', 'false');
    await user.keyboard('{ArrowRight}');
    expect(glide).toHaveAttribute('data-on', 'true');
  });

  it('ajan verisi yoksa ajan bölümünü göstermez (uydurma ajan yok)', () => {
    setup('solid', []);
    expect(screen.queryByRole('heading', { name: 'AI ajanları' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ajanı/ })).not.toBeInTheDocument();
  });
});

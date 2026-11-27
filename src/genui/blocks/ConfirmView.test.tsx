import { render as renderUi, screen } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { parseBlocks } from '../schema';
import type { ConfirmBlock, GenUIActionResult } from '../types';
import { ConfirmView } from './ConfirmView';

import { LanguageProvider } from '@/app/locale';

/** These tests check the Turkish texts, so the UI language is Turkish (AJA-1859). */
function TurkishUi({ children }: { children: ReactNode }) {
  return <LanguageProvider initialLanguage="tr">{children}</LanguageProvider>;
}

const render = (ui: ReactElement) => renderUi(ui, { wrapper: TurkishUi });

const base: ConfirmBlock = {
  type: 'confirm',
  id: 'c1',
  title: 'İzin talebi güncellensin mi?',
  summary: 'İZN-0041 talebinin bitiş tarihi bir gün öne alınır.',
  changes: [{ field: 'Bitiş tarihi', before: '12 Aralık 2026', after: '11 Aralık 2026' }],
  confirmLabel: 'Onayla',
  cancelLabel: 'Reddet',
};

const r3: ConfirmBlock = {
  ...base,
  title: 'Kullanıcı silinsin mi?',
  risk: 'R3',
  target: { label: 'Kullanıcı: Örnek Kişi 7', name: 'Örnek Kişi 7' },
};

const accept = () => vi.fn((): GenUIActionResult => 'accepted');

function approveButton() {
  return screen.getByRole('button', { name: 'Onayla' });
}

describe('ConfirmView risk düzeyi', () => {
  it('R1 önerisinde tek bir "Onayla" düğmesi vardır ve hemen açıktır', () => {
    render(<ConfirmView block={{ ...base, risk: 'R1' }} onAction={accept()} />);
    expect(screen.getAllByRole('button', { name: 'Onayla' })).toHaveLength(1);
    expect(approveButton()).toBeEnabled();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('R1 Düşük')).toBeInTheDocument();
  });

  it('risk düzeyi gelmezse kart R1 gibi davranır', () => {
    render(<ConfirmView block={base} onAction={accept()} />);
    expect(approveButton()).toBeEnabled();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('R2 önerisinde kutu işaretlenmeden "Onayla" düğmesi kapalı kalır', async () => {
    const onAction = accept();
    render(<ConfirmView block={{ ...base, risk: 'R2' }} onAction={onAction} />);
    expect(screen.getByText('R2 Orta')).toBeInTheDocument();
    expect(approveButton()).toBeDisabled();
    await userEvent.click(approveButton());
    expect(onAction).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Önizlemeyi okudum.' }));
    expect(approveButton()).toBeEnabled();
    await userEvent.click(approveButton());
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'confirm', decision: 'approved' }),
    );
  });

  it('R2 kutusu klavyeyle de işaretlenir', async () => {
    render(<ConfirmView block={{ ...base, risk: 'R2' }} onAction={accept()} />);
    await userEvent.tab();
    expect(screen.getByRole('checkbox')).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(approveButton()).toBeEnabled();
  });

  it('R3 önerisinde ad yanlış yazılınca "Onayla" düğmesi kapalı kalır', async () => {
    const onAction = accept();
    render(<ConfirmView block={r3} onAction={onAction} />);
    expect(screen.getByText('R3 Yüksek')).toBeInTheDocument();
    expect(screen.getByText('Kullanıcı: Örnek Kişi 7')).toBeInTheDocument();
    const input = screen.getByRole('textbox', { name: /hedefin adını yazın/ });
    expect(approveButton()).toBeDisabled();

    await userEvent.type(input, 'Örnek Kişi 8');
    expect(approveButton()).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, 'örnek kişi 7');
    expect(approveButton()).toBeDisabled();
    await userEvent.click(approveButton());
    expect(onAction).not.toHaveBeenCalled();
  });

  it('R3 önerisinde ad doğru yazılınca "Onayla" düğmesi açılır', async () => {
    const onAction = accept();
    render(<ConfirmView block={r3} onAction={onAction} />);
    await userEvent.type(screen.getByRole('textbox'), 'Örnek Kişi 7');
    expect(approveButton()).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('Ad doğru.');
    await userEvent.click(approveButton());
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'confirm', blockId: 'c1', decision: 'approved' }),
    );
  });

  it('R3 hedefi gelmezse blok doğrulanmaz ve düğmesiz çizilir', () => {
    const [block] = parseBlocks([{ ...base, risk: 'R3' }]);
    expect(block?.type).toBe('unknown');
    const [bad] = parseBlocks([{ ...base, risk: 'R9' }]);
    expect(bad?.type).toBe('unknown');
    const [ok] = parseBlocks([r3]);
    expect(ok?.type).toBe('confirm');
  });
});

describe('ConfirmView geri alma', () => {
  it.each(['R1', 'R2', 'R3'] as const)('%s kartında "Geri al" düğmesi hiç yoktur', async (risk) => {
    const block: ConfirmBlock = { ...r3, risk, undoProposal: true };
    const { rerender } = render(<ConfirmView block={block} onAction={accept()} />);
    expect(screen.queryByRole('button', { name: 'Geri al' })).toBeNull();
    rerender(<ConfirmView block={block} onAction={accept()} decided="approved" />);
    expect(screen.queryByRole('button', { name: 'Geri al' })).toBeNull();
  });

  it('geri alma ucu bildirilmezse "Geri almayı öner" düğmesi yoktur', () => {
    render(<ConfirmView block={base} onAction={accept()} decided="approved" />);
    expect(screen.queryByRole('button', { name: 'Geri almayı öner' })).toBeNull();
  });

  it('geri alma ucu bildirilirse onaydan sonra "Geri almayı öner" düğmesi yeni öneri ister', async () => {
    const onAction = accept();
    render(
      <ConfirmView
        block={{ ...base, undoProposal: true }}
        onAction={onAction}
        decided="approved"
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Geri almayı öner' }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ kind: 'ask' }));
  });

  it('onaydan önce "Geri almayı öner" düğmesi görünmez', () => {
    render(<ConfirmView block={{ ...base, undoProposal: true }} onAction={accept()} />);
    expect(screen.queryByRole('button', { name: 'Geri almayı öner' })).toBeNull();
  });

  it('kartta güven yüzdesi yoktur', () => {
    const { container } = render(<ConfirmView block={r3} onAction={accept()} />);
    expect(container.textContent).not.toMatch(/%|güven/i);
  });
});

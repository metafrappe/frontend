// G-139 tur paneli: ilk ziyaret, devam, sürüm yükseltmesi, girdi koruması ve erişilebilirlik.
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TourDefinition, TourProgress } from './model';
import { createMemoryTourStore, type TourStore } from './store';
import { TourPanel, TourRestartButton } from './TourPanel';
import { useTour } from './useTour';

const tour: TourDefinition = {
  id: 'leave-application',
  version: 1,
  label: 'İzin isteği',
  steps: [
    { id: 'intro', title: 'Hoş geldiniz', body: 'Kısa bir tur.' },
    {
      id: 'reason',
      title: 'Gerekçe',
      body: 'Gerekçeyi yazın.',
      target: { doctype: 'Leave Application', fieldname: 'reason' },
    },
    { id: 'missing', title: 'Yok', body: 'Bu hedef sayfada yok.', target: { tourId: 'nowhere' } },
    { id: 'save', title: 'Kaydet', body: 'Kaydedin.', target: { tourId: 'record-save' } },
  ],
};

function Page({ definition = tour, store }: { definition?: TourDefinition; store: TourStore }) {
  const controller = useTour({ definition, store });
  return (
    <>
      <form data-doctype="Leave Application" aria-label="İzin formu">
        <div data-fieldname="reason">
          <label>
            Gerekçe
            <input name="reason" />
          </label>
        </div>
        <button type="button" data-tour-id="record-save">
          Kaydet
        </button>
      </form>
      <TourRestartButton tour={controller} />
      <TourPanel tour={controller} />
    </>
  );
}

const panel = () => screen.findByRole('dialog', { name: 'Tur: İzin isteği' });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TourPanel', () => {
  it('ilk ziyarette kipsiz tur açılır ve adımı duyurur', async () => {
    render(<Page store={createMemoryTourStore()} />);
    const dialog = await panel();
    expect(dialog).toHaveAttribute('aria-modal', 'false');
    expect(within(dialog).getByRole('heading', { name: 'Hoş geldiniz' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Adım 1 / 3: Hoş geldiniz');
    // Sayfa kilitlenmez: form erişilebilir ağaçta kalır.
    expect(screen.getByRole('form', { name: 'İzin formu' })).not.toHaveAttribute('aria-hidden');
    expect(screen.getByRole('form', { name: 'İzin formu' }).closest('[inert]')).toBeNull();
  });

  it('hedefi olmayan adım atlanır ve sayılmaz', async () => {
    const user = userEvent.setup();
    render(<Page store={createMemoryTourStore()} />);
    const dialog = await panel();
    await user.click(within(dialog).getByRole('button', { name: 'İleri' }));
    await user.click(within(dialog).getByRole('button', { name: 'İleri' }));
    expect(within(dialog).getByRole('heading', { name: 'Kaydet' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Adım 3 / 3: Kaydet');
  });

  it('etkin adımın hedefi işaretlenir', async () => {
    const user = userEvent.setup();
    render(<Page store={createMemoryTourStore()} />);
    const dialog = await panel();
    await user.click(within(dialog).getByRole('button', { name: 'İleri' }));
    const target = document.querySelector('[data-fieldname="reason"]');
    expect(target).toHaveAttribute('data-tour-active', 'true');
    await user.click(within(dialog).getByRole('button', { name: 'İleri' }));
    expect(target).not.toHaveAttribute('data-tour-active');
  });

  it('klavyeyle ileri ve geri gider', async () => {
    const user = userEvent.setup();
    render(<Page store={createMemoryTourStore()} />);
    const dialog = await panel();
    within(dialog).getByRole('button', { name: 'İleri' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(within(dialog).getByRole('heading', { name: 'Gerekçe' })).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(within(dialog).getByRole('heading', { name: 'Hoş geldiniz' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Geri' })).toBeDisabled();
  });

  it('Escape turu erteler ve kaldığı adımı kaydeder', async () => {
    const user = userEvent.setup();
    const store = createMemoryTourStore();
    render(<Page store={store} />);
    const dialog = await panel();
    await user.click(within(dialog).getByRole('button', { name: 'İleri' }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await expect(store.load('leave-application')).resolves.toMatchObject({
      status: 'snoozed',
      current_step: 'reason',
    });
    // Odak sayfada kalır: yeniden başlatma düğmesine döner.
    expect(screen.getByRole('button', { name: 'Turu yeniden başlat' })).toHaveFocus();
  });

  it('ertelenen tur yeniden açılınca kaldığı yerden sürer', async () => {
    const store = createMemoryTourStore();
    await store.save({
      tour_id: 'leave-application',
      version: 1,
      status: 'snoozed',
      current_step: 'reason',
      seen_steps: ['intro', 'reason'],
    });
    render(<Page store={store} />);
    const dialog = await panel();
    expect(within(dialog).getByRole('heading', { name: 'Gerekçe' })).toBeInTheDocument();
  });

  it('atlanan tur yeniden açılmaz, yeniden başlatma düğmesi turu baştan açar', async () => {
    const user = userEvent.setup();
    const store = createMemoryTourStore();
    const first = render(<Page store={store} />);
    await user.click(within(await panel()).getByRole('button', { name: 'Turu atla' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    first.unmount();

    render(<Page store={store} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Turu yeniden başlat' }));
    const dialog = await panel();
    expect(within(dialog).getByRole('heading', { name: 'Hoş geldiniz' })).toBeInTheDocument();
    await expect(store.load('leave-application')).resolves.toMatchObject({ status: 'active' });
  });

  it('bitirilen tur yeni sürümde yalnız yeni adımı gösterir', async () => {
    const store = createMemoryTourStore();
    await store.save({
      tour_id: 'leave-application',
      version: 1,
      status: 'completed',
      current_step: null,
      seen_steps: ['intro', 'reason', 'save'],
    });
    const next: TourDefinition = {
      ...tour,
      version: 2,
      steps: [...tour.steps, { id: 'attachments', title: 'Ekler', body: 'Belge ekleyin.' }],
    };
    render(<Page definition={next} store={store} />);
    const dialog = await panel();
    expect(within(dialog).getByRole('heading', { name: 'Ekler' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Adım 1 / 1: Ekler');
  });

  it('tur kullanıcının yazdığını silmez ve yazmayı engellemez', async () => {
    const user = userEvent.setup();
    const store = createMemoryTourStore();
    render(<Page store={store} />);
    const dialog = await panel();
    const input = screen.getByRole('textbox', { name: 'Gerekçe' });
    await user.type(input, 'Aile ziyareti');
    // Tur odağı alandan çalmaz. Yazı sürer.
    expect(input).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'İleri' }));
    await user.click(input);
    await user.type(input, ' için');
    await user.click(within(dialog).getByRole('button', { name: 'İleri' }));
    await user.click(within(dialog).getByRole('button', { name: 'Bitir' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(input).toHaveValue('Aile ziyareti için');
    expect(screen.getByRole('form', { name: 'İzin formu' })).toBeInTheDocument();
  });

  it('alanda yazarken basılan ok tuşu turu ilerletmez', async () => {
    const user = userEvent.setup();
    render(<Page store={createMemoryTourStore()} />);
    const dialog = await panel();
    const input = screen.getByRole('textbox', { name: 'Gerekçe' });
    await user.type(input, 'abc{ArrowLeft}{ArrowRight}');
    expect(within(dialog).getByRole('heading', { name: 'Hoş geldiniz' })).toBeInTheDocument();
    expect(input).toHaveValue('abc');
  });

  it('kayıt hatası turu bozmaz', async () => {
    const user = userEvent.setup();
    const store: TourStore = {
      load: () => Promise.resolve(null),
      save: () => Promise.reject(new Error('ağ yok')),
    };
    render(<Page store={store} />);
    const dialog = await panel();
    await user.click(within(dialog).getByRole('button', { name: 'İleri' }));
    expect(within(dialog).getByRole('heading', { name: 'Gerekçe' })).toBeInTheDocument();
  });

  it('azaltılmış hareket isteniyorsa hedefe kaydırma anında olur', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => false,
        }) as MediaQueryList,
    );
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(<Page store={createMemoryTourStore()} />);
    await user.click(within(await panel()).getByRole('button', { name: 'İleri' }));
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
  });

  it('başka turun ilerlemesi bu turu etkilemez', async () => {
    const store = createMemoryTourStore();
    const other: TourProgress = {
      tour_id: 'expense-claim',
      version: 1,
      status: 'completed',
      current_step: null,
      seen_steps: [],
    };
    await store.save(other);
    render(<Page store={store} />);
    expect(await panel()).toBeInTheDocument();
  });
});

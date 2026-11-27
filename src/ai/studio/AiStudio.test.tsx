import {
  cleanup,
  configure,
  getConfig,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockTransport } from '../agent';
import type { AgentEvent, AgentRequest, AgentTransport } from '../agent';
import { encodeAgentEvent } from '../agent';
import { MOCK_SOURCE } from '../agent';
import { AiStudio } from './AiStudio';

// `waitFor` and `find*` checks rerun when the DOM changes. They do not wait a fixed time.
// The default limit is 1 second. The mock stream takes longer on a loaded machine (review 2, Ö4).
// This file raises the limit. The check ends as soon as the condition holds.
const defaultAsyncTimeout = getConfig().asyncUtilTimeout;
beforeAll(() => configure({ asyncUtilTimeout: 10_000 }));
afterAll(() => configure({ asyncUtilTimeout: defaultAsyncTimeout }));

beforeAll(() => {
  // jsdom does not define a scroll function on elements. Bubble.List calls it.
  Element.prototype.scrollTo ??= () => undefined;
  // jsdom does not define ResizeObserver. The antd table uses it.
  globalThis.ResizeObserver ??= class {
    observe = () => undefined;
    unobserve = () => undefined;
    disconnect = () => undefined;
  };
});

/**
 * All mock streams stop when a test ends. On the abort signal the mock server clears its timer
 * at once. So no timer is left for the next test, without a fixed wait (review 2, Ö4).
 */
let streams = new AbortController();
beforeEach(() => {
  streams = new AbortController();
});
afterEach(() => {
  streams.abort();
  cleanup();
});

/** Mock server that is stopped at the end of the test. */
function mock(options: Parameters<typeof createMockTransport>[0] = {}): AgentTransport {
  const base = createMockTransport(options);
  return (request, signal) => base(request, AbortSignal.any([signal, streams.signal]));
}

/** Wraps the mock server. Records outgoing requests and their abort signals. */
function recording(base: AgentTransport = mock({ delayMs: 1 })) {
  const requests: AgentRequest[] = [];
  const signals: AbortSignal[] = [];
  const transport: AgentTransport = (request, signal) => {
    requests.push(structuredClone(request));
    signals.push(signal);
    return base(request, signal);
  };
  return { requests, signals, transport };
}

/** Under load, no per-key timer is awaited. The event order stays the same. */
function setupUser() {
  return userEvent.setup({ delay: null });
}

async function approveDelayNotice(user: ReturnType<typeof setupUser>) {
  const log = screen.getByRole('log');
  await waitFor(() => expect(log.querySelector('[data-genui="confirm"]')).not.toBeNull());
  const block = log.querySelector('[data-genui="confirm"]') as HTMLElement;
  await user.click(within(block).getByRole('button', { name: 'Gönder' }));
}

/** Switches to a conversation from the conversation drawer. */
async function openConversation(user: ReturnType<typeof setupUser>, name: RegExp) {
  await user.click(screen.getByRole('button', { name: 'Sohbetleri aç' }));
  const nav = await screen.findByRole('navigation', { name: 'Sohbetler' });
  await user.click(within(nav).getByText(name));
  await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Sohbetler' })).toBeNull());
}

async function newConversation(user: ReturnType<typeof setupUser>) {
  await user.click(screen.getByRole('button', { name: 'Sohbetleri aç' }));
  await user.click(await screen.findByRole('button', { name: /Yeni sohbet/ }));
}

async function send(text: string) {
  const user = setupUser();
  const box = screen.getByRole('textbox', { name: 'Asistana mesaj yazın' });
  await user.type(box, text);
  await user.click(screen.getByRole('button', { name: 'Mesajı gönder' }));
  return user;
}

// These tests render the whole studio and follow the mock stream to the end. On a loaded machine
// one test takes a few seconds. The time budget is explicit. Expectations and event checks stay the same.
describe('AI Studio', { timeout: 30_000 }, () => {
  it('boş durumda karşılama ve kategorili önerileri gösterir', () => {
    render(<AiStudio transport={mock({ delayMs: 1 })} source={MOCK_SOURCE} />);
    expect(screen.getByRole('heading', { name: /Atonota asistanı/ })).toBeInTheDocument();
    expect(screen.getByText('Bu haftanın satış özetini çıkar')).toBeInTheDocument();
    expect(screen.getByRole('log')).toBeInTheDocument();
  });

  it('sahte sunucuyu açıkça etiketler', () => {
    render(<AiStudio transport={mock({ delayMs: 1 })} source={MOCK_SOURCE} />);
    expect(screen.getAllByText('Sahte sunucu').length).toBeGreaterThan(0);
  });

  it('yanıtı akıtır ve bloklar akış bitince belirir', async () => {
    const { container } = render(
      <AiStudio transport={mock({ delayMs: 1 })} source={MOCK_SOURCE} />,
    );
    await send('Bu haftanın satış özetini çıkar');
    await waitFor(() => expect(container.querySelector('[data-genui="kpis"]')).not.toBeNull());
    expect(screen.getByRole('log')).toHaveTextContent('%12 arttı');
    expect(screen.getByRole('button', { name: 'Kopyala' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yeniden üret' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Beğen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Beğenme' })).toBeInTheDocument();
  });

  it('iptal düğmesi akışı durdurur', async () => {
    const { signals, transport } = recording(mock({ delayMs: 40 }));
    const { container } = render(<AiStudio transport={transport} source={MOCK_SOURCE} />);
    const user = await send('Geciken siparişleri bul');
    const stop = await screen.findByRole('button', { name: 'Yanıtı durdur' });
    await user.click(stop);
    expect(await screen.findByText('Yanıt durduruldu.')).toBeInTheDocument();
    // No time is awaited. The request's abort signal must have arrived. On abort the mock server
    // closes the stream at once, so no block can arrive later.
    await waitFor(() => expect(signals[0]?.aborted).toBe(true));
    expect(container.querySelector('[data-genui]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Mesajı gönder' })).toBeInTheDocument();
  });

  it('iptalden sonra gelen metni ve bloğu çizmez', async () => {
    // The mock server ignores the abort signal. After abort it sends text, block and end events.
    // The UI must not render these events (review 3, K2).
    const encode = (event: AgentEvent) => new TextEncoder().encode(encodeAgentEvent(event));
    let lateSent: (() => void) | undefined;
    const sent = new Promise<void>((resolve) => (lateSent = resolve));
    const stubborn: AgentTransport = (_request, signal) =>
      Promise.resolve(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encode({ type: 'text', delta: 'İlk parça. ' }));
            signal.addEventListener('abort', () => {
              controller.enqueue(encode({ type: 'text', delta: 'Geç gelen metin.' }));
              controller.enqueue(
                encode({
                  type: 'ui',
                  blocks: [{ type: 'kpis', items: [{ label: 'Gelir', value: '1', delta: 1 }] }],
                }),
              );
              controller.enqueue(encode({ type: 'done' }));
              controller.close();
              lateSent?.();
            });
          },
        }),
      );
    const { signals, transport } = recording(stubborn);
    const { container } = render(<AiStudio transport={transport} source={MOCK_SOURCE} />);
    const user = await send('Geciken siparişleri bul');
    await screen.findByText(/İlk parça/);
    await user.click(await screen.findByRole('button', { name: 'Yanıtı durdur' }));
    expect(await screen.findByText('Yanıt durduruldu.')).toBeInTheDocument();
    await waitFor(() => expect(signals[0]?.aborted).toBe(true));
    await sent;
    // Late events entered the stream. A few task ticks are awaited so the UI can process them.
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText(/Geç gelen metin/)).toBeNull();
    expect(container.querySelector('[data-genui]')).toBeNull();
    expect(screen.getByText('Yanıt durduruldu.')).toBeInTheDocument();
  });

  it('sunucu araç olayı göndermezse araç listesi göstermez', async () => {
    const events: AgentEvent[] = [{ type: 'text', delta: 'Kısa yanıt.' }, { type: 'done' }];
    render(
      <AiStudio transport={mock({ delayMs: 1, events: () => events })} source={MOCK_SOURCE} />,
    );
    await send('merhaba');
    await screen.findByText('Kısa yanıt.');
    expect(screen.queryByText('Araç olayları')).toBeNull();
  });

  it('onay bloğu onay verilmeden mesaj göndermez, onayla yeni mesaj oluşur', async () => {
    render(<AiStudio transport={mock({ delayMs: 1 })} source={MOCK_SOURCE} />);
    const user = await send('Geciken siparişleri bul');
    const log = screen.getByRole('log');
    await waitFor(() => expect(log.querySelector('[data-genui="confirm"]')).not.toBeNull());
    expect(within(log).queryAllByText(/^Onaylıyorum/)).toHaveLength(0);
    const block = log.querySelector('[data-genui="confirm"]') as HTMLElement;
    await user.click(within(block).getByRole('button', { name: 'Gönder' }));
    await waitFor(() => expect(within(log).getByText(/^Onaylıyorum/)).toBeInTheDocument());
    await waitFor(() => expect(log).toHaveTextContent('gerçek bir işlem yapılmadı'));
  });

  it('yanıt eylemleri klavyeyle çalışır', async () => {
    render(<AiStudio transport={mock({ delayMs: 1 })} source={MOCK_SOURCE} />);
    const user = await send('merhaba');
    const like = await screen.findByRole('button', { name: 'Beğen' });
    expect(like).toHaveAttribute('aria-pressed', 'false');
    like.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Beğen' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('dar ekranda yan bölümler çekmeceye iner', async () => {
    const user = setupUser();
    render(<AiStudio />);
    expect(screen.queryByRole('navigation', { name: 'Sohbetler' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Sohbetleri aç' }));
    expect(await screen.findByRole('navigation', { name: 'Sohbetler' })).toBeInTheDocument();
  });

  it('geniş ekranda üç sütun açılır', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.startsWith('(min-width'),
          media: query,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => false,
        }) as MediaQueryList,
    );
    render(<AiStudio />);
    expect(screen.getByRole('navigation', { name: 'Sohbetler' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Çalışma alanı' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sohbetleri aç' })).toBeNull();
  });

  it('araç olaylarını "Araç olayları" yüzeyinde gösterir, düşünce demez', async () => {
    render(<AiStudio transport={mock({ delayMs: 1 })} source={MOCK_SOURCE} />);
    await send('Bu haftanın satış özetini çıkar');
    await within(screen.getByRole('log')).findByText('Araç olayları');
    expect(screen.queryByText(/Düşünce/)).toBeNull();
    expect(screen.getByText('Örnek adımlar. Gerçek araç çalışmadı.')).toBeInTheDocument();
  });

  it('yeniden üret onay verisini tekrar göndermez', async () => {
    const { requests, transport } = recording();
    render(<AiStudio transport={transport} source={MOCK_SOURCE} />);
    const user = await send('Geciken siparişleri bul');
    await approveDelayNotice(user);
    const log = screen.getByRole('log');
    await waitFor(() => expect(log).toHaveTextContent('gerçek bir işlem yapılmadı'));
    const retry = screen.getAllByRole('button', { name: 'Yeniden üret' });
    await user.click(retry[retry.length - 1] as HTMLElement);
    await waitFor(() => expect(requests).toHaveLength(3));
    expect(requests.filter((r) => r.message.action)).toHaveLength(1);
    expect(requests[2]?.intent).toBe('regenerate');
    expect(requests[2]?.message.action).toBeUndefined();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Mesajı gönder' })).toBeEnabled(),
    );
    expect(log).not.toHaveTextContent('zaten kullanıldı');
  });

  it('onaylı istek koparsa yeniden denemede yalnız işlemin durumunu sorar', async () => {
    const base = mock({ delayMs: 1 });
    const broken: AgentTransport = (request, signal) => {
      if (!request.message.action) return base(request, signal);
      return Promise.resolve(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(encodeAgentEvent({ type: 'text', delta: 'Yarım' })),
            );
            controller.close();
          },
        }),
      );
    };
    const { requests, transport } = recording(broken);
    render(<AiStudio transport={transport} source={MOCK_SOURCE} />);
    const user = await send('Geciken siparişleri bul');
    await approveDelayNotice(user);
    const ask = await screen.findByRole('button', { name: 'İşlemin durumunu sor' });
    expect(screen.queryByRole('button', { name: 'Yeniden dene' })).toBeNull();
    await user.click(ask);
    await waitFor(() => expect(requests).toHaveLength(3));
    expect(requests[2]).toMatchObject({
      intent: 'status',
      actionId: expect.stringMatching(/^notify-delay-/),
    });
    expect(requests[2]?.message.action).toBeUndefined();
  });

  it('yanıt akarken eski onay düğmesi kapalıdır', async () => {
    const { transport } = recording(mock({ delayMs: 15 }));
    render(<AiStudio transport={transport} source={MOCK_SOURCE} />);
    const user = await send('Geciken siparişleri bul');
    const log = screen.getByRole('log');
    await waitFor(() => expect(log.querySelector('[data-genui="confirm"]')).not.toBeNull());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Mesajı gönder' })).toBeEnabled(),
    );
    await user.type(screen.getByRole('textbox', { name: 'Asistana mesaj yazın' }), 'merhaba');
    await user.click(screen.getByRole('button', { name: 'Mesajı gönder' }));
    const block = log.querySelector('[data-genui="confirm"]') as HTMLElement;
    expect(within(block).getByRole('button', { name: 'Gönder' })).toBeDisabled();
  });

  it('bağlam dosyası yalnız kendi sohbetinde kalır', async () => {
    const { requests, transport } = recording();
    const user = setupUser();
    const { container } = render(<AiStudio transport={transport} source={MOCK_SOURCE} />);
    await user.click(screen.getByRole('button', { name: 'Bağlam dosyası ekle' }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['x'], 'rapor.csv', { type: 'text/csv' }));
    expect(
      screen.getByText('Yalnız dosya adı gönderilir. Dosya içeriği okunmaz.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sohbetleri aç' }));
    await user.click(await screen.findByRole('button', { name: /Yeni sohbet/ }));
    await send('merhaba');
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.message.files).toBeUndefined();
  });

  it('çekmece kapanınca odak açan düğmeye döner', async () => {
    const user = setupUser();
    render(<AiStudio />);
    const trigger = screen.getByRole('button', { name: 'Sohbetleri aç' });
    await user.click(trigger);
    await screen.findByRole('navigation', { name: 'Sohbetler' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('sohbet değişip geri dönülünce gönderilmiş onay kilitli kalır', async () => {
    render(<AiStudio transport={mock({ delayMs: 1 })} source={MOCK_SOURCE} />);
    const user = await send('Geciken siparişleri bul');
    await approveDelayNotice(user);
    const log = screen.getByRole('log');
    await waitFor(() => expect(log).toHaveTextContent('gerçek bir işlem yapılmadı'));
    await newConversation(user);
    await waitFor(() => expect(log.querySelector('[data-genui="confirm"]')).toBeNull());
    await openConversation(user, /^Geciken siparişleri bul$/);
    await waitFor(() => expect(log.querySelector('[data-genui="confirm"]')).not.toBeNull());
    const block = log.querySelector('[data-genui="confirm"]') as HTMLElement;
    expect(within(block).queryByRole('button', { name: 'Gönder' })).toBeNull();
    expect(within(block).getByRole('status')).toHaveTextContent('Onayınız gönderildi');
  });

  it('yeni sohbette aynı soru yeni onay kimliğiyle onaylanabilir', async () => {
    const { requests, transport } = recording();
    render(<AiStudio transport={transport} source={MOCK_SOURCE} />);
    let user = await send('Geciken siparişleri bul');
    await approveDelayNotice(user);
    const log = screen.getByRole('log');
    await waitFor(() => expect(log).toHaveTextContent('gerçek bir işlem yapılmadı'));
    await newConversation(user);
    user = await send('Geciken siparişleri bul');
    await approveDelayNotice(user);
    await waitFor(() => expect(log).toHaveTextContent('gerçek bir işlem yapılmadı'));
    expect(screen.queryByRole('alert')).toBeNull();
    const ids = requests.flatMap((r) =>
      r.message.action && r.message.action.kind !== 'ask' ? [r.message.action.blockId] : [],
    );
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('geçmişteki onay verisini sunucuya göndermez', async () => {
    const { requests, transport } = recording();
    render(<AiStudio transport={transport} source={MOCK_SOURCE} />);
    const user = await send('Geciken siparişleri bul');
    await approveDelayNotice(user);
    const log = screen.getByRole('log');
    await waitFor(() => expect(log).toHaveTextContent('gerçek bir işlem yapılmadı'));
    await user.type(screen.getByRole('textbox', { name: 'Asistana mesaj yazın' }), 'merhaba');
    await user.click(screen.getByRole('button', { name: 'Mesajı gönder' }));
    await waitFor(() => expect(requests).toHaveLength(3));
    const history = requests[2]?.history ?? [];
    expect(history.some((m) => m.role === 'user' && m.text.startsWith('Onaylıyorum'))).toBe(true);
    expect(history.some((m) => m.role === 'user' && m.action)).toBe(false);
  });

  it('durum sorgusu da koparsa yeniden deneme yine durum sorar', async () => {
    const base = mock({ delayMs: 1 });
    const broken: AgentTransport = (request, signal) => {
      if (!request.message.action && request.intent !== 'status') return base(request, signal);
      return Promise.resolve(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(encodeAgentEvent({ type: 'text', delta: 'Yarım' })),
            );
            controller.close();
          },
        }),
      );
    };
    const { requests, transport } = recording(broken);
    render(<AiStudio transport={transport} source={MOCK_SOURCE} />);
    const user = await send('Geciken siparişleri bul');
    await approveDelayNotice(user);
    await user.click(await screen.findByRole('button', { name: 'İşlemin durumunu sor' }));
    await waitFor(() => expect(requests).toHaveLength(3));
    await user.click(await screen.findByRole('button', { name: 'İşlemin durumunu sor' }));
    await waitFor(() => expect(requests).toHaveLength(4));
    expect(requests[3]).toMatchObject({ intent: 'status', actionId: requests[2]?.actionId });
    expect(requests[3]?.message.action).toBeUndefined();
  });
});

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
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { encodeAgentEvent, MOCK_SOURCE } from '../agent';
import type { AgentEvent, AgentRequest, AgentTransport } from '../agent';
import { AiStudio } from './AiStudio';
import { createFlowDemoTransport } from './flowDemo';

/*
 * Tests that bind the flow to the screen (AJA-1159).
 * Mode picker, step surfaces, server tool event, R3 approval and removed items.
 */

const defaultAsyncTimeout = getConfig().asyncUtilTimeout;
beforeAll(() => configure({ asyncUtilTimeout: 10_000 }));
afterAll(() => configure({ asyncUtilTimeout: defaultAsyncTimeout }));

beforeAll(() => {
  Element.prototype.scrollTo ??= () => undefined;
  globalThis.ResizeObserver ??= class {
    observe = () => undefined;
    unobserve = () => undefined;
    disconnect = () => undefined;
  };
});

const stops: AbortController[] = [];
afterEach(() => {
  stops.splice(0).forEach((c) => c.abort());
  cleanup();
});

function setupUser() {
  return userEvent.setup({ delay: null });
}

async function send(user: ReturnType<typeof setupUser>, text: string) {
  await user.type(screen.getByRole('textbox', { name: 'Asistana mesaj yazın' }), text);
  await user.click(screen.getByRole('button', { name: 'Mesajı gönder' }));
}

/** Clicks the mode label. The antd radio input is invisible, so the user clicks the label. */
async function pickMode(user: ReturnType<typeof setupUser>, name: string) {
  const label = screen.getByRole('radio', { name }).closest('label');
  if (!label) throw new Error(`${name} etiketi yok`);
  await user.click(label);
}

/** Mock stream that stops when the test ends. */
function demo(): AgentTransport {
  const base = createFlowDemoTransport({ delayMs: 1 });
  return (request, signal) => {
    const stop = new AbortController();
    stops.push(stop);
    return base(request, AbortSignal.any([signal, stop.signal]));
  };
}

/** Transport that sends events by hand. The test decides when to send each line. */
function manual() {
  const requests: AgentRequest[] = [];
  let push: (event: unknown) => void = () => undefined;
  let close: () => void = () => undefined;
  const transport: AgentTransport = (request) => {
    requests.push(structuredClone(request));
    const encoder = new TextEncoder();
    return Promise.resolve(
      new ReadableStream<Uint8Array>({
        start(controller) {
          push = (event) =>
            controller.enqueue(encoder.encode(encodeAgentEvent(event as AgentEvent)));
          close = () => controller.close();
        },
      }),
    );
  };
  return {
    requests,
    transport,
    push: (event: unknown) => push(event),
    close: () => close(),
  };
}

describe('Yardımcı akışı ekranda', { timeout: 30_000 }, () => {
  it('kip seçicide dört kip vardır, ilk kip "Sor" olur', () => {
    render(<AiStudio transport={demo()} source={MOCK_SOURCE} />);
    const group = screen.getByRole('radiogroup', { name: 'Kip' });
    const names = within(group)
      .getAllByRole('radio')
      .map((r) => r.closest('label')?.textContent?.trim());
    expect(names).toEqual(['Sor', 'Ara', 'Taslak hazırla', 'İşlem yap']);
    expect(within(group).getByRole('radio', { name: 'Sor' })).toBeChecked();
  });

  it('seçilen kip istekle sunucuya gider', async () => {
    const user = setupUser();
    const m = manual();
    render(<AiStudio transport={m.transport} source={MOCK_SOURCE} />);
    await pickMode(user, 'İşlem yap');
    await send(user, 'Sipariş SO-0041 iptal et');
    await waitFor(() => expect(m.requests).toHaveLength(1));
    expect((m.requests[0] as AgentRequest & { mode?: string }).mode).toBe('act');
  });

  it('sunucu olayı gelmeden araç olayı görünmez, gelince listeye girer', async () => {
    const user = setupUser();
    const m = manual();
    render(<AiStudio transport={m.transport} source={MOCK_SOURCE} />);
    await send(user, 'Siparişleri tara');
    await waitFor(() => expect(m.requests).toHaveLength(1));
    expect(document.querySelector('[data-genui="events"]')).toBeNull();
    expect(screen.queryByText('Araç olayları')).toBeNull();

    m.push({
      type: 'tool',
      key: 't1',
      tool: 'orders.read',
      title: 'Sipariş kaydı okundu',
      status: 'success',
    });
    const log = screen.getByRole('log');
    await waitFor(() => expect(log.querySelector('[data-genui="events"]')).not.toBeNull());
    const events = log.querySelector('[data-genui="events"]') as HTMLElement;
    expect(within(events).getByText('orders.read')).toBeInTheDocument();
    m.push({ type: 'done' });
    m.close();
  });

  it('sunucu adım olayı akış adımını ilerletir, istemci adım uydurmaz', async () => {
    const user = setupUser();
    const m = manual();
    render(<AiStudio transport={m.transport} source={MOCK_SOURCE} />);
    const flow = screen.getByRole('list', { name: 'Akış adımları' });
    expect(within(flow).getByText('Niyet').closest('li')).toHaveAttribute('aria-current', 'step');

    await send(user, 'Siparişleri tara');
    await waitFor(() => expect(m.requests).toHaveLength(1));
    // Until the server sends a step, the screen stays at the intent step.
    expect(within(flow).getByText('Niyet').closest('li')).toHaveAttribute('aria-current', 'step');

    m.push({ type: 'step', step: 'plan' });
    await waitFor(() =>
      expect(within(flow).getByText('Plan').closest('li')).toHaveAttribute('aria-current', 'step'),
    );
    m.push({ type: 'done' });
    m.close();
  });

  it('"Sor" kipinde onay, uygulama ve geri alma adımları "Bu kipte yok" yazar', () => {
    render(<AiStudio transport={demo()} source={MOCK_SOURCE} />);
    const flow = screen.getByRole('list', { name: 'Akış adımları' });
    for (const label of ['Onay', 'Uygulama', 'Geri alma önerisi']) {
      expect(within(flow).getByText(label).closest('li')).toHaveTextContent('Bu kipte yok');
    }
  });

  it('plan adımında kapsam şeridi, onay adımında onay kartı görünür', async () => {
    const user = setupUser();
    render(<AiStudio transport={demo()} source={MOCK_SOURCE} />);
    await pickMode(user, 'İşlem yap');
    await send(user, 'SO-0041 siparişinin teslim tarihini bir gün ileri al');
    const log = screen.getByRole('log');
    await waitFor(() => expect(log.querySelector('[data-genui="confirm"]')).not.toBeNull());

    const plan = within(log).getByRole('region', { name: 'Plan' });
    expect(plan.querySelector('[data-genui="scope"]')).not.toBeNull();
    expect(plan.querySelector('[data-genui="events"]')).not.toBeNull();
    const preview = within(log).getByRole('region', { name: 'Önizleme' });
    expect(preview.querySelector('[data-genui="review"]')).not.toBeNull();
    const approval = within(log).getByRole('region', { name: 'Onay' });
    expect(approval.querySelector('[data-genui="confirm"]')).not.toBeNull();

    const flow = screen.getByRole('list', { name: 'Akış adımları' });
    expect(within(flow).getByText('Onay').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  it('onaydan sonra uygulama adımında sonuç yüzeyi görünür', async () => {
    const user = setupUser();
    render(<AiStudio transport={demo()} source={MOCK_SOURCE} />);
    await pickMode(user, 'İşlem yap');
    await send(user, 'SO-0041 siparişinin teslim tarihini bir gün ileri al');
    const log = screen.getByRole('log');
    await waitFor(() => expect(log.querySelector('[data-genui="confirm"]')).not.toBeNull());
    const card = log.querySelector('[data-genui="confirm"]') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: 'Onayla' }));

    await waitFor(() => expect(log.querySelector('[data-genui="result"]')).not.toBeNull());
    const apply = within(log).getByRole('region', { name: 'Uygulama' });
    expect(apply.querySelector('[data-genui="result"]')).not.toBeNull();
    // A tool event after approval belongs to the apply step, not to the plan heading.
    expect(apply.querySelector('[data-genui="events"]')).not.toBeNull();
    expect(within(log).getAllByRole('region', { name: 'Plan' })).toHaveLength(1);
    const flow = screen.getByRole('list', { name: 'Akış adımları' });
    await waitFor(() =>
      expect(within(flow).getByText('Uygulama').closest('li')).toHaveAttribute(
        'aria-current',
        'step',
      ),
    );
  });

  it('R3 önerisinde ad yanlış yazılınca "Onayla" kapalı kalır', async () => {
    const user = setupUser();
    render(<AiStudio transport={demo()} source={MOCK_SOURCE} />);
    await pickMode(user, 'İşlem yap');
    await send(user, 'SO-0041 siparişini iptal et');
    const log = screen.getByRole('log');
    await waitFor(() => expect(log.querySelector('[data-risk="R3"]')).not.toBeNull());
    const card = log.querySelector('[data-risk="R3"]') as HTMLElement;
    const approve = within(card).getByRole('button', { name: 'Onayla' });
    expect(approve).toBeDisabled();
    const input = within(card).getByRole('textbox');
    await user.type(input, 'SO-0014');
    expect(approve).toBeDisabled();
    await user.clear(input);
    await user.type(input, 'SO-0041');
    expect(approve).toBeEnabled();
  });

  it('ekranda baykuş, "Geri al" düğmesi ve yüzde biçiminde güven değeri yoktur', async () => {
    const user = setupUser();
    const { container } = render(<AiStudio transport={demo()} source={MOCK_SOURCE} />);
    expect(container.querySelector('svg.owl, .owl')).toBeNull();
    await pickMode(user, 'İşlem yap');
    await send(user, 'SO-0041 siparişinin teslim tarihini bir gün ileri al');
    const log = screen.getByRole('log');
    await waitFor(() => expect(log.querySelector('[data-genui="confirm"]')).not.toBeNull());
    expect(container.querySelector('svg.owl, .owl')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Geri al' })).toBeNull();
    expect(document.body.textContent ?? '').not.toMatch(/%\s?\d|\d\s?%/);
    expect(screen.queryByText(/Düşünce|düşünüyor/)).toBeNull();
  });

  it('form alanlarında alan başına yapay zekâ düğmesi yoktur', async () => {
    const user = setupUser();
    render(<AiStudio transport={demo()} source={MOCK_SOURCE} />);
    await send(user, 'Stok uyarısı için otomasyon kur');
    const log = screen.getByRole('log');
    await waitFor(() => expect(log.querySelector('[data-genui="form"]')).not.toBeNull());
    const form = log.querySelector('[data-genui="form"]') as HTMLElement;
    const buttons = within(form).queryAllByRole('button');
    for (const button of buttons) {
      expect(button.textContent ?? button.getAttribute('aria-label') ?? '').not.toMatch(
        /yapay zek|\bAI\b|öner|doldur/i,
      );
    }
  });
});

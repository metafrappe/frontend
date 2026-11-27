import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, createIdempotentRunner, createKeyStore } from '../../api';
import { IdempotentAction } from '../idempotent-action';
import { useLatestRecord } from '../latest-record';
import { ModuleProvider } from '../runtime';

interface Ticket {
  name: string;
  subject: string;
  version: string;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function runner() {
  return createIdempotentRunner({
    store: createKeyStore({ storage: window.localStorage }),
    sleep: () => Promise.resolve(),
  });
}

function wrap(node: React.ReactNode) {
  return (
    <ModuleProvider
      value={{ tenant: 'example-site', user: 'example-user', mode: 'example', locale: 'en' }}
    >
      {node}
    </ModuleProvider>
  );
}

/** Test ekranı: kayıt ve "Save" düğmesi. Geç gelen yanıt `useLatestRecord` ile süzülür. */
function TicketScreen({
  initial,
  send,
  refreshed,
  run = runner(),
}: {
  initial: Ticket;
  send: (key: string) => Promise<Ticket>;
  refreshed?: Promise<Ticket>;
  run?: ReturnType<typeof runner>;
}) {
  const [ticket, accept] = useLatestRecord(initial, (t) => t.version);
  return (
    <>
      <p data-testid="subject">{ticket.subject}</p>
      <IdempotentAction
        name="idempotency-key:example-site:support-update:TICKET-1"
        label="Save"
        runner={run}
        send={send}
        onDone={accept}
      />
      <button type="button" onClick={() => void refreshed?.then(accept)}>
        Reload
      </button>
    </>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe('idempotent action on screen', () => {
  const initial = { name: 'TICKET-1', subject: 'Old subject', version: 'v1' };

  it('sends one request with one key when the user presses twice', async () => {
    const reply = deferred<Ticket>();
    const send = vi.fn((_key: string) => reply.promise);
    render(wrap(<TicketScreen initial={initial} send={send} />));

    const button = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(button);
    fireEvent.click(button);

    // Bekleme sırasında düğme durumu söyler.
    const busy = screen.getByRole('button', { name: /Processing/ });
    expect(busy).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(busy);

    await act(async () => reply.resolve({ ...initial, subject: 'Saved', version: 'v2' }));
    expect(send).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('subject')).toHaveTextContent('Saved');
  });

  it('retries a lost response with the same key', async () => {
    const keys: string[] = [];
    const send = vi.fn((key: string) => {
      keys.push(key);
      return keys.length === 1
        ? Promise.reject(new ApiError({ kind: 'network', status: 0 }))
        : Promise.resolve({ ...initial, subject: 'Saved', version: 'v2' });
    });
    render(wrap(<TicketScreen initial={initial} send={send} />));

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved')).toBeVisible();
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });

  it('shows the conflict message when the record has an older version', async () => {
    const send = vi.fn(() =>
      Promise.reject(new ApiError({ kind: 'conflict', status: 409, code: 'VersionConflictError' })),
    );
    render(wrap(<TicketScreen initial={initial} send={send} />));

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('This record changed after you opened it.')).toBeVisible();
    expect(screen.getByTestId('subject')).toHaveTextContent('Old subject');
  });

  it('keeps the newer result when an old response arrives late', async () => {
    const late = deferred<Ticket>();
    const fresh = deferred<Ticket>();
    render(
      wrap(<TicketScreen initial={initial} send={() => late.promise} refreshed={fresh.promise} />),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    await act(async () => fresh.resolve({ ...initial, subject: 'From other tab', version: 'v3' }));
    expect(screen.getByTestId('subject')).toHaveTextContent('From other tab');

    await act(async () => late.resolve({ ...initial, subject: 'Late old answer', version: 'v2' }));
    expect(screen.getByTestId('subject')).toHaveTextContent('From other tab');
  });
});

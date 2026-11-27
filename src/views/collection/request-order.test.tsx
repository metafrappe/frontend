// Request order on the list screen (AJA-1773). Delays come from the mock server (MSW).
// Tests do not sleep: each delayed response waits for a promise the test releases.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { mockServer } from '@/mocks/node';
import { resetMockState } from '@/mocks/handlers';
import { CollectionView } from './CollectionView';
import { sampleDefinition } from './sample';
import { sampleSource } from './test-support/api';

const LIST = '*/api/v2/document/:doctype';

function deferred() {
  let release: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

function rows(title: string) {
  return HttpResponse.json({
    data: [{ name: `ID ${title}`, title, status: 'Açık', amount: 1 }],
    has_next_page: false,
  });
}

beforeAll(() => {
  mockServer.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  cleanup();
  mockServer.resetHandlers();
  resetMockState();
});
afterAll(() => {
  mockServer.close();
});

function Screen({
  workspace,
  source,
}: {
  workspace: string;
  source: ReturnType<typeof sampleSource>;
}) {
  return (
    <MemoryRouter>
      <p>Kurum: {workspace}</p>
      <CollectionView definition={sampleDefinition} source={source} workspace={workspace} />
    </MemoryRouter>
  );
}

describe('request order', () => {
  it('keeps the last search when the earlier "vida" response arrives late', async () => {
    const slow = deferred();
    const served = deferred();
    const arrived = deferred();
    mockServer.use(
      http.get(LIST, async ({ request }) => {
        const filters = new URL(request.url).searchParams.get('filters') ?? '';
        if (filters.includes('paslanmaz vida')) return rows('paslanmaz vida sonucu');
        if (filters.includes('vida')) {
          arrived.release();
          await slow.promise;
          served.release();
          return rows('eski vida sonucu');
        }
        return rows('ilk liste');
      }),
    );
    render(<Screen workspace="kurum-a" source={sampleSource()} />);
    await screen.findByText('ilk liste');
    const input = screen.getByRole('textbox', { name: 'Kayıt ara' });
    fireEvent.change(input, { target: { value: 'vida' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ara' }));
    await act(async () => {
      await arrived.promise;
    });
    fireEvent.change(input, { target: { value: 'paslanmaz vida' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ara' }));
    await screen.findByText('paslanmaz vida sonucu');
    await act(async () => {
      slow.release();
      await served.promise;
    });
    expect(screen.queryByText('eski vida sonucu')).not.toBeInTheDocument();
    expect(screen.getByText('paslanmaz vida sonucu')).toBeVisible();
    expect(input).toHaveValue('paslanmaz vida');
  });

  it('does not write organisation A late data on the organisation B screen', async () => {
    const slow = deferred();
    const served = deferred();
    const arrived = deferred();
    let calls = 0;
    mockServer.use(
      http.get(LIST, async () => {
        calls += 1;
        if (calls === 1) {
          arrived.release();
          await slow.promise;
          served.release();
          return rows('Kurum A kaydı');
        }
        return rows('Kurum B kaydı');
      }),
    );
    const source = sampleSource();
    const { rerender } = render(<Screen workspace="kurum-a" source={source} />);
    await act(async () => {
      await arrived.promise;
    });
    rerender(<Screen workspace="kurum-b" source={source} />);
    await screen.findByText('Kurum B kaydı');
    await act(async () => {
      slow.release();
      await served.promise;
    });
    expect(screen.queryByText('Kurum A kaydı')).not.toBeInTheDocument();
    expect(screen.getByText('Kurum B kaydı')).toBeVisible();
    expect(screen.getByText('Kurum: kurum-b')).toBeVisible();
  });

  it('does not show the late error of organisation A on the organisation B screen', async () => {
    const slow = deferred();
    const served = deferred();
    const arrived = deferred();
    let calls = 0;
    mockServer.use(
      http.get(LIST, async () => {
        calls += 1;
        if (calls === 1) {
          arrived.release();
          await slow.promise;
          served.release();
          return HttpResponse.json({ errors: [{ type: 'ServerError' }] }, { status: 500 });
        }
        return rows('Kurum B kaydı');
      }),
    );
    const source = sampleSource();
    const { rerender } = render(<Screen workspace="kurum-a" source={source} />);
    await act(async () => {
      await arrived.promise;
    });
    rerender(<Screen workspace="kurum-b" source={source} />);
    await screen.findByText('Kurum B kaydı');
    await act(async () => {
      slow.release();
      await served.promise;
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Kurum B kaydı')).toBeVisible();
  });
});

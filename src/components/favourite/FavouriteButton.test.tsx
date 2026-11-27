// Favourite button sends the target state (AJA-1774, AJA-1736 tests 6 and 8).
// The fake server is in `src/mocks/favourite.ts`. Tests do not sleep.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createApiClient } from '@/api/client';
import type { ApiConfig } from '@/api/config';
import { createCsrfStore } from '@/api/csrf';
import { createFavouriteClient } from '@/api/favourite-client';
import { LanguageProvider } from '@/app/locale/LanguageProvider';
import { SAMPLE_CSRF_TOKEN, SAMPLE_KEYCLOAK_URL } from '@/mocks/fixtures';
import {
  createFakeFavouriteServer,
  favouriteHandlers,
  type FakeFavouriteServer,
} from '@/mocks/favourite';
import { resetMockState } from '@/mocks/handlers';
import { mockServer } from '@/mocks/node';

import { FavouriteButton } from './FavouriteButton';

const config: ApiConfig = {
  siteUrl: 'https://kiraci.example.test',
  credentials: 'same-origin',
  timeoutMs: 1_000,
  modelTimeoutMs: 2_000,
  keycloakUrl: SAMPLE_KEYCLOAK_URL,
  keycloakRealm: 'platform',
  aiRoute: 'ornek-rota',
  csrfMetaName: 'csrf-token',
};

const RECORD = { doctype: 'Item', name: 'ITEM-0001' };

function favouriteClient() {
  return createFavouriteClient(
    createApiClient({ config, csrf: createCsrfStore(SAMPLE_CSRF_TOKEN) }),
  );
}

function deferred() {
  let release: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

function useServer(initial: boolean): FakeFavouriteServer {
  const server = createFakeFavouriteServer(initial);
  mockServer.use(...favouriteHandlers(server));
  return server;
}

function renderButton(options: { language?: 'tr' | 'en'; initial?: boolean } = {}) {
  render(
    <LanguageProvider initialLanguage={options.language ?? 'tr'}>
      <FavouriteButton
        client={favouriteClient()}
        doctype={RECORD.doctype}
        name={RECORD.name}
        initial={options.initial ?? false}
      />
    </LanguageProvider>,
  );
  return screen.getByRole('button', { name: options.language === 'en' ? 'Favourite' : 'Favori' });
}

beforeAll(() => mockServer.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  cleanup();
  mockServer.resetHandlers();
  resetMockState();
});
afterAll(() => mockServer.close());

describe('favourite target state', () => {
  it('1. sending "favourite = yes" twice keeps the favourite on', async () => {
    const server = useServer(false);
    const client = favouriteClient();

    await client.set(RECORD, true);
    await client.set(RECORD, true);

    expect(server.favourite).toBe(true);
    expect(await client.read(RECORD)).toBe(true);
  });

  it('1. a double press on a slow network sends one "yes" and the button stays on', async () => {
    const server = useServer(false);
    const slow = deferred();
    server.hold = slow.promise;
    const button = renderButton();

    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');

    await act(async () => {
      slow.release();
      await slow.promise;
    });

    await waitFor(() => expect(button).toHaveAttribute('aria-busy', 'false'));
    expect(server.setBodies).toHaveLength(1);
    expect(server.favourite).toBe(true);
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('2. the request body carries the target state and no "toggle"', async () => {
    const server = useServer(true);
    const button = renderButton({ initial: true });

    fireEvent.click(button);
    await waitFor(() => expect(server.setBodies).toHaveLength(1));
    await waitFor(() => expect(button).toHaveAttribute('aria-busy', 'false'));

    expect(server.setBodies[0]).toEqual({
      doctype: RECORD.doctype,
      name: RECORD.name,
      favourite: false,
    });
    expect(JSON.stringify(server.setBodies[0]).toLowerCase()).not.toContain('toggle');
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('3. a rejection returns the button to the real server state and shows the reason', async () => {
    // The screen shows "off". Another user already turned it on. The server rejects the change.
    const server = useServer(true);
    server.reject = { status: 403, code: 'data_policy_denied' };
    const button = renderButton({ initial: false });

    fireEvent.click(button);

    const reason = await screen.findByText('Bu işlem için izniniz yok.');
    expect(reason.closest('[role="alert"]')).not.toBeNull();
    expect(server.reads).toBeGreaterThan(0);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAttribute('aria-busy', 'false');
  });

  it("3. the rejection reason is in the user's language", async () => {
    const server = useServer(false);
    server.reject = { status: 403, code: 'data_policy_denied' };
    const button = renderButton({ language: 'en', initial: false });

    fireEvent.click(button);

    const reason = await screen.findByText('You do not have permission for this action.');
    expect(reason.closest('[role="alert"]')).not.toBeNull();
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('4. a lost response makes the screen read the state again from the server', async () => {
    const server = useServer(false);
    server.dropResponse = true;
    const button = renderButton({ initial: false });

    fireEvent.click(button);

    await waitFor(() => expect(server.reads).toBe(1));
    await waitFor(() => expect(button).toHaveAttribute('aria-busy', 'false'));
    expect(server.favourite).toBe(true);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('');
  });
});

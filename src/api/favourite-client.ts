// Favourite client (AJA-1774). The favourite button sends the target state, never "toggle".
//
// Team A's idempotency contract (`contracts/idempotency.md`, section "Eylem türleri") calls this
// kind of endpoint "hedef durum" (target state): sending the same target twice gives the same
// result, so no `Idempotency-Key` header is needed.
//
// The endpoint names below are provisional. The favourite endpoint is not yet in the contract's
// endpoint list. When Team A adds it, change these two paths and `src/mocks/favourite.ts`.
//
// Values are imported only from `./index`. This keeps the shared code in the initial-load chunk.
import type { ApiClient, RequestOptions } from './client';
import { ApiError } from './index';

export const FAVOURITE_READ_PATH = '/api/method/platform_core.api.favourite.get_favourite';
export const FAVOURITE_SET_PATH = '/api/method/platform_core.api.favourite.set_favourite';

export interface FavouriteRecord {
  doctype: string;
  name: string;
}

function readFavourite(body: unknown, status: number): boolean {
  const message =
    typeof body === 'object' && body !== null && 'message' in body
      ? (body as { message: unknown }).message
      : undefined;
  const value =
    typeof message === 'object' && message !== null && 'favourite' in message
      ? (message as { favourite: unknown }).favourite
      : undefined;
  if (typeof value !== 'boolean') throw new ApiError({ kind: 'invalid_response', status });
  return value;
}

export function createFavouriteClient(api: Pick<ApiClient, 'frappeDocument'>) {
  return {
    /** Reads the real favourite state from the server. */
    async read(record: FavouriteRecord, options: RequestOptions = {}): Promise<boolean> {
      const response = await api.frappeDocument({
        method: 'GET',
        path: FAVOURITE_READ_PATH,
        query: { doctype: record.doctype, name: record.name },
        ...(options.signal ? { signal: options.signal } : {}),
      });
      if (!response.ok) throw response.error;
      return readFavourite(response.body, response.status);
    },

    /**
     * Sends the target state. Example: `set(record, true)` means "favourite = yes".
     * Returns the state the server confirmed.
     */
    async set(
      record: FavouriteRecord,
      favourite: boolean,
      options: RequestOptions = {},
    ): Promise<boolean> {
      const response = await api.frappeDocument({
        method: 'POST',
        path: FAVOURITE_SET_PATH,
        body: { doctype: record.doctype, name: record.name, favourite },
        ...(options.signal ? { signal: options.signal } : {}),
      });
      if (!response.ok) throw response.error;
      return readFavourite(response.body, response.status);
    },
  };
}

export type FavouriteClient = ReturnType<typeof createFavouriteClient>;

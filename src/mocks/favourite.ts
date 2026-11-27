// Fake favourite server (AJA-1774). This is the only file with fake favourite data.
// The endpoint is not yet in Team A's idempotency contract (`contracts/idempotency.md`).
// When Team A adds it, change the paths in `src/api/favourite-client.ts` and this file only.
//
// The server keeps one favourite flag per record. A "set" request carries the target state.
// Sending the same target twice gives the same result.
import { http, HttpResponse } from 'msw';

import { FAVOURITE_READ_PATH, FAVOURITE_SET_PATH } from '@/api/favourite-client';

export interface FakeFavouriteServer {
  /** The real state on the server. Tests change it to simulate another user. */
  favourite: boolean;
  /** Every body sent to the set endpoint, in order. */
  setBodies: unknown[];
  /** Number of read requests. */
  reads: number;
  /** When set, the server rejects set requests with this status and error code. */
  reject?: { status: number; code: string } | undefined;
  /** When true, the server applies the change and then drops the response. */
  dropResponse?: boolean | undefined;
  /** When given, the set response waits for this promise. */
  hold?: Promise<void> | undefined;
}

export function createFakeFavouriteServer(initial = false): FakeFavouriteServer {
  return { favourite: initial, setBodies: [], reads: 0 };
}

export function favouriteHandlers(server: FakeFavouriteServer) {
  return [
    http.get(`*${FAVOURITE_READ_PATH}`, () => {
      server.reads += 1;
      return HttpResponse.json({ message: { favourite: server.favourite } });
    }),
    http.post(`*${FAVOURITE_SET_PATH}`, async ({ request }) => {
      const body: unknown = await request.json();
      server.setBodies.push(body);
      if (server.hold) await server.hold;
      if (server.reject) {
        return HttpResponse.json({ exc_type: server.reject.code }, { status: server.reject.status });
      }
      const target =
        typeof body === 'object' && body !== null && 'favourite' in body
          ? (body as { favourite: unknown }).favourite
          : undefined;
      if (typeof target !== 'boolean') {
        return HttpResponse.json({ exc_type: 'ValidationError' }, { status: 417 });
      }
      server.favourite = target;
      if (server.dropResponse) return HttpResponse.error();
      return HttpResponse.json({ message: { favourite: server.favourite } });
    }),
  ];
}

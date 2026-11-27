import { describe, expect, it, vi } from 'vitest';

import { ApiError } from './errors';
import {
  IDEMPOTENCY_HEADER,
  KEY_MAX_AGE_MS,
  createIdempotentRunner,
  createKeyStore,
  idempotencyKeyName,
  isNotOlder,
} from './idempotency';

/** Bellekte duran sahte `localStorage`. İki sekme aynı nesneyi paylaşır. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

function sequentialUuid() {
  let n = 0;
  return () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  };
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

const name = idempotencyKeyName('team-a', 'support-create', 'new');
const noSleep = () => Promise.resolve();

describe('idempotency key store', () => {
  it('builds the storage name from team, action and form', () => {
    expect(name).toBe('idempotency-key:team-a:support-create:new');
    expect(IDEMPOTENCY_HEADER).toBe('Idempotency-Key');
  });

  it('gives a second tab the same key from shared storage', () => {
    const storage = memoryStorage();
    const uuid = sequentialUuid();
    const first = createKeyStore({ storage, uuid }).obtain(name);
    const second = createKeyStore({ storage, uuid }).obtain(name);
    expect(second.key).toBe(first.key);
    expect(first.key).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('idempotent runner', () => {
  it('sends one request with one key when the user presses twice', async () => {
    const store = createKeyStore({ storage: memoryStorage(), uuid: sequentialUuid() });
    const runner = createIdempotentRunner({ store, sleep: noSleep });
    const reply = deferred<{ name: string }>();
    const send = vi.fn((_key: string) => reply.promise);

    const first = runner.run(name, send);
    const second = runner.run(name, send);
    reply.resolve({ name: 'TICKET-1' });

    expect(await first).toEqual({ status: 'done', value: { name: 'TICKET-1' } });
    expect(await second).toEqual({ status: 'done', value: { name: 'TICKET-1' } });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('retries a lost response with the same key', async () => {
    const store = createKeyStore({ storage: memoryStorage(), uuid: sequentialUuid() });
    const runner = createIdempotentRunner({ store, sleep: noSleep });
    const keys: string[] = [];
    const send = vi.fn((key: string) => {
      keys.push(key);
      if (keys.length === 1) return Promise.reject(new ApiError({ kind: 'network', status: 0 }));
      if (keys.length === 2) return Promise.reject(new ApiError({ kind: 'timeout', status: 0 }));
      return Promise.resolve({ name: 'TICKET-1' });
    });

    expect(await runner.run(name, send)).toEqual({ status: 'done', value: { name: 'TICKET-1' } });
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(1);
  });

  it('keeps the key when every retry is lost, so the next press reuses it', async () => {
    const store = createKeyStore({ storage: memoryStorage(), uuid: sequentialUuid() });
    const runner = createIdempotentRunner({ store, sleep: noSleep, maxAttempts: 2 });
    const keys: string[] = [];
    const send = (key: string) => {
      keys.push(key);
      return Promise.reject(new ApiError({ kind: 'network', status: 0 }));
    };
    expect((await runner.run(name, send)).status).toBe('uncertain');
    await runner.run(name, send);
    expect(new Set(keys).size).toBe(1);
  });

  it('waits and asks again with the same key while the first request is in progress', async () => {
    const store = createKeyStore({ storage: memoryStorage(), uuid: sequentialUuid() });
    const sleep = vi.fn(noSleep);
    const runner = createIdempotentRunner({ store, sleep });
    const keys: string[] = [];
    const send = (key: string) => {
      keys.push(key);
      return keys.length === 1
        ? Promise.reject(
            new ApiError({
              kind: 'conflict',
              status: 409,
              code: 'IdempotencyInProgressError',
              retryAfterSeconds: 2,
            }),
          )
        : Promise.resolve('ok');
    };
    expect(await runner.run(name, send)).toEqual({ status: 'done', value: 'ok' });
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(new Set(keys).size).toBe(1);
  });

  it('reports a version conflict and forgets the key', async () => {
    const storage = memoryStorage();
    const store = createKeyStore({ storage, uuid: sequentialUuid() });
    const runner = createIdempotentRunner({ store, sleep: noSleep });
    const outcome = await runner.run(name, () =>
      Promise.reject(new ApiError({ kind: 'conflict', status: 409, code: 'VersionConflictError' })),
    );
    expect(outcome.status).toBe('conflict');
    expect(storage.getItem(name)).toBeNull();
  });

  it('makes a new key after the server says the key was reused with other details', async () => {
    const store = createKeyStore({ storage: memoryStorage(), uuid: sequentialUuid() });
    const runner = createIdempotentRunner({ store, sleep: noSleep });
    const keys: string[] = [];
    const outcome = await runner.run(name, (key) => {
      keys.push(key);
      return Promise.reject(
        new ApiError({ kind: 'invalid_request', status: 422, code: 'IdempotencyKeyReusedError' }),
      );
    });
    expect(outcome.status).toBe('reused');
    await runner.run(name, (key) => {
      keys.push(key);
      return Promise.resolve('ok');
    });
    expect(keys[1]).not.toBe(keys[0]);
  });

  it('does not resend a key older than 23 hours on its own', async () => {
    const storage = memoryStorage();
    let clock = 0;
    const store = createKeyStore({ storage, uuid: sequentialUuid(), now: () => clock });
    store.obtain(name);
    clock = KEY_MAX_AGE_MS + 1;
    const runner = createIdempotentRunner({ store, sleep: noSleep });
    const send = vi.fn(() => Promise.resolve('ok'));
    expect((await runner.run(name, send)).status).toBe('stale');
    expect(send).not.toHaveBeenCalled();
  });
});

describe('late response guard', () => {
  it('rejects an older version and accepts the same or a newer one', () => {
    const newer = '2026-11-27 10:00:01.000002';
    const older = '2026-11-27 10:00:01.000001';
    expect(isNotOlder(older, newer)).toBe(false);
    expect(isNotOlder(newer, newer)).toBe(true);
    expect(isNotOlder(newer, older)).toBe(true);
    expect(isNotOlder(older, undefined)).toBe(true);
  });
});

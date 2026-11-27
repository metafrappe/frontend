import { ApiError } from './errors';

/**
 * İş anahtarı. Sözleşme: `metafrappe/backend` deposunda `contracts/idempotency.md` (AJA-1749).
 *
 * İstemci her kullanıcı niyeti için bir anahtar üretir. Anahtar `localStorage` içinde durur.
 * Böylece ikinci sekme aynı anahtarı gönderir. Ağ hatasında ve zaman aşımında aynı anahtar yeniden gider.
 * Kesin sonuç gelince anahtar silinir.
 */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/** Bu yaştan eski anahtar kendiliğinden yeniden gönderilmez (sözleşme 1. bölüm, 8. kural). */
export const KEY_MAX_AGE_MS = 23 * 60 * 60 * 1000;

const KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Depodaki ad kurumu, eylemi ve formu birlikte içerir. Ad kişisel bilgi taşımaz. */
export function idempotencyKeyName(team: string, action: string, form: string): string {
  return `idempotency-key:${team}:${action}:${form}`;
}

export interface StoredKey {
  key: string;
  createdAt: number;
}

export interface KeyStore {
  /** Var olan anahtarı ya da yeni anahtarı verir. */
  obtain(name: string): StoredKey;
  clear(name: string): void;
  isStale(entry: StoredKey): boolean;
}

export interface KeyStoreDeps {
  storage?: Storage;
  now?: () => number;
  uuid?: () => string;
}

function readEntry(raw: string | null): StoredKey | undefined {
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === 'object' &&
      value !== null &&
      'key' in value &&
      'createdAt' in value &&
      typeof value.key === 'string' &&
      KEY_PATTERN.test(value.key) &&
      typeof value.createdAt === 'number' &&
      Number.isFinite(value.createdAt)
    ) {
      return { key: value.key, createdAt: value.createdAt };
    }
  } catch {
    // Bozuk kayıt yok sayılır. Yeni anahtar üretilir.
  }
  return undefined;
}

export function createKeyStore({
  storage = globalThis.localStorage,
  now = Date.now,
  uuid = () => globalThis.crypto.randomUUID(),
}: KeyStoreDeps = {}): KeyStore {
  return {
    obtain(name) {
      const existing = readEntry(storage.getItem(name));
      if (existing) return existing;
      const entry = { key: uuid().toLowerCase(), createdAt: now() };
      storage.setItem(name, JSON.stringify(entry));
      return entry;
    },
    clear(name) {
      storage.removeItem(name);
    },
    isStale(entry) {
      return now() - entry.createdAt > KEY_MAX_AGE_MS;
    },
  };
}

/**
 * Eylemin sonucu.
 * - `done`: sunucu işi yaptı ya da ilk sonucu yeniden verdi.
 * - `conflict`: kayıt başkası tarafından değişti (`VersionConflictError`).
 * - `reused`: aynı anahtar başka bilgilerle gitti (`IdempotencyKeyReusedError`).
 * - `uncertain`: yanıt gelmedi. Anahtar saklı kalır. Sonraki basış aynı anahtarı gönderir.
 * - `stale`: anahtar 23 saatten eski. Önce liste yeniden okunur.
 * - `failed`: sunucu kesin bir hatayla reddetti.
 */
export type ActionOutcome<T> =
  | { status: 'done'; value: T }
  | { status: 'conflict'; error: ApiError }
  | { status: 'reused'; error: ApiError }
  | { status: 'uncertain'; error: unknown }
  | { status: 'stale' }
  | { status: 'failed'; error: unknown };

export interface RunnerDeps {
  store: KeyStore;
  sleep?: (ms: number) => Promise<void>;
  /** Ağ hatası ya da zaman aşımında en çok bu kadar deneme yapılır. */
  maxAttempts?: number;
  /** Sunucu "işleniyor" dedikçe en çok bu kadar yeniden sorulur. */
  maxInProgressPolls?: number;
}

const IN_PROGRESS = 'IdempotencyInProgressError';
const KEY_REUSED = 'IdempotencyKeyReusedError';
/** Eski izin uçları düz `TimestampMismatchError` (417) verebilir. İkisi de çakışmadır (sözleşme 7. bölüm). */
const VERSION_CONFLICT = new Set(['VersionConflictError', 'TimestampMismatchError']);

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createIdempotentRunner({
  store,
  sleep = defaultSleep,
  maxAttempts = 3,
  maxInProgressPolls = 30,
}: RunnerDeps) {
  const inFlight = new Map<string, Promise<ActionOutcome<unknown>>>();

  async function execute<T>(
    name: string,
    send: (key: string) => Promise<T>,
  ): Promise<ActionOutcome<T>> {
    const entry = store.obtain(name);
    if (store.isStale(entry)) {
      store.clear(name);
      return { status: 'stale' };
    }
    let attempts = 0;
    let polls = 0;
    for (;;) {
      try {
        const value = await send(entry.key);
        store.clear(name);
        return { status: 'done', value };
      } catch (error) {
        if (!(error instanceof ApiError)) return { status: 'uncertain', error };
        if (error.code === IN_PROGRESS) {
          polls += 1;
          if (polls > maxInProgressPolls) return { status: 'uncertain', error };
          await sleep((error.retryAfterSeconds ?? 2) * 1000);
          continue;
        }
        if (error.kind === 'network' || error.kind === 'timeout') {
          attempts += 1;
          if (attempts >= maxAttempts) return { status: 'uncertain', error };
          await sleep(attempts * 1000);
          continue;
        }
        if (error.code === KEY_REUSED) {
          store.clear(name);
          return { status: 'reused', error };
        }
        if (error.code !== undefined && VERSION_CONFLICT.has(error.code)) {
          store.clear(name);
          return { status: 'conflict', error };
        }
        // Sunucu hatası ve bozuk yanıt kesin değildir. Anahtar saklı kalır.
        if (
          error.kind === 'unavailable' ||
          error.kind === 'unknown' ||
          error.kind === 'invalid_response'
        ) {
          return { status: 'uncertain', error };
        }
        store.clear(name);
        return { status: 'failed', error };
      }
    }
  }

  return {
    /**
     * Eylemi çalıştırır. Aynı ad için süren bir istek varsa yeni istek gitmez.
     * İkinci basış ilk isteğin sonucunu bekler.
     */
    run<T>(name: string, send: (key: string) => Promise<T>): Promise<ActionOutcome<T>> {
      const pending = inFlight.get(name);
      if (pending) return pending as Promise<ActionOutcome<T>>;
      const started = execute(name, send).finally(() => inFlight.delete(name));
      inFlight.set(name, started);
      return started;
    },
  };
}

export type IdempotentRunner = ReturnType<typeof createIdempotentRunner>;

/**
 * Geç gelen yanıt süzgeci. Sürüm kaydın `modified` değeridir.
 * Frappe bu değeri sabit biçimde yazar (`YYYY-MM-DD HH:MM:SS.ffffff`). Bu yüzden metin karşılaştırması sırayı verir.
 */
export function isNotOlder(candidate: string, current: string | undefined): boolean {
  return current === undefined || candidate >= current;
}

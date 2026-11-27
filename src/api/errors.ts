import messages from './error-messages.json';

/**
 * Ortak hata türleri. Ekran bu türe göre karar verir.
 * Ham sunucu gövdesi ve hata izi hiçbir alana konmaz (SZ-8).
 */
export type ApiErrorKind =
  | 'session_expired'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'unavailable'
  | 'invalid_request'
  | 'csrf'
  | 'network'
  | 'timeout'
  | 'invalid_response'
  | 'unknown';

export type MessageLocale = keyof typeof messages;

export interface ApiErrorInit {
  kind: ApiErrorKind;
  status: number;
  code?: string | undefined;
  retryAfterSeconds?: number | undefined;
  needsSessionCheck?: boolean | undefined;
  fields?: readonly string[] | undefined;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** HTTP durum kodu. Ağ hatasında 0 olur. */
  readonly status: number;
  /** Sunucunun hata kodu. Örneğin `exc_type` ya da model geçidinin `error` değeri. */
  readonly code: string | undefined;
  readonly retryAfterSeconds: number | undefined;
  /**
   * Sunucunun hatalı bulduğu alan adları. Model geçidinin `invalid_fields` yanıtında sağlayıcı istemcisi doldurur.
   * Ekran bu alanları formda işaretler. Değerler ya da sunucu iletisi taşınmaz (SZ-8).
   */
  readonly fields: readonly string[] | undefined;
  /**
   * Belirsiz 403 yanıtında doğrudur. Oturum bitmiş olabilir.
   * İstemci oturumu ayrı ve önbelleksiz bir istekle doğrular.
   */
  readonly needsSessionCheck: boolean;

  constructor(init: ApiErrorInit) {
    super(`API hatası: ${init.kind} (${init.status}${init.code ? `, ${init.code}` : ''})`);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code;
    this.retryAfterSeconds = init.retryAfterSeconds;
    this.fields = init.fields;
    this.needsSessionCheck = init.needsSessionCheck ?? false;
  }
}

const SESSION_CODES = new Set([
  'SessionExpired',
  'AuthenticationError',
  'authentication_required',
  'reauthentication_required',
  'session_ended',
]);
const CONFLICT_CODES = new Set([
  'TimestampMismatchError',
  'VersionConflictError',
  'document_changed',
  'version_conflict',
  'operation_conflict',
]);
/** Bu kodlar kesin yetki reddidir. Oturum denetimi gerekmez. */
const DEFINITE_FORBIDDEN_CODES = new Set([
  'data_policy_denied',
  'DeskRoleNotAllowed',
  'not_owner',
  'installation_unavailable',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Gövdeden hata kodunu okur. API v1 `exc_type`, API v2 `errors[].type`, geçit `message.error`. */
function readCode(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined;
  if (typeof body.exc_type === 'string' && body.exc_type.length > 0) return body.exc_type;
  if (Array.isArray(body.errors)) {
    for (const item of body.errors as unknown[]) {
      if (isRecord(item) && typeof item.type === 'string' && item.type.length > 0) return item.type;
    }
  }
  if (isRecord(body.message) && typeof body.message.error === 'string') return body.message.error;
  if (typeof body.error === 'string') return body.error;
  // Mobil ve PWA uçları hata kodunu `code` alanında verir.
  if (typeof body.code === 'string' && body.code.length > 0) return body.code;
  return undefined;
}

function readRetryAfter(headers: Headers | undefined): number | undefined {
  const value = headers?.get('Retry-After');
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

/** HTTP yanıtını ortak hata türüne çevirir. */
export function toApiError(status: number, body: unknown, headers?: Headers): ApiError {
  const code = readCode(body);
  const retryAfterSeconds = readRetryAfter(headers);
  const base = { status, code, retryAfterSeconds };
  const sessionFlag = isRecord(body) && body.session_expired === 1;

  // Sunucu hatası her zaman önce gelir. Gövdedeki oturum işareti 5xx yanıtında yok sayılır.
  // Böylece sunucu arızası kullanıcıyı girişe göndermez.
  if (status >= 500) {
    const kind = status === 502 || status === 503 || status === 504 ? 'unavailable' : 'unknown';
    return new ApiError({ ...base, kind });
  }
  if (code === 'CSRFTokenError') return new ApiError({ ...base, kind: 'csrf' });
  if (status === 401 || (code !== undefined && SESSION_CODES.has(code)) || sessionFlag) {
    return new ApiError({ ...base, kind: 'session_expired' });
  }
  if (code !== undefined && CONFLICT_CODES.has(code))
    return new ApiError({ ...base, kind: 'conflict' });

  switch (status) {
    case 403: {
      const definite = code !== undefined && DEFINITE_FORBIDDEN_CODES.has(code);
      return new ApiError({ ...base, kind: 'forbidden', needsSessionCheck: !definite });
    }
    case 404:
      return new ApiError({ ...base, kind: 'not_found' });
    case 409:
      return new ApiError({ ...base, kind: 'conflict' });
    case 429:
      return new ApiError({ ...base, kind: 'rate_limited' });
    case 400:
    case 413:
    case 417:
    case 422:
      return new ApiError({ ...base, kind: 'invalid_request' });
    default:
      return new ApiError({ ...base, kind: 'unknown' });
  }
}

/** Kullanıcıya gösterilecek metni verir. Metinler `error-messages.json` dosyasındadır. */
export function userMessage(error: ApiError, locale: MessageLocale = 'tr'): string {
  return messages[locale][error.kind];
}

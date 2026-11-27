import type { AgentTransport } from './types';

export interface HttpTransportOptions {
  /** Arka ucun model geçidi adresi. Adresi `api-client` işi verir. */
  url: string;
  fetch?: typeof fetch;
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
}

/**
 * Gerçek bağdaştırıcı. İstek kendi arka ucumuzdan geçer (AX-2).
 * Model anahtarı ve model adı arayüzde yoktur.
 */
export function createHttpTransport({
  url,
  fetch: fetchFn = fetch,
  headers,
}: HttpTransportOptions): AgentTransport {
  return async (request, signal) => {
    const response = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(headers ? await headers() : {}),
        ...(request.idempotencyKey ? { 'Idempotency-Key': request.idempotencyKey } : {}),
      },
      body: JSON.stringify(request),
      signal,
    });
    if (!response.ok || !response.body) {
      throw new Error(`Model geçidi yanıt vermedi: ${response.status}`);
    }
    return response.body;
  };
}

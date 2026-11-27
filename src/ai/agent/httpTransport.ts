import type { AgentTransport } from './types';

export interface HttpTransportOptions {
  /** Backend model gateway address. The `api-client` task provides the address. */
  url: string;
  fetch?: typeof fetch;
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
}

/**
 * Real adapter. The request goes through our own backend (AX-2).
 * The model key and model name are not in the UI.
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

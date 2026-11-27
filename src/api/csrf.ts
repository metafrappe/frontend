/**
 * The CSRF token is kept in memory only (SZ-7, GV-4).
 * It is never written to browser storage, the URL or logs.
 */
export interface CsrfStore {
  get(): string | undefined;
  set(token: string | undefined): void;
  clear(): void;
}

export function createCsrfStore(initial?: string): CsrfStore {
  let token = initial && initial.length > 0 ? initial : undefined;
  return {
    get: () => token,
    set: (next) => {
      token = next && next.length > 0 ? next : undefined;
    },
    clear: () => {
      token = undefined;
    },
  };
}

/**
 * Reads the token the server puts on the `/panel` page.
 * The token is in the `content` attribute of the `meta` element.
 */
export function readCsrfFromDocument(doc: Document, metaName: string): string | undefined {
  const meta = doc.querySelector<HTMLMetaElement>(`meta[name="${CSS.escape(metaName)}"]`);
  const value = meta?.content.trim();
  return value && value.length > 0 ? value : undefined;
}

// CSP nonce. The server makes a new value for each page and writes it to this element:
// `<meta property="csp-nonce" nonce="...">` (frappesetup backend: platform_core/www/panel.html).
// Vite also reads this element and gives the same value to the style links of lazy chunks.
// The UI gives this value to style and script elements added at runtime. Without a value the UI still works.

/** Reads the nonce value on the page. Returns `undefined` if it is missing or empty. */
export function readCspNonce(doc: Document | undefined = globalThis.document): string | undefined {
  const meta = doc?.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]');
  // The browser hides the nonce attribute; the value is read from the `nonce` property.
  const value = meta?.nonce || meta?.getAttribute('nonce') || '';
  return value === '' ? undefined : value;
}

const NONCE_TAGS = new Set(['style', 'script']);
const installed = new WeakMap<Document, string>();

/**
 * Gives the nonce value to every `<style>` and `<script>` element created in the document.
 *
 * Why: antd 5 (`@ant-design/cssinjs` 1.24) adds CSS variable styles without a nonce.
 * The ConfigProvider `csp` setting does not reach these elements. The browser checks the nonce
 * when the element enters the document, so the value is set when the element is created.
 * Without a nonce nothing changes. The call can be repeated; it is not installed twice on one document.
 */
export function installCspNonce(doc: Document | undefined = globalThis.document): string | undefined {
  if (!doc) return undefined;
  const done = installed.get(doc);
  if (done !== undefined) return done;
  const nonce = readCspNonce(doc);
  if (!nonce) return undefined;
  const original = doc.createElement;
  doc.createElement = function createElementWithNonce(
    this: Document,
    tagName: string,
    options?: ElementCreationOptions,
  ): HTMLElement {
    const element = original.call(this, tagName, options);
    if (NONCE_TAGS.has(tagName.toLowerCase()) && !element.nonce) element.nonce = nonce;
    return element;
  } as Document['createElement'];
  installed.set(doc, nonce);
  return nonce;
}

import { doctypeFromSlug } from './view-data';

// Used only by the record route; lazy-loaded with the record chunk.

/**
 * Converts a DocType name to a URL segment. Non-ASCII letters are kept. Example: `Exemple Été` -> `exemple-été`.
 * Returns `undefined` if the segment cannot be converted back to the same name; no link is rendered then.
 */
export function slugFromDoctype(doctype: string): string | undefined {
  // `toLowerCase` is locale-independent. The URL segment does not vary with the user's language (G-132).
  const slug = doctype.trim().toLowerCase().split(/\s+/).filter(Boolean).join('-');
  return slug !== '' && doctypeFromSlug(slug) === doctype ? slug : undefined;
}

/**
 * Splits the assistant's plain reply text into prose and fenced code.
 * Only a small, safe subset is understood. No HTML is ever produced from the text.
 */
export type TextBlock =
  { kind: 'text'; text: string } | { kind: 'code'; text: string; lang: string };

export interface TextPart {
  kind: 'text' | 'link';
  text: string;
}

const FENCE = /```([^\n`]*)\n?([\s\S]*?)(?:\n?```|$)/g;

/** Fenced code becomes a code block. An unclosed fence stays code while the reply streams. */
export function splitBlocks(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  let last = 0;
  for (const match of text.matchAll(FENCE)) {
    const start = match.index ?? 0;
    if (start > last) blocks.push({ kind: 'text', text: text.slice(last, start) });
    blocks.push({ kind: 'code', text: match[2] ?? '', lang: (match[1] ?? '').trim() });
    last = start + match[0].length;
  }
  if (last < text.length) blocks.push({ kind: 'text', text: text.slice(last) });
  return blocks;
}

/** Only http and https addresses become links. Trailing punctuation stays outside the link. */
const URL = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)]/g;

export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ kind: 'text', text: text.slice(last, start) });
    parts.push({ kind: 'link', text: match[0] });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}

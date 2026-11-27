// The name ends in `.node.test.ts`, so Node types apply only to this test.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync(`${process.cwd()}/src/shell/tokens.ts`, 'utf8');

/**
 * Review 2, Minor 3: if a source field is deleted, a hard-coded fallback is not used silently.
 * The reader throws an error.
 */
describe('tokens.ts', () => {
  it('sessiz sabit yedek değer yoktur', () => {
    expect(src.match(/\?\?\s*-?\d/g) ?? []).toEqual([]);
    expect(src.match(/\+\s*\d+\s*,?\s*$/gm) ?? []).toEqual([]);
  });
});

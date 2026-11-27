import { describe, expect, it } from 'vitest';

import { splitBlocks, splitLinks } from './richText';

describe('splitBlocks', () => {
  it('separates fenced code from prose', () => {
    expect(splitBlocks('Önce bu.\n```bash\nnpm ci\n```\nSonra bu.')).toEqual([
      { kind: 'text', text: 'Önce bu.\n' },
      { kind: 'code', text: 'npm ci', lang: 'bash' },
      { kind: 'text', text: '\nSonra bu.' },
    ]);
  });

  it('keeps an unclosed fence as code while the reply streams', () => {
    expect(splitBlocks('Bak:\n```\nlet a = 1;')).toEqual([
      { kind: 'text', text: 'Bak:\n' },
      { kind: 'code', text: 'let a = 1;', lang: '' },
    ]);
  });

  it('returns plain text unchanged', () => {
    expect(splitBlocks('Yalnız metin.')).toEqual([{ kind: 'text', text: 'Yalnız metin.' }]);
  });
});

describe('splitLinks', () => {
  it('turns http and https addresses into links and keeps the text exact', () => {
    const url = 'https://beispiel.example/a/Betriebsumgebungstemperatur?x=1';
    expect(splitLinks(`Bakın: ${url}. Bitti.`)).toEqual([
      { kind: 'text', text: 'Bakın: ' },
      { kind: 'link', text: url },
      { kind: 'text', text: '. Bitti.' },
    ]);
  });

  it('does not link other schemes', () => {
    expect(splitLinks('javascript:alert(1) ve ftp://x.example')).toEqual([
      { kind: 'text', text: 'javascript:alert(1) ve ftp://x.example' },
    ]);
  });
});

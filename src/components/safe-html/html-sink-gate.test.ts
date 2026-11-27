// @vitest-environment node
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

/**
 * GV-2 kapısı. HTML basan kod yalnız `src/components/safe-html/` klasöründe durur.
 * Kural `eslint.config.js` içindedir. `npm run lint` bu kuralı CI'da koşar.
 */
const eslint = new ESLint();

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result!.messages.map((message) => message.ruleId ?? 'parse-error');
}

const DANGEROUS = 'export const X = () => <div dangerouslySetInnerHTML={{ __html: "x" }} />;\n';
const INNER = 'export function f(el: HTMLElement): void {\n  el.innerHTML = "x";\n}\n';

describe('HTML basma kapısı (GV-2)', () => {
  it('dangerouslySetInnerHTML başka dosyada geçerse kırmızı olur', async () => {
    expect(await ruleIds(DANGEROUS, 'src/modules/ornek/Page.tsx')).toContain(
      'no-restricted-syntax',
    );
  });

  it('innerHTML ataması başka dosyada geçerse kırmızı olur', async () => {
    expect(await ruleIds(INNER, 'src/modules/ornek/dom.ts')).toContain('no-restricted-syntax');
  });

  it('SafeHtml klasöründe izin verir', async () => {
    expect(await ruleIds(DANGEROUS, 'src/components/safe-html/SafeHtml.tsx')).toEqual([]);
  });
});

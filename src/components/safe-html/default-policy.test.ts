import { describe, expect, it, vi } from 'vitest';

import { allowTextOnlyHtml, installDefaultTrustedTypesPolicy } from './default-policy.ts';

/**
 * Trusted Types varsayılan ilkesi (GV-2, AJA-2283).
 * İlke yalnız `<` içermeyen metne izin verir. Böyle bir metin HTML öğesi üretemez.
 * antd stil kütüphanesi `<style>` öğesine CSS metnini `innerHTML` ile yazar. Bu metin geçer.
 */
describe('allowTextOnlyHtml', () => {
  it('öğe üretemeyen düz metni aynen döndürür', () => {
    expect(allowTextOnlyHtml('.ant-btn{color:red}')).toBe('.ant-btn{color:red}');
    expect(allowTextOnlyHtml('.a > .b{content:"&amp;"}')).toBe('.a > .b{content:"&amp;"}');
    expect(allowTextOnlyHtml('')).toBe('');
  });

  it('öğe üretebilen metni geri çevirir; tarayıcı ihlali raporlar', () => {
    expect(allowTextOnlyHtml('<img src=x onerror=alert(1)>')).toBeNull();
    expect(allowTextOnlyHtml('metin <b>kalın</b>')).toBeNull();
    expect(allowTextOnlyHtml('</style><script>alert(1)</script>')).toBeNull();
  });
});

describe('installDefaultTrustedTypesPolicy', () => {
  it('tarayıcı desteklemiyorsa hiçbir şey yapmaz', () => {
    expect(installDefaultTrustedTypesPolicy({})).toBe(false);
  });

  it('`default` adlı ilkeyi yalnız createHTML kuralıyla kurar', () => {
    const createPolicy = vi.fn();
    expect(installDefaultTrustedTypesPolicy({ trustedTypes: { createPolicy } })).toBe(true);
    expect(createPolicy).toHaveBeenCalledTimes(1);
    const [name, rules] = createPolicy.mock.calls[0] as [string, Record<string, unknown>];
    expect(name).toBe('default');
    expect(Object.keys(rules)).toEqual(['createHTML']);
    expect(rules['createHTML']).toBe(allowTextOnlyHtml);
  });

  it('betik adresi listesi verilirse yalnız listedeki adrese izin verir', () => {
    const createPolicy = vi.fn();
    const target = { trustedTypes: { createPolicy } };
    expect(installDefaultTrustedTypesPolicy(target, { scriptUrls: ['/mockServiceWorker.js'] })).toBe(
      true,
    );
    const rules = createPolicy.mock.calls[0]?.[1] as {
      createScriptURL: (input: string) => string | null;
    };
    expect(Object.keys(rules)).toEqual(['createHTML', 'createScriptURL']);
    expect(rules.createScriptURL('/mockServiceWorker.js')).toBe('/mockServiceWorker.js');
    expect(rules.createScriptURL('https://kotu.example/sw.js')).toBeNull();
    expect(rules.createScriptURL('/mockServiceWorker.js?x=1')).toBeNull();
  });

  it('varsayılan ilke zaten varsa ikinci kez kurmaz', () => {
    const createPolicy = vi.fn();
    const target = { trustedTypes: { createPolicy, defaultPolicy: {} } };
    expect(installDefaultTrustedTypesPolicy(target)).toBe(false);
    expect(createPolicy).not.toHaveBeenCalled();
  });
});

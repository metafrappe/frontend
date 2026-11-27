/**
 * Trusted Types varsayılan ilkesi (GV-2, AJA-2283).
 *
 * Tarayıcı, ilkeden geçmemiş düz metni bir HTML yuvasına yazınca `default` ilkesine sorar.
 * Bu ilke yalnız `<` içermeyen metne izin verir. Böyle bir metin HTML öğesi üretemez.
 * Neden: antd stil kütüphanesi (`rc-util` `updateCSS`) `<style>` öğesine CSS metnini
 * `innerHTML` ile yazar. Bu yazım güvenlidir ama rapor kipinde ihlal sayılıyordu.
 * Öğe üretebilen metin geri çevrilir. Tarayıcı bu yazımı raporlar, zorunlu kipte engeller.
 * Dışarıdan gelen HTML bu ilkeden geçmez. O HTML `SafeHtml` bileşeninin ilkesinden geçer.
 */

/** Öğe üretemeyen düz metni aynen döndürür. Öğe üretebilen metinde `null` döner. */
export function allowTextOnlyHtml(input: string): string | null {
  return input.includes('<') ? null : input;
}

interface DefaultPolicyRules {
  createHTML: (input: string) => string | null;
  createScriptURL?: (input: string) => string | null;
}

export interface TrustedTypesTarget {
  trustedTypes?: {
    createPolicy: (name: string, rules: DefaultPolicyRules) => unknown;
    defaultPolicy?: unknown;
  };
}

export interface DefaultPolicyOptions {
  /**
   * İzin verilen betik adresleri. Adres birebir eşleşmelidir.
   * Örneğin sahte sunucu açıkken `/mockServiceWorker.js` verilir. Üretimde liste boştur.
   */
  scriptUrls?: readonly string[];
}

/**
 * `default` ilkesini kurar. Kurulursa `true` döner.
 * Tarayıcı Trusted Types desteklemiyorsa ya da ilke zaten varsa hiçbir şey yapmaz.
 * Uygulama ilk bileşeni çizmeden önce bir kez çağırır (`src/main.tsx`).
 */
export function installDefaultTrustedTypesPolicy(
  target: TrustedTypesTarget = globalThis as TrustedTypesTarget,
  options: DefaultPolicyOptions = {},
): boolean {
  const factory = target.trustedTypes;
  if (!factory || factory.defaultPolicy) return false;
  const rules: DefaultPolicyRules = { createHTML: allowTextOnlyHtml };
  const scriptUrls = options.scriptUrls ?? [];
  if (scriptUrls.length > 0) {
    const allowed = new Set(scriptUrls);
    rules.createScriptURL = (input) => (allowed.has(input) ? input : null);
  }
  factory.createPolicy('default', rules);
  return true;
}

/**
 * Köşe basamakları (Karar 45, `metafrappe/backend` deposunda `docs/standards/radius.md`).
 *
 * Köşe değeri yalnız basamak listesinden gelir. Kapsül öğeler listenin dışındadır.
 * Kapsül öğe kısa kenarının yarısını alır. Örnek: yuvarlak düğme, avatar ve pill.
 */
import source from '../../design/source/control-size-config.json';

export const radiusLadder: readonly number[] = source.radius.ladder;

export function isLadderRadius(px: number): boolean {
  return radiusLadder.includes(px);
}

/** Üst düzey boşluklardan böler. Parantez içindeki boşluk bölünmez. */
function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if ((ch === ' ' || ch === '/') && depth === 0) {
      if (current) parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) parts.push(current);
  return parts;
}

/** Kapsül biçimi: `50%` ya da yüksekliğin yarısı, örneğin `calc(var(--tag-h) / 2)`. */
function isCapsule(part: string): boolean {
  return part === '50%' || /^calc\(.+\/\s*2\)$/.test(part);
}

/**
 * Bir CSS `border-radius` değerindeki izinsiz parçaları döndürür.
 * Boş dizi değerin yönergeye uyduğunu gösterir.
 * Köşe tokenı (`var(--…radius…)`) kabul edilir. Tokenın değerini ayrı test denetler.
 */
export function radiusViolations(value: string): string[] {
  const clean = value.replace(/!important/g, '').trim();
  return splitTopLevel(clean).filter((part) => {
    if (part === '0' || isCapsule(part)) return false;
    if (/^var\(--[\w-]*radius[\w-]*\)$/.test(part)) return false;
    const px = /^(\d+(?:\.\d+)?)px$/.exec(part);
    return !(px && isLadderRadius(Number(px[1])));
  });
}

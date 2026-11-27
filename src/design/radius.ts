/**
 * Köşe basamakları (Karar 45, `metafrappe/backend` deposunda `docs/standards/radius.md`).
 *
 * Köşe değeri yalnız basamak listesinden gelir. Kapsül öğeler listenin dışındadır.
 * Kapsül öğe kısa kenarının yarısını alır. Örnek: yuvarlak düğme, avatar ve pill.
 */
import type { ThemeConfig } from 'antd';

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

const [none, micro, control, ring, menu, surface, surfaceLg, panel, shellSm, shell] =
  radiusLadder as [number, number, number, number, number, number, number, number, number, number];

/** Basamakların adları (radius.md 2. bölüm). Değerler kaynak listeden gelir. */
export const radiusStep = {
  none,
  micro,
  control,
  ring,
  menu,
  surface,
  surfaceLg,
  panel,
  shellSm,
  shell,
} as const;

/**
 * Global antd köşe tokenları (radius.md 7.3).
 * `borderRadiusLG` açılır listeyi çizer: 5 + 4 px iç boşluk = 9.
 */
export const radiusGlobalTokens = {
  borderRadiusXS: micro,
  borderRadiusSM: control,
  borderRadius: control,
  borderRadiusLG: menu,
  borderRadiusOuter: control,
} as const;

/** Kontrol köşesi her boyutta 5 px kalır (Kural 1). */
const anchorAllSizes = {
  borderRadius: control,
  borderRadiusSM: control,
  borderRadiusLG: control,
} as const;

/** Bileşen düzeyinde köşe tokenları (radius.md 7.3). Kart köşesi kaynaktaki kart değeridir. */
export function radiusComponentTokens(cardRadius: number) {
  return {
    Button: anchorAllSizes,
    Input: anchorAllSizes,
    InputNumber: anchorAllSizes,
    Select: anchorAllSizes,
    DatePicker: anchorAllSizes,
    Cascader: anchorAllSizes,
    Mentions: anchorAllSizes,
    Segmented: { borderRadius: ring, borderRadiusSM: control, borderRadiusLG: ring },
    Popover: { borderRadiusLG: surfaceLg },
    Card: { borderRadiusLG: cardRadius },
    Modal: { borderRadiusLG: panel },
    Notification: { borderRadiusLG: surfaceLg },
    Message: { borderRadiusLG: surfaceLg },
  } as const;
}

type Components = NonNullable<ThemeConfig['components']>;

/** Bileşen tokenlarına köşe tokenlarını ekler. Öteki tokenlar korunur. */
export function withRadius(components: Components, cardRadius: number): Components {
  const out: Record<string, object> = { ...components };
  for (const [name, tokens] of Object.entries(radiusComponentTokens(cardRadius))) {
    out[name] = { ...(out[name] ?? {}), ...tokens };
  }
  return out as Components;
}

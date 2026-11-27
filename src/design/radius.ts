export const R = {
  anchor: 5,
  bind: 16,
  max: 29,
  floor: 2,
  ladder: [0, 3, 5, 7, 9, 13, 17, 21, 25, 29] as const,
};

/** Kap radius'u: köşeye bitişik çocuklardan türetilir. */
export function outerRadius(
  corners: { r: number; dx: number; dy: number }[],
  box?: { w: number; h: number },
): number {
  const raw = Math.max(...corners.map((c) => c.r + Math.min(Math.min(c.dx, c.dy), R.bind)));
  const capsule = box ? Math.min(box.w, box.h) / 2 : Infinity;
  if (raw > R.max) {
    console.warn(`[radius] ${raw} > R_max: katmanı görünmez/kenara dayalı yap (Kural 7).`);
  }
  return Math.min(raw, R.max, capsule);
}

/** Çocuk radius'u: ebeveynden içe türetilir. */
export function innerRadius(parentR: number, inset: number, sharp = false): number {
  if (inset === 0) return parentR; // Kural 5
  const r = parentR - inset;
  return r > 0 ? Math.max(r, R.floor) : sharp ? 0 : R.floor;
}

/** Küçük leaf (h < 24). */
export const leafRadius = (h: number) =>
  h >= 24 ? R.anchor : Math.max(R.floor, Math.round((h * R.anchor) / 32));

/** Denetim: basamak dışındaki değer = hata. */
export const isValidRadius = (r: number) => (R.ladder as readonly number[]).includes(r);

/** Converts a `#rrggbb` colour to `rgba(r,g,b,a)`. Used for the opacity decisions in the source. */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Geçersiz renk: ${hex}`);
  }
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Geçersiz renk: ${hex}`);
  }
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

/** WCAG 2.x relative luminance. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio (between 1 and 21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Darkens the colour until it gives at least `minRatio` contrast on the given background.
 * The hue is kept; only the brightness drops. If the source colour is already enough, it is returned as is.
 * Use: text links in the light theme (WCAG 2.2 AA, 4.5:1).
 */
export function darkenToContrast(hex: string, background: string, minRatio = 4.5): string {
  let rgb = parseHex(hex);
  let current = toHex(rgb);
  for (let step = 0; step < 100 && contrastRatio(current, background) < minRatio; step += 1) {
    rgb = [rgb[0] * 0.97, rgb[1] * 0.97, rgb[2] * 0.97];
    current = toHex(rgb);
  }
  return current;
}

/**
 * Lightens the colour (moves it towards white) until it gives at least `minRatio` contrast on the
 * given background. Each step raises a channel by 3% of its distance to white; the hue is kept.
 * If already enough, it is returned as is. Use: danger text colour in the dark theme (WCAG 2.2 AA, 4.5:1).
 */
export function lightenToContrast(hex: string, background: string, minRatio = 4.5): string {
  let rgb = parseHex(hex);
  let current = toHex(rgb);
  for (let step = 0; step < 300 && contrastRatio(current, background) < minRatio; step += 1) {
    rgb = [rgb[0] + (255 - rgb[0]) * 0.03, rgb[1] + (255 - rgb[1]) * 0.03, rgb[2] + (255 - rgb[2]) * 0.03];
    current = toHex(rgb);
  }
  return current;
}

/** Lays `fg` over `background` at `alpha` opacity; returns a solid colour. */
export function blendOver(fg: string, alpha: number, background: string): string {
  const f = parseHex(fg);
  const b = parseHex(background);
  return toHex([
    alpha * f[0] + (1 - alpha) * b[0],
    alpha * f[1] + (1 - alpha) * b[1],
    alpha * f[2] + (1 - alpha) * b[2],
  ]);
}

/**
 * Finds the lowest opacity at which semi-transparent text gives at least `minRatio` contrast on a
 * semi-transparent background. Starts at `startAlpha`, rises in 0.01 steps, up to 1.
 * `surfaces`: possible page colours under the background; the limit must hold on all of them.
 */
export function minAlphaForContrast(options: {
  text: string;
  startAlpha: number;
  background: string;
  backgroundAlpha: number;
  surfaces: readonly string[];
  minRatio?: number;
}): number {
  const minRatio = options.minRatio ?? 4.5;
  const ok = (alpha: number) =>
    options.surfaces.every((surface) => {
      const bg = blendOver(options.background, options.backgroundAlpha, surface);
      return contrastRatio(blendOver(options.text, alpha, bg), bg) >= minRatio;
    });
  let alpha = Math.round(options.startAlpha * 100);
  while (alpha < 100 && !ok(alpha / 100)) alpha += 1;
  return alpha / 100;
}

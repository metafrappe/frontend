/**
 * Design values specific to AI Studio, GenUI and the owl.
 *
 * Shared values are not in this file. They come from the CSS variables of the
 * `foundation` task. The names are in `src/design/css-variables.ts`.
 * Example: `--font-ui`, `--radius`, `--card-radius`, `--color-primary`,
 * `--motion-easing-standard` and `--focus-indicator-color`.
 *
 * This file holds only values specific to the AI area. Most values are read from
 * `design/source/control-size-config.json`. Values written inside sentences in the
 * source are parsed. If parsing fails, the module throws while loading. This way a
 * wrong value is not used silently when the source changes.
 */
import config from '@design-source/control-size-config.json';

function fail(what: string): never {
  throw new Error(`AI tokenı kaynak dosyada bulunamadı: ${what}`);
}

/** Converts the first seconds value, such as "2.4 s", into milliseconds. */
function secondsIn(text: string, what: string): number {
  const match = /(\d+(?:\.\d+)?)\s*s\b/.exec(text);
  if (!match?.[1]) fail(what);
  return Math.round(Number(match[1]) * 1000);
}

function itemStartingWith(prefix: string): string {
  const item = config.aiMotion.items.find((entry) => entry.startsWith(prefix));
  if (!item) fail(`aiMotion "${prefix}"`);
  return item;
}

const liftMatch = /(\d+)\s*px\s*yükselir/.exec(itemStartingWith('AI önerileri'));
if (!liftMatch?.[1]) fail('aiMotion öneri kartı yükselmesi');

export const aiMotion = {
  durations: {
    spark: secondsIn(itemStartingWith('Sparkle'), 'Sparkle'),
    brain: secondsIn(itemStartingWith('Brain'), 'Brain'),
    owl: secondsIn(itemStartingWith('Baykuş'), 'Baykuş'),
    agent: secondsIn(itemStartingWith('Çalışan ajan'), 'Çalışan ajan'),
    scan: secondsIn(itemStartingWith('AI kartları'), 'AI kartları'),
    badge: secondsIn(itemStartingWith('AI rozeti'), 'AI rozeti'),
    ring: secondsIn(itemStartingWith('AI kredisi'), 'AI kredisi'),
  },
  /** How far a suggestion card rises on hover, px. */
  hoverLift: Number(liftMatch[1]),
} as const;

const orbitMatch = /\((\d+(?:\.\d+)?)\s*s\s*\/\s*(\d+(?:\.\d+)?)\s*s\)/.exec(config.mascot.motion);
if (!orbitMatch?.[1] || !orbitMatch[2]) fail('mascot yörünge süreleri');
const blinkMatch = /(\d+)\s*sn/.exec(config.mascot.motion);
if (!blinkMatch?.[1]) fail('mascot göz kırpma süresi');

/**
 * The owl's extra colours come from the `OWL_COLORS` object in
 * `control-size-engine.html`. The JSON holds only the main colours.
 */
const owlEngineColors = {
  tuft: '#007f99',
  feather: '#8fdcec',
  face: '#ffffff',
  eye: '#0b1220',
  beakShade: '#d97706',
  outline: '#0b1220',
} as const;

export type MascotSize = 22 | 28 | 48;

export const mascotTokens = {
  sizes: config.mascot.sizes as MascotSize[],
  orbitDurations: [
    Math.round(Number(orbitMatch[1]) * 1000),
    Math.round(Number(orbitMatch[2]) * 1000),
  ] as const,
  blinkPeriod: Number(blinkMatch[1]) * 1000,
  colors: { ...config.mascot.colors, ...owlEngineColors },
};

function pxIn(text: string, what: string): number {
  const match = /(\d+)\s*px/.exec(text);
  if (!match?.[1]) fail(what);
  return Number(match[1]);
}

export const aiStudioLayout = {
  left: pxIn(config.aiStudio.layout.left, 'aiStudio sol genişlik'),
  right: pxIn(config.aiStudio.layout.right, 'aiStudio sağ genişlik'),
} as const;

export const genuiRules = config.aiStudio.genui.rules;

/**
 * Sizes of the AI area. The JSON does not hold these sizes. The values are the AI Studio
 * and GenUI rules in the working example `control-size-engine.html`.
 * Column widths are in `ch`. The others are in px.
 */
export const aiSizes = {
  /** Maximum width of `.st-welcome`. */
  welcomeMaxWidth: 760,
  /** Height of `.gu-bars`. */
  chartHeight: 150,
  /** Maximum width of `.gu-bar i`. */
  chartBarMax: 34,
  /** Sizes of `.st-caret`. */
  caretWidth: 7,
  caretHeight: 15,
  /** Blink duration of the streaming caret (`stCaret 1s`), ms. */
  caretBlink: 1000,
  /** Height of `.gu-skel i`. */
  skeletonLine: 12,
  /** Minimum width of the indicator and the form field. */
  kpiMin: 140,
  fieldMin: 200,
  /** Minimum and maximum width of the table description column, ch. */
  textCellMin: 16,
  textCellMax: 40,
} as const;

/** Exposes the AI values as CSS variables. Components read the values from here. */
export function aiCssVars(): Record<`--${string}`, string> {
  const d = aiMotion.durations;
  const z = aiSizes;
  return {
    '--ai-dur-spark': `${d.spark}ms`,
    '--ai-dur-brain': `${d.brain}ms`,
    '--ai-dur-owl': `${d.owl}ms`,
    '--ai-dur-agent': `${d.agent}ms`,
    '--ai-dur-scan': `${d.scan}ms`,
    '--ai-dur-badge': `${d.badge}ms`,
    '--ai-dur-ring': `${d.ring}ms`,
    '--ai-dur-caret': `${z.caretBlink}ms`,
    '--ai-dur-orbit-a': `${mascotTokens.orbitDurations[0]}ms`,
    '--ai-dur-orbit-b': `${mascotTokens.orbitDurations[1]}ms`,
    '--ai-dur-blink': `${mascotTokens.blinkPeriod}ms`,
    '--ai-hover-lift': `-${aiMotion.hoverLift}px`,
    '--ai-left-width': `${aiStudioLayout.left}px`,
    '--ai-right-width': `${aiStudioLayout.right}px`,
    '--ai-welcome-max': `${z.welcomeMaxWidth}px`,
    '--ai-chart-h': `${z.chartHeight}px`,
    '--ai-chart-bar-max': `${z.chartBarMax}px`,
    '--ai-caret-w': `${z.caretWidth}px`,
    '--ai-caret-h': `${z.caretHeight}px`,
    '--ai-skeleton-line': `${z.skeletonLine}px`,
    '--ai-kpi-min': `${z.kpiMin}px`,
    '--ai-field-min': `${z.fieldMin}px`,
    '--ai-cell-text-min': `${z.textCellMin}ch`,
    '--ai-cell-text-max': `${z.textCellMax}ch`,
  };
}

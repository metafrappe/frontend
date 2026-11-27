/**
 * Motion tokens. All durations and curves live only in this file.
 * Values are read from the source file. Base durations missing from the source are defined here, in one place.
 * Motion stops while `prefers-reduced-motion: reduce` is on (see css-variables.ts).
 */
import { designSource } from './source';

const s = designSource;

/** Reads the first millisecond value from text such as "520 ms cubic-bezier(.65,0,.35,1)". */
export function parseMs(text: string): number {
  const match = /(\d+(?:\.\d+)?)\s*ms/.exec(text);
  if (!match || match[1] === undefined) {
    throw new Error(`Süre okunamadı: ${text}`);
  }
  return Number(match[1]);
}

/** Reads the `cubic-bezier(...)` expression from text. */
export function parseEasing(text: string): string {
  const match = /cubic-bezier\([^)]*\)/.exec(text);
  if (!match) {
    throw new Error(`Eğri okunamadı: ${text}`);
  }
  return match[0];
}

export const easing = {
  /** General S curve. The source focus dim layer and AI motion use the same curve. */
  standard: s.focusDim.easing,
  /** Dropdown opening: no separate curve; it is the default curve (AJA-997). */
  dropdown: s.dropdown.animation.easing,
  /** Owl badge: the documented exception in the source. */
  owlPop: parseEasing(s.owlAssist.badge.animation),
  /** Gliding hover background: the `.glide` rule on the source sample page (`.2s cubic-bezier(.2,0,0,1)`). */
  glide: 'cubic-bezier(.2, 0, 0, 1)',
  /** Linear: the spinning loading icon and switch-like transitions such as `visibility`. */
  linear: 'linear',
} as const;

export const duration = {
  /** antd base durations. Not in the source; this is their only place. */
  fast: 100,
  mid: 200,
  slow: 300,
  /** Dropdown: shorter than the default mid duration (AJA-997). */
  dropdown: s.dropdown.animation.duration,
  focusDim: s.focusDim.duration,
  flyout: parseMs(s.sidebar.flyout.animation),
  flyoutOpenDelay: parseMs(s.sidebar.flyout.trigger),
  flyoutCloseDelay: s.sidebar.flyout.closeDelay,
  rail: parseMs(s.sidebar.railToggle.motion),
  owlPop: parseMs(s.owlAssist.badge.animation),
  owlDwell: s.owlAssist.dwell,
  /** Shell motion. From the source sample page: glide background .2s, fade .15s, skeleton 1.2s. */
  glide: 200,
  glideFade: 150,
  skeleton: 1200,
  /** Spinning loading icon (source sample page). */
  spin: 900,
} as const;

/** Instant transition (0 ms). For switch-like properties such as `visibility`. Not in the `duration` list; durations are positive. */
export const instantMs = 0;

export const dropdownAnimation = {
  name: s.dropdown.animation.name,
  duration: duration.dropdown,
  easing: easing.dropdown,
  keyframes: s.dropdown.animation.keyframes,
} as const;

export type DurationToken = keyof typeof duration;
export type EasingToken = keyof typeof easing;

export function seconds(ms: number): string {
  return `${ms / 1000}s`;
}

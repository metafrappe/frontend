/**
 * The shell's design values.
 *
 * All values come from `design/source/control-size-config.json`.
 * Some decisions are written in the source only as text, e.g. the Turkish phrase for "60 ms opening".
 * Those values are parsed from the text below. If the source changes, the value changes too.
 *
 * TEMPORARY: once the `foundation` work adds a token export under `src/design/`,
 * this file will read from there. See `src/shell/README.md`.
 */
import config from '@design-source/control-size-config.json';

function num(text: string, pattern: RegExp, name: string): number {
  const m = pattern.exec(text);
  if (!m?.[1]) {
    throw new Error(`Kaynak dosyada değer bulunamadı: ${name}`);
  }
  return Number(m[1]);
}

function str(text: string, pattern: RegExp, name: string): string {
  const m = pattern.exec(text);
  if (!m?.[1]) {
    throw new Error(`Kaynak dosyada değer bulunamadı: ${name}`);
  }
  return m[1];
}

/** The source field is required. If it is missing, this throws instead of using a hard-coded fallback. */
export function required<T>(value: T | undefined | null, name: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Kaynak dosyada değer bulunamadı: ${name}`);
  }
  return value;
}

const described = required(
  config.dropdown.styles.find((x) => x.key === 'described'),
  'dropdown.styles described',
);

function aiItem(pattern: RegExp): string | undefined {
  for (const it of config.aiMotion.items) {
    const m = pattern.exec(it);
    if (m?.[1]) return m[1];
  }
  return undefined;
}

function secondsToMs(v: string | undefined, name: string): number {
  if (!v) throw new Error(`Kaynak dosyada değer bulunamadı: ${name}`);
  return Math.round(Number(v) * 1000);
}

const sb = config.sidebar;
const fly = sb.flyout;

const railMotion = sb.railToggle.motion;

export interface ViewTypeToken {
  value: ViewType;
  label: string;
}

export type ViewType = 'table' | 'kanban' | 'pivot' | 'report' | 'gantt' | 'timesheet' | 'form';
export type DataStateKind =
  'normal' | 'live' | 'loading' | 'empty' | 'error' | 'selection' | 'dirty';

export const shellTokens = {
  sidebar: {
    widthExpanded: sb.widthExpanded,
    widthCollapsed: sb.widthCollapsed,
    item: { ...sb.item, fontSize: Math.max(14, sb.item.fontSize) },
    /** S2: active item indicator width. */
    indicator: num(sb.active.indicator, /(\d+)\s*px/, 'sidebar.active.indicator'),
    /** S2: active background opacity, light and dark theme. */
    activeTint: {
      light: num(sb.active.background, /%(\d+)/, 'sidebar.active.background') / 100,
      dark: num(sb.active.background, /koyu tema %(\d+)/, 'sidebar.active.background') / 100,
    },
  },
  flyout: {
    width: fly.width,
    agentWidth: fly.agentWidth,
    gap: fly.gap,
    clampPadding: fly.clampPadding,
    closeDelay: fly.closeDelay,
    openDelay: num(fly.trigger, /hover \((\d+)\s*ms\)/, 'sidebar.flyout.trigger'),
    duration: num(fly.animation, /(\d+)\s*ms/, 'sidebar.flyout.animation'),
    shift: num(fly.animation, /(\d+)\s*px/, 'sidebar.flyout.animation'),
  },
  rail: {
    duration: num(railMotion, /(\d+)\s*ms/, 'sidebar.railToggle.motion'),
    easing: str(railMotion, /(cubic-bezier\([^)]*\))/, 'sidebar.railToggle.motion'),
  },
  footer: {
    dark: str(sb.footer, /koyu:\s*(#[0-9A-Fa-f]{6})/, 'sidebar.footer'),
    light: str(sb.footer, /açık:\s*(#[0-9A-Fa-f]{6})/, 'sidebar.footer'),
  },
  focusDim: {
    duration: config.focusDim.duration,
    easing: config.focusDim.easing,
    blur: config.focusDim.blur,
    light: { color: config.focusDim.color, opacity: config.focusDim.opacity },
    dark: { color: config.focusDim.dark.color, opacity: config.focusDim.dark.opacity },
  },
  header: {
    titleSize: config.header.settings.titleSize,
    titleWeight: config.header.settings.titleWeight,
    titleLineHeight: config.header.settings.titleLineHeight,
    buttonHeight: config.header.settings.buttonHeight,
    viewTypes: config.header.viewTypes.map((v) => ({
      value: v.value as ViewType,
      label: v.label,
    })),
    dataStates: config.header.dataStates.map((v) => ({
      value: v.value as DataStateKind,
      label: v.label,
    })),
  },
  radius: config.radius.default,
  /** Line box = text + 8 (source: typography.lineHeightRule). */
  lineHeightAdd: num(config.typography.lineHeightRule, /\+\s*(\d+)/, 'typography.lineHeightRule'),
  fontMd: config.sizes.md.button.fontSize,
  fontLg: config.sizes.lg.button.fontSize,
  /** Badge height: smallest Pill/Tag size (source: choice.tagHeights). */
  tagHeight: required(config.choice.tagHeights[0], 'choice.tagHeights[0]'),
  /** Icon box of the described dropdown (source: dropdown.styles described). */
  ddBox: required(described.contentHeight, 'dropdown.styles described.contentHeight'),
  ddRow: required(described.itemHeight, 'dropdown.styles described.itemHeight'),
  motion: {
    /** Status pulse (source: aiMotion, running agent 1.4 s). */
    pulse: secondsToMs(aiItem(/ajan[^:]*:\s*([\d.]+)\s*s/i), 'aiMotion ajan'),
    /** Credit ring fill (source: aiMotion, 1.2 s). */
    ring: secondsToMs(aiItem(/halkası:[^\d]*([\d.]+)\s*s/i), 'aiMotion halka'),
  },
  /** Approved workspace model, section 6: minimum 14 px, body 16 px. */
  typography: { ...config.typography, min: 14, default: 16 },
  primary: config.primary.color,
  darkPalette: config.darkPalette,
} as const;

/** CSS variables used at the shell root. Values come only from tokens. */
export function shellCssVars(): Record<`--${string}`, string> {
  const t = shellTokens;
  return {
    '--shell-sb-w': `${t.sidebar.widthExpanded}px`,
    '--shell-sb-w-rail': `${t.sidebar.widthCollapsed}px`,
    '--shell-item-h': `${t.sidebar.item.height}px`,
    '--shell-item-fs': `${t.sidebar.item.fontSize}px`,
    '--shell-item-fw': String(t.sidebar.item.fontWeight),
    '--shell-item-icon': `${t.sidebar.item.iconSize}px`,
    '--shell-item-gap': `${t.sidebar.item.gap}px`,
    '--shell-item-px': `${t.sidebar.item.paddingInline}px`,
    '--shell-radius': `${t.radius}px`,
    '--shell-indicator': `${t.sidebar.indicator}px`,
    '--shell-tint-light': String(t.sidebar.activeTint.light),
    '--shell-tint-dark': String(t.sidebar.activeTint.dark),
    '--shell-fly-w': `${t.flyout.width}px`,
    '--shell-fly-w-agent': `${t.flyout.agentWidth}px`,
    '--shell-fly-gap': `${t.flyout.gap}px`,
    '--shell-fly-dur': `${t.flyout.duration}ms`,
    '--shell-fly-shift': `${t.flyout.shift}px`,
    '--shell-rail-dur': `${t.rail.duration}ms`,
    '--shell-ease': t.rail.easing,
    '--shell-foot-light': t.footer.light,
    '--shell-foot-dark': t.footer.dark,
    '--shell-dim-dur': `${t.focusDim.duration}ms`,
    '--shell-dim-ease': t.focusDim.easing,
    '--shell-dim-blur': `${t.focusDim.blur}px`,
    '--shell-dim-light': hexToRgba(t.focusDim.light.color, t.focusDim.light.opacity),
    '--shell-dim-dark': hexToRgba(t.focusDim.dark.color, t.focusDim.dark.opacity),
    '--shell-hd-title': `${t.header.titleSize}px`,
    '--shell-hd-title-lh': `${t.header.titleLineHeight}px`,
    '--shell-hd-title-fw': String(t.header.titleWeight),
    '--shell-hd-btn-h': `${t.header.buttonHeight}px`,
    '--shell-fs-min': `${t.typography.min}px`,
    '--shell-fs': `${t.typography.default}px`,
    '--shell-fs-md': `${t.fontMd}px`,
    '--shell-fs-lg': `${t.fontLg}px`,
    '--shell-lh-add': `${t.lineHeightAdd}px`,
    '--shell-tag-h': `${t.tagHeight}px`,
    '--shell-dd-box': `${t.ddBox}px`,
    '--shell-dd-row': `${t.ddRow}px`,
    '--shell-pulse-dur': `${t.motion.pulse}ms`,
    '--shell-ring-dur': `${t.motion.ring}ms`,
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

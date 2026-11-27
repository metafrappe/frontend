/**
 * Focus dim layer (source: focusDim). Everything outside the open panel sits under the dim layer.
 * Several trigger keys can open it; the layer lifts when the last key closes.
 * Colour, opacity, blur, duration and curve come from CSS variables (src/design).
 */
export const FOCUS_DIM_CLASS = 'focus-dim-on';
export const FOCUS_DIM_OVERLAY_CLASS = 'focus-dim-overlay';
export const FOCUS_DIM_SOURCE_CLASS = 'focus-dim-source';

type Listener = (active: boolean, keys: readonly string[]) => void;

const keys = new Set<string>();
const listeners = new Set<Listener>();

function emit(): void {
  const active = keys.size > 0;
  if (typeof document !== 'undefined') {
    document.body.classList.toggle(FOCUS_DIM_CLASS, active);
  }
  for (const l of listeners) l(active, [...keys]);
}

/** Turns one trigger on or off. Example keys: "sidebar-flyout", "dropdown:menu-1". */
export function setFocusDim(key: string, on: boolean): void {
  const had = keys.has(key);
  if (on === had) return;
  if (on) keys.add(key);
  else keys.delete(key);
  emit();
}

export function isFocusDimActive(): boolean {
  return keys.size > 0;
}

export function activeFocusDimKeys(): readonly string[] {
  return [...keys];
}

export function subscribeFocusDim(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** For tests and a full reset. */
export function resetFocusDim(): void {
  keys.clear();
  emit();
}

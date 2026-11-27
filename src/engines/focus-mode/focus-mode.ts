/**
 * Visible focus mode. Rule: the mode starts off. Only Tab and Shift+Tab turn it on.
 * Arrow keys, Escape, typing and caret mode do not turn it on. `pointerdown` and `touchstart`
 * only turn off the visual mode. CSS shows the indicator via `html[data-focus-mode="keyboard"]`.
 * Focus management does not change; only the presentation changes.
 */
export const FOCUS_MODE_ATTR = 'data-focus-mode';
export const FOCUS_MODE_KEYBOARD = 'keyboard';

let refCount = 0;
let detach: (() => void) | null = null;

function root(): HTMLElement {
  return document.documentElement;
}

export function isKeyboardFocusMode(): boolean {
  return root().getAttribute(FOCUS_MODE_ATTR) === FOCUS_MODE_KEYBOARD;
}

export function setKeyboardFocusMode(on: boolean): void {
  if (on) {
    root().setAttribute(FOCUS_MODE_ATTR, FOCUS_MODE_KEYBOARD);
  } else {
    root().removeAttribute(FOCUS_MODE_ATTR);
  }
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey) {
    setKeyboardFocusMode(true);
  }
}

function onPointer(): void {
  setKeyboardFocusMode(false);
}

/** Starts the engine. The returned function stops it. Multiple calls share one listener set. */
export function startFocusMode(doc: Document = document): () => void {
  refCount += 1;
  if (!detach) {
    doc.addEventListener('keydown', onKeyDown, true);
    doc.addEventListener('pointerdown', onPointer, true);
    doc.addEventListener('touchstart', onPointer, { capture: true, passive: true });
    detach = () => {
      doc.removeEventListener('keydown', onKeyDown, true);
      doc.removeEventListener('pointerdown', onPointer, true);
      doc.removeEventListener('touchstart', onPointer, { capture: true });
    };
  }
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    refCount -= 1;
    if (refCount <= 0 && detach) {
      detach();
      detach = null;
      refCount = 0;
    }
  };
}

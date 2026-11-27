import { useSyncExternalStore } from 'react';

/**
 * Virtual keyboard share. If the visual viewport shrinks by more than this share of the window,
 * the keyboard counts as open. A phone keyboard covers about a third of the screen in portrait
 * and half in landscape. The browser's address bar is less than this share, so it does not count as a keyboard.
 */
const KEYBOARD_SHARE = 0.2;

function keyboardOpen(): boolean {
  const vv = window.visualViewport;
  if (!vv) return false;
  // When zoomed, the visual viewport shrinks, but its product with the scale stays equal to the window.
  const visible = vv.height * vv.scale;
  return window.innerHeight - visible > window.innerHeight * KEYBOARD_SHARE;
}

function subscribe(cb: () => void) {
  const vv = window.visualViewport;
  vv?.addEventListener('resize', cb);
  window.addEventListener('resize', cb);
  return () => {
    vv?.removeEventListener('resize', cb);
    window.removeEventListener('resize', cb);
  };
}

/**
 * Is the virtual keyboard open? The decision comes from the `visualViewport` size.
 * No device name or user-agent is used. Without `visualViewport` the keyboard counts as closed.
 */
export function useVirtualKeyboard(): boolean {
  return useSyncExternalStore(subscribe, keyboardOpen, () => false);
}

import { useCallback, useLayoutEffect, useRef } from 'react';

/** Items of a list. When the opener is gone, focus moves to the neighbouring item. */
const ITEM = 'li, [role="listitem"], [role="row"]';
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Origin {
  opener: HTMLElement;
  next: Element | null;
  previous: Element | null;
}

function focusFirst(item: Element | null): boolean {
  if (!item?.isConnected) return false;
  const target = item.matches(FOCUSABLE) ? item : item.querySelector(FOCUSABLE);
  if (!(target instanceof HTMLElement)) return false;
  target.focus();
  return true;
}

/**
 * Remembers the element that had focus when `open` became true.
 * `restore()` moves focus back to it. If it was removed, focus moves to the next item of
 * its list, then to the previous item.
 */
export function useFocusReturn(open: boolean) {
  const origin = useRef<Origin | undefined>(undefined);

  useLayoutEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || active === document.body) return;
    const item = active.closest(ITEM);
    origin.current = {
      opener: active,
      next: item?.nextElementSibling ?? null,
      previous: item?.previousElementSibling ?? null,
    };
  }, [open]);

  return useCallback(() => {
    const saved = origin.current;
    origin.current = undefined;
    if (!saved) return;
    if (saved.opener.isConnected) {
      saved.opener.focus();
      return;
    }
    if (!focusFirst(saved.next)) focusFirst(saved.previous);
  }, []);
}

/** Open dialog layers. Escape inside them is handled by the dialog itself. */
const LAYER = '.ant-modal-wrap, .ant-drawer, .ant-popover';

/**
 * Closes on Escape while focus has not moved into the dialog yet. The dialog moves focus
 * after its open step, so a quick Escape right after opening would otherwise be lost.
 */
export function useEscapeWhileOpening(open: boolean, close: () => void) {
  useLayoutEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(LAYER)) return;
      event.preventDefault();
      close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);
}

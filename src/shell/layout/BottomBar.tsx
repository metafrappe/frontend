import { List, MagnifyingGlass, Sparkle, Tray } from '@phosphor-icons/react';
import type { MouseEvent } from 'react';
import { forwardRef, useLayoutEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';

import { t } from '../messages';
import { routes } from '../paths';
import { LANDSCAPE_PHONE_QUERY } from './useMedia';
import { useVirtualKeyboard } from './useVirtualKeyboard';

interface BottomBarProps {
  /** Is the menu open? Buttons take their `aria-expanded` value from this. */
  open: boolean;
  /** Which button opened the menu? Only that button gets `aria-expanded=true`. */
  opener: 'menu' | 'search' | null;
  onMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  onSearch: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Phone bottom bar. It has four buttons:
 * Pending, Search, Assistant and Menu. On a landscape phone the bar moves to the left edge.
 * CSS makes this decision; the React tree does not change. The bar hides when the virtual keyboard opens.
 */
export const BottomBar = forwardRef<HTMLElement, BottomBarProps>(function BottomBar(
  { open, opener, onMenu, onSearch },
  ref,
) {
  const keyboard = useVirtualKeyboard();
  const b = t.bottomBar;
  const own = useRef<HTMLElement | null>(null);
  // The bar's real size is measured. Content keeps clear of the bar by this offset.
  // With enlarged text the bar grows, and so does the offset. A hidden bar's offset is zero.
  useLayoutEffect(() => {
    const el = own.current;
    if (!el) return undefined;
    const root = document.documentElement;
    // There may be another note above the shell. Example: the mock server's sample data note.
    // On a landscape phone the left bar starts at the shell's top edge and does not cover this note.
    const shell = el.parentElement;
    const measureTop = () => {
      const top = Math.max(0, shell?.getBoundingClientRect().top ?? 0);
      root.style.setProperty('--shell-bar-top', `${top}px`);
    };
    const measure = () => {
      const r = el.getBoundingClientRect();
      root.style.setProperty('--shell-bar-block', `${r.height}px`);
      root.style.setProperty('--shell-bar-inline', `${r.width}px`);
      measureTop();
    };
    // Scrolling changes only the bar's top edge. The top edge is used only on a landscape phone.
    // So on scroll, only this value is measured, and only on a landscape phone.
    const landscape = window.matchMedia(LANDSCAPE_PHONE_QUERY);
    const onScroll = () => {
      if (landscape.matches) measureTop();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (shell) observer.observe(shell);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      root.style.removeProperty('--shell-bar-block');
      root.style.removeProperty('--shell-bar-inline');
      root.style.removeProperty('--shell-bar-top');
    };
  }, []);
  const setRef = (el: HTMLElement | null) => {
    own.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };
  return (
    <nav
      ref={setRef}
      className="shell-bar"
      aria-label={b.label}
      data-keyboard={keyboard ? 'open' : undefined}
    >
      <NavLink to={routes.home()} end className="shell-bar-item" data-nav-link="">
        <Tray aria-hidden="true" />
        <span>{b.pending}</span>
      </NavLink>
      <button
        type="button"
        className="shell-bar-item"
        aria-haspopup="dialog"
        aria-controls="shell-drawer"
        aria-expanded={open && opener === 'search'}
        onClick={onSearch}
      >
        <MagnifyingGlass aria-hidden="true" />
        <span>{b.search}</span>
      </button>
      <NavLink to={routes.assistant()} className="shell-bar-item" data-nav-link="">
        <Sparkle aria-hidden="true" />
        <span>{b.assistant}</span>
      </NavLink>
      <button
        type="button"
        className="shell-bar-item"
        aria-haspopup="dialog"
        aria-controls="shell-drawer"
        aria-expanded={open && opener === 'menu'}
        onClick={onMenu}
      >
        <List aria-hidden="true" />
        <span>{b.menu}</span>
      </button>
    </nav>
  );
});

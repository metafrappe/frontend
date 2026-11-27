import { CaretUpDown } from '@phosphor-icons/react';
import type { MenuProps } from 'antd';
import { Dropdown } from 'antd';
import type { KeyboardEvent } from 'react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import { t } from '../messages';
import type { ShellWorkspace, ShellWorkspaceData } from '../view-data';

interface WorkspaceSwitcherProps {
  rail: boolean;
  /** Workspaces from the server. If absent, only the logo is shown. No sample company is shown. */
  data?: ShellWorkspaceData | undefined;
}

type FocusTarget = 'first' | 'last';

/** Maximum number of frames to wait for the list to render. */
const MAX_FOCUS_FRAMES = 30;

const ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"])';

/**
 * Arrows, Home and End move focus at once. After the last item it wraps to the first.
 * The antd menu moves focus one frame later and conditionally. On a slow device that can swallow the arrow press.
 * So these keys are handled here before they reach the menu. Enter and Space stay with the menu.
 * Escape is handled separately inside the component.
 */
function moveMenuFocus(event: KeyboardEvent<HTMLDivElement>) {
  const { key } = event;
  if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Home' && key !== 'End') return;
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
  if (items.length === 0) return;
  const at = items.findIndex((item) => item === document.activeElement);
  const last = items.length - 1;
  const next =
    key === 'Home'
      ? 0
      : key === 'End'
        ? last
        : key === 'ArrowDown'
          ? at < 0 || at === last
            ? 0
            : at + 1
          : at <= 0
            ? last
            : at - 1;
  event.preventDefault();
  event.stopPropagation();
  items[next]?.focus();
}

/** Target of an arrow pressed on the button or the body. Down goes to the first item, up to the last. */
function arrowTarget(key: string): FocusTarget | null {
  return key === 'ArrowDown' ? 'first' : key === 'ArrowUp' ? 'last' : null;
}

/** Focuses the first or last item of the open list. Returns `false` if the list has not rendered. */
function focusMenuItem(menuId: string, target: FocusTarget): boolean {
  const items = document.getElementById(menuId)?.querySelectorAll<HTMLElement>(ITEM_SELECTOR);
  const item = items && (target === 'first' ? items[0] : items[items.length - 1]);
  if (!item) return false;
  item.focus();
  return true;
}

/**
 * W1: workspace switcher. Data comes from the server (the session's tenant).
 * Without data only the logo is shown. With one workspace the name is shown plainly, without a dropdown.
 * With more than one workspace it becomes a dropdown.
 */
export function WorkspaceSwitcher({ rail, data }: WorkspaceSwitcherProps) {
  const items = data?.items ?? [];
  if (items.length > 1 && data) return <WorkspaceMenu rail={rail} data={data} />;
  const ws = items[0];
  return (
    <div className="shell-ws" data-static="true">
      <span className="shell-logo" aria-hidden="true">
        A
      </span>
      {ws &&
        (rail ? (
          <span className="shell-vh">{t.workspace.label(ws.name)}</span>
        ) : (
          <WorkspaceLabel ws={ws} />
        ))}
    </div>
  );
}

/** Name and short note in the switcher. Without a note, the note line is not rendered. */
function WorkspaceLabel({ ws }: { ws: ShellWorkspace }) {
  return (
    <span className="shell-ws-t">
      <span className="shell-vh">{t.workspace.prefix}</span>
      <b>{ws.name}</b>
      {ws.note ? <small>{ws.note}</small> : null}
    </span>
  );
}

/**
 * Several workspaces: a click opens a list in the "with descriptions" style. The focus dim is applied.
 * Keyboard follows the APG menu button pattern (Ö8):
 * Enter, Space and Down open the list and go to the first item. Up goes to the last item.
 * Arrows move between items. Escape closes the list and focuses the button.
 * Tab and Shift+Tab close the list. Focus moves to the element after or before the button.
 * If the list was opened with the mouse, Down goes to the first item, Up to the last.
 */
function WorkspaceMenu({ rail, data }: { rail: boolean; data: ShellWorkspaceData }) {
  const workspaces = data.items;
  const [current, setCurrent] = useState(data.current);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<FocusTarget | null>(null);

  // If the list was opened by keyboard, focus goes to the requested item once rendered.
  useEffect(() => {
    if (!open || !pendingFocus.current) return undefined;
    const target = pendingFocus.current;
    let frames = 0;
    let handle = 0;
    const tryFocus = () => {
      if (focusMenuItem(menuId, target)) {
        pendingFocus.current = null;
        return;
      }
      frames += 1;
      if (frames < MAX_FOCUS_FRAMES) handle = requestAnimationFrame(tryFocus);
    };
    handle = requestAnimationFrame(tryFocus);
    return () => cancelAnimationFrame(handle);
  }, [open, menuId]);

  // While the closing animation runs, the list is closed to screen readers and the keyboard.
  // The animation depends on frames and can take seconds on a slow device. Semantic state does not wait.
  // The dropdown layer freezes its content while closing, so the attributes are written here.
  useLayoutEffect(() => {
    const surface = document.getElementById(`${menuId}-surface`);
    if (!surface) return;
    if (open) {
      surface.removeAttribute('aria-hidden');
      surface.removeAttribute('inert');
    } else {
      surface.setAttribute('aria-hidden', 'true');
      surface.setAttribute('inert', '');
    }
  }, [open, menuId]);

  // If the list was opened with the mouse, focus is not in the menu (K-1).
  // In Chromium focus is on the button. The button's own key handler covers that case.
  // WebKit does not focus a clicked button. Focus stays on the page body. This listener covers that case.
  // Tab and Shift+Tab close the list (review 2, K-1). The event does not reach the window.
  // So antd's window listener cannot block Tab. The browser still moves focus itself.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const active = document.activeElement;
      if (active && active !== document.body) return;
      if (event.key === 'Tab') {
        event.stopPropagation();
        pendingFocus.current = null;
        setOpen(false);
        return;
      }
      const target = arrowTarget(event.key);
      if (!target) return;
      if (focusMenuItem(menuId, target)) event.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, menuId]);

  const ws = workspaces.find((w) => w.id === current) ?? workspaces[0];
  if (!ws) return null;

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (open) {
      // The list was opened with the mouse and focus stayed on the button. Arrows move focus into the menu at once (K-1).
      // Enter and Space are not handled here. They close the list as a click.
      // Tab and Shift+Tab close the list. The browser moves focus to the element after or before the button.
      // The event does not reach antd's window listener, which would block the first Tab (review 2, K-1).
      if (event.key === 'Tab') {
        event.stopPropagation();
        pendingFocus.current = null;
        setOpen(false);
        return;
      }
      const arrow = arrowTarget(event.key);
      if (arrow && focusMenuItem(menuId, arrow)) event.preventDefault();
      return;
    }
    const target: FocusTarget | null =
      event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown'
        ? 'first'
        : event.key === 'ArrowUp'
          ? 'last'
          : null;
    if (!target) return;
    // Stop the browser's click event from toggling the list a second time.
    event.preventDefault();
    pendingFocus.current = target;
    setOpen(true);
  };

  const items: MenuProps['items'] = workspaces.map((w) => ({
    key: w.id,
    label: (
      <span className="shell-dd-desc">
        <span className="shell-dd-box" aria-hidden="true">
          {w.name.slice(-1)}
        </span>
        <span className="shell-dd-t">
          <span>{w.name}</span>
          {w.note ? <small>{w.note}</small> : null}
        </span>
      </span>
    ),
  }));

  return (
    <Dropdown
      trigger={['click']}
      open={open}
      onOpenChange={(next) => {
        if (!next) pendingFocus.current = null;
        setOpen(next);
      }}
      menu={{
        id: menuId,
        items,
        selectable: true,
        selectedKeys: [current],
        onClick: ({ key, domEvent }) => {
          setCurrent(key);
          if (key !== current) data.select?.(key);
          // After a keyboard selection, focus returns to the button.
          // The same Enter key must not pass to the focused button as a click, or the list reopens.
          const byKeyboard = domEvent.type === 'keydown';
          if (byKeyboard) domEvent.preventDefault();
          // On a mouse selection, if focus is in the list it returns to the button (review 1, K-3).
          // Chromium focuses the clicked item. The list becomes `inert` at once, so focus would fall to the body.
          // If focus is not in the list (e.g. WebKit), focus is left alone.
          const surface = document.getElementById(`${menuId}-surface`);
          const focusInMenu = surface?.contains(document.activeElement) ?? false;
          close(byKeyboard || focusInMenu);
        },
        'aria-label': t.workspace.menu,
      }}
      popupRender={(node) => (
        <div
          id={`${menuId}-surface`}
          onKeyDownCapture={(event) => {
            // Escape closes the list and focuses the button at once.
            if (event.key === 'Escape') {
              event.preventDefault();
              close(true);
              return;
            }
            // Tab and Shift+Tab close the list (Ö-1). The browser's Tab behaviour is not prevented.
            // Focus first returns to the button. The browser counts the next or previous element from the button.
            // The antd dropdown binds a Tab listener to the window. On the first Tab that listener
            // pulls focus back into the list. The event is stopped here so it never reaches that listener.
            if (event.key === 'Tab') {
              event.stopPropagation();
              close(true);
              return;
            }
            moveMenuFocus(event);
          }}
        >
          {node}
        </div>
      )}
      overlayClassName="shell-dd shell-dd-described"
      // The list opens inside the shell, so it sees the shell's variables.
      getPopupContainer={(node) => node.closest<HTMLElement>('.shell') ?? document.body}
      placement="bottomLeft"
    >
      <button
        ref={buttonRef}
        type="button"
        className="shell-ws"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-raised={open ? 'true' : undefined}
        onKeyDown={onButtonKeyDown}
        {...(rail ? { 'aria-label': t.workspace.label(ws.name) } : {})}
      >
        <span className="shell-logo" aria-hidden="true">
          A
        </span>
        {!rail && (
          <>
            <WorkspaceLabel ws={ws} />
            <span className="shell-ws-i" aria-hidden="true">
              <CaretUpDown />
            </span>
          </>
        )}
      </button>
    </Dropdown>
  );
}

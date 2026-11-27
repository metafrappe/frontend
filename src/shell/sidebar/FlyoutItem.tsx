import type { Icon } from '@phosphor-icons/react';
import { CaretRight, Sparkle } from '@phosphor-icons/react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useReducedMotion } from '../layout/useMedia';
import { usePresence } from '../layout/usePresence';
import type { AgentStatus } from '../sampleData';
import { shellTokens } from '../tokens';
import { flyoutPosition } from './flyoutPosition';
import { Glide } from './Glide';
import { FLY_GLIDE_ITEM, useGlide } from './useGlide';

export type OpenedBy = 'hover' | 'focus' | 'press' | 'key';

export interface FlyoutItemRenderProps {
  'data-fly-item': '';
}

export interface FlyoutContent {
  title: string;
  badge?: number;
  /** Agent and command panels are wide. */
  wide?: boolean;
  body?: ReactNode;
  items: { key: string; render: (p: FlyoutItemRenderProps) => ReactNode }[];
  ai?: { label: string; onClick: () => void };
}

export interface FlyoutItemProps {
  id: string;
  flyId: string;
  open: boolean;
  openedBy: OpenedBy | null;
  rail: boolean;
  compact: boolean;
  onOpen: (id: string, by: OpenedBy) => void;
  onClose: () => void;
  onHoverOpen: (id: string) => void;
  onHoverClose: () => void;
  onHoverKeep: () => void;
  label: string;
  description?: string;
  icon: Icon;
  badge?: number;
  status?: AgentStatus;
  active: boolean;
  content: FlyoutContent;
}

const ITEM_SELECTOR = '[data-fly-item]';

/**
 * Sidebar item with a submenu (S5, F1–F6).
 * On wide screens the panel opens to the right. On phones it opens below the item.
 */
export function FlyoutItem(p: FlyoutItemProps) {
  const {
    id,
    flyId,
    open,
    openedBy,
    rail,
    compact,
    onOpen,
    onClose,
    onHoverOpen,
    onHoverClose,
    onHoverKeep,
    content,
  } = p;
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pressWasOpen = useRef(false);
  const suppressFocusOpen = useRef(false);
  const focusFirst = useRef(false);
  const reduced = useReducedMotion();
  const presence = usePresence(open, reduced ? 0 : shellTokens.flyout.duration);
  const [pos, setPos] = useState<{ left: number; top: number; caret: number } | null>(null);
  const descId = `${flyId}-d`;
  const { hostRef: glideRef, state: glideState, hostProps: glideProps } = useGlide(FLY_GLIDE_ITEM);

  const returnFocus = () => {
    suppressFocusOpen.current = true;
    btnRef.current?.focus();
    suppressFocusOpen.current = false;
  };

  // F5: when opened with the right arrow, focus moves to the first item.
  useEffect(() => {
    if (!open || !focusFirst.current) return;
    focusFirst.current = false;
    panelRef.current?.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus();
  }, [open]);

  // F1–F3: panel position. On phones the panel is in the normal flow.
  useLayoutEffect(() => {
    if (compact || presence === 'closed') return undefined;
    const update = () => {
      const btn = btnRef.current;
      const panel = panelRef.current;
      const sb = btn?.closest('.shell-sb');
      if (!btn || !panel || !sb) return;
      const a = btn.getBoundingClientRect();
      setPos(
        flyoutPosition({
          anchor: { top: a.top, height: a.height },
          sidebarRight: sb.getBoundingClientRect().right,
          flyoutHeight: panel.offsetHeight,
          viewportHeight: window.innerHeight,
          gap: shellTokens.flyout.gap,
          clampPadding: shellTokens.flyout.clampPadding,
        }),
      );
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [compact, presence, rail]);

  const onBtnKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (open) {
        panelRef.current?.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus();
      } else {
        focusFirst.current = true;
        onOpen(id, 'key');
      }
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  const onPanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (n: number) => items[(n + items.length) % items.length]?.focus();
    switch (e.key) {
      case 'ArrowDown':
        if (i < 0) return;
        e.preventDefault();
        focusAt(i + 1);
        break;
      case 'ArrowUp':
        if (i < 0) return;
        e.preventDefault();
        focusAt(i - 1);
        break;
      case 'Home':
        if (i < 0) return;
        e.preventDefault();
        focusAt(0);
        break;
      case 'End':
        if (i < 0) return;
        e.preventDefault();
        focusAt(items.length - 1);
        break;
      case 'ArrowLeft':
        if (i < 0) return;
        e.preventDefault();
        onClose();
        returnFocus();
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        onClose();
        returnFocus();
        break;
      default:
    }
  };

  const onHostBlur = (e: React.FocusEvent<HTMLLIElement>) => {
    const next = e.relatedTarget as Node | null;
    if (!next) return;
    if (e.currentTarget.contains(next)) return;
    if (open) onClose();
  };

  const isMouse = (e: React.PointerEvent) => e.pointerType === 'mouse';
  const hoverEnabled = !compact;
  const ItemIcon = p.icon;
  const closing = presence === 'closing';
  const wide = content.wide === true;

  const panelStyle: CSSProperties | undefined =
    compact || !pos ? undefined : { left: pos.left, top: pos.top };

  return (
    <li
      className="shell-fly-host"
      data-fly-host={id}
      onBlur={onHostBlur}
      onPointerLeave={(e) => {
        if (hoverEnabled && isMouse(e)) onHoverClose();
      }}
    >
      <button
        ref={btnRef}
        type="button"
        className="shell-item"
        data-sb-top=""
        data-active={p.active ? 'true' : undefined}
        data-open={open ? 'true' : undefined}
        data-raised={open && !compact ? 'true' : undefined}
        {...(rail ? { 'aria-label': p.label } : {})}
        aria-expanded={open}
        aria-controls={flyId}
        {...(p.badge !== undefined || p.description ? { 'aria-describedby': descId } : {})}
        onFocus={() => {
          if (suppressFocusOpen.current) return;
          onOpen(id, 'focus');
        }}
        onPointerDown={() => {
          pressWasOpen.current = open && openedBy === 'press';
        }}
        onClick={(e) => {
          if (e.detail === 0) {
            if (open) onClose();
            else onOpen(id, 'key');
            return;
          }
          if (pressWasOpen.current) onClose();
          else onOpen(id, 'press');
          pressWasOpen.current = false;
        }}
        onPointerEnter={(e) => {
          if (hoverEnabled && isMouse(e) && !open) onHoverOpen(id);
        }}
        onKeyDown={onBtnKeyDown}
      >
        <span className="shell-ic" aria-hidden="true">
          <ItemIcon />
          {p.status && <span className="shell-st" data-status={p.status} />}
        </span>
        {p.description ? (
          <span className="shell-lb2">
            <span>{p.label}</span>
            <small id={descId} aria-hidden="true">
              {p.description}
            </small>
          </span>
        ) : (
          <span className="shell-lb">{p.label}</span>
        )}
        {p.badge !== undefined && (
          <span className="shell-badge" id={descId} aria-hidden="true">
            {p.badge}
          </span>
        )}
        <span className="shell-chev" aria-hidden="true">
          <CaretRight />
        </span>
      </button>

      {presence !== 'closed' && (
        <div
          ref={panelRef}
          id={flyId}
          role="group"
          aria-label={content.title}
          className="shell-fly"
          data-wide={wide ? 'true' : undefined}
          data-compact={compact ? 'true' : undefined}
          data-state={closing ? 'closing' : 'open'}
          data-placed={compact || pos ? 'true' : 'false'}
          {...(closing ? { 'aria-hidden': true, inert: '' } : {})}
          style={panelStyle}
          onKeyDown={onPanelKeyDown}
          onPointerEnter={onHoverKeep}
          onPointerLeave={(e) => {
            if (hoverEnabled && isMouse(e)) onHoverClose();
          }}
        >
          {!compact && pos && (
            <span className="shell-fly-caret" aria-hidden="true" style={{ top: pos.caret }} />
          )}
          <div className="shell-fly-h">
            <span className="shell-ic" aria-hidden="true">
              <ItemIcon />
            </span>
            <span className="shell-lb">{content.title}</span>
            {content.badge !== undefined && <span className="shell-badge">{content.badge}</span>}
          </div>
          {content.body}
          {content.items.length > 0 && (
            // G1: the flyout panel has its own gliding background too (source: .sb-fly .glide).
            <div
              ref={glideRef as React.RefObject<HTMLDivElement>}
              className="shell-glide-host"
              {...glideProps}
            >
              <Glide state={glideState} />
              <ul className="shell-fly-list">
                {content.items.map((it) => (
                  <li key={it.key}>{it.render({ 'data-fly-item': '' })}</li>
                ))}
              </ul>
            </div>
          )}
          {content.ai && (
            <button
              type="button"
              className="shell-fly-ai"
              data-fly-item=""
              onClick={content.ai.onClick}
            >
              <Sparkle aria-hidden="true" />
              <span>{content.ai.label}</span>
            </button>
          )}
        </div>
      )}
    </li>
  );
}

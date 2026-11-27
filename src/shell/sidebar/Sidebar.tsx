import { Sparkle } from '@phosphor-icons/react';
import { Tooltip } from 'antd';
import { Fragment, useCallback, useEffect, useId, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

import type { QuickAction } from '../nav';
import { groupNavigation } from '../nav';
import { isPathActive } from '../navMatch';
import { t } from '../messages';
import { routes } from '../paths';
import type { Agent, NavEntry, NavGroup, NavLeaf } from '../sampleData';
import { shellTokens } from '../tokens';
import type { ShellCredit, ShellWorkspaceData } from '../view-data';
import { CommandBox } from './CommandBox';
import type { CommandMode } from './CommandBox';
import type { FlyoutContent, OpenedBy } from './FlyoutItem';
import { FlyoutItem } from './FlyoutItem';
import { RailToggle } from './RailToggle';
import { SidebarFooter } from './SidebarFooter';
import { Glide } from './Glide';
import { useGlide } from './useGlide';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

export type SidebarVariant = 'solid' | 'rail';

export interface SidebarProps {
  variant: SidebarVariant;
  onVariantChange: (v: SidebarVariant) => void;
  nav: NavEntry[];
  agents: Agent[];
  /** Workspaces. If absent, only the logo is shown. */
  workspaces?: ShellWorkspaceData | undefined;
  /** Quick actions of the command box. If empty, the section is not rendered. */
  quickActions?: readonly QuickAction[];
  /** AI credit. If absent, the meter is not rendered. */
  credit?: ShellCredit | null;
  /** Phone shell. The flyout opens below the item. */
  compact?: boolean;
  /** Called on navigating to a page. On phones it closes the drawer. */
  onNavigate?: (() => void) | undefined;
  /** Live work is grouped by task. The isolated legacy demo retains its flyouts. */
  grouped?: boolean;
  commandMode?: CommandMode;
  onCommandModeChange?: (mode: CommandMode) => void;
}

interface OpenState {
  id: string;
  by: OpenedBy;
}

const COMMAND_ID = 'command';

export function Sidebar({
  variant,
  onVariantChange,
  nav,
  agents,
  workspaces,
  quickActions = [],
  credit = null,
  compact = false,
  onNavigate,
  grouped = false,
  commandMode,
  onCommandModeChange,
}: SidebarProps) {
  const rail = variant === 'rail' && !compact;
  const [open, setOpen] = useState<OpenState | null>(null);
  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const baseId = useId();

  const { hostRef: glideRef, state: glideState, hostProps: glideProps } = useGlide();

  const clearTimers = () => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  };

  useEffect(() => clearTimers, []);

  // An open flyout closes when the page changes.
  const [prevPath, setPrevPath] = useState(location.pathname);
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname);
    setOpen(null);
  }

  const openNow = useCallback((id: string, by: OpenedBy) => {
    clearTimers();
    setOpen((cur) => (cur?.id === id && cur.by !== 'hover' && by === 'hover' ? cur : { id, by }));
  }, []);

  const close = useCallback(() => {
    clearTimers();
    setOpen(null);
  }, []);

  const hoverOpen = useCallback(
    (id: string) => {
      clearTimers();
      openTimer.current = window.setTimeout(
        () => openNow(id, 'hover'),
        shellTokens.flyout.openDelay,
      );
    },
    [openNow],
  );

  const hoverClose = useCallback(() => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setOpen((cur) => (cur?.by === 'hover' ? null : cur));
    }, shellTokens.flyout.closeDelay);
  }, []);

  const hoverKeep = useCallback(() => {
    window.clearTimeout(closeTimer.current);
  }, []);

  const handleNavigate = useCallback(() => {
    close();
    onNavigate?.();
  }, [close, onNavigate]);

  // An outside click closes the open flyout.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      const host = rootRef.current?.querySelector(`[data-fly-host="${open.id}"]`);
      if (host && target && host.contains(target)) return;
      close();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, close]);

  const isActive = (to: string) => isPathActive(to, location.pathname);

  // Up and down arrow keys move between top-level items.
  const onNavKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const target = e.target as HTMLElement;
    if (!target.matches('[data-sb-top]')) return;
    const all = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-sb-top]') ?? []);
    const i = all.indexOf(target);
    if (i < 0) return;
    e.preventDefault();
    const next = all[(i + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length];
    next?.focus();
  };

  const flyProps = (id: string) => ({
    id,
    flyId: `${baseId}-fly-${id}`,
    open: open?.id === id,
    openedBy: open?.id === id ? open.by : null,
    rail,
    compact,
    onOpen: openNow,
    onClose: close,
    onHoverOpen: hoverOpen,
    onHoverClose: hoverClose,
    onHoverKeep: hoverKeep,
  });

  const renderGroup = (g: NavGroup) => {
    const content: FlyoutContent = {
      title: g.label,
      ...(g.badge === undefined ? {} : { badge: g.badge }),
      items: g.children.map((c) => ({
        key: c.id,
        render: (itemProps) => (
          <NavLink
            to={c.to}
            className="shell-item"
            data-nav-link=""
            onClick={handleNavigate}
            {...itemProps}
          >
            <span className="shell-ic" aria-hidden="true">
              <c.icon />
            </span>
            <span className="shell-lb">{c.label}</span>
            {c.badge !== undefined && <span className="shell-badge">{c.badge}</span>}
          </NavLink>
        ),
      })),
      ai: {
        label: t.nav.aiAction(g.label),
        onClick: () => {
          navigate(routes.assistant(), { state: { q: '', context: g.id } });
          handleNavigate();
        },
      },
    };
    const active = g.children.some((c) => isActive(c.to));
    return (
      <FlyoutItem
        key={g.id}
        {...flyProps(g.id)}
        label={g.label}
        icon={g.icon}
        active={active}
        {...(g.badge === undefined ? {} : { badge: g.badge })}
        content={content}
      />
    );
  };

  const renderLeaf = (l: NavLeaf) => {
    const link = (
      <NavLink
        to={l.to}
        end={l.to === '/'}
        className="shell-item"
        data-nav-link=""
        data-sb-top=""
        // Explicit native tab stop also enables link traversal in macOS WebKit.
        tabIndex={0}
        onClick={handleNavigate}
        onFocus={close}
        {...(rail ? { 'aria-label': l.label } : {})}
      >
        <span className="shell-ic" aria-hidden="true">
          <l.icon />
        </span>
        <span className="shell-lb">{l.label}</span>
        {l.badge !== undefined && <span className="shell-badge">{l.badge}</span>}
      </NavLink>
    );
    return (
      <li key={l.id}>
        {rail ? (
          <Tooltip title={l.label} placement="right" mouseEnterDelay={0.06}>
            {link}
          </Tooltip>
        ) : (
          link
        )}
      </li>
    );
  };

  const renderAgent = (a: Agent) => {
    const statusText = t.agents.status[a.status];
    const content: FlyoutContent = {
      title: a.name,
      wide: true,
      body: (
        <div className="shell-agent-b">
          <p className="shell-agent-st" data-status={a.status}>
            <span className="shell-st" data-status={a.status} aria-hidden="true" />
            {statusText}
          </p>
          <p>{a.task}</p>
          <p className="shell-muted">{t.agents.lastEvent(a.lastEvent)}</p>
        </div>
      ),
      items: [
        {
          key: 'open',
          render: (itemProps) => (
            <NavLink
              to={routes.agent(a.id)}
              className="shell-item"
              data-nav-link=""
              onClick={handleNavigate}
              {...itemProps}
            >
              <span className="shell-lb">{t.agents.open}</span>
            </NavLink>
          ),
        },
      ],
    };
    return (
      <FlyoutItem
        key={a.id}
        {...flyProps(`agent-${a.id}`)}
        label={a.name}
        description={statusText}
        icon={a.icon}
        status={a.status}
        active={isActive(routes.agent(a.id))}
        content={content}
      />
    );
  };

  return (
    <div
      ref={rootRef}
      className="shell-sb"
      data-variant={rail ? 'rail' : 'solid'}
      data-compact={compact ? 'true' : 'false'}
    >
      <div className="shell-sb-top">
        <WorkspaceSwitcher rail={rail} data={workspaces} />
        {!compact && (
          <RailToggle rail={rail} onToggle={() => onVariantChange(rail ? 'solid' : 'rail')} />
        )}
      </div>

      <div className="shell-sb-scroll">
        {!rail && (
          <CommandBox
            actions={quickActions}
            mode={commandMode}
            onModeChange={onCommandModeChange}
            {...(onNavigate ? { onSubmitted: onNavigate } : {})}
          />
        )}

        <nav
          ref={glideRef}
          aria-label={t.nav.label}
          className="shell-glide-host"
          onKeyDown={onNavKeyDown}
          {...glideProps}
        >
          <Glide state={glideState} />
          {rail && (
            <ul className="shell-list">
              <FlyoutItem
                {...flyProps(COMMAND_ID)}
                label={t.command.label}
                icon={Sparkle}
                active={false}
                content={{
                  title: t.command.label,
                  wide: true,
                  body: (
                    <CommandBox
                      actions={quickActions}
                      mode={commandMode}
                      onModeChange={onCommandModeChange}
                      onSubmitted={handleNavigate}
                    />
                  ),
                  items: [],
                }}
              />
            </ul>
          )}
          {grouped ? (
            groupNavigation(nav).map((section) => (
              <Fragment key={section.id}>
                <h2 id={`${baseId}-${section.id}`} className={rail ? 'shell-vh' : 'shell-sec'}>
                  {section.label}
                </h2>
                <ul className="shell-list" aria-labelledby={`${baseId}-${section.id}`}>
                  {section.children.map(renderLeaf)}
                </ul>
              </Fragment>
            ))
          ) : (
            <>
              {!rail && <h2 className="shell-sec">{t.nav.sectionMain}</h2>}
              <ul className="shell-list">
                {nav.map((e) => (e.kind === 'group' ? renderGroup(e) : renderLeaf(e)))}
              </ul>
            </>
          )}
          {/* Without agent data the section is hidden. No made-up agents are shown. */}
          {agents.length > 0 && (
            <>
              {!rail && <h2 className="shell-sec">{t.nav.sectionAgents}</h2>}
              <ul className="shell-list" aria-label={rail ? t.nav.sectionAgents : undefined}>
                {agents.map(renderAgent)}
              </ul>
            </>
          )}
        </nav>
      </div>

      <SidebarFooter rail={rail} credit={credit} />
    </div>
  );
}

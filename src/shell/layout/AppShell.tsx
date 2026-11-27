import { List, Sparkle, WarningCircle, X } from '@phosphor-icons/react';
import { theme } from 'antd';
import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { isDemoEnabled, isDemoPath } from '@/app/demo-mode';
import { RESELLER_LINK_DOCTYPE } from '@/modules';

import { type ShellAccess, ShellAccessContext } from '../access';
import { ASSIST_PANEL_ID, AssistPanel, type AssistPanelApi, AssistPanelContext } from '../assist';
import { FocusDimProvider } from '../focus-dim';
import { isDarkColor } from '../focus-dim/isDarkColor';
import { WorkspaceIdentity } from '../header/WorkspaceIdentity';
import { t } from '../messages';
import type { QuickAction } from '../nav';
import {
  buildShellNav,
  navFromSidebars,
  permittedNav,
  quickActionsFrom,
  requiredDocTypes,
  routeNav,
} from '../nav';
import type { NavEntry, NavGroup } from '../sampleData';
import {
  sampleAgents,
  sampleCredit,
  sampleNav,
  samplePrompts,
  sampleWorkspaces,
} from '../sampleData';
import type { SidebarVariant } from '../sidebar/Sidebar';
import { Sidebar } from '../sidebar/Sidebar';
import type { CommandMode } from '../sidebar/CommandBox';
import { shellCssVars } from '../tokens';
import type { AccountKind, ShellCredit, ShellWorkspaceData } from '../view-data';
import { useViewData } from '../view-data';
import { workspaceText } from '../workspaceMessages';
import { BottomBar } from './BottomBar';
import { useCompactLayout } from './useMedia';

const STORAGE_KEY = 'atonota.shell.sidebar';

function readVariant(): SidebarVariant {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'rail' ? 'rail' : 'solid';
  } catch {
    return 'solid';
  }
}

function writeVariant(v: SidebarVariant) {
  try {
    window.localStorage.setItem(STORAGE_KEY, v);
  } catch {
    // The browser does not allow storage. The preference lasts only for this session.
  }
}

/** Shell CSS variables come from antd tokens and the source file. */
function useThemeVars(): CSSProperties {
  const { token } = theme.useToken();
  const dark = isDarkColor(token.colorBgLayout);
  return {
    ...shellCssVars(),
    '--shell-bg': token.colorBgLayout,
    '--shell-bg-c': token.colorBgContainer,
    '--shell-bg-el': token.colorBgElevated,
    '--shell-bg-e': token.colorFillQuaternary,
    '--shell-ghost': token.colorFillTertiary,
    '--shell-bd': token.colorBorderSecondary,
    '--shell-tx': token.colorText,
    '--shell-tx2': token.colorTextSecondary,
    '--shell-tx3': token.colorTextTertiary,
    '--shell-pri': token.colorPrimary,
    '--shell-ok': token.colorSuccess,
    '--shell-warn': token.colorWarning,
    '--shell-err': token.colorError,
    '--shell-err-bg': token.colorErrorBg,
    '--shell-test-bg': token.colorWarningBg,
    '--shell-live-bg': token.colorSuccessBg,
    '--shell-mono': token.fontFamilyCode,
    '--shell-shadow': token.boxShadowSecondary,
    '--shell-foot': dark ? 'var(--shell-foot-dark)' : 'var(--shell-foot-light)',
    '--shell-foot-tx': dark ? token.colorText : token.colorBgContainer,
    '--shell-tint': dark ? 'var(--shell-tint-dark)' : 'var(--shell-tint-light)',
    colorScheme: dark ? 'dark' : 'light',
  } as CSSProperties;
}

/** Demo pages exist only in the e2e build. The condition is fixed at build time. */
const DEMO_ENABLED = isDemoEnabled(import.meta.env.MODE);

/**
 * Menu data. The live menu comes from the route registry and the server's sidebar data.
 * Sample groups and sample agents appear only on the demo page (`/_demo/...`).
 * The server has no data for the agent list; the agent section is hidden in the live menu.
 */
function useShellNav(): {
  access: ShellAccess;
  accountKindFailed: boolean;
  nav: NavEntry[];
  agents: typeof sampleAgents;
  quickActions: QuickAction[];
  demo: boolean;
} {
  const navigation = useViewData()?.navigation;
  const { pathname } = useLocation();
  const demo = DEMO_ENABLED && isDemoPath(pathname);
  const [groups, setGroups] = useState<NavGroup[]>([]);
  // DocType names the server allows reading (G-94). The set is empty until the response arrives.
  // With an empty set, pages that need permission do not appear in the menu.
  const [probed, setProbed] = useState<ReadonlySet<string>>(() => new Set());
  // The page gate waits for the response. The connection the response came from is stored.
  // If there is no connection or permission endpoint, the gate does not wait and decides with an empty set.
  const [probedFrom, setProbedFrom] = useState<unknown>(null);
  // Is this a reseller account (AJA-945)? The decision comes from the customer list endpoint. The response source is stored too.
  // If the endpoint returns another error, the account is not treated as a reseller. The shell shows an error note instead.
  const [accountKind, setAccountKind] = useState<{
    from: unknown;
    kind: AccountKind | 'failed';
  } | null>(null);
  useEffect(() => {
    if (!navigation) return undefined;
    const ctrl = new AbortController();
    void navigation.loadSidebars(ctrl.signal).then((sidebars) => {
      if (!ctrl.signal.aborted) setGroups(navFromSidebars(sidebars));
    });
    navigation.loadReadable?.(requiredDocTypes, ctrl.signal).then(
      (readable) => {
        if (ctrl.signal.aborted) return;
        setProbed(readable);
        setProbedFrom(navigation);
      },
      // If permission data does not arrive, the set stays empty. The menu hides pages that need permission.
      () => {
        if (!ctrl.signal.aborted) setProbedFrom(navigation);
      },
    );
    navigation.loadAccountKind?.(ctrl.signal).then(
      (kind) => {
        if (!ctrl.signal.aborted) setAccountKind({ from: navigation, kind });
      },
      () => {
        if (!ctrl.signal.aborted) setAccountKind({ from: navigation, kind: 'failed' });
      },
    );
    return () => ctrl.abort();
  }, [navigation]);
  const kind = navigation && accountKind?.from === navigation ? accountKind.kind : null;
  // The server's sidebar groups have passed Frappe's permission filter (`resolve_sidebar`).
  // DocTypes in a group are therefore treated as readable. Module pages are probed via the definition endpoint.
  // For a reseller account the link type is treated as readable. The menu and page gate use this name with one rule.
  const readable = useMemo(
    () =>
      new Set([
        ...probed,
        ...groups.flatMap((g) => g.children.flatMap((c) => c.requires ?? [])),
        ...(kind === 'reseller' ? [RESELLER_LINK_DOCTYPE] : []),
      ]),
    [probed, groups, kind],
  );
  const permittedGroups = useMemo(
    () => permittedNav(groups, readable).filter((e): e is NavGroup => e.kind === 'group'),
    [groups, readable],
  );
  const nav = useMemo(
    () => (demo ? [...routeNav, ...sampleNav] : buildShellNav(permittedGroups, readable)),
    [demo, permittedGroups, readable],
  );
  // Quick actions pass the same filter as the menu. Sample requests appear only in the demo.
  const quickActions = useMemo(
    () => (demo ? samplePrompts : quickActionsFrom(permittedGroups)),
    [demo, permittedGroups],
  );
  const access = useMemo(
    () => ({
      ready:
        (!navigation?.loadReadable || probedFrom === navigation) &&
        (!navigation?.loadAccountKind || kind !== null),
      readable,
    }),
    [navigation, probedFrom, kind, readable],
  );
  return {
    access,
    accountKindFailed: kind === 'failed',
    nav,
    agents: demo ? sampleAgents : [],
    quickActions,
    demo,
  };
}

/** Sample workspaces for the demo page. Not used in the live panel. */
const DEMO_WORKSPACES: ShellWorkspaceData = {
  items: sampleWorkspaces,
  current: sampleWorkspaces[0]?.id ?? '',
};

/**
 * AI credit. In live use the number comes only from the server endpoint. With no endpoint or an empty response the counter is hidden.
 * Sample credit appears only on the demo page.
 */
function useShellCredit(demo: boolean): ShellCredit | null {
  const source = useViewData()?.credit;
  // The response is stored with the source it came from. When the source changes, the old number is not shown.
  const [loaded, setLoaded] = useState<{ from: unknown; value: ShellCredit | null }>({
    from: null,
    value: null,
  });
  useEffect(() => {
    if (demo || !source) return undefined;
    const ctrl = new AbortController();
    source.load(ctrl.signal).then(
      (value) => {
        if (!ctrl.signal.aborted) setLoaded({ from: source, value });
      },
      // If the request fails, the counter stays hidden. No made-up number is shown.
      () => undefined,
    );
    return () => ctrl.abort();
  }, [demo, source]);
  if (demo) return sampleCredit;
  return source && loaded.from === source ? loaded.value : null;
}

interface AppShellProps {
  children: ReactNode;
  /** Assist panel content. The content belongs to the `ai-studio` work. Without it, a short note appears. */
  assistant?: ReactNode;
}

/**
 * Application shell. The sidebar sits at the same DOM position on every screen.
 * On phones the sidebar becomes a drawer. This keeps state and focus across orientation changes.
 */
export function AppShell({ children, assistant }: AppShellProps) {
  const compact = useCompactLayout();
  const [variant, setVariant] = useState<SidebarVariant>(readVariant);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // The button that opened the menu. Focus returns to this button on close.
  const [opener, setOpener] = useState<'header' | 'menu' | 'search'>('header');
  const openerEl = useRef<HTMLElement | null>(null);
  const barRef = useRef<HTMLElement>(null);
  const [commandMode, setCommandMode] = useState<CommandMode>('ask');
  const menuBtn = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const topRef = useRef<HTMLElement>(null);
  const vars = useThemeVars();
  const { access, accountKindFailed, nav, agents, quickActions, demo } = useShellNav();
  const liveWorkspaces = useViewData()?.workspaces;
  const moduleEnvironment = useViewData()?.modules?.mode;
  const workspaces = demo ? DEMO_WORKSPACES : liveWorkspaces;
  const credit = useShellCredit(demo);
  const isDrawer = compact;
  const modalOpen = isDrawer && drawerOpen;
  const [assistOpen, setAssistOpen] = useState(false);
  const assistBtn = useRef<HTMLButtonElement>(null);
  const assistOpener = useRef<HTMLElement | null>(null);
  const assistPanelRef = useRef<HTMLDivElement>(null);
  const assistCloseRef = useRef<HTMLButtonElement>(null);
  const assistReturnFocus = useRef(false);
  // On phones the panel is a full-height dialog. The rest of the shell becomes non-interactive.
  const assistModal = isDrawer && assistOpen;
  const shellRef = useRef<HTMLDivElement>(null);
  // The phone panel does not cover the sample data note. The note sits outside and above the shell.
  // The note's visible height is the shell's top edge on screen. Without a note the value is 0.
  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!assistModal || !shell) return undefined;
    const property = '--shell-note-h';
    const measure = () =>
      shell.style.setProperty(property, `${Math.max(0, shell.getBoundingClientRect().top)}px`);
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
      shell.style.removeProperty(property);
    };
  }, [assistModal]);
  // A wrapping identity strip has no fixed height. Keep focused content below it.
  useLayoutEffect(() => {
    const header = topRef.current;
    if (!isDrawer || !header) return undefined;
    const root = document.documentElement;
    const property = '--shell-identity-height';
    const previous = root.style.getPropertyValue(property);
    const measure = () =>
      root.style.setProperty(property, `${header.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => {
      observer.disconnect();
      if (previous) root.style.setProperty(property, previous);
      else root.style.removeProperty(property);
    };
  }, [isDrawer]);

  const changeVariant = (v: SidebarVariant) => {
    setVariant(v);
    writeVariant(v);
  };

  const returnFocus = useRef(false);

  const closeAssist = useCallback(() => {
    assistReturnFocus.current = true;
    setAssistOpen(false);
  }, []);

  const toggleAssist = useCallback((opener?: HTMLElement | null) => {
    setAssistOpen((was) => {
      if (was) {
        assistReturnFocus.current = true;
        return false;
      }
      assistOpener.current = opener ?? assistBtn.current;
      return true;
    });
  }, []);

  const assistApi = useMemo<AssistPanelApi>(
    () => ({ open: assistOpen, toggle: toggleAssist, close: closeAssist }),
    [assistOpen, toggleAssist, closeAssist],
  );

  // When the panel opens, focus moves to the close button.
  useEffect(() => {
    if (assistOpen) assistCloseRef.current?.focus();
  }, [assistOpen]);

  // While the drawer or phone panel is open, the rest of the shell is non-interactive.
  // When the panel closes, focus returns to the button that opened it. The button is made interactive first.
  useLayoutEffect(() => {
    const drawer = drawerRef.current;
    for (const el of [mainRef.current, topRef.current, barRef.current]) {
      el?.toggleAttribute('inert', modalOpen || assistModal);
    }
    if (isDrawer) drawer?.toggleAttribute('inert', assistModal);
    else drawer?.removeAttribute('inert');
    if (!assistOpen && assistReturnFocus.current) {
      assistReturnFocus.current = false;
      const target = assistOpener.current?.isConnected ? assistOpener.current : assistBtn.current;
      target?.focus();
    }
  }, [assistOpen, assistModal, modalOpen, isDrawer]);

  const closeDrawer = useCallback(() => {
    returnFocus.current = true;
    setDrawerOpen(false);
  }, []);

  const openDrawer = (kind: 'header' | 'menu' | 'search', el: HTMLElement) => {
    openerEl.current = el;
    setOpener(kind);
    if (kind === 'search') setCommandMode('search');
    setDrawerOpen(true);
  };

  // While the drawer is open, everything outside it is non-interactive.
  // On close, focus returns to the menu button. The button must be made interactive first.
  // `inert` is set in the effect above. This effect runs after it.
  useLayoutEffect(() => {
    if (!modalOpen && returnFocus.current) {
      returnFocus.current = false;
      const target = openerEl.current?.isConnected ? openerEl.current : menuBtn.current;
      target?.focus();
    }
  }, [modalOpen]);

  // On open, focus moves into the drawer. If focus is already inside, it stays put.
  useEffect(() => {
    if (!modalOpen) return;
    const d = drawerRef.current;
    if (!d || d.contains(document.activeElement)) return;
    // The "Ara" (search) button opens the command field. Other buttons open (focus) the close button.
    const field =
      opener === 'search' ? d.querySelector<HTMLElement>('.shell-sender textarea') : null;
    (field ?? d.querySelector<HTMLElement>('[data-drawer-close]'))?.focus();
  }, [modalOpen, opener]);

  useEffect(() => {
    if (!modalOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) closeDrawer();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modalOpen, closeDrawer]);

  // The top bar shows the open workspace's name. Without data the name is hidden.
  const ws = workspaces?.items.find((w) => w.id === workspaces.current) ?? workspaces?.items[0];

  return (
    <FocusDimProvider>
      <AssistPanelContext.Provider value={assistApi}>
        <div
          ref={shellRef}
          className="shell"
          style={vars}
          data-layout={isDrawer ? 'compact' : 'wide'}
          data-variant={variant}
          data-assist={assistOpen ? 'open' : 'closed'}
        >
          <header ref={topRef} className="shell-identity" aria-label={workspaceText.identity}>
            {isDrawer && (
              <button
                ref={menuBtn}
                type="button"
                className="shell-iconbtn"
                aria-label={t.nav.openMenu}
                aria-expanded={drawerOpen && opener === 'header'}
                aria-controls="shell-drawer"
                onClick={(e) => openDrawer('header', e.currentTarget)}
              >
                <List aria-hidden="true" />
              </button>
            )}
            <WorkspaceIdentity
              tenant={ws?.name}
              environment={demo ? 'example' : moduleEnvironment}
              mode={commandMode}
            />
            {/* The panel opens only on click, touch, Enter and Space. Mouse hover does not open it. */}
            <button
              ref={assistBtn}
              type="button"
              className="shell-iconbtn shell-assist-btn"
              aria-label={t.assist.open}
              aria-expanded={assistOpen}
              aria-controls={ASSIST_PANEL_ID}
              onClick={(e) => toggleAssist(e.currentTarget)}
            >
              <Sparkle aria-hidden="true" />
            </button>
          </header>
          {isDrawer && (
            <div
              className="shell-backdrop"
              data-open={drawerOpen ? 'true' : 'false'}
              aria-hidden="true"
              onClick={closeDrawer}
            />
          )}
          <div
            ref={drawerRef}
            id="shell-drawer"
            className="shell-aside"
            data-open={isDrawer ? (drawerOpen ? 'true' : 'false') : undefined}
            {...(isDrawer
              ? { role: 'dialog', 'aria-modal': drawerOpen, 'aria-label': t.nav.drawer }
              : { role: 'complementary' })}
          >
            {isDrawer && (
              <button
                type="button"
                className="shell-iconbtn shell-drawer-close"
                data-drawer-close=""
                aria-label={t.nav.closeMenu}
                onClick={closeDrawer}
              >
                <X aria-hidden="true" />
              </button>
            )}
            <Sidebar
              variant={variant}
              onVariantChange={changeVariant}
              nav={nav}
              agents={agents}
              workspaces={workspaces}
              quickActions={quickActions}
              credit={credit}
              compact={isDrawer}
              onNavigate={isDrawer ? closeDrawer : undefined}
              grouped={!demo}
              commandMode={commandMode}
              onCommandModeChange={setCommandMode}
            />
          </div>
          <main ref={mainRef} className="shell-main" id="main">
            {accountKindFailed && (
              <div className="shell-hd-err" role="alert">
                <WarningCircle aria-hidden="true" />
                <span>{t.pages.accountKindError}</span>
              </div>
            )}
            <ShellAccessContext.Provider value={access}>{children}</ShellAccessContext.Provider>
          </main>
          <AssistPanel
            open={assistOpen}
            compact={isDrawer}
            onClose={closeAssist}
            panelRef={assistPanelRef}
            closeRef={assistCloseRef}
          >
            {assistant}
          </AssistPanel>
          {isDrawer && (
            <BottomBar
              ref={barRef}
              open={drawerOpen}
              opener={opener === 'header' ? null : opener}
              onMenu={(e) => openDrawer('menu', e.currentTarget)}
              onSearch={(e) => openDrawer('search', e.currentTarget)}
            />
          )}
        </div>
      </AssistPanelContext.Provider>
    </FocusDimProvider>
  );
}

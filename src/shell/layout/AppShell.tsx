import { List, Question, Sparkle, WarningCircle, X } from '@phosphor-icons/react';
import { theme } from 'antd';
import type { CSSProperties, ReactNode } from 'react';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';

import { isDemoEnabled, isDemoPath } from '@/app/demo-mode';
import { RESELLER_LINK_DOCTYPE } from '@/modules';

import { type ShellAccess, ShellAccessContext } from '../access';
import { ASSIST_PANEL_ID, AssistPanel, type AssistPanelApi, AssistPanelContext } from '../assist';
import { FocusDimProvider } from '../focus-dim';
import type { HelpApi, HelpTarget } from '../help/context';
import { HelpContext, readSelfHelp, writeSelfHelp } from '../help/context';
import { HelpMarker } from '../help/HelpMarker';
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
import { helpDockQuery, shellCssVars } from '../tokens';
import type { AccountKind, ShellCredit, ShellWorkspaceData } from '../view-data';
import { useViewData } from '../view-data';
import { workspaceText } from '../workspaceMessages';
import { BottomBar } from './BottomBar';
import { useCompactLayout, useMedia } from './useMedia';

const STORAGE_KEY = 'atonota.shell.sidebar';

// G-137: yardım paneli ilk yüke girmez. Kod kulakçık ilk kez açılınca iner.
// Kulakçığa fare gelince ya da odak gelince indirme önceden başlar.
const loadHelpPanel = () => import('../help/HelpPanel');
const HelpPanel = lazy(() => loadHelpPanel().then((m) => ({ default: m.HelpPanel })));
const preloadHelpPanel = () => {
  void loadHelpPanel();
};

/**
 * Panel kodu inmeden önce boş ve gizli yer tutucu durur.
 * Böylece kulakçığın `aria-controls` başvurusu her zaman var olan bir öğeyi gösterir.
 */
const helpPlaceholder = <aside id="shell-help" className="shell-help" hidden />;

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
    // Tarayıcı saklamaya izin vermiyor. Tercih yalnız bu oturumda kalır.
  }
}

/** Kabuk CSS değişkenleri antd tokenlarından ve kaynak dosyadan gelir. */
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

/** Deneme sayfaları yalnız e2e derlemesinde vardır. Koşul derleme zamanında sabittir. */
const DEMO_ENABLED = isDemoEnabled(import.meta.env.MODE);

/**
 * Menü verisi. Canlı menü rota kaydından ve sunucunun sidebar verisinden gelir.
 * Örnek gruplar ve örnek ajanlar yalnız deneme sayfasında (`/_demo/...`) görünür.
 * Ajan listesi için sunucuda veri yoktur; canlı menüde ajan bölümü gizlidir.
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
  // Sunucunun okumaya izin verdiği DocType adları (G-94). Yanıt gelene kadar küme boştur.
  // Boş kümede yetki isteyen sayfa menüde görünmez.
  const [probed, setProbed] = useState<ReadonlySet<string>>(() => new Set());
  // Sayfa kapısı yanıtı bekler. Yanıtın hangi bağlantıdan geldiği saklanır.
  // Bağlantı ya da yetki ucu yoksa kapı beklemez ve boş kümeyle karar verir.
  const [probedFrom, setProbedFrom] = useState<unknown>(null);
  // Bayi hesabı mı (AJA-945)? Karar müşteri listesi ucundan gelir. Yanıtın kaynağı da saklanır.
  // Uç başka hata verirse hesap bayi sayılmaz. Kabuk bunun yerine hata notu gösterir.
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
      // Yetki bilgisi gelmezse küme boş kalır. Menü yetki isteyen sayfayı göstermez.
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
  // Sunucunun sidebar grupları Frappe'nin izin süzgecinden geçmiştir (`resolve_sidebar`).
  // Gruptaki DocType'lar bu yüzden okunabilir sayılır. Modül sayfaları tanım ucuyla denenir.
  // Bayi hesabında bağ türü okunabilir sayılır. Menü ve sayfa kapısı bu adı tek kuralla kullanır.
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
  // Hızlı eylemler menüyle aynı süzgeçten geçer. Örnek istekler yalnız denemede.
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

/** Deneme sayfasının örnek çalışma alanları. Canlı panelde kullanılmaz. */
const DEMO_WORKSPACES: ShellWorkspaceData = {
  items: sampleWorkspaces,
  current: sampleWorkspaces[0]?.id ?? '',
};

/**
 * AI kredisi. Canlıda sayı yalnız sunucu ucundan gelir. Uç yoksa ya da yanıt boşsa sayaç gizlidir.
 * Örnek kredi yalnız deneme sayfasında görünür.
 */
function useShellCredit(demo: boolean): ShellCredit | null {
  const source = useViewData()?.credit;
  // Yanıt hangi kaynaktan geldiyse onunla saklanır. Kaynak değişince eski sayı görünmez.
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
      // İstek başarısızsa sayaç gizli kalır. Uydurma sayı gösterilmez.
      () => undefined,
    );
    return () => ctrl.abort();
  }, [demo, source]);
  if (demo) return sampleCredit;
  return source && loaded.from === source ? loaded.value : null;
}

interface AppShellProps {
  children: ReactNode;
  /** Yardımcı panelin içeriği. İçerik `ai-studio` işinindir. Yoksa kısa bir not görünür. */
  assistant?: ReactNode;
}

/**
 * Uygulama kabuğu. Sidebar her ekranda aynı DOM yerindedir.
 * Telefonda sidebar çekmece olur. Böylece yön değişiminde durum ve odak korunur.
 */
export function AppShell({ children, assistant }: AppShellProps) {
  const compact = useCompactLayout();
  const [variant, setVariant] = useState<SidebarVariant>(readVariant);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Menüyü açan düğme. Odak kapanınca bu düğmeye döner.
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
  // Telefonda panel tam boy iletişim kutusudur. Geri kalan kabuk etkileşime kapanır.
  const assistModal = isDrawer && assistOpen;
  const shellRef = useRef<HTMLDivElement>(null);
  // Telefon paneli "Örnek veri" notunu örtmez. Not kabuğun dışında ve üstündedir.
  // Notun görünen yüksekliği kabuğun ekrandaki üst kenarıdır. Not yoksa değer 0 olur.
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

  // G-137 yardım paneli. AI paneliyle aynı sağ yuvayı kullanır.
  const dockFits = useMedia(helpDockQuery(variant === 'rail'));
  const helpMode = !compact && dockFits ? 'dock' : 'drawer';
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTarget, setHelpTarget] = useState<HelpTarget>({ kind: 'page' });
  const [selfHelp, setSelfHelp] = useState(readSelfHelp);
  const helpTab = useRef<HTMLButtonElement>(null);
  // Panel tembel yüklenir. Öğe DOM'a girince odak etkisi yeniden çalışsın diye durumda tutulur.
  const [helpPanel, setHelpPanel] = useState<HTMLElement | null>(null);
  const [helpLoaded, setHelpLoaded] = useState(false);
  const helpTrigger = useRef<HTMLElement | null>(null);
  const helpReturn = useRef(false);
  const helpModal = helpOpen && helpMode === 'drawer';

  const openHelp = useCallback((target: HelpTarget, trigger: HTMLElement | null) => {
    helpTrigger.current = trigger;
    setHelpLoaded(true);
    setHelpTarget(target);
    setAssistOpen(false);
    setHelpOpen(true);
  }, []);

  const closeHelp = useCallback(() => {
    helpReturn.current = true;
    setHelpOpen(false);
  }, []);

  const changeSelfHelp = useCallback((on: boolean) => {
    setSelfHelp(on);
    writeSelfHelp(on);
  }, []);

  const helpApi = useMemo<HelpApi>(() => ({ selfHelp, open: openHelp }), [selfHelp, openHelp]);

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
      setHelpOpen(false);
      return true;
    });
  }, []);

  const assistApi = useMemo<AssistPanelApi>(
    () => ({ open: assistOpen, toggle: toggleAssist, close: closeAssist }),
    [assistOpen, toggleAssist, closeAssist],
  );

  // Panel açılınca odak kapatma düğmesine geçer.
  useEffect(() => {
    if (assistOpen) assistCloseRef.current?.focus();
  }, [assistOpen]);

  // Çekmece, telefon yardımcı paneli ya da yardım çekmecesi açıkken geri kalan kabuk etkileşime kapanır.
  // Panel kapanınca odak paneli açan öğeye döner. Öğe önce etkileşime açılır.
  useLayoutEffect(() => {
    const drawer = drawerRef.current;
    for (const el of [mainRef.current, topRef.current, barRef.current]) {
      el?.toggleAttribute('inert', modalOpen || assistModal || helpModal);
    }
    if (isDrawer) drawer?.toggleAttribute('inert', assistModal || helpModal);
    else drawer?.toggleAttribute('inert', helpModal);
    helpTab.current?.toggleAttribute('inert', modalOpen || assistModal || helpModal);
    if (!assistOpen && assistReturnFocus.current) {
      assistReturnFocus.current = false;
      const target = assistOpener.current?.isConnected ? assistOpener.current : assistBtn.current;
      target?.focus();
    }
  }, [assistOpen, assistModal, modalOpen, helpModal, isDrawer]);

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

  // Çekmece ya da yardım paneli kapanınca odak açan öğeye döner.
  // `inert` yukarıdaki etkide kurulur. Bu etki ondan sonra çalışır.
  useLayoutEffect(() => {
    if (!modalOpen && returnFocus.current) {
      returnFocus.current = false;
      const target = openerEl.current?.isConnected ? openerEl.current : menuBtn.current;
      target?.focus();
    }
    // Panel kapanınca odak paneli açan öğeye döner: kulakçık ya da yardım işareti.
    if (!helpOpen && helpReturn.current) {
      helpReturn.current = false;
      const back = helpTrigger.current;
      (back?.isConnected ? back : helpTab.current)?.focus();
    }
  }, [modalOpen, helpModal, helpOpen]);

  // Panel açılınca odak panele taşınır. Yerleşim değişince odak yerinde kalır.
  useEffect(() => {
    if (!helpOpen) return;
    const p = helpPanel;
    if (!p || p.contains(document.activeElement)) return;
    p.querySelector<HTMLElement>('[data-help-close]')?.focus();
  }, [helpOpen, helpTarget, helpPanel]);

  useEffect(() => {
    if (!helpOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) closeHelp();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [helpOpen, closeHelp]);

  // Açılınca odak çekmeceye geçer. Odak zaten içerideyse yerinde kalır.
  useEffect(() => {
    if (!modalOpen) return;
    const d = drawerRef.current;
    if (!d || d.contains(document.activeElement)) return;
    // "Ara" düğmesi komut alanını açar. Öteki düğmeler kapatma düğmesini açar.
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

  // Üst çubuk açık çalışma alanının adını yazar. Veri yoksa ad gizlidir.
  const ws = workspaces?.items.find((w) => w.id === workspaces.current) ?? workspaces?.items[0];

  return (
    <FocusDimProvider>
      <AssistPanelContext.Provider value={assistApi}>
        <HelpContext.Provider value={helpApi}>
          <div
            ref={shellRef}
            className="shell"
            style={vars}
            data-layout={isDrawer ? 'compact' : 'wide'}
            data-variant={variant}
            data-assist={assistOpen ? 'open' : 'closed'}
            data-help={helpOpen ? helpMode : 'closed'}
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
              {/* Panel yalnız tıklama, dokunma, Enter ve Space ile açılır. Fare üstüne gelmek açmaz. */}
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
              {selfHelp && (
                <div className="shell-help-bar">
                  <HelpMarker target={{ kind: 'page' }} />
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
            {helpLoaded ? (
              <Suspense fallback={helpPlaceholder}>
                <HelpPanel
                  ref={setHelpPanel}
                  open={helpOpen}
                  mode={helpMode}
                  target={helpTarget}
                  selfHelp={selfHelp}
                  onSelfHelpChange={changeSelfHelp}
                  onClose={closeHelp}
                  tasks={quickActions}
                />
              </Suspense>
            ) : (
              helpPlaceholder
            )}
            <button
              ref={helpTab}
              type="button"
              className="shell-help-tab"
              aria-expanded={helpOpen}
              aria-controls="shell-help"
              onPointerEnter={preloadHelpPanel}
              onFocus={preloadHelpPanel}
              onClick={() => (helpOpen ? closeHelp() : openHelp({ kind: 'page' }, helpTab.current))}
            >
              <Question aria-hidden="true" />
              <span className="shell-help-tab-t">{t.help.tab}</span>
            </button>
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
        </HelpContext.Provider>
      </AssistPanelContext.Provider>
    </FocusDimProvider>
  );
}

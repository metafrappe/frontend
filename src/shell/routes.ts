/**
 * Route registry. All of the app's page routes are here.
 *
 * RULE: each task adds only its own row to `lazyRoutes` for its own page.
 * Another task's row is not changed. Collection paths (`collectionRoutes`) belong to the shell.
 * The row format is fixed. There are four fields; no other field is added:
 *
 *   {
 *     path: '/satis/:doctype',             // react-router path, starts with "/"
 *     label: 'Sales',                      // menu label, short
 *     icon: ShoppingCart,                  // Phosphor icon, weight regular
 *     load: () => import('@/modules/...'), // lazy loader
 *   },
 *
 * Rules:
 * - The loader returns a module whose default export is a component.
 * - A page module does not import this file. Addresses come from `paths.ts`.
 * - Parameterless paths (without ":") appear in the sidebar menu. `/_demo/` paths do not.
 * - Paths are unique. `routes.test.ts` checks the format and uniqueness.
 * - This file is owned by the `shell` task. Other tasks only add their own row.
 */
import type { Icon } from '@phosphor-icons/react';
import {
  Buildings,
  CalendarCheck,
  FileText,
  Flask,
  House,
  PlugsConnected,
  Robot,
  Rows,
  ShieldCheck,
  Sparkle,
  SquaresFour,
  UserCircle,
  UsersThree,
} from '@phosphor-icons/react';
import type { ComponentType } from 'react';
import { createElement, lazy } from 'react';

import { DEMO_PATH_PREFIX } from '@/app/demo-mode';

import type { ModuleRegistration } from '@/modules';
import { moduleRegistrations } from '@/modules';
import type { RouteObject } from 'react-router-dom';

export interface RouteEntry {
  path: string;
  label: string;
  icon: Icon;
  load: () => Promise<{ default: ComponentType }>;
}

/**
 * Feature flags. A disabled flag's row does not enter the route list.
 * A disabled row's address does not fall through to the collection page either. See `reservedFirstSegments`.
 */
export const shellFeatures = {
  /** AI Studio is on this branch. The loader points to `src/ai/studio/AiStudioPage.tsx`. */
  aiStudio: true,
};

/** The AI Studio row. If the flag is off, it is not in the list. */
export const aiStudioRoute: RouteEntry = {
  path: '/panel/ai',
  label: 'AI Studio',
  icon: Sparkle,
  load: () => import('@/ai/studio/AiStudioPage'),
};

/**
 * Lazy loader for a module page.
 * The page and `ModuleBoundary` are requested only when the loader is called.
 * The page opens inside `ModuleProvider`.
 */
export function modulePage(load: ModuleRegistration['load'], path?: string): RouteEntry['load'] {
  return () =>
    Promise.all([load(), import('./pages/ModuleBoundary')]).then(([page, boundary]) => {
      const Page = page.default;
      const { ModuleBoundary } = boundary;
      // The path selects the page gate's rule (G-94, G-169). See `moduleAllowed`.
      return {
        default: () => createElement(ModuleBoundary, { page: Page, ...(path ? { path } : {}) }),
      };
    });
}

/** Module icons. The registry has no icon field. An unknown module gets the generic icon. */
const moduleIcons: Record<string, Icon> = {
  account: UserCircle,
  administration: ShieldCheck,
  'ai-providers': PlugsConnected,
  hr: CalendarCheck,
  'site-plan': Buildings,
  'ai-operations': Robot,
  customers: UsersThree,
};

/** The `modules` task's entries (`src/modules/registry.ts`). The shell only converts the format. */
export const moduleRoutes: RouteEntry[] = moduleRegistrations.map((m) => ({
  path: m.path,
  label: m.label.tr,
  icon: moduleIcons[m.id] ?? SquaresFour,
  load: modulePage(m.load, m.path),
}));

/**
 * Lazy route list. Each task adds only its own row here.
 * These rows are added before the collection paths and match before them.
 */
export const lazyRoutes: RouteEntry[] = [
  { path: '/', label: 'Ana sayfa', icon: House, load: () => import('./pages/HomePage') },
  {
    path: '/asistan',
    label: 'Asistan',
    icon: Sparkle,
    load: () => import('./pages/AssistantPage'),
  },
  { path: '/ajanlar/:id', label: 'AI ajanı', icon: Robot, load: () => import('./pages/AgentPage') },
  ...moduleRoutes,
  ...(shellFeatures.aiStudio ? [aiStudioRoute] : []),
  // Test pages exist only in the e2e build. The condition is constant at build time.
  // A function call is not used: the compiler would not fold the call to a constant and the pages would reach production.
  // They do not appear in the menu (`menuEntries`).
  ...(import.meta.env.MODE === 'e2e'
    ? [
        {
          path: '/_demo/shell',
          label: 'Kabuk denemesi',
          icon: Flask,
          load: () => import('./pages/DemoPage'),
        },
        {
          path: '/_demo/controls',
          label: 'Kontrol denemesi',
          icon: SquaresFour,
          load: () => import('@/components/controls/demo/ControlsDemoPage'),
        },
        {
          path: '/_demo/genui',
          label: 'Yüzey denemesi',
          icon: Flask,
          load: () => import('@/genui/demo/GenuiDemoPage'),
        },
      ]
    : []),
];

/**
 * Collection paths. These rows are owned by the `shell` task. Other tasks do not add rows here.
 * The list route renders the `views-collection` task's `CollectionView` component.
 * The record route will be wired to the `views-record` task's component once it arrives.
 */
export const collectionRoutes: RouteEntry[] = [
  {
    path: '/:module/:doctype',
    label: 'Kayıtlar',
    icon: Rows,
    load: () => import('./pages/CollectionRoute'),
  },
  {
    path: '/:module/:doctype/:name',
    label: 'Kayıt',
    icon: FileText,
    load: () => import('./pages/RecordPage'),
  },
];

/** All routes, in match order. */
export const routeRegistry: RouteEntry[] = [...lazyRoutes, ...collectionRoutes];

/**
 * These first address segments never fall through to a collection or record page.
 * `_demo` is for sample pages. `panel` is for app pages.
 * Pages under these prefixes open only via their own row in `lazyRoutes`.
 */
export const reservedFirstSegments: readonly string[] = ['_demo', 'panel'];

export function isReservedSegment(segment: string | undefined): boolean {
  return segment !== undefined && reservedFirstSegments.includes(segment);
}

/**
 * Converts entries into router entries. The page is lazy-loaded with `React.lazy`.
 * The shell renders immediately. While the page loads, only the content area waits.
 * The router's own `lazy` field is not used: on first load it would make the shell wait too.
 */
export function toRouteObjects(entries: RouteEntry[]): RouteObject[] {
  return entries.map((e) => ({ path: e.path, Component: lazy(e.load) }));
}

/** Entries shown in the menu: parameterless paths. Test pages (`/_demo/`) do not appear in the menu. */
export function menuEntries(entries: RouteEntry[]): RouteEntry[] {
  return entries.filter((e) => !e.path.includes(':') && !e.path.startsWith(DEMO_PATH_PREFIX));
}

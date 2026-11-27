/**
 * Sidebar menu. The menu only shows pages that can be opened.
 *
 * 1. Parameterless pages from the route registry come first. Module entries are in this list too.
 * 2. Then come the sidebar groups from the server's boot data. Groups lead to list pages.
 * 3. All links pass through the `permittedNav` filter (G-94). An unreadable page does not appear in the menu.
 *
 * Sample groups (`sampleNav`) appear only on the test page. The live menu has no made-up counts.
 */
import { FileText, Rows } from '@phosphor-icons/react';

import { moduleRegistrations, RESELLER_LINK_DOCTYPE } from '@/modules';

import { routes } from './paths';
import { isReservedSegment, menuEntries, routeRegistry } from './routes';
import type { NavEntry, NavGroup, NavLeaf } from './sampleData';
import type { ShellSidebar } from './view-data';
import { workspaceText } from './workspaceMessages';

/** Menu links from the route registry. `menuEntries` removes the test pages. */
/** Module path and the DocType names that need read permission. Source: `src/modules/registry.ts`. */
const moduleRules = new Map(
  moduleRegistrations.map((m) => [
    m.path,
    { requires: m.requires ?? [], excludes: m.excludes ?? [] },
  ]),
);

/**
 * DocType names the menu asks the definition endpoint about: `requires` and `excludes`. Each name appears once.
 * The reseller link type is not in this list (AJA-945). The definition endpoint returns 403 for this type to resellers too.
 * The customer list endpoint identifies a reseller account (`loadAccountKind`).
 */
export const requiredDocTypes: readonly string[] = [
  ...new Set(moduleRegistrations.flatMap((m) => [...(m.requires ?? []), ...(m.excludes ?? [])])),
].filter((doctype) => doctype !== RESELLER_LINK_DOCTYPE);

export const routeNav: NavEntry[] = menuEntries(routeRegistry).map((r): NavEntry => {
  const { requires = [], excludes = [] } = moduleRules.get(r.path) ?? {};
  return {
    kind: 'link',
    id: `route-${r.path}`,
    label: r.label,
    to: r.path,
    icon: r.icon,
    ...(requires.length > 0 ? { requires } : {}),
    ...(excludes.length > 0 ? { excludes } : {}),
  };
});

/** Link rule: all required types are readable and none of the excluding types is readable. */
function leafAllowed(
  rule: { requires?: readonly string[]; excludes?: readonly string[] },
  readable: ReadonlySet<string>,
): boolean {
  return (
    (rule.requires ?? []).every((d) => readable.has(d)) &&
    !(rule.excludes ?? []).some((d) => readable.has(d))
  );
}

/**
 * Page gate (G-94, G-169). A module page opens under the same rule as the menu.
 * A non-module path passes this gate. Example: a reseller account cannot open the `/administration` page.
 */
export function moduleAllowed(path: string, readable: ReadonlySet<string>): boolean {
  const rule = moduleRules.get(path);
  return !rule || leafAllowed(rule, readable);
}

/**
 * The menu's permission filter (G-94). A link stays only if all the DocTypes it requires are readable.
 * If one of the excluding types is readable, the link is dropped (G-169). Example: a reseller does not see tenant pages.
 * A group with no links left is dropped. A link that needs no permission always stays.
 * Example: if `readable` lacks `Leave Application`, the Leave requests item is hidden.
 */
export function permittedNav(
  entries: readonly NavEntry[],
  readable: ReadonlySet<string>,
): NavEntry[] {
  const allowed = (l: NavLeaf) => leafAllowed(l, readable);
  return entries.flatMap((e): NavEntry[] => {
    if (e.kind === 'link') return allowed(e) ? [e] : [];
    const children = e.children.filter(allowed);
    return children.length > 0 ? [{ ...e, children }] : [];
  });
}

/**
 * Converts the server's sidebar data into menu groups.
 * A group with a reserved prefix (`_demo`, `panel`) or without links does not enter the menu.
 * Each DocType list appears once in the menu. The first link stays; later ones are dropped (AJA-807).
 * Example: if `User` is in both Setup and Users, it stays only in Setup.
 */
export function navFromSidebars(sidebars: readonly ShellSidebar[]): NavGroup[] {
  const seen = new Set<string>();
  return sidebars
    .filter((g) => !isReservedSegment(g.module))
    .map((g): NavGroup => ({
      kind: 'group',
      id: `sidebar-${g.id}`,
      label: g.label,
      icon: Rows,
      children: g.links.flatMap((l) => {
        if (seen.has(l.doctype)) return [];
        seen.add(l.doctype);
        return [
          {
            kind: 'link',
            id: `sidebar-${g.id}-${l.doctype}`,
            label: l.label,
            to: routes.collection(g.module, l.doctype),
            icon: FileText,
            requires: [l.doctype],
          },
        ];
      }),
    }))
    .filter((g) => g.children.length > 0);
}

/** Live menu: route links and server groups. Both pass through the permission filter. */
export function buildShellNav(
  groups: readonly NavGroup[],
  readable: ReadonlySet<string>,
): NavEntry[] {
  return permittedNav([...routeNav, ...groups], readable);
}

export interface NavigationSection {
  id: 'review' | 'people' | 'management';
  label: string;
  children: NavLeaf[];
}

/** Presentation only: callers supply the result of the existing permission filter. */
export function groupNavigation(entries: readonly NavEntry[]): NavigationSection[] {
  const leaves = entries.flatMap((entry) => (entry.kind === 'link' ? [entry] : entry.children));
  const sections: NavigationSection[] = [
    { id: 'review', label: workspaceText.review, children: [] },
    { id: 'people', label: workspaceText.people, children: [] },
    { id: 'management', label: workspaceText.management, children: [] },
  ];
  const seen = new Set<string>();
  const hasLeavePage = leaves.some((leaf) => leaf.to === '/hr');
  const reviewPaths = new Set(['/', '/asistan', '/panel/ai', '/ai-operations']);
  for (const leaf of leaves) {
    // The dedicated leave screen and its generic collection represent the same work.
    if (
      hasLeavePage &&
      leaf.to.split('/').at(-1) === encodeURIComponent('Leave Application') &&
      leaf.requires?.length === 1 &&
      leaf.requires[0] === 'Leave Application'
    )
      continue;
    const path = leaf.to.replace(/\/+$/, '') || '/';
    if (seen.has(path)) continue;
    seen.add(path);
    const sectionId = reviewPaths.has(path)
      ? 'review'
      : path === '/hr' || path.startsWith('/hr/')
        ? 'people'
        : 'management';
    sections.find((section) => section.id === sectionId)?.children.push(leaf);
  }
  return sections.filter((section) => section.children.length > 0);
}

/** Quick action. With `to` it goes to the page. With `prompt` it sends the request to the assistant. */
export interface QuickAction {
  key: string;
  label: string;
  to?: string;
  prompt?: string;
}

/** At most this many quick actions appear below the command field. */
export const QUICK_ACTION_LIMIT = 3;

/**
 * Quick actions come from the server's sidebar groups.
 * The shell first passes the groups through the `permittedNav` filter. The menu and quick actions use the same filter.
 * So a page the user cannot open never becomes a quick action. Without data the list is empty.
 */
export function quickActionsFrom(groups: readonly NavGroup[], limit = QUICK_ACTION_LIMIT) {
  return groups
    .flatMap((g) => g.children)
    .slice(0, limit)
    .map((l): QuickAction => ({ key: l.id, label: l.label, to: l.to }));
}

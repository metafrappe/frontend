import { createElement, lazy } from 'react';

import type { ApiClient } from '@/api';
import type {
  RecordAddress,
  ShellAccount,
  ShellSidebar,
  ShellViewData,
  ShellWorkspaceData,
} from '@/shell/view-data';
import type { CollectionSource } from '@/views/collection/source';

// This file is in the initial-load chunk. The collection source and definition builder must not be in the initial load.
// The chain is fetched via `import()` only when the list route makes its first request (orchestrator addendum: initial load).
// The record adapter is likewise fetched only with the record route (`RecordRoute` lazy chunk).
const loadCollectionSource = () => import('@/views/collection/source');

/**
 * Converts a URL segment to a Frappe DocType name.
 * Example: `sales-invoice` -> `Sales Invoice`.
 */
export function doctypeFromSlug(slug: string): string {
  return decodeURIComponent(slug)
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

type Bootstrap = Awaited<ReturnType<ApiClient['getBootstrap']>>;
type BootstrapSidebar = Bootstrap['sidebars'][number];

/**
 * Converts a module name to a URL segment. Example: `Selling` -> `selling`, `Site Plan` -> `site-plan`.
 * The menu group and record link use the same conversion, so the URL matches the group in the menu.
 */
export function moduleSlug(name: string): string {
  // Locale-independent lowercasing (G-132): the Turkish rule would turn the leading `I` of `Integrations` into a dotless i (U+0131).
  // `toLowerCase` is locale-independent. The URL segment does not vary with the user's language.
  return name.trim().toLowerCase().split(/\s+/).filter(Boolean).join('-');
}

const truthy = (v: number | boolean | null | undefined) => v === true || v === 1;

/**
 * Converts the sidebar rows in the bootstrap data into menu groups.
 * Only DocType links are taken; the list route opens only those. Hidden rows are skipped.
 * A type that cannot be converted back from the URL to the same name is skipped; its link would open another type.
 */
function toShellSidebar(sidebar: BootstrapSidebar): ShellSidebar | null {
  const data = sidebar.data;
  const links = (data.items ?? []).flatMap((item) => {
    const doctype = item.link_to?.trim();
    if (item.link_type !== 'DocType' || !doctype || truthy(item.hidden)) return [];
    if (doctypeFromSlug(encodeURIComponent(doctype)) !== doctype) return [];
    return [{ label: item.label?.trim() || doctype, doctype }];
  });
  const module = moduleSlug(data.module ?? sidebar.name);
  if (links.length === 0 || !module) return null;
  return { id: sidebar.name, label: data.label?.trim() || sidebar.name, module, links };
}

/** The reseller's list of linked customers. The endpoint returns 200 only for reseller roles (G-169, G-170). */
const RESELLER_PROBE_PATH = '/api/method/platform_core.api.reseller.list_customers';

// The record view is fetched in its own chunk; it loads only when the record route opens.
const RecordRoute = lazy(() => import('./RecordRoute'));

/**
 * Wires the shell's list and record routes to the shared API client. The shell does not create its own client.
 * The record route uses the same client: site root, CSRF store and session expiry handling are shared.
 */
export function createShellViewData(
  api: Pick<ApiClient, 'getDocType' | 'listDocuments' | 'frappeDocument' | 'getBootstrap'>,
): ShellViewData {
  function Record(address: RecordAddress) {
    return createElement(RecordRoute, { ...address, api });
  }
  // The shared wiring from the `views-collection` work forwards list requests to the server.
  // The wiring is set up once, on the first request.
  let pending: Promise<CollectionSource> | undefined;
  const source: CollectionSource = {
    async list(request, signal) {
      pending ??= loadCollectionSource().then((module) => module.createApiSource(api));
      return (await pending).list(request, signal);
    },
  };
  return {
    collection: {
      async loadDefinition({ doctype }, signal) {
        const [result, module] = await Promise.all([
          api.getDocType(doctypeFromSlug(doctype), undefined, { signal }),
          loadCollectionSource(),
        ]);
        if (result.status !== 'fresh') throw new Error('DocType bilgisi alınamadı.');
        // The list title is the DocType's display name. The contract has no separate display name; the name is it.
        return module.createDefinition(result.meta, { label: result.meta.schema.name });
      },
      source,
      title: ({ doctype }) => doctypeFromSlug(doctype),
    },
    navigation: {
      // The menu never shows made-up groups: with no data or a failed request the list is empty.
      async loadSidebars(signal) {
        try {
          const bootstrap = await api.getBootstrap({ signal });
          return (bootstrap.sidebars ?? []).flatMap((s) => toShellSidebar(s) ?? []);
        } catch {
          return [];
        }
      },
      // The definition endpoint returns 403 for a type without read permission (`platform_core.shell.metadata`).
      // A type that gets a response counts as readable. An error or abort means not readable.
      async loadReadable(doctypes, signal) {
        const results = await Promise.all(
          doctypes.map((doctype) =>
            api.getDocType(doctype, undefined, { signal }).then(
              () => doctype,
              () => null,
            ),
          ),
        );
        return new Set(results.filter((d): d is string => d !== null));
      },
      // The customer list endpoint identifies a reseller account (AJA-945). The definition endpoint also returns 403 to resellers for the link type.
      // 200 means reseller, an empty list included. 403 means tenant. Any other error is propagated.
      async loadAccountKind(signal) {
        const response = await api.frappeDocument({
          method: 'GET',
          path: RESELLER_PROBE_PATH,
          signal,
        });
        if (response.ok) return 'reseller';
        if (response.error.kind === 'forbidden' && response.error.status === 403) return 'tenant';
        throw response.error;
      },
    },
    record: { Component: Record },
  };
}

/**
 * Reads the session user for the user card. The display name comes from the bootstrap data.
 * If the bootstrap data belongs to another user or the request fails, only the ID is returned.
 */
export async function loadShellAccount(
  api: Pick<ApiClient, 'getBootstrap'>,
  user: string,
  signal?: AbortSignal,
): Promise<ShellAccount> {
  try {
    const bootstrap = await api.getBootstrap(signal ? { signal } : {});
    const fullName = bootstrap.user.full_name?.trim();
    if (bootstrap.user.name === user && fullName) return { user, fullName };
  } catch {
    /* If the name cannot be read, the card shows the ID. */
  }
  return { user };
}

/** User language, time zone and currency from the bootstrap data. */
export interface UserLocale {
  /** Raw language. The language context resolves it. */
  language: string;
  time_zone: string;
  currency: string | null;
}

/**
 * Reads the session user's language and the site's time zone and currency from the bootstrap data (IC-12, IC-13).
 * If the bootstrap data belongs to another user or the request fails, nothing is returned.
 */
export async function loadUserLocale(
  api: Pick<ApiClient, 'getBootstrap'>,
  user: string,
  signal?: AbortSignal,
): Promise<UserLocale | undefined> {
  try {
    const bootstrap = await api.getBootstrap(signal ? { signal } : {});
    if (bootstrap.user.name === user) {
      return {
        language: bootstrap.user.language,
        time_zone: bootstrap.formatting.time_zone,
        currency: bootstrap.formatting.currency,
      };
    }
  } catch {
    /* If the bootstrap data cannot be read, the screen stays in the fallback language and the browser's time zone. */
  }
  return undefined;
}

/**
 * Data for the workspace switcher. In this version the workspace is the session's tenant (Frappe site).
 * The name is the host name of the site URL. Example: `https://acme.atonota.net` -> `acme.atonota.net`.
 * The server has no endpoint listing a user's multiple tenants; the list has a single item.
 * If the URL cannot be parsed, no data is returned; the switcher shows only the logo.
 */
export function workspaceFromSite(siteUrl: string): ShellWorkspaceData | undefined {
  let host: string;
  try {
    host = new URL(siteUrl).hostname;
  } catch {
    return undefined;
  }
  if (!host) return undefined;
  return { items: [{ id: host, name: host }], current: host };
}

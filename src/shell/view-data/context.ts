import { createContext } from 'react';
import type { ComponentType } from 'react';

import type { AgentSource, AgentTransport } from '@/ai/agent/types';
import type { ModuleEnvironment } from '@/modules';
import type { CollectionDefinition, CollectionSource } from '@/views/collection';

import type { ShellHomeData } from './home-data';

/** URL segments of the list route. Mapping is the provider's job. */
export interface CollectionAddress {
  module: string;
  doctype: string;
}

export interface ShellCollectionData {
  /** Fetches the collection definition for the DocType in the URL. Honours the abort signal. */
  loadDefinition: (
    address: CollectionAddress,
    signal: AbortSignal,
  ) => Promise<CollectionDefinition>;
  /** The source that forwards list requests to the server. */
  source: CollectionSource;
  /**
   * Display name of the type in the URL. Before the definition arrives (loading and error screens) this is the page header.
   * Example: `/satis/teklif` -> `Teklif`. If absent, the header is the generic "Records" title.
   */
  title?: (address: CollectionAddress) => string;
}

/** A list link in a sidebar group. */
export interface ShellSidebarLink {
  /** Name shown in the menu. */
  label: string;
  /** Frappe DocType name. The URL segment is derived from it. */
  doctype: string;
}

/** A sidebar group in the server's boot data. Mapping is the app entry's job. */
export interface ShellSidebar {
  id: string;
  label: string;
  /** First segment of the list URL. Example: `selling`. */
  module: string;
  links: ShellSidebarLink[];
}

export interface ShellNavigationData {
  /** Fetches the menu groups. Returns an empty list if there is no data or the request fails. */
  loadSidebars: (signal: AbortSignal) => Promise<ShellSidebar[]>;
  /**
   * Returns which of the given DocType names the user can read (G-94).
   * The server makes the decision. If the request fails, the type counts as unreadable.
   * Without a connection, the menu does not show pages that require permission.
   */
  loadReadable?: (doctypes: readonly string[], signal: AbortSignal) => Promise<ReadonlySet<string>>;
  /**
   * Asks the server whether the account is a reseller account (G-169, G-170, AJA-945).
   * If the reseller customer list endpoint returns 200, the account is a reseller. An empty list also counts as reseller.
   * If the endpoint returns 403, the account is a tenant account. On any other error the promise is rejected.
   */
  loadAccountKind?: (signal: AbortSignal) => Promise<AccountKind>;
}

/** Account type. `reseller` is a reseller account, `tenant` is a tenant account. */
export type AccountKind = 'reseller' | 'tenant';

/** URL segments of the record route. */
export interface RecordAddress {
  module: string;
  doctype: string;
  /** The record name in the URL, in its encoded form. */
  name: string;
}

export interface ShellRecordData {
  /** The component that renders the record. The app entry lazy-loads it. */
  Component: ComponentType<RecordAddress>;
}

/**
 * The data connection the shell gives to views.
 * The shell does not create an API client. The app entry (`src/app/`) provides the connection.
 */
/** The signed-in person. The user card shows this. */
export interface ShellAccount {
  /** Frappe user ID. Example: `kisi@example.test`. */
  user: string;
  /** Display name. If absent, the card shows the user ID. */
  fullName?: string;
}

/**
 * A workspace. In this version the workspace is the session's tenant (Frappe site).
 * Example: `{ id: 'acme.atonota.net', name: 'acme.atonota.net' }`.
 */
export interface ShellWorkspace {
  id: string;
  name: string;
  /** Short note below the name. If absent, the note line is not drawn. */
  note?: string;
}

/** Workspace switcher data. With a single item the switcher appears plain, without a dropdown. */
export interface ShellWorkspaceData {
  items: ShellWorkspace[];
  /** ID of the open workspace. */
  current: string;
  /** Called when another workspace is selected. If absent, the selection changes only on screen. */
  select?: (id: string) => void;
}

/** AI credit. The numbers come from the server. */
export interface ShellCredit {
  used: number;
  total: number;
}

export interface ShellCreditData {
  /** Reads the credit. Returns `null` if there is no endpoint or the response is invalid; the counter is hidden. */
  load: (signal: AbortSignal) => Promise<ShellCredit | null>;
}

export interface ShellViewData {
  /** Workspace switcher. If absent, only the logo is shown. */
  workspaces?: ShellWorkspaceData;
  /** AI credit counter. If absent, the counter is hidden. */
  credit?: ShellCreditData;
  /** AI Studio connection. If absent, AI Studio shows "not connected". */
  ai?: ShellAiData;
  collection?: ShellCollectionData;
  /** Record route connection. If absent, the shell shows the sample record (test pages). */
  record?: ShellRecordData;
  /** The signed-in person. If absent, the shell shows the sample person (test pages). */
  account?: ShellAccount;
  /** Menu groups. If absent, the menu shows only pages in the route registry. */
  navigation?: ShellNavigationData;
  /**
   * Signs out. On success the browser goes to the Keycloak logout page.
   * If the request fails, the function rejects and the session stays open.
   * If absent, the shell does not draw the sign-out button (test pages).
   */
  signOut?: () => Promise<void>;
  /** Environment for module pages. The shell provides it via `ModuleProvider`. */
  modules?: ModuleEnvironment;
  /**
   * Connection for the home page ("Bekleyenler", pending items). If absent, the home page uses the module environment's connection.
   * If neither exists, the home page states that the connection is not set up.
   */
  home?: ShellHomeData;
}

/** AI Studio transport and the source name shown on screen (AX-7). */
export interface ShellAiData {
  transport: AgentTransport;
  source: AgentSource;
}

export const ViewDataContext = createContext<ShellViewData | null>(null);

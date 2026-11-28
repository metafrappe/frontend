import { parsePage } from './model';
import { CollectionError } from './types';
import type { CollectionDefinition, CollectionPage, CollectionSource, ListRequest } from './types';

export type QuerySnapshot =
  { status: 'ready'; page: CollectionPage } | { status: 'error' | 'unauthorized' };
interface Entry {
  request: ListRequest;
  listeners: Set<() => void>;
  snapshot?: QuerySnapshot | undefined;
  controller?: AbortController | undefined;
}
/**
 * Temporary in-memory query adapter. Replace with the shared query cache when exported.
 * Each mounted collection owns its scope. Source, definition or workspace replacement creates a
 * fresh cache; nothing is shared across users, tenants or browser storage.
 * Request order rules are in `@/api/request-order` (AJA-1773).
 */
export function createCollectionCache(scope: {
  source: CollectionSource;
  definition: CollectionDefinition;
  /** Organisation ID. Part of the scope: a new organisation always gets a new cache. */
  workspace?: string;
}) {
  const entries = new Map<string, Entry>();
  const maxPages = 20;
  function notify(entry: Entry) {
    entry.listeners.forEach((listener) => listener());
  }
  function start(entry: Entry) {
    if (entry.controller || entry.snapshot) return;
    const controller = new AbortController();
    entry.controller = controller;
    void Promise.resolve()
      .then(() => scope.source.list(entry.request, controller.signal))
      .then((response) => {
        if (!controller.signal.aborted)
          entry.snapshot = { status: 'ready', page: parsePage(response) };
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const unauthorized = error instanceof CollectionError && error.kind === 'unauthorized';
        if (unauthorized) {
          // A revoked permission must not expose previously cached pages on Back.
          entries.forEach((other) => {
            if (other !== entry) {
              other.controller?.abort();
              other.controller = undefined;
              other.snapshot = undefined;
              notify(other);
            }
          });
        }
        entry.snapshot = { status: unauthorized ? 'unauthorized' : 'error' };
      })
      .finally(() => {
        if (entry.controller === controller) {
          entry.controller = undefined;
          notify(entry);
        }
      });
  }
  function getEntry(key: string, request: ListRequest) {
    let entry = entries.get(key);
    if (!entry) {
      for (const [oldKey, old] of entries) {
        if (entries.size < maxPages) break;
        if (!old.listeners.size) {
          old.controller?.abort();
          entries.delete(oldKey);
        }
      }
      entry = { request, listeners: new Set() };
      entries.set(key, entry);
    }
    return entry;
  }
  return {
    snapshot(key: string) {
      return entries.get(key)?.snapshot;
    },
    subscribe(key: string, request: ListRequest, listener: () => void) {
      const entry = getEntry(key, request);
      entry.listeners.add(listener);
      start(entry);
      return () => {
        entry.listeners.delete(listener);
        if (!entry.listeners.size && entry.controller) {
          entry.controller.abort();
          entry.controller = undefined;
        }
      };
    },
    /** Cancels every pending request and forgets every page. Used when the organisation changes. */
    dispose() {
      entries.forEach((entry) => {
        entry.controller?.abort();
        entry.controller = undefined;
        entry.snapshot = undefined;
      });
      entries.clear();
    },
    retry(key: string) {
      const entry = entries.get(key);
      if (!entry) return;
      entry.controller?.abort();
      entry.controller = undefined;
      entry.snapshot = undefined;
      notify(entry);
      if (entry.listeners.size) start(entry);
    },
  };
}

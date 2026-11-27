/**
 * Shared request ordering rules for list screens (AJA-1773).
 *
 * 1. The last request wins. Starting a request cancels the earlier one.
 * 2. A request belongs to a scope: the organisation (tenant) and the query.
 *    Changing the organisation invalidates every pending request of the old one.
 * 3. A response or error of an old request never reaches the screen.
 * 4. Appending a page never shows the same record twice.
 *
 * Reads only. Writes keep their own single-flight rule (`useMutation`).
 */

export interface LatestTicket {
  /** Pass to the request. Aborted when a newer request starts or the gate is cancelled. */
  signal: AbortSignal;
  /** True only while this ticket is the newest one and it was not cancelled. */
  isCurrent: () => boolean;
}

/** One gate per screen read. Only the newest ticket may write to the screen. */
export function createLatestRequest() {
  let current: { controller: AbortController; scope: string } | undefined;
  return {
    begin(scope: string): LatestTicket {
      current?.controller.abort();
      const entry = { controller: new AbortController(), scope };
      current = entry;
      return {
        signal: entry.controller.signal,
        isCurrent: () => current === entry && !entry.controller.signal.aborted,
      };
    },
    cancel() {
      current?.controller.abort();
      current = undefined;
    },
  };
}

/** Joins the organisation and the request key. The same key in two organisations never matches. */
export function scopedKey(scope: string, key: string): string {
  return JSON.stringify([scope, key]);
}

/** Adds the next page to the list. A record already in the list is not added again. */
export function appendUnique<T extends { name: string }>(
  rows: readonly T[],
  next: readonly T[],
): T[] {
  const seen = new Set(rows.map((row) => row.name));
  const merged = [...rows];
  for (const row of next) {
    if (seen.has(row.name)) continue;
    seen.add(row.name);
    merged.push(row);
  }
  return merged;
}

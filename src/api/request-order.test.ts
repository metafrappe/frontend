// Shared request ordering rules (AJA-1773). Every list screen uses these rules.
import { describe, expect, it } from 'vitest';
import { appendUnique, createLatestRequest, scopedKey } from './request-order';

describe('latest request gate', () => {
  it('treats only the last search as current and cancels the earlier one', () => {
    const gate = createLatestRequest();
    const first = gate.begin(scopedKey('kurum-a', 'vida'));
    const second = gate.begin(scopedKey('kurum-a', 'paslanmaz vida'));
    expect(first.signal.aborted).toBe(true);
    expect(first.isCurrent()).toBe(false);
    expect(second.isCurrent()).toBe(true);
  });

  it('invalidates every pending request when the organisation changes', () => {
    const gate = createLatestRequest();
    const old = gate.begin(scopedKey('kurum-a', 'list'));
    const next = gate.begin(scopedKey('kurum-b', 'list'));
    expect(old.isCurrent()).toBe(false);
    expect(next.isCurrent()).toBe(true);
  });

  it('keeps a cancelled request out of the screen, even if its error arrives later', () => {
    const gate = createLatestRequest();
    const ticket = gate.begin('scope');
    gate.cancel();
    expect(ticket.signal.aborted).toBe(true);
    expect(ticket.isCurrent()).toBe(false);
  });

  it('separates the same key in two organisations', () => {
    expect(scopedKey('kurum-a', 'list')).not.toBe(scopedKey('kurum-b', 'list'));
    expect(scopedKey('a:b', 'c')).not.toBe(scopedKey('a', 'b:c'));
  });
});

describe('appendUnique', () => {
  it('shows each record once when the next page repeats a record', () => {
    const merged = appendUnique(
      [{ name: 'L-1' }, { name: 'L-2' }],
      [{ name: 'L-2' }, { name: 'L-3' }, { name: 'L-3' }],
    );
    expect(merged.map((row) => row.name)).toEqual(['L-1', 'L-2', 'L-3']);
  });
});

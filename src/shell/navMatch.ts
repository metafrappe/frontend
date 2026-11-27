/**
 * Determines whether a menu item is active.
 * Paths are compared segment by segment. A prefix match does not count as active.
 * Example: the "/satis/teklif" item is not active at "/satis/teklifler".
 */
export function isPathActive(to: string, pathname: string): boolean {
  const target = (to.split('?')[0] ?? to).split('/').filter(Boolean);
  const current = pathname.split('/').filter(Boolean);
  if (target.length === 0) return current.length === 0;
  if (current.length < target.length) return false;
  return target.every((seg, i) => decodeURIComponent(current[i] ?? '') === decodeURIComponent(seg));
}

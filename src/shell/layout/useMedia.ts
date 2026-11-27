import { useSyncExternalStore } from 'react';

/**
 * Phone shell query. A narrow width or a short height counts as a phone.
 * A landscape phone stays in the phone shell because of its short height.
 */
export const COMPACT_QUERY = '(max-width: 767px), (max-height: 499px)';
/** Landscape phone query. Matches the landscape phone section in `shell.css`. */
export const LANDSCAPE_PHONE_QUERY = '(orientation: landscape) and (max-height: 499px)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const useCompactLayout = () => useMedia(COMPACT_QUERY);
export const useReducedMotion = () => useMedia(REDUCED_MOTION_QUERY);

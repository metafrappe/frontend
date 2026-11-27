import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { ThemeMode } from '@/design/source';

export type ThemeModeChoice = ThemeMode | 'system';

export const THEME_MODE_STORAGE_KEY = 'atonota.theme-mode';
export const THEME_ATTR = 'data-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

interface ThemeModeContextValue {
  /** The user's choice: light, dark or system. */
  choice: ThemeModeChoice;
  /** Ekrana uygulanan tema. */
  resolved: ThemeMode;
  setChoice: (choice: ThemeModeChoice) => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function isChoice(value: unknown): value is ThemeModeChoice {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function readStoredChoice(storage: Storage | undefined = safeStorage()): ThemeModeChoice {
  try {
    const raw = storage?.getItem(THEME_MODE_STORAGE_KEY);
    return isChoice(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(DARK_QUERY).matches
    : false;
}

export function resolveThemeMode(choice: ThemeModeChoice, prefersDark: boolean): ThemeMode {
  if (choice === 'system') return prefersDark ? 'dark' : 'light';
  return choice;
}

/** Writes `<html data-theme>` and the `color-scheme` value. The semantic update is immediate. */
export function applyThemeToDocument(mode: ThemeMode, doc: Document = document): void {
  doc.documentElement.setAttribute(THEME_ATTR, mode);
  doc.documentElement.style.colorScheme = mode;
}

export function ThemeModeProvider({
  children,
  initialChoice,
}: {
  children: ReactNode;
  initialChoice?: ThemeModeChoice;
}) {
  const [choice, setChoiceState] = useState<ThemeModeChoice>(
    () => initialChoice ?? readStoredChoice(),
  );
  const [prefersDark, setPrefersDark] = useState<boolean>(systemPrefersDark);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(DARK_QUERY);
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const resolved = resolveThemeMode(choice, prefersDark);

  useEffect(() => {
    applyThemeToDocument(resolved);
  }, [resolved]);

  const setChoice = useCallback((next: ThemeModeChoice) => {
    setChoiceState(next);
    try {
      safeStorage()?.setItem(THEME_MODE_STORAGE_KEY, next);
    } catch {
      // If storage is unavailable, the choice lasts only for the session.
    }
  }, []);

  const value = useMemo(() => ({ choice, resolved, setChoice }), [choice, resolved, setChoice]);
  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode(): ThemeModeContextValue {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) {
    throw new Error('useThemeMode yalnız ThemeModeProvider içinde kullanılır.');
  }
  return ctx;
}

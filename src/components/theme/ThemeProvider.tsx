import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  applyThemeClassToDocument,
  readThemePreferenceFromStorage,
  resolveEffectiveTheme,
  writeThemePreferenceToStorage,
  type ResolvedTheme,
  type ThemePreference,
} from '@/src/lib/theme/theme';

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    typeof window !== 'undefined' ? readThemePreferenceFromStorage(window.localStorage) : 'dark'
  );
  const [systemDark, setSystemDark] = useState<boolean>(() => getSystemPrefersDark());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    setSystemDark(mql.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  const resolvedTheme = useMemo(
    () => resolveEffectiveTheme(preference, systemDark),
    [preference, systemDark]
  );

  useEffect(() => {
    if (typeof document !== 'undefined') {
      applyThemeClassToDocument(resolvedTheme, document);
    }
  }, [resolvedTheme]);

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
    if (typeof window !== 'undefined') {
      writeThemePreferenceToStorage(next, window.localStorage);
    }
  }

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      preference: 'dark',
      resolvedTheme: 'dark',
      setPreference: () => undefined,
    };
  }
  return ctx;
}

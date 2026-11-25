export type ThemePreference = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'restoconnect_theme_v1';

export function normalizeThemePreference(raw: unknown): ThemePreference {
  if (raw === 'dark' || raw === 'light' || raw === 'system') {
    return raw;
  }
  return 'dark';
}

export function resolveEffectiveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean
): ResolvedTheme {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return systemPrefersDark ? 'dark' : 'light';
}

export function readThemePreferenceFromStorage(
  storage?: Pick<Storage, 'getItem'> | null
): ThemePreference {
  if (!storage) return 'dark';
  try {
    return normalizeThemePreference(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'dark';
  }
}

export function writeThemePreferenceToStorage(
  preference: ThemePreference,
  storage?: Pick<Storage, 'setItem'> | null
): void {
  if (!storage) return;
  try {
    storage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Ignore storage quota / private mode failures
  }
}

export function applyThemeClassToDocument(
  resolved: ResolvedTheme,
  doc?: Pick<Document, 'documentElement'> | null
): void {
  if (!doc?.documentElement) return;
  const root = doc.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.setAttribute('data-theme', resolved);
}

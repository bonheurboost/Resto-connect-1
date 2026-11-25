import assert from 'node:assert/strict';
import test from 'node:test';
import {
  THEME_STORAGE_KEY,
  applyThemeClassToDocument,
  normalizeThemePreference,
  readThemePreferenceFromStorage,
  resolveEffectiveTheme,
  writeThemePreferenceToStorage,
} from './theme';

test('normalizeThemePreference defaults to dark for unknown values', () => {
  assert.equal(normalizeThemePreference(null), 'dark');
  assert.equal(normalizeThemePreference(undefined), 'dark');
  assert.equal(normalizeThemePreference('sepia'), 'dark');
  assert.equal(normalizeThemePreference('light'), 'light');
  assert.equal(normalizeThemePreference('system'), 'system');
  assert.equal(normalizeThemePreference('dark'), 'dark');
});

test('resolveEffectiveTheme handles dark, light, and system modes', () => {
  assert.equal(resolveEffectiveTheme('dark', false), 'dark');
  assert.equal(resolveEffectiveTheme('light', true), 'light');
  assert.equal(resolveEffectiveTheme('system', true), 'dark');
  assert.equal(resolveEffectiveTheme('system', false), 'light');
});

test('storage roundtrip persists and reloads theme preference', () => {
  const map = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, val: string) => {
      map.set(key, val);
    },
  };

  assert.equal(readThemePreferenceFromStorage(mockStorage), 'dark');
  writeThemePreferenceToStorage('light', mockStorage);
  assert.equal(map.get(THEME_STORAGE_KEY), 'light');
  assert.equal(readThemePreferenceFromStorage(mockStorage), 'light');

  writeThemePreferenceToStorage('system', mockStorage);
  assert.equal(readThemePreferenceFromStorage(mockStorage), 'system');
});

test('applyThemeClassToDocument toggles .dark class and data-theme attribute', () => {
  const classes = new Set<string>();
  let dataTheme = '';
  const mockDoc = {
    documentElement: {
      classList: {
        add: (cls: string) => classes.add(cls),
        remove: (cls: string) => classes.delete(cls),
      },
      setAttribute: (name: string, val: string) => {
        if (name === 'data-theme') dataTheme = val;
      },
    },
  } as unknown as Pick<Document, 'documentElement'>;

  applyThemeClassToDocument('dark', mockDoc);
  assert.equal(classes.has('dark'), true);
  assert.equal(dataTheme, 'dark');

  applyThemeClassToDocument('light', mockDoc);
  assert.equal(classes.has('dark'), false);
  assert.equal(dataTheme, 'light');
});

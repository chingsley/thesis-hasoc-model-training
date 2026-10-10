import type { ColorThemeId, ColorThemeMeta } from './types';

/** @deprecated Legacy single-user key; migrated to per-user keys on read. */
export const THEME_STORAGE_KEY = 'hg-color-theme';

const AUTH_PERSIST_KEY = 'hg-auth';

export const DEFAULT_THEME_ID: ColorThemeId = 'classic';

export function themeStorageKeyForUser(userId: number): string {
  return `${THEME_STORAGE_KEY}:user:${userId}`;
}

/** User id from persisted auth (before Zustand rehydrates). */
export function readPersistedAuthUserId(): number | null {
  try {
    const raw = localStorage.getItem(AUTH_PERSIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { user?: { id?: number; } | null; }; };
    const id = parsed.state?.user?.id;
    return typeof id === 'number' ? id : null;
  } catch {
    return null;
  }
}

export function readGlobalThemeId(): ColorThemeId {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw && isColorThemeId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME_ID;
}

export function writeGlobalThemeId(themeId: ColorThemeId): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  } catch {
    /* ignore */
  }
}

export function resolveThemeIdForSession(): ColorThemeId {
  const userId = readPersistedAuthUserId();
  return userId != null ? readStoredThemeIdForUser(userId) : readGlobalThemeId();
}

export const COLOR_THEMES: ColorThemeMeta[] = [
  {
    id: 'classic',
    label: 'Color theme 1 — Classic purple',
    description:
      'Original dashboard — lavender selected nav, purple accent tiles (#4a3f6e), light gray shell (#eaebf4).',
    preview: {
      shell: '#eaebf4',
      accent: '#4a3f6e',
      soft: '#d9d6f7',
      primary: '#3d355c',
    },
  },
  {
    id: 'sky',
    label: 'Color theme 2 — Navy & sky',
    description:
      'Login-page navy (#19305a) for primary actions and accent tiles; sky-blue selected nav; bluish-gray shell.',
    preview: {
      shell: '#f6f9fc',
      // shell: '#000000',
      accent: '#19305a',
      soft: '#edf1f5',
      primary: '#19305a',
    },
  },
  {
    id: 'noir',
    label: 'Color theme 3 — Charcoal (Carnductor)',
    description:
      'Carnductor charcoal palette with matching primary/secondary button gradients.',
    preview: {
      shell: '#f5f7fa',
      accent: '#282828',
      soft: '#e8e8e8',
      primary: '#2c2c2c',
    },
  },
];

export function isColorThemeId(value: string): value is ColorThemeId {
  return value === 'classic' || value === 'sky' || value === 'noir';
}

export function readStoredThemeIdForUser(userId: number): ColorThemeId {
  try {
    const key = themeStorageKeyForUser(userId);
    const raw = localStorage.getItem(key);
    if (raw && isColorThemeId(raw)) return raw;

    const legacy = localStorage.getItem(THEME_STORAGE_KEY);
    if (legacy && isColorThemeId(legacy)) {
      localStorage.setItem(key, legacy);
      localStorage.removeItem(THEME_STORAGE_KEY);
      return legacy;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME_ID;
}

export function writeStoredThemeIdForUser(userId: number, themeId: ColorThemeId): void {
  try {
    localStorage.setItem(themeStorageKeyForUser(userId), themeId);
    writeGlobalThemeId(themeId);
  } catch {
    /* ignore */
  }
}

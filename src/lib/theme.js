const THEME_STORAGE_KEY = 'careerlyst-theme';

const VALID_THEMES = new Set(['light']);

export function normalizeThemePreference(value) {
  return 'light';
}

export function getStoredThemePreference() {
  return 'light';
}

export function hasStoredThemePreference() {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(
      THEME_STORAGE_KEY
    ) === 'light';
  } catch {
    return false;
  }
}

export function resolveThemePreference() {
  return 'light';
}

export function applyTheme() {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = 'light';
  }

  return 'light';
}

export function saveThemePreference() {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        THEME_STORAGE_KEY,
        'light'
      );
    } catch {
      // Theme application should still work
      // when localStorage is unavailable.
    }
  }

  return applyTheme();
}

export function applyStoredTheme() {
  if (typeof window !== 'undefined') {
    try {
      // Remove any old dark/system preference.
      window.localStorage.setItem(
        THEME_STORAGE_KEY,
        'light'
      );
    } catch {
      // Ignore storage failures.
    }
  }

  return applyTheme();
}

/*
 * Kept for compatibility with existing Dashboard imports.
 * System theme is disabled, so there is nothing to watch.
 */
export function watchSystemTheme() {
  return undefined;
}

export { THEME_STORAGE_KEY };
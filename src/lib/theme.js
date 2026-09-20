const THEME_STORAGE_KEY = 'careerlyst-theme';

const VALID_THEMES = new Set(['dark', 'light', 'system']);

export function normalizeThemePreference(value) {
  return VALID_THEMES.has(value) ? value : 'system';
}

export function getStoredThemePreference() {
  if (typeof window === 'undefined') {
    return 'system';
  }

  try {
    return normalizeThemePreference(
      window.localStorage.getItem(THEME_STORAGE_KEY)
    );
  } catch {
    return 'system';
  }
}

export function hasStoredThemePreference() {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);

    return VALID_THEMES.has(value);
  } catch {
    return false;
  }
}

export function resolveThemePreference(preference) {
  const normalized = normalizeThemePreference(preference);

  if (normalized === 'dark' || normalized === 'light') {
    return normalized;
  }

  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function applyTheme(preference) {
  const normalized = normalizeThemePreference(preference);
  const resolved = resolveThemePreference(normalized);

  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolved;
  }

  return resolved;
}

export function saveThemePreference(preference) {
  const normalized = normalizeThemePreference(preference);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        THEME_STORAGE_KEY,
        normalized
      );
    } catch {
      // Theme application should still work
      // when localStorage is unavailable.
    }
  }

  applyTheme(normalized);

  return normalized;
}

export function applyStoredTheme() {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(
        THEME_STORAGE_KEY
      );

      // No valid local preference:
      // use system theme, but DON'T save "system" to localStorage.
      // This allows Supabase preference to hydrate later.
      if (!VALID_THEMES.has(stored)) {
        if (stored !== null) {
          window.localStorage.removeItem(
            THEME_STORAGE_KEY
          );
        }

        return applyTheme('system');
      }

      return applyTheme(stored);
    } catch {
      return applyTheme('system');
    }
  }

  return applyTheme('system');
}

export function watchSystemTheme(preference) {
  if (
    typeof window === 'undefined' ||
    !window.matchMedia
  ) {
    return undefined;
  }

  const normalized = normalizeThemePreference(preference);

  // Only watch system preference when user selected "system".
  if (normalized !== 'system') {
    return undefined;
  }

  const media = window.matchMedia(
    '(prefers-color-scheme: dark)'
  );

  const handleChange = () => {
    applyTheme('system');
  };

  if (media.addEventListener) {
    media.addEventListener('change', handleChange);
  } else {
    media.addListener?.(handleChange);
  }

  return () => {
    if (media.removeEventListener) {
      media.removeEventListener(
        'change',
        handleChange
      );
    } else {
      media.removeListener?.(handleChange);
    }
  };
}

export { THEME_STORAGE_KEY };

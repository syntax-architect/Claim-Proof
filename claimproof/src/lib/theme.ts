import { BRAND } from '../config/brand';

/* Light/dark theme store — persisted, system-aware, FOUC-free (init in index.html). */

export type Theme = 'light' | 'dark';

const KEY = BRAND.storageKeys.theme;
const LEGACY_KEY = BRAND.storageKeys.legacyTheme;

export function storedTheme(): Theme | null {
  try {
    const t = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

export function systemTheme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function currentTheme(): Theme {
  return document.documentElement.classList.contains('light') ? 'light' : 'dark';
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* private mode */
  }
}

export function initTheme(): Theme {
  const theme = storedTheme() ?? systemTheme();
  applyTheme(theme);
  return theme;
}

export function toggleTheme(theme: Theme): Theme {
  const next: Theme = theme === 'light' ? 'dark' : 'light';
  applyTheme(next);
  return next;
}

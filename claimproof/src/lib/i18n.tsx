/**
 * Lightweight, strictly typed i18n layer for SABOOT Suite.
 *
 * Acceptance Criteria & AGENTS.md Rules:
 * - Rule 4: Local-first, zero remote dependencies or fonts.
 * - Rule 6: All user-visible strings pass through i18n layer.
 * - Rule 7: IST dates with "IST" indicator.
 * - Rule 8: Integer paise and en-IN currency grouping.
 * - Criterion 1: Typed keys, English and Hindi, language switch in TopBar and Settings, remembered across sessions.
 * - Criterion 4: Hindi text must not overflow buttons or cards at 360px width.
 * - Criterion 5: Numbers and dates use en-IN formatting.
 * - Criterion 6: AI-translated strings marked in translation-metadata.json.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { en, type I18nKey } from '../locales/en';
import { hi } from '../locales/hi';
import { setSetting, getSetting } from '../db/schema';

export type SupportedLocale = 'en' | 'hi';
export type { I18nKey };

export const LOCALES: Record<SupportedLocale, { label: string; nativeName: string }> = {
  en: { label: 'English', nativeName: 'English' },
  hi: { label: 'Hindi', nativeName: 'हिन्दी' }
};

export const STORAGE_KEY = 'saboot_locale';
export const PSEUDO_STORAGE_KEY = 'saboot_pseudo_locale';

// In-memory active locale for standalone t() calls outside React tree
let currentLocale: SupportedLocale = 'en';
let currentPseudoMode = false;

// Pseudo-localization transformer (adds ~35% length expansion and accented glyphs to catch 360px overflow)
const ACCENT_MAP: Record<string, string> = {
  a: 'ä',
  b: 'ḅ',
  c: 'ç',
  d: 'ḍ',
  e: 'ë',
  f: 'ƒ',
  g: 'ğ',
  h: 'ĥ',
  i: 'ï',
  j: 'ĵ',
  k: 'ḳ',
  l: 'ḷ',
  m: 'ṃ',
  n: 'ñ',
  o: 'ö',
  p: 'ṗ',
  q: 'ʠ',
  r: 'ṛ',
  s: 'ṣ',
  t: 'ṭ',
  u: 'ü',
  v: 'ṿ',
  w: 'ŵ',
  x: 'ẋ',
  y: 'ÿ',
  z: 'ż',
  A: 'Ä',
  B: 'Ḅ',
  C: 'Ç',
  D: 'Ḍ',
  E: 'Ë',
  F: 'Ƒ',
  G: 'Ğ',
  H: 'Ĥ',
  I: 'Ï',
  J: 'Ĵ',
  K: 'Ḳ',
  L: 'Ḷ',
  M: 'Ṃ',
  N: 'Ñ',
  O: 'Ö',
  P: 'Ṗ',
  Q: 'Ǫ',
  R: 'Ṛ',
  S: 'Ṣ',
  T: 'Ṭ',
  U: 'Ü',
  V: 'Ṿ',
  W: 'Ŵ',
  X: 'Ẋ',
  Y: 'Ÿ',
  Z: 'Ż'
};

export function pseudoLocalize(str: string): string {
  if (!str) return str;
  const transformed = str
    .split('')
    .map((char) => ACCENT_MAP[char] || char)
    .join('');
  return `[!! ${transformed} !!]`;
}

/**
 * Global standalone translate function with optional interpolation.
 * Example: `t('common.save')` or `t('recorder.savedSuccess', { awb: '1234' })`
 */
export function t(
  key: I18nKey,
  params?: Record<string, string | number>,
  localeOverride?: SupportedLocale
): string {
  const activeLang = localeOverride ?? currentLocale;
  const dict = activeLang === 'hi' ? hi : en;
  let text = dict[key] ?? en[key] ?? key;

  if (currentPseudoMode && activeLang === 'en') {
    text = pseudoLocalize(text);
  }

  if (!params) return text;

  return text.replace(/\{(\w+)\}/g, (_, match) => {
    return params[match] !== undefined ? String(params[match]) : `{${match}}`;
  });
}

/**
 * Format number with Indian numbering grouping (en-IN).
 */
export function formatNumberIN(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

/**
 * Format monetary value in integer paise to Indian Rupee (₹) with en-IN grouping.
 */
export function formatPaiseIN(paise: number): string {
  const rupees = Math.round(paise / 100);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(rupees);
}

export interface I18nContextValue {
  lang: SupportedLocale;
  setLang: (lang: SupportedLocale) => void;
  toggleLang: () => void;
  t: (key: I18nKey, params?: Record<string, string | number>) => string;
  isHindi: boolean;
  pseudoMode: boolean;
  setPseudoMode: (enabled: boolean) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<SupportedLocale>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'hi' || saved === 'en') {
        currentLocale = saved;
        return saved;
      }
    } catch {
      // LocalStorage unavailable in certain sandboxes
    }
    return 'en';
  });

  const [pseudoMode, setPseudoModeState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PSEUDO_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Keep in-memory variables in sync
  useEffect(() => {
    currentLocale = lang;
    currentPseudoMode = pseudoMode;
  }, [lang, pseudoMode]);

  const setLang = useCallback((newLang: SupportedLocale) => {
    setLangState(newLang);
    currentLocale = newLang;
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
      document.documentElement.lang = newLang;
      void setSetting('language', newLang);
      window.dispatchEvent(new CustomEvent('cp-language-changed', { detail: newLang }));
    } catch {
      // ignore
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'en' ? 'hi' : 'en');
  }, [lang, setLang]);

  const setPseudoMode = useCallback((enabled: boolean) => {
    setPseudoModeState(enabled);
    currentPseudoMode = enabled;
    try {
      localStorage.setItem(PSEUDO_STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {
      // ignore
    }
  }, []);

  // Sync with document element and initial Dexie DB setting
  useEffect(() => {
    document.documentElement.lang = lang;
    void getSetting<string>('language', 'en').then((saved) => {
      if ((saved === 'hi' || saved === 'en') && saved !== lang) {
        setLangState(saved);
        currentLocale = saved;
      }
    });

    const onLangChanged = (e: Event) => {
      const custom = e as CustomEvent<SupportedLocale>;
      if (custom.detail && (custom.detail === 'hi' || custom.detail === 'en')) {
        setLangState(custom.detail);
        currentLocale = custom.detail;
      }
    };
    window.addEventListener('cp-language-changed', onLangChanged);
    return () => window.removeEventListener('cp-language-changed', onLangChanged);
  }, [lang]);

  const translate = useCallback(
    (key: I18nKey, params?: Record<string, string | number>) => {
      return t(key, params, lang);
    },
    [lang]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      toggleLang,
      t: translate,
      isHindi: lang === 'hi',
      pseudoMode,
      setPseudoMode
    }),
    [lang, setLang, toggleLang, translate, pseudoMode, setPseudoMode]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Graceful fallback for components rendered outside I18nProvider (e.g. tests)
    return {
      lang: currentLocale,
      setLang: () => {},
      toggleLang: () => {},
      t: (key: I18nKey, params?: Record<string, string | number>) => t(key, params, currentLocale),
      isHindi: currentLocale === 'hi',
      pseudoMode: currentPseudoMode,
      setPseudoMode: () => {}
    };
  }
  return ctx;
}

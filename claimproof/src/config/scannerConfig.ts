/**
 * Barcode & USB HID Scanner Configuration for SABOOT Suite.
 *
 * Defines configuration settings, defaults, normalization rules,
 * and persistence helpers for keyboard-wedge USB scanners and camera scanners.
 */

import { getSetting, setSetting } from '../db/schema';

export type ScannerSuffix = 'Enter' | 'Tab' | 'EnterOrTab' | 'None';
export type CaseHandling = 'uppercase' | 'lowercase' | 'preserve';

export interface ScannerSettings {
  /** Optional prefix string expected from or configured on the barcode scanner. */
  prefix: string;
  /** Expected keystroke terminator (suffix) from keyboard-wedge scanners. */
  suffix: ScannerSuffix;
  /** Minimum character length for a valid barcode (after stripping prefix/suffix). */
  minLength: number;
  /** Duplicate scan debounce suppression duration in milliseconds (default: 1500 ms). */
  debounceMs: number;
  /** Maximum inter-keystroke interval in ms to qualify as a scanner burst (default: 80 ms). */
  maxBurstIntervalMs: number;
  /** Whether to strip invisible control characters, whitespace, and AIM symbology headers. */
  stripNoise: boolean;
  /** Case normalization rule for scanned barcodes. */
  caseHandling: CaseHandling;
  /** Whether to emit acoustic feedback beeps on scan events. */
  beepOnScan: boolean;
}

export const DEFAULT_SCANNER_SETTINGS: ScannerSettings = {
  prefix: '',
  suffix: 'EnterOrTab',
  minLength: 4,
  debounceMs: 1500, // 1.5 seconds default
  maxBurstIntervalMs: 80, // <80ms inter-key gap
  stripNoise: true,
  caseHandling: 'uppercase',
  beepOnScan: true
};

const STORAGE_KEY = 'saboot_scanner_settings';
export const SCANNER_SETTINGS_CHANGED_EVENT = 'saboot-scanner-settings-changed';

/**
 * Loads the current scanner settings synchronously from memory/localStorage,
 * falling back to defaults if not yet configured.
 */
export function getScannerSettings(): ScannerSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_SCANNER_SETTINGS };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ScannerSettings>;
      return {
        ...DEFAULT_SCANNER_SETTINGS,
        ...parsed,
        minLength: Math.max(1, Number(parsed.minLength) || DEFAULT_SCANNER_SETTINGS.minLength),
        debounceMs: Math.max(0, Number(parsed.debounceMs) || DEFAULT_SCANNER_SETTINGS.debounceMs),
        maxBurstIntervalMs: Math.max(
          20,
          Number(parsed.maxBurstIntervalMs) || DEFAULT_SCANNER_SETTINGS.maxBurstIntervalMs
        )
      };
    }
  } catch {
    /* Fall through to default */
  }
  return { ...DEFAULT_SCANNER_SETTINGS };
}

/**
 * Persists updated scanner settings to localStorage and IndexedDB settings table.
 */
export async function saveScannerSettings(
  partial: Partial<ScannerSettings>
): Promise<ScannerSettings> {
  const current = getScannerSettings();
  const updated: ScannerSettings = {
    ...current,
    ...partial,
    minLength: Math.max(1, Number(partial.minLength ?? current.minLength)),
    debounceMs: Math.max(0, Number(partial.debounceMs ?? current.debounceMs)),
    maxBurstIntervalMs: Math.max(
      20,
      Number(partial.maxBurstIntervalMs ?? current.maxBurstIntervalMs)
    )
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent(SCANNER_SETTINGS_CHANGED_EVENT, { detail: updated }));
    } catch {
      /* LocalStorage full / restricted */
    }
  }

  try {
    await setSetting('scanner_settings', updated);
  } catch {
    /* IndexedDB best-effort */
  }

  return updated;
}

/**
 * Resets scanner configuration to factory defaults.
 */
export async function resetScannerSettings(): Promise<ScannerSettings> {
  return saveScannerSettings(DEFAULT_SCANNER_SETTINGS);
}

/**
 * Initializes settings from IndexedDB if not present in localStorage.
 */
export async function initScannerSettings(): Promise<ScannerSettings> {
  try {
    const stored = await getSetting<ScannerSettings | null>('scanner_settings', null);
    if (stored) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      }
      return stored;
    }
  } catch {
    /* Best effort */
  }
  return getScannerSettings();
}

export interface BarcodeProcessResult {
  valid: boolean;
  code: string;
  raw: string;
  error?: string;
  strippedPrefix?: string;
}

/**
 * Normalizes, strips noise, checks prefix/suffix criteria, and validates length.
 */
export function processBarcodeCode(
  raw: string,
  settings: ScannerSettings = getScannerSettings()
): BarcodeProcessResult {
  if (typeof raw !== 'string' || !raw) {
    return {
      valid: false,
      code: '',
      raw: raw || '',
      error: 'Empty barcode stream'
    };
  }

  let text = raw;
  let strippedPrefix = '';

  // 1. Strip AIM Symbology standard prefix if present (e.g., ]C1, ]e0, ]Q1, ]d2)
  if (settings.stripNoise) {
    // AIM symbology identifier (ISO/IEC 15424): ] followed by 1 flag letter and 1 modifier digit/char
    const aimMatch = text.match(/^\][A-Za-z][0-9A-Za-z]/);
    if (aimMatch) {
      strippedPrefix = aimMatch[0];
      text = text.slice(aimMatch[0].length);
    }
  }

  // 2. Strip leading/trailing control characters, tabs, newlines, and spaces
  // eslint-disable-next-line no-control-regex
  text = text.replace(/^[\x00-\x1F\x7F\s]+|[\x00-\x1F\x7F\s]+$/g, '');

  // 3. User-configured prefix handling
  if (settings.prefix && settings.prefix.trim()) {
    const prefix = settings.prefix.trim();
    if (text.startsWith(prefix)) {
      strippedPrefix = strippedPrefix ? `${strippedPrefix}+${prefix}` : prefix;
      text = text.slice(prefix.length);
    } else {
      // Prefix was configured but not found on code
      return {
        valid: false,
        code: text,
        raw,
        error: `Expected prefix "${prefix}" was not detected on barcode.`
      };
    }
  }

  // 4. Clean leading/trailing characters again after prefix removal
  // eslint-disable-next-line no-control-regex
  text = text.replace(/^[\x00-\x1F\x7F\s]+|[\x00-\x1F\x7F\s]+$/g, '');

  // 5. Case normalization
  if (settings.caseHandling === 'uppercase') {
    text = text.toUpperCase();
  } else if (settings.caseHandling === 'lowercase') {
    text = text.toLowerCase();
  }
  // 'preserve' leaves text as-is

  // 6. Minimum length validation
  if (text.length < settings.minLength) {
    return {
      valid: false,
      code: text,
      raw,
      error: `Barcode too short: ${text.length} character${text.length === 1 ? '' : 's'} (minimum required: ${settings.minLength}).`
    };
  }

  return {
    valid: true,
    code: text,
    raw,
    strippedPrefix: strippedPrefix || undefined
  };
}

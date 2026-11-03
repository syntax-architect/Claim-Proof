/**
 * USB / Bluetooth HID Laser Barcode Scanner Listener for SABOOT Suite.
 *
 * Scanners act as keyboard-wedge HID devices: rapid keystroke bursts (<80ms per key)
 * ending in Enter, Tab, Enter/Tab, or idle timeout (suffix: None).
 *
 * Rules:
 * - Differentiates barcode bursts from normal human typing in text fields via burst speed.
 * - Supports configurable prefix, suffix, minLength, debounce, case handling, and noise filtering.
 * - Distinct acoustic beeps for good scans vs invalid/rejected scans.
 * - Diagnostic events for Scanner Test workbench inspection.
 */

import {
  getScannerSettings,
  processBarcodeCode,
  SCANNER_SETTINGS_CHANGED_EVENT,
  type BarcodeProcessResult,
  type ScannerSettings,
  type ScannerSuffix
} from '../config/scannerConfig';
import { playGoodScanBeep, playInvalidScanBeep } from './audioBeeps';

export interface HidListenerHandle {
  stop: () => void;
}

export interface ScannerStats {
  keyCount: number;
  totalBurstMs: number;
  avgIntervalMs: number;
  maxIntervalMs: number;
  terminator: string;
  isTypingTarget: boolean;
}

export interface ScannerDiagnosticEvent {
  type: 'keystroke' | 'burst_complete' | 'debounced' | 'invalid';
  key?: string;
  deltaMs?: number;
  raw?: string;
  code?: string;
  error?: string;
  stats?: ScannerStats;
  result?: BarcodeProcessResult;
}

export interface HidListenerOptions {
  onInvalidScan?: (raw: string, error?: string) => void;
  onDiagnostic?: (diagnostic: ScannerDiagnosticEvent) => void;
  getSettings?: () => ScannerSettings;
}

export const SCANNER_DIAGNOSTIC_EVENT = 'saboot-scanner-diagnostic';

interface KeyRecord {
  key: string;
  time: number;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'TEXTAREA' || el.isContentEditable || tag === 'INPUT';
}

function isMatchingTerminator(key: string, suffix: ScannerSuffix): boolean {
  if (suffix === 'Enter') return key === 'Enter';
  if (suffix === 'Tab') return key === 'Tab';
  if (suffix === 'EnterOrTab') return key === 'Enter' || key === 'Tab';
  return false;
}

export function startHidListener(
  onScan: (code: string, result?: BarcodeProcessResult) => void,
  options?: HidListenerOptions
): HidListenerHandle {
  let settings: ScannerSettings = options?.getSettings?.() ?? getScannerSettings();
  let keyRecords: KeyRecord[] = [];
  let lastScannedCode = '';
  let lastScannedAt = 0;
  let staleTimer: ReturnType<typeof setTimeout> | undefined;
  let noneSuffixTimer: ReturnType<typeof setTimeout> | undefined;

  const onSettingsChanged = (e: Event) => {
    const custom = e as CustomEvent<ScannerSettings>;
    if (custom.detail) {
      settings = custom.detail;
    } else {
      settings = options?.getSettings?.() ?? getScannerSettings();
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(SCANNER_SETTINGS_CHANGED_EVENT, onSettingsChanged);
  }

  function emitDiagnostic(diagnostic: ScannerDiagnosticEvent): void {
    options?.onDiagnostic?.(diagnostic);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent<ScannerDiagnosticEvent>(SCANNER_DIAGNOSTIC_EVENT, { detail: diagnostic })
      );
    }
  }

  function resetBuffer(): void {
    keyRecords = [];
    if (staleTimer) {
      clearTimeout(staleTimer);
      staleTimer = undefined;
    }
    if (noneSuffixTimer) {
      clearTimeout(noneSuffixTimer);
      noneSuffixTimer = undefined;
    }
  }

  function evaluateBurst(
    terminator: string,
    target: EventTarget | null,
    event?: KeyboardEvent
  ): void {
    if (keyRecords.length === 0) return;

    const targetIsInput = isTypingTarget(target);
    const count = keyRecords.length;
    const now = performance.now();
    const firstTime = keyRecords[0].time;
    const lastTime = keyRecords[count - 1].time;
    const totalBurstMs = Math.max(0, lastTime - firstTime);

    // Calculate intervals between adjacent keys
    const intervals: number[] = [];
    for (let i = 1; i < count; i++) {
      intervals.push(keyRecords[i].time - keyRecords[i - 1].time);
    }

    const avgIntervalMs =
      intervals.length > 0 ? intervals.reduce((sum, v) => sum + v, 0) / intervals.length : 0;
    const maxIntervalMs = intervals.length > 0 ? Math.max(...intervals) : 0;
    const gapToTerminator = event ? Math.max(0, now - lastTime) : 0;

    const stats: ScannerStats = {
      keyCount: count,
      totalBurstMs: Math.round(totalBurstMs),
      avgIntervalMs: Math.round(avgIntervalMs),
      maxIntervalMs: Math.round(maxIntervalMs),
      terminator,
      isTypingTarget: targetIsInput
    };

    // If typing in an input/textarea, verify burst typing speed:
    // Scanners transmit at rapid speed (< maxBurstIntervalMs per key, avg < 55ms).
    // Humans type irregularly with large pauses (>80ms, avg > 70-120ms).
    if (targetIsInput) {
      const isBurstFast =
        maxIntervalMs <= settings.maxBurstIntervalMs &&
        avgIntervalMs <= settings.maxBurstIntervalMs * 0.85 &&
        (terminator === 'None' || gapToTerminator <= settings.maxBurstIntervalMs * 1.6);

      if (!isBurstFast) {
        // Normal human typing in text input: do NOT intercept as scanner burst!
        resetBuffer();
        return;
      }
    } else {
      // Outside text input, verify keys weren't stray slow presses
      if (count > 1 && maxIntervalMs > settings.maxBurstIntervalMs * 1.5) {
        resetBuffer();
        return;
      }
    }

    // High-speed burst verified! Intercept terminator so form doesn't submit / insert tab
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const rawString = keyRecords.map((r) => r.key).join('');
    resetBuffer();

    const result = processBarcodeCode(rawString, settings);

    if (result.valid) {
      const wallNow = Date.now();
      // Debounce duplicate scans within configured window (default 1500ms)
      if (result.code === lastScannedCode && wallNow - lastScannedAt < settings.debounceMs) {
        emitDiagnostic({
          type: 'debounced',
          raw: rawString,
          code: result.code,
          stats,
          result
        });
        return;
      }

      lastScannedCode = result.code;
      lastScannedAt = wallNow;

      if (settings.beepOnScan) {
        playGoodScanBeep();
      }

      emitDiagnostic({
        type: 'burst_complete',
        raw: rawString,
        code: result.code,
        stats,
        result
      });

      // If typed into a scan-sink input, clear its text so it remains ready
      if (target && target instanceof HTMLInputElement && target.dataset.scansink === 'true') {
        target.value = '';
      }

      onScan(result.code, result);
    } else {
      // Invalid barcode (length, prefix mismatch, etc.)
      if (settings.beepOnScan) {
        playInvalidScanBeep();
      }

      emitDiagnostic({
        type: 'invalid',
        raw: rawString,
        code: result.code,
        error: result.error,
        stats,
        result
      });

      options?.onInvalidScan?.(rawString, result.error);
    }
  }

  function onKeyDown(event: KeyboardEvent): void {
    // Ignore modifier combinations (Ctrl/Alt/Meta), but allow Shift
    if (event.ctrlKey || event.altKey || event.metaKey) {
      resetBuffer();
      return;
    }

    const now = performance.now();

    // Check if key is the expected suffix terminator
    if (isMatchingTerminator(event.key, settings.suffix)) {
      evaluateBurst(event.key, event.target, event);
      return;
    }

    // Non-matching terminator resets buffer so previous characters do not linger
    if (event.key === 'Enter' || event.key === 'Tab') {
      resetBuffer();
      return;
    }

    // Printable single-character keystroke
    if (event.key.length === 1) {
      const lastKeyTime = keyRecords.length > 0 ? keyRecords[keyRecords.length - 1].time : 0;
      const deltaMs = lastKeyTime > 0 ? Math.max(0, now - lastKeyTime) : 0;

      // If gap exceeds burst interval, clear prior buffer (it was a past pause)
      if (lastKeyTime > 0 && deltaMs > settings.maxBurstIntervalMs) {
        keyRecords = [];
      }

      keyRecords.push({ key: event.key, time: now });

      emitDiagnostic({
        type: 'keystroke',
        key: event.key,
        deltaMs: Math.round(deltaMs)
      });

      // Clear idle burst if no terminator or key arrives within 400ms
      if (staleTimer) clearTimeout(staleTimer);
      staleTimer = setTimeout(() => {
        if (settings.suffix !== 'None') {
          keyRecords = [];
        }
      }, 400);

      // If suffix is None, trigger scan evaluation when burst ends with idle gap
      if (settings.suffix === 'None') {
        if (noneSuffixTimer) clearTimeout(noneSuffixTimer);
        noneSuffixTimer = setTimeout(() => {
          if (keyRecords.length >= settings.minLength) {
            evaluateBurst('None', event.target);
          } else {
            resetBuffer();
          }
        }, 120);
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown, true);
  }

  return {
    stop: () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', onKeyDown, true);
        window.removeEventListener(SCANNER_SETTINGS_CHANGED_EVENT, onSettingsChanged);
      }
      resetBuffer();
    }
  };
}

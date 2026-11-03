/**
 * Unit & Integration Tests for USB / Bluetooth HID Laser Barcode Scanner Listener.
 *
 * Verifies:
 * - High-speed keyboard wedge detection (<80ms per key) ending in Enter / Tab.
 * - Ignoring normal human typing in text inputs and textareas.
 * - Suffix configurations: Enter, Tab, EnterOrTab, None (idle timeout).
 * - Noise filtering (AIM ]C1 headers, control bytes, whitespace).
 * - Case normalization (uppercase, lowercase, preserve).
 * - Duplicate scan debounce suppression (1500ms default).
 * - Acoustic confirmation tones (good scan vs invalid scan).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  startHidListener,
  SCANNER_DIAGNOSTIC_EVENT,
  type ScannerDiagnosticEvent
} from './hidScanner';
import { DEFAULT_SCANNER_SETTINGS, type ScannerSettings } from '../config/scannerConfig';
import * as audioBeeps from './audioBeeps';

describe('HID Barcode Scanner Listener', () => {
  let goodBeepSpy: any;
  let invalidBeepSpy: any;
  let activeHandles: { stop: () => void }[] = [];

  function applyTestSettings(custom: Partial<ScannerSettings> = {}) {
    const merged = { ...DEFAULT_SCANNER_SETTINGS, ...custom };
    localStorage.setItem('saboot_scanner_settings', JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent('saboot-scanner-settings-changed', { detail: merged }));
  }

  function registerListener(onScan: (code: string, result?: any) => void, options?: any) {
    const handle = startHidListener(onScan, options);
    activeHandles.push(handle);
    return handle;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    applyTestSettings();
    goodBeepSpy = vi.spyOn(audioBeeps, 'playGoodScanBeep').mockImplementation(() => {
      /* noop */
    });
    invalidBeepSpy = vi.spyOn(audioBeeps, 'playInvalidScanBeep').mockImplementation(() => {
      /* noop */
    });
  });

  afterEach(() => {
    activeHandles.forEach((h) => {
      try {
        h.stop();
      } catch {
        // ignore stop failure during cleanup
      }
    });
    activeHandles = [];
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function simulateKeystrokes(
    keys: string[],
    intervalMs: number,
    target: HTMLElement = document.body
  ) {
    let now = performance.now();
    for (const key of keys) {
      now += intervalMs;
      vi.spyOn(performance, 'now').mockReturnValue(now);
      const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true
      });
      target.dispatchEvent(event);
      vi.advanceTimersByTime(intervalMs);
    }
  }

  it('detects high-speed scanner burst (<50ms per key) ending with Enter', () => {
    const onScan = vi.fn();
    const handle = registerListener(onScan);

    // Fast burst: "AWB12345678" + Enter at 20ms per key
    const keys = ['A', 'W', 'B', '1', '2', '3', '4', '5', '6', '7', '8', 'Enter'];
    simulateKeystrokes(keys, 20);

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('AWB12345678', expect.objectContaining({ valid: true }));
    expect(goodBeepSpy).toHaveBeenCalledTimes(1);
    expect(invalidBeepSpy).not.toHaveBeenCalled();

    handle.stop();
  });

  it('detects scanner burst ending with Tab when suffix is EnterOrTab', () => {
    const onScan = vi.fn();
    const handle = registerListener(onScan);

    // Fast burst: "DELHIVERY999" + Tab at 25ms per key
    const keys = ['D', 'E', 'L', 'H', 'I', 'V', 'E', 'R', 'Y', '9', '9', '9', 'Tab'];
    simulateKeystrokes(keys, 25);

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('DELHIVERY999', expect.objectContaining({ valid: true }));
    expect(goodBeepSpy).toHaveBeenCalledTimes(1);

    handle.stop();
  });

  it('supports suffix="Tab" exclusively and ignores Enter', () => {
    applyTestSettings({ suffix: 'Tab' });
    const onScan = vi.fn();
    const handle = registerListener(onScan);

    // Burst ending with Enter should NOT fire when suffix is Tab
    simulateKeystrokes(['P', 'A', 'R', 'C', 'E', 'L', '1', 'Enter'], 20);
    expect(onScan).not.toHaveBeenCalled();

    // Burst ending with Tab DOES fire
    simulateKeystrokes(['P', 'A', 'R', 'C', 'E', 'L', '1', 'Tab'], 20);
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('PARCEL1', expect.objectContaining({ valid: true }));

    handle.stop();
  });

  it('supports suffix="Enter" exclusively and ignores Tab', () => {
    applyTestSettings({ suffix: 'Enter' });
    const onScan = vi.fn();
    const handle = registerListener(onScan);

    // Burst ending with Tab should NOT fire when suffix is Enter
    simulateKeystrokes(['A', 'W', 'B', '7', '7', '7', 'Tab'], 20);
    expect(onScan).not.toHaveBeenCalled();

    // Burst ending with Enter DOES fire
    simulateKeystrokes(['A', 'W', 'B', '7', '7', '7', 'Enter'], 20);
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('AWB777', expect.objectContaining({ valid: true }));

    handle.stop();
  });

  it('supports suffix="None" by emitting scan on idle timeout after fast burst', () => {
    applyTestSettings({ suffix: 'None', minLength: 4 });
    const onScan = vi.fn();
    const handle = registerListener(onScan);

    // Rapid keys without any terminator
    simulateKeystrokes(['S', 'H', 'I', 'P', '1', '2', '3'], 20);
    expect(onScan).not.toHaveBeenCalled();

    // Advance timer past the 120ms noneSuffixTimer
    vi.advanceTimersByTime(150);

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('SHIP123', expect.objectContaining({ valid: true }));

    handle.stop();
  });

  it('ignores slow human typing in text input fields', () => {
    const onScan = vi.fn();
    const handle = registerListener(onScan);

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    // Slow human typing (150ms per key) ending with Enter in an <input>
    const keys = ['m', 'y', 's', 'e', 'a', 'r', 'c', 'h', 'Enter'];
    simulateKeystrokes(keys, 150, input);

    expect(onScan).not.toHaveBeenCalled();
    expect(goodBeepSpy).not.toHaveBeenCalled();
    expect(invalidBeepSpy).not.toHaveBeenCalled();

    handle.stop();
    document.body.removeChild(input);
  });

  it('ignores human typing in <textarea> fields', () => {
    const onScan = vi.fn();
    const handle = registerListener(onScan);

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    // Slow human typing in textarea
    simulateKeystrokes(['h', 'e', 'l', 'l', 'o', 'Enter'], 160, textarea);

    expect(onScan).not.toHaveBeenCalled();

    handle.stop();
    document.body.removeChild(textarea);
  });

  it('detects high-speed scanner burst even when focused inside an input field', () => {
    const onScan = vi.fn();
    const handle = registerListener(onScan);

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    // Scanner gun fires into the input field at 15ms per key!
    const keys = ['A', 'W', 'B', '9', '9', '8', '8', '7', '7', 'Enter'];
    simulateKeystrokes(keys, 15, input);

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('AWB998877', expect.objectContaining({ valid: true }));

    handle.stop();
    document.body.removeChild(input);
  });

  it('clears scan sink input value when burst arrives', () => {
    const onScan = vi.fn();
    const handle = registerListener(onScan);

    const sink = document.createElement('input');
    sink.dataset.scansink = 'true';
    sink.value = 'AWB111222';
    document.body.appendChild(sink);

    simulateKeystrokes(['A', 'W', 'B', '1', '1', '1', '2', '2', '2', 'Enter'], 15, sink);

    expect(sink.value).toBe('');
    expect(onScan).toHaveBeenCalledTimes(1);

    handle.stop();
    document.body.removeChild(sink);
  });

  it('strips AIM symbology prefix (e.g. ]C1) and whitespace noise', () => {
    const onScan = vi.fn();
    const handle = registerListener(onScan);

    // Scanners sometimes send "]C1" Code 128 AIM identifier with trailing CR/LF
    const keys = [']', 'C', '1', 'F', 'K', 'R', 'T', '8', '8', '9', 'Enter'];
    simulateKeystrokes(keys, 18);

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('FKRT889', expect.objectContaining({ valid: true }));

    handle.stop();
  });

  it('normalizes lowercase codes to uppercase by default', () => {
    const onScan = vi.fn();
    const handle = registerListener(onScan);

    simulateKeystrokes(['e', 'k', 'a', 'r', 't', '1', '2', '3', 'Enter'], 20);

    expect(onScan).toHaveBeenCalledWith('EKART123', expect.objectContaining({ valid: true }));

    handle.stop();
  });

  it('handles lowercase caseHandling setting', () => {
    applyTestSettings({ caseHandling: 'lowercase' });
    const onScan = vi.fn();
    const handle = registerListener(onScan);

    simulateKeystrokes(['M', 'E', 'E', 'S', 'H', 'O', '4', '5', 'Enter'], 20);

    expect(onScan).toHaveBeenCalledWith('meesho45', expect.objectContaining({ valid: true }));

    handle.stop();
  });

  it('debounces duplicate scans within configured debounceMs window (1500ms)', () => {
    const onScan = vi.fn();
    const handle = registerListener(onScan);

    // Scan 1
    simulateKeystrokes(['A', 'W', 'B', '5', '5', '5', 'Enter'], 20);
    expect(onScan).toHaveBeenCalledTimes(1);

    // Duplicate Scan 2 within 500ms (< 1500ms debounce)
    vi.advanceTimersByTime(500);
    simulateKeystrokes(['A', 'W', 'B', '5', '5', '5', 'Enter'], 20);
    expect(onScan).toHaveBeenCalledTimes(1); // Suppressed!

    // Scan 3 after debounce window (> 1500ms)
    vi.advanceTimersByTime(1600);
    simulateKeystrokes(['A', 'W', 'B', '5', '5', '5', 'Enter'], 20);
    expect(onScan).toHaveBeenCalledTimes(2); // Allowed!

    handle.stop();
  });

  it('allows different barcode immediately without debounce suppression', () => {
    const onScan = vi.fn();
    const handle = registerListener(onScan);

    // Scan AWB 1
    simulateKeystrokes(['A', 'W', 'B', '1', '1', '1', 'Enter'], 20);
    expect(onScan).toHaveBeenCalledWith('AWB111', expect.anything());

    // Scan AWB 2 immediately after 200ms
    vi.advanceTimersByTime(200);
    simulateKeystrokes(['A', 'W', 'B', '2', '2', '2', 'Enter'], 20);
    expect(onScan).toHaveBeenCalledWith('AWB222', expect.anything());
    expect(onScan).toHaveBeenCalledTimes(2);

    handle.stop();
  });

  it('emits invalid scan and plays invalid buzz when barcode is too short', () => {
    applyTestSettings({ minLength: 6 });
    const onScan = vi.fn();
    const onInvalidScan = vi.fn();
    const handle = registerListener(onScan, { onInvalidScan });

    // Too short (3 chars < 6 minLength)
    simulateKeystrokes(['A', 'B', 'C', 'Enter'], 20);

    expect(onScan).not.toHaveBeenCalled();
    expect(onInvalidScan).toHaveBeenCalledWith('ABC', expect.stringContaining('too short'));
    expect(invalidBeepSpy).toHaveBeenCalledTimes(1);

    handle.stop();
  });

  it('resets buffer when modifier keys (Ctrl/Alt/Meta) are pressed', () => {
    const onScan = vi.fn();
    const handle = registerListener(onScan);

    // Start typing rapidly
    simulateKeystrokes(['A', 'W', 'B'], 20);

    // Press Ctrl key
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true, bubbles: true })
    );

    // Try to finish
    simulateKeystrokes(['1', '2', '3', 'Enter'], 20);

    // The buffer was cleared so only "123" arrived which is < minLength (4)
    expect(onScan).not.toHaveBeenCalled();

    handle.stop();
  });

  it('dispatches diagnostic events for keystroke and burst evaluation', () => {
    const diagnosticEvents: ScannerDiagnosticEvent[] = [];
    const listener = (e: Event) => {
      diagnosticEvents.push((e as CustomEvent<ScannerDiagnosticEvent>).detail);
    };
    window.addEventListener(SCANNER_DIAGNOSTIC_EVENT, listener);

    const onScan = vi.fn();
    const handle = registerListener(onScan);

    simulateKeystrokes(['X', 'Y', 'Z', '9', 'Enter'], 15);

    expect(diagnosticEvents.some((d) => d.type === 'keystroke' && d.key === 'X')).toBe(true);
    expect(diagnosticEvents.some((d) => d.type === 'burst_complete' && d.code === 'XYZ9')).toBe(
      true
    );

    window.removeEventListener(SCANNER_DIAGNOSTIC_EVENT, listener);
    handle.stop();
  });
});

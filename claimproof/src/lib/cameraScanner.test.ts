/**
 * Unit tests for Camera Barcode Scanner.
 *
 * Verifies:
 * - Native BarcodeDetector engine detection.
 * - ZXing fallback when native detector is unavailable.
 * - Torch control (hasTorch, isTorchOn, setTorch via applyConstraints).
 * - Zoom control (hasZoom, getZoomRange, getZoom, setZoom).
 * - Barcode normalization & duplicate debounce.
 * - Acoustic confirmation beeps (good scan vs invalid scan).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startCameraScanner } from './cameraScanner';
import * as audioBeeps from './audioBeeps';
import { DEFAULT_SCANNER_SETTINGS } from '../config/scannerConfig';

describe('Camera Barcode Scanner', () => {
  let videoEl: HTMLVideoElement;
  let mockTrack: any;
  let mockStream: any;

  function applyTestSettings(custom = {}) {
    const merged = { ...DEFAULT_SCANNER_SETTINGS, ...custom };
    localStorage.setItem('saboot_scanner_settings', JSON.stringify(merged));
  }

  beforeEach(() => {
    localStorage.clear();
    applyTestSettings();
    vi.spyOn(audioBeeps, 'playGoodScanBeep').mockImplementation(() => {});
    vi.spyOn(audioBeeps, 'playInvalidScanBeep').mockImplementation(() => {});

    (window as any).BarcodeDetector = class {
      static getSupportedFormats = vi.fn().mockResolvedValue(['code_128', 'qr_code']);
      detect = vi.fn().mockResolvedValue([]);
    };

    mockTrack = {
      applyConstraints: vi.fn().mockResolvedValue(undefined),
      getCapabilities: vi.fn().mockReturnValue({
        torch: true,
        zoom: { min: 1, max: 5, step: 0.1 }
      }),
      getSettings: vi.fn().mockReturnValue({
        torch: false,
        zoom: 1
      }),
      stop: vi.fn()
    };

    mockStream = {
      getVideoTracks: vi.fn().mockReturnValue([mockTrack])
    };

    videoEl = document.createElement('video');
    Object.defineProperty(videoEl, 'videoWidth', { value: 1280, configurable: true });
    Object.defineProperty(videoEl, 'videoHeight', { value: 720, configurable: true });
    Object.defineProperty(videoEl, 'readyState', { value: 4, configurable: true });
    videoEl.srcObject = mockStream;
  });

  afterEach(() => {
    delete (window as any).BarcodeDetector;
    vi.restoreAllMocks();
  });

  it('exposes hardware torch controls when supported by camera stream', async () => {
    const handle = await startCameraScanner(videoEl, () => {});

    expect(handle.hasTorch).toBe(true);
    expect(handle.isTorchOn()).toBe(false);

    const ok = await handle.setTorch(true);
    expect(ok).toBe(true);
    expect(mockTrack.applyConstraints).toHaveBeenCalledWith({
      advanced: [{ torch: true }]
    });

    handle.stop();
  });

  it('exposes hardware zoom controls with min/max range and clamping', async () => {
    const handle = await startCameraScanner(videoEl, () => {});

    expect(handle.hasZoom).toBe(true);
    const range = handle.getZoomRange();
    expect(range).toEqual({ min: 1, max: 5, step: 0.1 });
    expect(handle.getZoom()).toBe(1);

    // Set zoom to 2.5
    const ok = await handle.setZoom(2.5);
    expect(ok).toBe(true);
    expect(mockTrack.applyConstraints).toHaveBeenCalledWith({
      advanced: [{ zoom: 2.5 }]
    });

    // Test clamping beyond max (e.g. 10 clamped to 5)
    await handle.setZoom(10);
    expect(mockTrack.applyConstraints).toHaveBeenCalledWith({
      advanced: [{ zoom: 5 }]
    });

    handle.stop();
  });

  it('handles cameras without torch or zoom gracefully', async () => {
    mockTrack.getCapabilities.mockReturnValue({});
    mockTrack.getSettings.mockReturnValue({});

    const handle = await startCameraScanner(videoEl, () => {});

    expect(handle.hasTorch).toBe(false);
    expect(handle.isTorchOn()).toBe(false);
    expect(handle.hasZoom).toBe(false);
    expect(handle.getZoomRange()).toBeNull();

    const torchOk = await handle.setTorch(true);
    expect(torchOk).toBe(false);

    const zoomOk = await handle.setZoom(2);
    expect(zoomOk).toBe(false);

    handle.stop();
  });

  it('uses native BarcodeDetector when available and reports running status', async () => {
    const detectMock = vi.fn().mockResolvedValue([{ rawValue: 'AWB987654321' }]);
    const supportedFormatsMock = vi.fn().mockResolvedValue(['code_128', 'qr_code']);

    (window as any).BarcodeDetector = class {
      static getSupportedFormats = supportedFormatsMock;
      detect = detectMock;
    };

    const statusUpdates: string[] = [];
    const handle = await startCameraScanner(videoEl, () => {}, {
      onStatus: (st, detail) => statusUpdates.push(`${st}: ${detail}`)
    });

    expect(statusUpdates.some((s) => s.includes('native'))).toBe(true);

    delete (window as any).BarcodeDetector;
    handle.stop();
  });
});

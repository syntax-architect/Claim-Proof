/**
 * Camera barcode scanner for SABOOT Suite.
 *
 * Supports native BarcodeDetector Web API with automatic @zxing/library fallback,
 * running on a hidden offscreen canvas.
 *
 * Features:
 * - Hardware torch / flashlight control where supported (Android, PTZ webcams).
 * - Hardware zoom control where supported (MediaTrackCapabilities.zoom).
 * - Barcode normalization, noise stripping, prefix, and case handling via processBarcodeCode.
 * - Acoustic feedback beeps for valid and invalid scans.
 * - Configurable duplicate scan debounce.
 */

import { getScannerSettings, processBarcodeCode } from '../config/scannerConfig';
import { playGoodScanBeep, playInvalidScanBeep } from './audioBeeps';

export type ScannerStatus = 'idle' | 'running' | 'error';

export interface CameraScannerOptions {
  onStatus?: (status: ScannerStatus, detail?: string) => void;
  onInvalidScan?: (raw: string, error?: string) => void;
}

export interface CameraScannerHandle {
  stop: () => void;
  hasTorch: boolean;
  isTorchOn: () => boolean;
  setTorch: (enabled: boolean) => Promise<boolean>;
  hasZoom: boolean;
  getZoomRange: () => { min: number; max: number; step: number } | null;
  getZoom: () => number;
  setZoom: (value: number) => Promise<boolean>;
}

const PREFERRED_FORMATS = [
  'code_128',
  'code_39',
  'code_93',
  'codabar',
  'ean_13',
  'ean_8',
  'itf',
  'qr_code'
];

export async function startCameraScanner(
  video: HTMLVideoElement,
  onDetect: (code: string) => void,
  opts?: CameraScannerOptions
): Promise<CameraScannerHandle> {
  let stopped = false;
  let raf = 0;
  let busy = false;
  let lastRun = 0;
  let lastCode = '';
  let lastAt = 0;
  let lastInvalidCode = '';
  let lastInvalidAt = 0;

  const offscreen = document.createElement('canvas');
  const offCtx = offscreen.getContext('2d', { willReadFrequently: true });

  function getTrack(): MediaStreamTrack | null {
    const stream = video.srcObject as MediaStream | null;
    if (!stream || !stream.getVideoTracks) return null;
    const tracks = stream.getVideoTracks();
    return tracks.length > 0 ? tracks[0] : null;
  }

  function getCapabilities(): any {
    const track = getTrack();
    if (!track || !track.getCapabilities) return {};
    try {
      return track.getCapabilities() || {};
    } catch {
      return {};
    }
  }

  const initialCaps = getCapabilities();
  const hasTorch = Boolean(initialCaps.torch);
  const hasZoom = Boolean(initialCaps.zoom);

  function isTorchOn(): boolean {
    const track = getTrack();
    if (!track || !track.getSettings) return false;
    try {
      const s = track.getSettings() as any;
      return Boolean(s?.torch);
    } catch {
      return false;
    }
  }

  async function setTorch(enabled: boolean): Promise<boolean> {
    const track = getTrack();
    if (!track || !hasTorch) return false;
    try {
      await track.applyConstraints({
        advanced: [{ torch: enabled } as any]
      });
      return true;
    } catch {
      return false;
    }
  }

  function getZoomRange(): { min: number; max: number; step: number } | null {
    const caps = getCapabilities();
    if (!caps || !caps.zoom) return null;
    return {
      min: Number(caps.zoom.min) || 1,
      max: Number(caps.zoom.max) || 1,
      step: Number(caps.zoom.step) || 0.1
    };
  }

  function getZoom(): number {
    const track = getTrack();
    if (!track || !track.getSettings) return 1;
    try {
      const s = track.getSettings() as any;
      return Number(s?.zoom) || 1;
    } catch {
      return 1;
    }
  }

  async function setZoom(value: number): Promise<boolean> {
    const track = getTrack();
    if (!track) return false;
    const range = getZoomRange();
    if (!range) return false;
    const clamped = Math.max(range.min, Math.min(range.max, value));
    try {
      await track.applyConstraints({
        advanced: [{ zoom: clamped } as any]
      });
      return true;
    } catch {
      return false;
    }
  }

  function drawOffscreen(): void {
    if (!offCtx) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;
    const scale = Math.min(1, 960 / vw);
    offscreen.width = Math.round(vw * scale);
    offscreen.height = Math.round(vh * scale);
    offCtx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
  }

  /* Native engine first. */
  let detector: BarcodeDetector | null = null;
  if (typeof window !== 'undefined' && window.BarcodeDetector) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      const formats = PREFERRED_FORMATS.filter((f) => supported.includes(f));
      detector = new window.BarcodeDetector({
        formats: formats.length > 0 ? formats : PREFERRED_FORMATS
      });
    } catch {
      detector = null;
    }
  }

  /* ZXing fallback. */
  type ZxingReader = { decodeFromCanvas(canvas: HTMLCanvasElement): { getText(): string } };
  let zxingReader: ZxingReader | null = null;
  if (!detector) {
    try {
      const zxing = await import('@zxing/library');
      zxingReader = new zxing.BrowserMultiFormatReader() as unknown as ZxingReader;
    } catch (e) {
      opts?.onStatus?.('error', e instanceof Error ? e.message : 'No barcode engine available');
      return {
        stop: () => {
          stopped = true;
        },
        hasTorch,
        isTorchOn,
        setTorch,
        hasZoom,
        getZoomRange,
        getZoom,
        setZoom
      };
    }
  }

  opts?.onStatus?.('running', detector ? 'BarcodeDetector (native)' : 'ZXing fallback');

  const loop = (t: number) => {
    if (stopped) return;
    raf = requestAnimationFrame(loop);
    const minGap = detector ? 33 : 80; /* ~30 fps native, ~12 fps ZXing (CPU guard) */
    if (busy || t - lastRun < minGap || video.readyState < 2) return;
    busy = true;
    lastRun = t;
    void (async () => {
      try {
        let rawCode: string | null = null;
        if (detector) {
          try {
            const found = await detector.detect(video);
            if (found.length > 0) rawCode = found[0].rawValue;
          } catch {
            drawOffscreen();
            if (offCtx) {
              const found = await detector.detect(offscreen);
              if (found.length > 0) rawCode = found[0].rawValue;
            }
          }
        } else if (zxingReader && offCtx) {
          drawOffscreen();
          try {
            rawCode = zxingReader.decodeFromCanvas(offscreen).getText();
          } catch {
            /* nothing decoded this frame */
          }
        }

        if (rawCode && rawCode.trim()) {
          const settings = getScannerSettings();
          const processed = processBarcodeCode(rawCode, settings);

          if (processed.valid) {
            const now = Date.now();
            if (processed.code !== lastCode || now - lastAt > settings.debounceMs) {
              lastCode = processed.code;
              lastAt = now;
              if (settings.beepOnScan) {
                playGoodScanBeep();
              }
              onDetect(processed.code);
            }
          } else {
            const now = Date.now();
            if (rawCode !== lastInvalidCode || now - lastInvalidAt > 2000) {
              lastInvalidCode = rawCode;
              lastInvalidAt = now;
              if (settings.beepOnScan) {
                playInvalidScanBeep();
              }
              opts?.onInvalidScan?.(rawCode, processed.error);
            }
          }
        }
      } catch (e) {
        opts?.onStatus?.('error', e instanceof Error ? e.message : String(e));
      } finally {
        busy = false;
      }
    })();
  };

  raf = requestAnimationFrame(loop);

  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
    },
    hasTorch,
    isTorchOn,
    setTorch,
    hasZoom,
    getZoomRange,
    getZoom,
    setZoom
  };
}

/* Camera barcode scanner — native BarcodeDetector Web API with an automatic
 * ZXing fallback, running on a hidden offscreen canvas. */

export type ScannerStatus = 'idle' | 'running' | 'error';

export interface CameraScannerHandle {
  stop: () => void;
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

const SAME_CODE_DEBOUNCE_MS = 1500;

export async function startCameraScanner(
  video: HTMLVideoElement,
  onDetect: (code: string) => void,
  opts?: { onStatus?: (status: ScannerStatus, detail?: string) => void }
): Promise<CameraScannerHandle> {
  let stopped = false;
  let raf = 0;
  let busy = false;
  let lastRun = 0;
  let lastCode = '';
  let lastAt = 0;

  const offscreen = document.createElement('canvas');
  const offCtx = offscreen.getContext('2d', { willReadFrequently: true });

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
        }
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
        let code: string | null = null;
        if (detector) {
          try {
            const found = await detector.detect(video);
            if (found.length > 0) code = found[0].rawValue;
          } catch {
            drawOffscreen();
            if (offCtx) {
              const found = await detector.detect(offscreen);
              if (found.length > 0) code = found[0].rawValue;
            }
          }
        } else if (zxingReader && offCtx) {
          drawOffscreen();
          try {
            code = zxingReader.decodeFromCanvas(offscreen).getText();
          } catch {
            /* nothing decoded this frame */
          }
        }
        if (code && code.trim()) {
          const now = Date.now();
          const trimmed = code.trim();
          if (trimmed !== lastCode || now - lastAt > SAME_CODE_DEBOUNCE_MS) {
            lastCode = trimmed;
            lastAt = now;
            onDetect(trimmed);
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
    }
  };
}

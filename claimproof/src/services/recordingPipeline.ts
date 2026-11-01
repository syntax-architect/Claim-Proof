/* ClaimProof AWB — canvas video compositor + MediaRecorder pipeline.
 * Draws the camera (or a synthetic demo scene) onto a 1280×720 canvas with a
 * burnt-in forensic bar, records at 1.2 Mbps (≈ under 4.5 MB for 30 s), and
 * extracts four timed JPEG stills stitched into a 2×2 evidence collage. */

import { formatIST } from '../lib/dateUtils';
import { triggerEmergencySave } from './recorderCrashGuard';
import type { RecordingType } from '../types';

export type CameraErrorType =
  'permission_denied' | 'not_found' | 'in_use' | 'device_unplugged' | 'unknown' | null;

export type ContainerFormat = 'mp4' | 'webm' | 'unknown';

export function getContainerFormat(mime: string): ContainerFormat {
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('webm')) return 'webm';
  return 'unknown';
}

export interface ForensicMeta {
  awb: string;
  orderId: string;
  sku: string;
  qty: number;
  courier: string;
  type: RecordingType;
  freeTier: boolean;
}

export interface PipelineEvents {
  onPhotoTaken?: (index: 0 | 1 | 2 | 3, dataUrl: string) => void;
  onElapsed?: (sec: number) => void;
  onMaxDurationReached?: () => void;
  onCameraDisconnected?: () => void;
}

export interface RecordingResult {
  videoBlob: Blob;
  videoMime: string;
  durationSec: number;
  photoCollage: Blob | null;
  containerFormat: ContainerFormat;
}

const WIDTH = 1280;
const HEIGHT = 720;
const BAR_H = 46;

const PHOTO_SCHEDULE: { index: 0 | 1 | 2 | 3; at: number }[] = [
  { index: 0, at: 500 },
  { index: 1, at: 3000 },
  { index: 2, at: 6000 },
  { index: 3, at: 9000 }
];

const PHOTO_CAPTIONS = ['T+0.5s · AWB', 'T+3s · PRODUCT', 'T+6s · BACK / WEIGHT', 'T+9s · SEALED'];

const MIME_CANDIDATES = [
  'video/mp4;codecs="avc1.42E01E"',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm'
];

export function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const mime of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return '';
}

export class RecordingPipeline {
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private stream: MediaStream | null = null;
  private mode: 'camera' | 'demo' | null = null;
  private forceDemo: boolean;
  private demoT0 = 0;
  private compositorRaf = 0;
  private cameraError: CameraErrorType = null;

  private recorder: MediaRecorder | null = null;
  private mime = '';
  private chunks: Blob[] = [];
  private recordedBytes = 0;
  private maxDurationSec = 300;
  private meta: ForensicMeta | null = null;
  private events: PipelineEvents | null = null;
  private startedAt = 0;
  private lastElapsedSec = -1;
  private photoBlobs: (Blob | null)[] = [null, null, null, null];
  private photoTimers: ReturnType<typeof setTimeout>[] = [];

  private throttleInterval: ReturnType<typeof setInterval> | null = null;
  private boundVisibilityHandler: (() => void) | null = null;

  constructor(opts?: { demoMode?: boolean }) {
    this.forceDemo = opts?.demoMode ?? false;
  }

  get bound(): 'camera' | 'demo' | null {
    return this.mode;
  }

  get recording(): boolean {
    return this.recorder !== null;
  }

  get recordingSince(): number | null {
    return this.recorder ? Date.now() - Math.round(performance.now() - this.startedAt) : null;
  }

  get cameraErrorType(): CameraErrorType {
    return this.cameraError;
  }

  get containerFormat(): ContainerFormat {
    return getContainerFormat(this.mime || pickMime());
  }

  get isWebM(): boolean {
    return this.containerFormat === 'webm';
  }

  get isMp4(): boolean {
    return this.containerFormat === 'mp4';
  }

  get currentRecordedBytes(): number {
    return this.recordedBytes;
  }

  async bind(video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<'camera' | 'demo'> {
    this.video = video;
    this.canvas = canvas;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    this.ctx = canvas.getContext('2d');
    this.cameraError = null;

    if (!this.forceDemo) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        video.srcObject = this.stream;
        video.muted = true;
        video.playsInline = true;
        try {
          await video.play();
        } catch {
          /* best effort autoplay */
        }
        this.mode = 'camera';

        // Monitor camera tracks for mid-recording disconnects
        this.attachTrackListeners(this.stream);
      } catch (err: unknown) {
        const errName =
          typeof err === 'object' && err !== null && 'name' in err && typeof (err as { name: unknown }).name === 'string'
            ? (err as { name: string }).name
            : err instanceof Error
              ? err.name
              : '';
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          this.cameraError = 'permission_denied';
        } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
          this.cameraError = 'not_found';
        } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
          this.cameraError = 'in_use';
        } else {
          this.cameraError = 'unknown';
        }
        this.mode = 'demo';
      }
    } else {
      this.mode = 'demo';
    }

    if (this.mode === 'demo') this.demoT0 = performance.now();
    this.startCompositor();
    this.setupVisibilityListener();
    return this.mode;
  }

  startRecording(
    meta: ForensicMeta,
    events?: PipelineEvents,
    options?: { maxDurationSec?: number }
  ): void {
    if (!this.canvas || this.recorder) return;
    this.meta = meta;
    this.events = events ?? null;
    this.photoBlobs = [null, null, null, null];
    this.lastElapsedSec = -1;
    this.startedAt = performance.now();
    this.recordedBytes = 0;
    this.maxDurationSec = options?.maxDurationSec ?? 300;

    const mime = pickMime();
    this.mime = mime;
    try {
      const stream = this.canvas.captureStream(24);
      this.recorder = new MediaRecorder(stream, {
        ...(mime ? { mimeType: mime } : {}),
        videoBitsPerSecond: 1_200_000
      });
      this.chunks = [];
      this.recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.chunks.push(e.data);
          this.recordedBytes += e.data.size;
        }
      };
      this.recorder.onerror = (e) => {
        console.error('[recordingPipeline] MediaRecorder error:', e);
        void triggerEmergencySave(e);
      };
      this.recorder.start(250);
      this.photoTimers = PHOTO_SCHEDULE.map(({ index, at }) =>
        setTimeout(() => void this.capturePhoto(index), at)
      );
    } catch (e) {
      console.error('[recordingPipeline] failed to start MediaRecorder:', e);
      this.recorder = null;
    }
  }

  async stopRecording(): Promise<RecordingResult | null> {
    if (!this.recorder) return null;
    const recorder = this.recorder;
    this.recorder = null;
    this.photoTimers.forEach(clearTimeout);
    this.photoTimers = [];

    const durationSec = Math.max(1, Math.round((performance.now() - this.startedAt) / 1000));
    const chunks = this.chunks;
    const mime = this.mime || 'video/webm';

    const blob = await new Promise<Blob>((resolve) => {
      let resolved = false;
      const done = () => {
        if (!resolved) {
          resolved = true;
          resolve(new Blob(chunks, { type: mime }));
        }
      };
      recorder.onstop = done;
      const safetyTimer = setTimeout(done, 1200);

      try {
        if (recorder.state === 'recording') {
          try {
            recorder.requestData();
          } catch {
            /* best effort */
          }
        }
        if (recorder.state !== 'inactive') {
          recorder.stop();
        } else {
          clearTimeout(safetyTimer);
          done();
        }
      } catch {
        clearTimeout(safetyTimer);
        done();
      }
    });

    const photos = this.photoBlobs;
    this.photoBlobs = [null, null, null, null];
    const collage = photos.every((p) => p !== null) ? await stitchCollage(photos as Blob[]) : null;

    return {
      videoBlob: blob,
      videoMime: mime,
      durationSec,
      photoCollage: collage,
      containerFormat: getContainerFormat(mime)
    };
  }

  async release(): Promise<void> {
    cancelAnimationFrame(this.compositorRaf);
    if (this.throttleInterval) {
      clearInterval(this.throttleInterval);
      this.throttleInterval = null;
    }
    if (this.boundVisibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
      this.boundVisibilityHandler = null;
    }
    if (this.recorder) {
      try {
        this.recorder.stop();
      } catch {
        /* already stopped */
      }
      this.recorder = null;
    }
    this.photoTimers.forEach(clearTimeout);
    this.photoTimers = [];
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.mode = null;
  }

  /* ── internals ────────────────────────────────────────────────────── */

  private attachTrackListeners(stream: MediaStream): void {
    const tracks = stream.getVideoTracks();
    for (const track of tracks) {
      track.onended = () => {
        this.handleCameraDisconnect();
      };
    }
  }

  private handleCameraDisconnect(): void {
    console.warn('[recordingPipeline] Camera disconnected / track ended.');
    const wasRecording = this.recording;
    this.cameraError = 'device_unplugged';
    this.mode = 'demo';
    this.events?.onCameraDisconnected?.();
    if (wasRecording) {
      void triggerEmergencySave('camera_disconnected');
    }
  }

  private setupVisibilityListener(): void {
    if (typeof document === 'undefined') return;
    if (this.boundVisibilityHandler) return;

    this.boundVisibilityHandler = () => {
      if (document.hidden) {
        // Tab backgrounded/hidden: requestAnimationFrame paused by browser.
        // Fallback interval keeps canvas frames rendering with live IST timestamps
        if (!this.throttleInterval) {
          this.throttleInterval = setInterval(() => {
            this.drawFrame();
          }, 100);
        }
      } else {
        if (this.throttleInterval) {
          clearInterval(this.throttleInterval);
          this.throttleInterval = null;
        }
      }
    };

    document.addEventListener('visibilitychange', this.boundVisibilityHandler);
  }

  private startCompositor(): void {
    const loop = () => {
      this.compositorRaf = requestAnimationFrame(loop);
      this.drawFrame();
    };
    this.compositorRaf = requestAnimationFrame(loop);
  }

  private drawFrame(): void {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;

    /* Source frame (cover-fit). */
    if (this.mode === 'camera' && this.video && this.video.videoWidth > 0) {
      const vw = this.video.videoWidth;
      const vh = this.video.videoHeight;
      const scale = Math.max(WIDTH / vw, HEIGHT / vh);
      const w = vw * scale;
      const h = vh * scale;
      ctx.drawImage(this.video, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h);
    } else {
      this.drawDemoScene(ctx);
    }

    this.drawForensicBar(ctx);
    if (this.meta?.freeTier && this.recorder) this.drawFreeWatermark(ctx);

    /* Elapsed ticker & max-duration monitor. */
    if (this.recorder && this.events?.onElapsed) {
      const sec = Math.floor((performance.now() - this.startedAt) / 1000);
      if (sec !== this.lastElapsedSec) {
        this.lastElapsedSec = sec;
        this.events.onElapsed(sec);
        if (this.maxDurationSec > 0 && sec >= this.maxDurationSec) {
          this.events.onMaxDurationReached?.();
        }
      }
    }
  }

  private async capturePhoto(index: 0 | 1 | 2 | 3): Promise<void> {
    if (!this.canvas || !this.recorder) return;
    const off = document.createElement('canvas');
    off.width = WIDTH;
    off.height = HEIGHT;
    const offCtx = off.getContext('2d');
    if (!offCtx) return;
    offCtx.drawImage(this.canvas, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      off.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
    );
    if (!blob) return;
    this.photoBlobs[index] = blob;
    this.events?.onPhotoTaken?.(index, off.toDataURL('image/jpeg', 0.55));
  }

  private drawForensicBar(ctx: CanvasRenderingContext2D): void {
    const recording = this.recorder !== null;
    const meta = this.meta;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
    ctx.fillRect(0, 0, WIDTH, BAR_H);
    ctx.fillStyle = 'rgba(52, 211, 153, 0.9)';
    ctx.fillRect(0, BAR_H - 2, WIDTH, 2);

    /* REC dot + elapsed on the left. */
    if (recording) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
      ctx.fillStyle = `rgba(239, 68, 68, ${0.45 + 0.55 * pulse})`;
      ctx.beginPath();
      ctx.arc(22, BAR_H / 2, 7, 0, Math.PI * 2);
      ctx.fill();
      const elapsed = Math.max(0, Math.floor((performance.now() - this.startedAt) / 1000));
      const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const ss = String(elapsed % 60).padStart(2, '0');
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px "JetBrains Mono", monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText(`REC ${mm}:${ss}`, 38, BAR_H / 2 + 1);
    } else {
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(22, BAR_H / 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    /* Forensic text — auto-shrinks to fit the space right of the REC badge.
     * Uses real-time wall-clock IST timestamp Date.now(). */
    const text =
      recording && meta
        ? `VERIFIED UNCUT PROOF | AWB: ${meta.awb} | ORDER: ${meta.orderId} | SKU: ${meta.sku} (Qty: ${meta.qty}) | ${formatIST(Date.now())} | ClaimProof.in`
        : `ClaimProof.in — PACKING STATION LIVE · ${formatIST(Date.now())}`;
    const textX = recording ? 150 : 38;
    const maxTextW = WIDTH - textX - 16;
    let size = 15;
    ctx.font = `bold ${size}px "JetBrains Mono", monospace`;
    while (ctx.measureText(text).width > maxTextW && size > 8.5) {
      size -= 0.5;
      ctx.font = `bold ${size}px "JetBrains Mono", monospace`;
    }
    ctx.fillStyle = recording ? '#ffffff' : 'rgba(226, 232, 240, 0.85)';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, textX, BAR_H / 2 + 1);
    ctx.restore();
  }

  private drawFreeWatermark(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const text = 'Recorded via ClaimProof.in — Free Tier';
    ctx.font = 'bold 14px "JetBrains Mono", monospace';
    const w = ctx.measureText(text).width + 20;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(WIDTH - w - 10, HEIGHT - 34, w, 24);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, WIDTH - w, HEIGHT - 22);
    ctx.restore();
  }

  /* Synthetic packing scene for machines without a webcam — makes the whole
   * state machine demo-able end to end. */
  private drawDemoScene(ctx: CanvasRenderingContext2D): void {
    const t = (performance.now() - this.demoT0) / 1000;
    const awb = this.meta?.awb ?? 'DEMO-0000000000';

    const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bg.addColorStop(0, '#0b0f14');
    bg.addColorStop(1, '#161d27');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    /* Table. */
    const table = ctx.createLinearGradient(0, 470, 0, HEIGHT);
    table.addColorStop(0, '#232b38');
    table.addColorStop(1, '#10151d');
    ctx.fillStyle = table;
    ctx.fillRect(0, 470, WIDTH, HEIGHT - 470);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.fillRect(0, 468, WIDTH, 3);

    /* Cardboard box with a gentle "breathing" wobble. */
    const wobble = Math.sin(t * 1.4) * 6;
    const boxX = 400 + wobble;
    const boxY = 210 + Math.cos(t * 1.1) * 4;
    const boxW = 460;
    const boxH = 280;
    ctx.save();
    ctx.translate(boxX + boxW / 2, boxY + boxH / 2);
    ctx.rotate(Math.sin(t * 0.5) * 0.012);
    ctx.translate(-(boxX + boxW / 2), -(boxY + boxH / 2));

    ctx.fillStyle = '#8a6a48';
    ctx.strokeStyle = '#5f4730';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();

    /* Flaps + tape. */
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(boxX, boxY + 60);
    ctx.lineTo(boxX + boxW, boxY + 60);
    ctx.stroke();
    ctx.fillStyle = 'rgba(200, 190, 170, 0.75)';
    ctx.fillRect(boxX + boxW / 2 - 26, boxY, 52, boxH);

    /* AWB sticker. */
    const stX = boxX + 46;
    const stY = boxY + 92;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(stX, stY, 200, 108, 6);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px "JetBrains Mono", monospace';
    ctx.fillText(awb.slice(0, 18), stX + 12, stY + 26);
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#475569';
    ctx.fillText('VERIFIED DISPATCH · ClaimProof.in', stX + 12, stY + 44);
    /* Fake barcode. */
    let bx = stX + 12;
    const seed = [...awb].reduce((s, ch) => s + ch.charCodeAt(0), 0);
    for (let i = 0; i < 34 && bx < stX + 186; i++) {
      const bw = ((seed * (i + 3)) % 5) + 2;
      ctx.fillStyle = i % 2 === 0 ? '#0f172a' : 'transparent';
      ctx.fillRect(bx, stY + 58, bw, 36);
      bx += bw + 2;
    }
    ctx.restore();

    /* Sweeping highlight so the scene feels alive. */
    const sweep = ((t * 90) % (WIDTH + 400)) - 200;
    const grad = ctx.createLinearGradient(sweep - 120, 0, sweep + 120, HEIGHT);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}

/* 2×2 evidence collage with caption strips. */
async function stitchCollage(photos: Blob[]): Promise<Blob> {
  const cellW = 640;
  const cellH = 360;
  const captionH = 28;
  const pad = 12;
  const gap = 12;
  const W = pad + cellW + gap + cellW + pad;
  const H = pad + (cellH + captionH) + gap + (cellH + captionH) + pad;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Collage canvas unavailable');

  ctx.fillStyle = '#05070b';
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = pad + col * (cellW + gap);
    const y = pad + row * (cellH + captionH + gap);

    try {
      const bitmap = await createImageBitmap(photos[i]);
      const scale = Math.max(cellW / bitmap.width, cellH / bitmap.height);
      const w = bitmap.width * scale;
      const h = bitmap.height * scale;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cellW, cellH);
      ctx.clip();
      ctx.drawImage(bitmap, x + (cellW - w) / 2, y + (cellH - h) / 2, w, h);
      ctx.restore();
      bitmap.close();
    } catch {
      ctx.fillStyle = '#111823';
      ctx.fillRect(x, y, cellW, cellH);
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(x, y + cellH, cellW, captionH);
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(PHOTO_CAPTIONS[i], x + 10, y + cellH + captionH / 2);
  }

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Collage encode failed'))),
      'image/jpeg',
      0.9
    )
  );
}

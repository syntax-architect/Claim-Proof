import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { parsePdfBuffer, processLabelFiles } from '../services/pdfLabelProcessor';
import { RecordingPipeline } from '../services/recordingPipeline';
import { saveRecordingFiles } from '../services/vaultWriter';
import * as schema from '../db/schema';
import * as utils from '../lib/utils';

// Sensitive seller test values
const SENSITIVE_AWB = 'MSH998877665544';
const SENSITIVE_ORDER_ID = 'OD8877665544332211';
const SENSITIVE_SKU = 'KURTI-COTTON-ROYAL-BLUE-XL';
const SENSITIVE_VIDEO_CONTENT = 'PROPRIETARY_WAREHOUSE_VIDEO_EVIDENCE_BYTES';

// Allowed network destination hosts
const ALLOWED_HOST_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/,
  /^wss:\/\/[a-z0-9-]+\.supabase\.co$/,
  /^https:\/\/api\.razorpay\.com$/,
  /^https:\/\/checkout\.razorpay\.com$/,
  /^https:\/\/rzp\.io$/
];

interface NetworkCallRecord {
  type: 'fetch' | 'xhr' | 'websocket' | 'beacon';
  url: string;
  method?: string;
  body?: string;
}

function isHostAllowed(urlString: string): boolean {
  if (urlString.startsWith('blob:') || urlString.startsWith('data:') || urlString.startsWith('/')) {
    return true;
  }
  try {
    const parsed = new URL(urlString, 'http://localhost:3000');
    const origin = parsed.origin;
    return ALLOWED_HOST_PATTERNS.some((pattern) => pattern.test(origin));
  } catch {
    return false;
  }
}

function inspectPayloadForSensitiveData(payload: unknown): string | null {
  if (!payload) return null;
  let str = '';
  if (typeof payload === 'string') {
    str = payload;
  } else if (payload instanceof Uint8Array || payload instanceof ArrayBuffer) {
    str = new TextDecoder().decode(payload);
  } else if (typeof payload === 'object') {
    try {
      str = JSON.stringify(payload);
    } catch {
      str = String(payload);
    }
  }
  if (str.includes(SENSITIVE_AWB)) return `Leaked AWB: ${SENSITIVE_AWB}`;
  if (str.includes(SENSITIVE_ORDER_ID)) return `Leaked Order ID: ${SENSITIVE_ORDER_ID}`;
  if (str.includes(SENSITIVE_SKU)) return `Leaked SKU: ${SENSITIVE_SKU}`;
  if (str.includes(SENSITIVE_VIDEO_CONTENT)) return `Leaked Video Bytes`;
  return null;
}

describe('Offline-First Privacy Guarantee: Zero Network Telemetry & Data Leakage', () => {
  const interceptedCalls: NetworkCallRecord[] = [];
  const leakViolations: string[] = [];

  let originalFetch: typeof globalThis.fetch;
  let originalXHR: typeof globalThis.XMLHttpRequest;
  let originalWebSocket: typeof globalThis.WebSocket;
  let originalSendBeacon: typeof navigator.sendBeacon | undefined;

  beforeEach(() => {
    interceptedCalls.length = 0;
    leakViolations.length = 0;

    // 1. Intercept fetch
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const bodyStr = init?.body ? String(init.body) : undefined;
      interceptedCalls.push({ type: 'fetch', url, method: init?.method ?? 'GET', body: bodyStr });

      const leak = inspectPayloadForSensitiveData(url) || inspectPayloadForSensitiveData(bodyStr);
      if (leak) leakViolations.push(leak);

      if (!isHostAllowed(url)) {
        throw new Error(`[OFFLINE SECURITY VIOLATION] Unauthorized fetch call to: ${url}`);
      }
      return new Response('{}', { status: 200 });
    });

    // 2. Intercept XMLHttpRequest
    originalXHR = globalThis.XMLHttpRequest;
    class InterceptedXHR {
      private url = '';
      private method = 'GET';
      open(method: string, url: string) {
        this.method = method;
        this.url = url;
      }
      send(body?: Document | XMLHttpRequestBodyInit | null) {
        const bodyStr = body ? String(body) : undefined;
        interceptedCalls.push({ type: 'xhr', url: this.url, method: this.method, body: bodyStr });

        const leak =
          inspectPayloadForSensitiveData(this.url) || inspectPayloadForSensitiveData(bodyStr);
        if (leak) leakViolations.push(leak);

        if (!isHostAllowed(this.url)) {
          throw new Error(`[OFFLINE SECURITY VIOLATION] Unauthorized XHR call to: ${this.url}`);
        }
      }
      setRequestHeader() {}
      addEventListener() {}
    }
    (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = InterceptedXHR;

    // 3. Intercept WebSocket
    originalWebSocket = globalThis.WebSocket;
    class InterceptedWebSocket {
      url: string;
      constructor(url: string) {
        this.url = url;
        interceptedCalls.push({ type: 'websocket', url });
        const leak = inspectPayloadForSensitiveData(url);
        if (leak) leakViolations.push(leak);
        if (!isHostAllowed(url)) {
          throw new Error(
            `[OFFLINE SECURITY VIOLATION] Unauthorized WebSocket connection to: ${url}`
          );
        }
      }
      send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        const leak = inspectPayloadForSensitiveData(data);
        if (leak) leakViolations.push(leak);
      }
      close() {}
      addEventListener() {}
    }
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = InterceptedWebSocket;

    // 4. Intercept navigator.sendBeacon
    if (typeof navigator !== 'undefined') {
      originalSendBeacon = navigator.sendBeacon;
      navigator.sendBeacon = vi.fn((url: string | URL, data?: BodyInit | null) => {
        const urlStr = url.toString();
        const bodyStr = data ? String(data) : undefined;
        interceptedCalls.push({ type: 'beacon', url: urlStr, body: bodyStr });
        const leak =
          inspectPayloadForSensitiveData(urlStr) || inspectPayloadForSensitiveData(bodyStr);
        if (leak) leakViolations.push(leak);
        if (!isHostAllowed(urlStr)) {
          throw new Error(`[OFFLINE SECURITY VIOLATION] Unauthorized sendBeacon to: ${urlStr}`);
        }
        return true;
      });
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.XMLHttpRequest = originalXHR;
    globalThis.WebSocket = originalWebSocket;
    if (originalSendBeacon && typeof navigator !== 'undefined') {
      navigator.sendBeacon = originalSendBeacon;
    }
  });

  it('guarantees label parsing, vector cropping, and manifest generation make 0 network calls and leak 0 user data', async () => {
    // Generate a fresh PDF with sensitive seller data
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.addPage([288, 432]); // 4x6 inches
    page.drawText(`AWB No: ${SENSITIVE_AWB}`, {
      x: 20,
      y: 390,
      size: 10,
      font,
      color: rgb(0, 0, 0)
    });
    page.drawText(`Order ID: ${SENSITIVE_ORDER_ID}`, {
      x: 20,
      y: 370,
      size: 10,
      font,
      color: rgb(0, 0, 0)
    });
    page.drawText(`SKU: ${SENSITIVE_SKU}`, { x: 20, y: 350, size: 10, font, color: rgb(0, 0, 0) });
    page.drawText(`Courier: Valmo`, { x: 20, y: 330, size: 10, font, color: rgb(0, 0, 0) });
    page.drawText(`Qty: 2`, { x: 20, y: 310, size: 10, font, color: rgb(0, 0, 0) });
    const pdfBytes = await pdfDoc.save();

    // 1. Run parsePdfBuffer
    const labels = await parsePdfBuffer(pdfBytes, 'sensitive_shipping_label.pdf');
    expect(labels.length).toBeGreaterThan(0);
    expect(labels[0].awb).toBe(SENSITIVE_AWB);
    expect(labels[0].orderId).toBe(SENSITIVE_ORDER_ID);
    expect(labels[0].sku).toBe(SENSITIVE_SKU);

    // 2. Run full label cropping and manifest processing
    const fileInput = {
      name: 'sensitive_shipping_label.pdf',
      arrayBuffer: async () =>
        pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength)
    };

    const processResult = await processLabelFiles([fileInput], {
      preset: '4x6',
      stampSku: true,
      multiQtyGuard: true,
      valmoPlusAsValmo: false,
      withManifest: true
    });

    expect(processResult.pdfBytes.byteLength).toBeGreaterThan(0);
    expect(processResult.labels.length).toBe(1);

    // Assert: Zero network calls made during the entire label workflow
    expect(interceptedCalls).toEqual([]);
    expect(leakViolations).toEqual([]);
  });

  it('guarantees recording pipeline and local vault saving make 0 network calls and leak 0 video data', async () => {
    // Mock getUserMedia & canvas for recording pipeline
    const mockTrack = {
      kind: 'video',
      enabled: true,
      readyState: 'live',
      onended: null,
      stop: vi.fn()
    };
    const mockStream = {
      getTracks: () => [mockTrack],
      getVideoTracks: () => [mockTrack]
    };

    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream as unknown as MediaStream) },
      configurable: true,
      writable: true
    });

    class FakeRecorder {
      state = 'inactive';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      static isTypeSupported = () => true;

      start() {
        this.state = 'recording';
        if (this.ondataavailable) {
          this.ondataavailable({
            data: new Blob([SENSITIVE_VIDEO_CONTENT], { type: 'video/webm' })
          });
        }
      }
      requestData() {}
      stop() {
        this.state = 'inactive';
        if (this.onstop) this.onstop();
      }
    }
    (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = FakeRecorder;

    const pipeline = new RecordingPipeline();
    const video = document.createElement('video');
    video.play = vi.fn().mockResolvedValue(undefined);
    const canvas = document.createElement('canvas');
    canvas.captureStream = vi.fn(() => mockStream as unknown as MediaStream);
    const mockCtx = {
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 100 })),
      roundRect: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn()
      }))
    };
    canvas.getContext = vi.fn(() => mockCtx) as unknown as typeof canvas.getContext;

    await pipeline.bind(video, canvas);

    pipeline.startRecording(
      {
        awb: SENSITIVE_AWB,
        orderId: SENSITIVE_ORDER_ID,
        sku: SENSITIVE_SKU,
        qty: 1,
        courier: 'Delhivery',
        type: 'dispatch',
        freeTier: false
      },
      {}
    );

    const recordResult = await pipeline.stopRecording();
    expect(recordResult).not.toBeNull();

    // Verify local saving to vault
    vi.spyOn(schema, 'getSetting').mockResolvedValue(null); // Downloads fallback
    const downloadSpy = vi.spyOn(utils, 'downloadBlob').mockImplementation(() => {});

    if (recordResult) {
      const saveResult = await saveRecordingFiles({
        awb: SENSITIVE_AWB,
        type: 'dispatch',
        startedAt: Date.now(),
        video: recordResult.videoBlob,
        videoMime: recordResult.videoMime,
        photo: null
      });

      expect(saveResult.mode).toBe('downloads');
      expect(downloadSpy).toHaveBeenCalled();
    }

    await pipeline.release();

    // Assert: Zero network requests made, and zero video/metadata transmitted
    expect(interceptedCalls).toEqual([]);
    expect(leakViolations).toEqual([]);
  });

  it('fails immediately if unauthorized network telemetry attempts to upload user data', async () => {
    // Simulated unauthorized background telemetry / analytics call
    let caughtError: Error | null = null;
    try {
      await fetch('https://telemetry.thirdparty-analytics.com/v1/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'parcel_scanned',
          awb: SENSITIVE_AWB,
          orderId: SENSITIVE_ORDER_ID
        })
      });
    } catch (err) {
      caughtError = err as Error;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError?.message).toContain('[OFFLINE SECURITY VIOLATION]');
    expect(leakViolations.length).toBeGreaterThan(0);
    expect(leakViolations[0]).toContain(SENSITIVE_AWB);
  });

  it('verifies static hosting security headers for Cloudflare Pages and Vercel', () => {
    // 1. Verify Cloudflare Pages _headers
    const headersPath = join(process.cwd(), 'public', '_headers');
    expect(existsSync(headersPath)).toBe(true);
    const headersContent = readFileSync(headersPath, 'utf8');

    expect(headersContent).toContain('Content-Security-Policy:');
    expect(headersContent).toContain("script-src 'self' 'unsafe-inline' blob:");
    expect(headersContent).toContain(
      "connect-src 'self' blob: data: https://*.supabase.co wss://*.supabase.co https://api.razorpay.com"
    );
    expect(headersContent).toContain('X-Content-Type-Options: nosniff');
    expect(headersContent).toContain('Referrer-Policy: strict-origin-when-cross-origin');
    expect(headersContent).toContain('Permissions-Policy: camera=(self)');
    expect(headersContent).toContain('X-Frame-Options: DENY');

    // 2. Verify Vercel vercel.json
    const vercelPath = join(process.cwd(), 'vercel.json');
    expect(existsSync(vercelPath)).toBe(true);
    const vercelContent = JSON.parse(readFileSync(vercelPath, 'utf8'));

    const headerList = vercelContent.headers[0].headers;
    const headerMap = Object.fromEntries(
      headerList.map((h: { key: string; value: string }) => [h.key, h.value])
    );

    expect(headerMap['Content-Security-Policy']).toBeDefined();
    expect(headerMap['Content-Security-Policy']).toContain(
      "connect-src 'self' blob: data: https://*.supabase.co wss://*.supabase.co https://api.razorpay.com"
    );
    expect(headerMap['X-Content-Type-Options']).toBe('nosniff');
    expect(headerMap['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headerMap['Permissions-Policy']).toContain('camera=(self)');
    expect(headerMap['X-Frame-Options']).toBe('DENY');
  });
});

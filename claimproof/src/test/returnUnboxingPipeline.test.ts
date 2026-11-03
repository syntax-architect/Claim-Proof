import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RecordingPipeline, type OverlayMeta } from '../services/recordingPipeline';
import { triggerEmergencySave, registerActiveRecording } from '../services/recorderCrashGuard';

describe('Return Unboxing Recording Pipeline & Continuous Safeguards', () => {
  let pipeline: RecordingPipeline;
  let videoEl: HTMLVideoElement;
  let canvasEl: HTMLCanvasElement;
  let mockCtx: {
    drawImage: ReturnType<typeof vi.fn>;
    fillRect: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    beginPath: ReturnType<typeof vi.fn>;
    arc: ReturnType<typeof vi.fn>;
    fill: ReturnType<typeof vi.fn>;
    stroke: ReturnType<typeof vi.fn>;
    fillText: ReturnType<typeof vi.fn>;
    measureText: ReturnType<typeof vi.fn>;
    clip: ReturnType<typeof vi.fn>;
    createLinearGradient: ReturnType<typeof vi.fn>;
    roundRect: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockCtx = {
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 100 }),
      clip: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      roundRect: vi.fn()
    };

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx) as any;

    pipeline = new RecordingPipeline({ demoMode: true });
    videoEl = document.createElement('video');
    canvasEl = document.createElement('canvas');
  });

  afterEach(async () => {
    await pipeline.release();
  });

  it('blocks pausing and returns plain-language explanation of continuous recording rule', () => {
    const pauseResult = pipeline.pauseRecording();
    expect(pauseResult.allowed).toBe(false);
    expect(pauseResult.reason).toContain('Continuous recording is mandatory');
    expect(pauseResult.reason).toContain('marketplaces reject paused or cut footage');
  });

  it('binds demo pipeline and initializes compositor', async () => {
    const boundMode = await pipeline.bind(videoEl, canvasEl);
    expect(boundMode).toBe('demo');
    expect(pipeline.bound).toBe('demo');
    expect(canvasEl.width).toBe(1280);
    expect(canvasEl.height).toBe(720);
  });

  it('burns in [RETURN UNBOXING] mode tag into the video watermark header', async () => {
    await pipeline.bind(videoEl, canvasEl);
    const ctx = canvasEl.getContext('2d');
    expect(ctx).toBeDefined();

    const returnMeta: OverlayMeta = {
      awb: 'AWB_RETURN_999',
      orderId: 'ORD_RET_123',
      sku: 'SKU_RET_ITEM',
      qty: 1,
      courier: 'Shadowfax',
      type: 'return',
      freeTier: false
    };

    // Mock captureStream & MediaRecorder
    class MockMediaStream {}
    globalThis.MediaStream = MockMediaStream as unknown as typeof MediaStream;

    class MockMediaRecorder {
      state = 'inactive';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }
      requestData() {}
    }

    (globalThis as any).MediaRecorder = MockMediaRecorder;
    (globalThis as any).MediaRecorder.isTypeSupported = vi.fn().mockReturnValue(true);

    canvasEl.captureStream = vi.fn().mockReturnValue(new MediaStream());

    pipeline.startRecording(returnMeta);
    expect(pipeline.recording).toBe(true);

    // Draw overlay bar with the active recording meta
    (pipeline as unknown as { drawOverlayBar: (c: unknown) => void }).drawOverlayBar(mockCtx);

    // Verify fillText called with header containing [RETURN UNBOXING]
    const headerCalls = mockCtx.fillText.mock.calls.map((c: any[]) => String(c[0]));
    const foundReturnHeader = headerCalls.some(
      (text: string) =>
        text.includes('[RETURN UNBOXING]') &&
        text.includes('AWB: AWB_RETURN_999') &&
        text.includes('SKU: SKU_RET_ITEM')
    );
    expect(foundReturnHeader).toBe(true);
  });

  it('triggers emergency save and captures partial footage when camera disconnect occurs', async () => {
    let emergencySaveCalled = false;
    let savedReason: unknown = null;

    const unregister = registerActiveRecording(async (reason) => {
      emergencySaveCalled = true;
      savedReason = reason;
    });

    await triggerEmergencySave('camera_disconnected');

    expect(emergencySaveCalled).toBe(true);
    expect(savedReason).toBe('camera_disconnected');

    unregister();
  });
});

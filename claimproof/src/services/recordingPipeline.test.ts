import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getContainerFormat,
  pickMime,
  RecordingPipeline,
  type OverlayMeta
} from './recordingPipeline';
import * as crashGuard from './recorderCrashGuard';

// Mock canvas & MediaStream
class MockMediaStreamTrack {
  kind = 'video';
  enabled = true;
  readyState = 'live';
  onended: (() => void) | null = null;
  stop = vi.fn(() => {
    this.readyState = 'ended';
  });
}

class MockMediaStream {
  tracks: MockMediaStreamTrack[] = [new MockMediaStreamTrack()];
  getTracks() {
    return this.tracks;
  }
  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === 'video');
  }
}

class MockMediaRecorder {
  static isTypeSupported = vi.fn((mime: string) => mime.includes('webm'));
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  stream: MediaStream;
  options?: MediaRecorderOptions;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    this.stream = stream;
    this.options = options;
  }

  start(_timeslice?: number) {
    this.state = 'recording';
    if (this.ondataavailable) {
      this.ondataavailable({
        data: new Blob(['chunk1', 'chunk2'], { type: this.options?.mimeType || 'video/webm' })
      });
    }
  }

  requestData() {
    if (this.ondataavailable) {
      this.ondataavailable({
        data: new Blob(['chunk3'], { type: this.options?.mimeType || 'video/webm' })
      });
    }
  }

  stop() {
    this.state = 'inactive';
    if (this.onstop) {
      this.onstop();
    }
  }
}

describe('RecordingPipeline and format helpers', () => {
  let mockStream: MockMediaStream;
  let mockGetUserMedia: ReturnType<typeof vi.fn>;
  let videoEl: HTMLVideoElement;
  let canvasEl: HTMLCanvasElement;
  let mockCtx: unknown;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockStream = new MockMediaStream();
    mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);

    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      configurable: true,
      writable: true
    });

    (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = MockMediaRecorder;

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

    videoEl = document.createElement('video');
    videoEl.play = vi.fn().mockResolvedValue(undefined);
    let assignedSrcObject: unknown = null;
    Object.defineProperty(videoEl, 'srcObject', {
      get: () => assignedSrcObject,
      set: (val) => {
        assignedSrcObject = val;
      },
      configurable: true
    });

    canvasEl = document.createElement('canvas');
    canvasEl.getContext = vi.fn().mockReturnValue(mockCtx);
    canvasEl.captureStream = vi.fn().mockReturnValue(mockStream as unknown as MediaStream);
    canvasEl.toBlob = vi.fn((cb: BlobCallback) => {
      cb(new Blob(['fake-jpeg'], { type: 'image/jpeg' }));
    });

    (globalThis as unknown as { createImageBitmap: unknown }).createImageBitmap = vi.fn(
      async () => ({
        width: 640,
        height: 360,
        close: vi.fn()
      })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Container format detection and selection', () => {
    it('accurately identifies mp4 vs webm vs unknown container formats', () => {
      expect(getContainerFormat('video/mp4;codecs="avc1.42E01E"')).toBe('mp4');
      expect(getContainerFormat('video/mp4')).toBe('mp4');
      expect(getContainerFormat('video/webm;codecs=vp9')).toBe('webm');
      expect(getContainerFormat('video/webm')).toBe('webm');
      expect(getContainerFormat('audio/ogg')).toBe('unknown');
    });

    it('prefers mp4 when browser supports it', () => {
      MockMediaRecorder.isTypeSupported.mockImplementation(
        (mime: string) => mime.includes('mp4') || mime.includes('webm')
      );
      const mime = pickMime();
      expect(mime).toContain('mp4');
      expect(getContainerFormat(mime)).toBe('mp4');
    });

    it('falls back to webm when mp4 is unsupported', () => {
      MockMediaRecorder.isTypeSupported.mockImplementation(
        (mime: string) => !mime.includes('mp4') && mime.includes('webm')
      );
      const mime = pickMime();
      expect(mime).toContain('webm');
      expect(getContainerFormat(mime)).toBe('webm');
    });
  });

  describe('Camera binding & hardware failure transitions', () => {
    it('binds camera stream successfully and tracks live state', async () => {
      const pipeline = new RecordingPipeline();
      const mode = await pipeline.bind(videoEl, canvasEl);

      expect(mode).toBe('camera');
      expect(pipeline.bound).toBe('camera');
      expect(pipeline.cameraErrorType).toBeNull();
      expect(mockGetUserMedia).toHaveBeenCalledTimes(1);

      await pipeline.release();
      expect(pipeline.bound).toBeNull();
    });

    it('handles camera permission denied with clear error state and demo fallback', async () => {
      const notAllowedErr = new DOMException('Permission denied by user', 'NotAllowedError');
      mockGetUserMedia.mockRejectedValueOnce(notAllowedErr);

      const pipeline = new RecordingPipeline();
      const mode = await pipeline.bind(videoEl, canvasEl);

      expect(mode).toBe('demo');
      expect(pipeline.bound).toBe('demo');
      expect(pipeline.cameraErrorType).toBe('permission_denied');

      await pipeline.release();
    });

    it('handles camera device not found error gracefully', async () => {
      const notFoundErr = new DOMException('Requested device not found', 'NotFoundError');
      mockGetUserMedia.mockRejectedValueOnce(notFoundErr);

      const pipeline = new RecordingPipeline();
      const mode = await pipeline.bind(videoEl, canvasEl);

      expect(mode).toBe('demo');
      expect(pipeline.bound).toBe('demo');
      expect(pipeline.cameraErrorType).toBe('not_found');

      await pipeline.release();
    });

    it('handles camera device in use by another app', async () => {
      const inUseErr = new DOMException('Device is in use', 'NotReadableError');
      mockGetUserMedia.mockRejectedValueOnce(inUseErr);

      const pipeline = new RecordingPipeline();
      const mode = await pipeline.bind(videoEl, canvasEl);

      expect(mode).toBe('demo');
      expect(pipeline.bound).toBe('demo');
      expect(pipeline.cameraErrorType).toBe('in_use');

      await pipeline.release();
    });
  });

  describe('Recording state transitions and safeguards', () => {
    const meta: OverlayMeta = {
      awb: 'AWB987654321',
      orderId: 'ORD123456',
      sku: 'TEST-SKU-M',
      qty: 1,
      courier: 'Delhivery',
      type: 'dispatch',
      freeTier: false
    };

    it('starts and stops recording, collecting chunks and calculating size', async () => {
      const pipeline = new RecordingPipeline();
      await pipeline.bind(videoEl, canvasEl);

      const onElapsed = vi.fn();
      pipeline.startRecording(meta, { onElapsed });

      expect(pipeline.recording).toBe(true);
      expect(pipeline.currentRecordedBytes).toBeGreaterThan(0);
      expect(pipeline.recordingSince).toBeTypeOf('number');

      const result = await pipeline.stopRecording();

      expect(pipeline.recording).toBe(false);
      expect(result).not.toBeNull();
      expect(result?.videoBlob).toBeInstanceOf(Blob);
      expect(result?.durationSec).toBeGreaterThanOrEqual(0);
      expect(result?.containerFormat).toBe('webm');

      await pipeline.release();
    });

    it('triggers onMaxDurationReached when recording exceeds limit', async () => {
      const pipeline = new RecordingPipeline();
      await pipeline.bind(videoEl, canvasEl);

      const onMaxDurationReached = vi.fn();
      const onElapsed = vi.fn();

      pipeline.startRecording(meta, { onElapsed, onMaxDurationReached }, { maxDurationSec: 1 });

      // Fast forward by simulating elapsed frames in compositor
      const now = performance.now();
      vi.spyOn(performance, 'now').mockReturnValue(now + 2500);

      // Invoke drawFrame directly via internal method to trigger elapsed check
      (pipeline as unknown as { drawFrame: () => void }).drawFrame();

      expect(onMaxDurationReached).toHaveBeenCalledTimes(1);

      await pipeline.release();
    });

    it('handles camera disconnected mid-recording with emergency save and fallback', async () => {
      const emergencySpy = vi.spyOn(crashGuard, 'triggerEmergencySave').mockResolvedValue();
      const pipeline = new RecordingPipeline();
      await pipeline.bind(videoEl, canvasEl);

      const onCameraDisconnected = vi.fn();
      pipeline.startRecording(meta, { onCameraDisconnected });

      // Simulate camera disconnection track ended event
      const track = mockStream.getVideoTracks()[0];
      expect(track.onended).toBeDefined();
      track.onended?.();

      expect(onCameraDisconnected).toHaveBeenCalledTimes(1);
      expect(emergencySpy).toHaveBeenCalledWith('camera_disconnected');
      expect(pipeline.bound).toBe('demo');

      await pipeline.release();
    });

    it('activates fallback interval when tab is backgrounded / hidden', async () => {
      const pipeline = new RecordingPipeline();
      await pipeline.bind(videoEl, canvasEl);

      // Initially tab is visible
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });

      // Tab hidden triggers background fallback interval
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(
        (pipeline as unknown as { throttleInterval: unknown }).throttleInterval
      ).not.toBeNull();

      // Tab restored clears interval
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      expect((pipeline as unknown as { throttleInterval: unknown }).throttleInterval).toBeNull();

      await pipeline.release();
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { VideoRecorderStation } from './VideoRecorderStation';
import { ToastProvider } from '../ui';
import { PaywallProvider } from '../../providers/PaywallProvider';
import * as cameraScanner from '../../lib/cameraScanner';
import * as hidScanner from '../../lib/hidScanner';
import * as vaultWriter from '../../services/vaultWriter';
import * as mediaLibrary from '../../services/mediaLibrary';
import * as quota from '../../lib/quota';
import { db } from '../../db/schema';

expect.extend(toHaveNoViolations);

// Mock MediaStream & MediaRecorder
class MockMediaStreamTrack {
  kind = 'video';
  enabled = true;
  readyState = 'live';
  onended: (() => void) | null = null;
  stop = vi.fn();
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
  static isTypeSupported = vi.fn(() => true);
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  stream: MediaStream;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(stream: MediaStream) {
    this.stream = stream;
  }

  start() {
    this.state = 'recording';
    if (this.ondataavailable) {
      this.ondataavailable({
        data: new Blob(['chunk1'], { type: 'video/webm' })
      });
    }
  }

  requestData() {}

  stop() {
    this.state = 'inactive';
    if (this.onstop) {
      this.onstop();
    }
  }
}

function renderRecorder() {
  return render(
    <ToastProvider>
      <PaywallProvider>
        <main>
          <VideoRecorderStation />
        </main>
      </PaywallProvider>
    </ToastProvider>
  );
}

describe('VideoRecorderStation Component', () => {
  let mockStream: MockMediaStream;

  beforeEach(async () => {
    vi.restoreAllMocks();
    await db.recordings.clear();
    await db.usage_counters.clear();

    mockStream = new MockMediaStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream)
      },
      configurable: true,
      writable: true
    });

    (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = MockMediaRecorder;

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
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() }))
    };

    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx);
    HTMLCanvasElement.prototype.captureStream = vi
      .fn()
      .mockReturnValue(mockStream as unknown as MediaStream);
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb) =>
      cb(new Blob(['fake-jpeg'], { type: 'image/jpeg' }))
    );

    (globalThis as unknown as { createImageBitmap: unknown }).createImageBitmap = vi.fn(
      async () => ({
        width: 640,
        height: 360,
        close: vi.fn()
      })
    );

    vi.spyOn(cameraScanner, 'startCameraScanner').mockResolvedValue({
      stop: vi.fn()
    });
    vi.spyOn(hidScanner, 'startHidListener').mockReturnValue({
      stop: vi.fn()
    });
    vi.spyOn(vaultWriter, 'saveRecordingFiles').mockResolvedValue({
      vaultPath: '2026-11-01/Dispatch/AWBTEST/AWBTEST_Video.webm',
      mode: 'fs-api'
    });
    vi.spyOn(mediaLibrary, 'cacheRecordingMedia').mockResolvedValue();
    vi.spyOn(quota, 'consumeRecordingQuota').mockResolvedValue({
      allowed: true,
      used: 0,
      limit: 10
    });
  });

  afterEach(async () => {
    await db.recordings.clear();
    await db.usage_counters.clear();
  });

  it('renders in idle state waiting for barcode scan and passes axe', async () => {
    const { container } = renderRecorder();

    expect(screen.getByText(/WAITING FOR SCAN/i)).toBeDefined();
    expect(screen.getByLabelText(/Scan or type AWB barcode/i)).toBeDefined();
    expect(screen.getByText(/USB Gun armed/i)).toBeDefined();

    const results = await axe(container, {
      rules: { region: { enabled: false } }
    });
    expect(results).toHaveNoViolations();
  });

  it('transitions through scanning, recording, and saved states cleanly and passes axe', async () => {
    const { container } = renderRecorder();

    const input = screen.getByLabelText(/Scan or type AWB barcode/i);

    // 1. Enter an AWB to trigger recording state
    fireEvent.change(input, { target: { value: 'AWB99887766' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // 2. Assert in recording state
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /Stop & Save/i })).toBeDefined();
      },
      { timeout: 8000 }
    );

    expect(screen.getAllByText('AWB99887766').length).toBeGreaterThan(0);
    expect(screen.getByText(/REC 00:00/i)).toBeDefined();

    // Verify axe during recording
    const recAxe = await axe(container, {
      rules: { region: { enabled: false }, 'heading-order': { enabled: false } }
    });
    expect(recAxe).toHaveNoViolations();

    // 3. Stop and persist recording
    const stopBtn = screen.getByRole('button', { name: /Stop & Save/i });
    fireEvent.click(stopBtn);

    // 4. Returns to idle after saving
    await waitFor(
      () => {
        expect(screen.getByText(/WAITING FOR SCAN/i)).toBeDefined();
      },
      { timeout: 10000 }
    );

    // Verify record was inserted into database
    await waitFor(
      async () => {
        const count = await db.recordings.where('awb').equals('AWB99887766').count();
        expect(count).toBe(1);
      },
      { timeout: 10000 }
    );

    const idleAxe = await axe(container, {
      rules: { region: { enabled: false }, 'heading-order': { enabled: false } }
    });
    expect(idleAxe).toHaveNoViolations();
  });
});

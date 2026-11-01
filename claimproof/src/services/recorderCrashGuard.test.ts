import { describe, expect, it, vi } from 'vitest';
import {
  isRecordingActive,
  registerActiveRecording,
  triggerEmergencySave
} from './recorderCrashGuard';

describe('recorderCrashGuard', () => {
  it('registers an active recording session and reports active state', () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const unregister = registerActiveRecording(saveFn);

    expect(isRecordingActive()).toBe(true);

    unregister();
    expect(isRecordingActive()).toBe(false);
  });

  it('triggers emergency save when a crash occurs', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    registerActiveRecording(saveFn);

    const crashReason = new Error('Webcam USB disconnected unexpectedly');
    await triggerEmergencySave(crashReason);

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(saveFn).toHaveBeenCalledWith(crashReason);

    // Active save should be unset after triggering to prevent re-entrant calls
    expect(isRecordingActive()).toBe(false);
  });

  it('does not re-invoke emergency save on multiple concurrent triggers', async () => {
    let callCount = 0;
    const saveFn = vi.fn().mockImplementation(async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 10));
    });

    registerActiveRecording(saveFn);

    // Trigger simultaneously from error handler and unmount
    await Promise.all([
      triggerEmergencySave('window.onerror'),
      triggerEmergencySave('ErrorBoundary.componentDidCatch')
    ]);

    expect(callCount).toBe(1);
  });

  it('does nothing when unregister was already called during normal save', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const unregister = registerActiveRecording(saveFn);

    // Normal save completed
    unregister();

    // Subsequent crash should not trigger emergency save
    await triggerEmergencySave('some late error');
    expect(saveFn).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setupGlobalErrorHandlers, teardownGlobalErrorHandlers } from './errorHandler';
import * as crashGuard from '../services/recorderCrashGuard';
import type { ToastPayload } from '../components/ui';

describe('global errorHandler', () => {
  beforeEach(() => {
    teardownGlobalErrorHandlers();
  });

  afterEach(() => {
    teardownGlobalErrorHandlers();
  });

  it('handles window.onerror by triggering emergency save and dispatching toast', () => {
    const emergencySpy = vi.spyOn(crashGuard, 'triggerEmergencySave');
    const toastListener = vi.fn();

    window.addEventListener('cp-toast', (e) => {
      const custom = e as CustomEvent<ToastPayload>;
      toastListener(custom.detail);
    });

    setupGlobalErrorHandlers();

    // Trigger window.onerror
    const testError = new Error('Barcode buffer overflow');
    window.onerror?.('Barcode buffer overflow', 'main.js', 42, 10, testError);

    expect(emergencySpy).toHaveBeenCalledWith(testError);
    expect(toastListener).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'error',
        title: 'Unexpected error',
        message: 'Barcode buffer overflow'
      })
    );

    emergencySpy.mockRestore();
  });

  it('handles unhandledrejection by triggering emergency save and dispatching toast', () => {
    const emergencySpy = vi.spyOn(crashGuard, 'triggerEmergencySave');
    const toastListener = vi.fn();

    window.addEventListener('cp-toast', (e) => {
      const custom = e as CustomEvent<ToastPayload>;
      toastListener(custom.detail);
    });

    setupGlobalErrorHandlers();

    // Dispatch unhandledrejection
    const rejectionError = new Error('File System Access API permission revoked');
    const rejectionEvent = new Event('unhandledrejection') as unknown as PromiseRejectionEvent;
    Object.defineProperty(rejectionEvent, 'reason', { value: rejectionError });
    window.dispatchEvent(rejectionEvent);

    expect(emergencySpy).toHaveBeenCalledWith(rejectionError);
    expect(toastListener).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'error',
        title: 'Unhandled promise error',
        message: 'File System Access API permission revoked'
      })
    );

    emergencySpy.mockRestore();
  });
});

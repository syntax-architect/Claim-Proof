/* SABOOT Suite — Global error & unhandled rejection handlers.
 * Intercepts uncaught errors, triggers emergency saving of any in-progress
 * recorder session, and displays a non-blocking toast notification.
 */

import { notifyToast } from '../components/ui';
import { triggerEmergencySave } from '../services/recorderCrashGuard';
import { reportError } from '../services/telemetry';

let lastToastMessage = '';
let lastToastTime = 0;

function showDeduplicatedToast(title: string, message: string) {
  const now = Date.now();
  if (message === lastToastMessage && now - lastToastTime < 1000) {
    return;
  }
  lastToastMessage = message;
  lastToastTime = now;

  notifyToast({
    tone: 'error',
    title,
    message
  });
}

let originalOnError: typeof window.onerror | null = null;
let unhandledRejectionListener: ((event: PromiseRejectionEvent) => void) | null = null;
let isInitialized = false;

export function setupGlobalErrorHandlers(): void {
  if (typeof window === 'undefined' || isInitialized) return;
  isInitialized = true;

  originalOnError = window.onerror;

  window.onerror = (message, source, lineno, colno, error) => {
    // 1. Immediately protect any active in-progress recording
    void triggerEmergencySave(error ?? message);

    // 2. Report error with scrubbing (if user opted in)
    void reportError(error ?? message);

    // 3. Extract plain message for non-blocking toast
    const text =
      typeof message === 'string' ? message : error?.message || 'An unexpected error occurred';

    showDeduplicatedToast('Unexpected error', text);

    if (typeof originalOnError === 'function') {
      return originalOnError(message, source, lineno, colno, error);
    }
    // Return false so normal browser console error logging still occurs
    return false;
  };

  unhandledRejectionListener = (event: PromiseRejectionEvent) => {
    // 1. Immediately protect any active in-progress recording
    void triggerEmergencySave(event.reason);

    // 2. Report error with scrubbing (if user opted in)
    void reportError(event.reason);

    // 3. Extract plain message for non-blocking toast
    const reason = event.reason;
    const text =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
          ? reason
          : 'An unhandled promise rejection occurred';

    showDeduplicatedToast('Unhandled promise error', text);
  };

  window.addEventListener('unhandledrejection', unhandledRejectionListener);
}

export function teardownGlobalErrorHandlers(): void {
  if (typeof window === 'undefined' || !isInitialized) return;
  isInitialized = false;

  window.onerror = originalOnError;
  originalOnError = null;

  if (unhandledRejectionListener) {
    window.removeEventListener('unhandledrejection', unhandledRejectionListener);
    unhandledRejectionListener = null;
  }
}

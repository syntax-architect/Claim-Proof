/* SABOOT AWB — In-progress recording crash guard.
 * Ensures that if a crash occurs in the app (React ErrorBoundary,
 * window.onerror, unhandledrejection, or component unmount), the active
 * MediaRecorder is cleanly stopped and captured footage is saved without loss.
 */

type EmergencySaveFn = (reason?: unknown) => Promise<void> | void;

let activeEmergencySave: EmergencySaveFn | null = null;
let isEmergencySaving = false;

/**
 * Register the active recording's emergency save function.
 * Returns an unregister function to call when recording stops normally.
 */
export function registerActiveRecording(saveFn: EmergencySaveFn): () => void {
  activeEmergencySave = saveFn;
  isEmergencySaving = false;

  return () => {
    if (activeEmergencySave === saveFn) {
      activeEmergencySave = null;
    }
  };
}

/**
 * Check if a recording session is currently registered and active.
 */
export function isRecordingActive(): boolean {
  return activeEmergencySave !== null;
}

/**
 * Trigger emergency save of any active in-progress recording.
 * Safe against re-entrancy and multiple concurrent crash triggers.
 */
export async function triggerEmergencySave(reason?: unknown): Promise<void> {
  if (!activeEmergencySave || isEmergencySaving) return;

  isEmergencySaving = true;
  const saveFn = activeEmergencySave;
  activeEmergencySave = null;

  try {
    console.warn(
      '[recorderCrashGuard] Triggering emergency save for in-progress recording:',
      reason
    );
    await saveFn(reason);
  } catch (err) {
    console.error('[recorderCrashGuard] Emergency save failed:', err);
  } finally {
    isEmergencySaving = false;
  }
}

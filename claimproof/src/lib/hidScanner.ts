/* USB / Bluetooth HID laser barcode-gun listener.
 * Guns behave like keyboards: rapid <80ms keystroke bursts ending in Enter.
 * Events originating from real text inputs are ignored (the recorder's scan-sink
 * input handles its own Enter), so gun and manual entry never double-fire. */

export interface HidListenerHandle {
  stop: () => void;
}

const BURST_GAP_MS = 80;
const STALE_MS = 500;

export function startHidListener(onScan: (code: string) => void): HidListenerHandle {
  let buffer = '';
  let lastKeyAt = 0;
  let staleTimer: ReturnType<typeof setTimeout> | undefined;

  function isTypingTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el || !(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    return tag === 'TEXTAREA' || el.isContentEditable || (tag === 'INPUT' && true);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.altKey || event.metaKey) {
      buffer = '';
      return;
    }
    if (event.key === 'Enter') {
      const code = buffer.trim();
      buffer = '';
      if (code.length >= 4) {
        event.preventDefault();
        onScan(code);
      }
      return;
    }
    if (event.key.length !== 1 || isTypingTarget(event.target)) {
      if (isTypingTarget(event.target)) buffer = '';
      return;
    }
    const now = performance.now();
    if (now - lastKeyAt > BURST_GAP_MS) buffer = '';
    lastKeyAt = now;
    buffer += event.key;
    if (staleTimer) clearTimeout(staleTimer);
    staleTimer = setTimeout(() => {
      buffer = '';
    }, STALE_MS);
  }

  window.addEventListener('keydown', onKeyDown, true);
  return {
    stop: () => {
      window.removeEventListener('keydown', onKeyDown, true);
      if (staleTimer) clearTimeout(staleTimer);
    }
  };
}

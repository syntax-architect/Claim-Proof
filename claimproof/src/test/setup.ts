// Setup vitest test environment
import 'fake-indexeddb/auto';
import { afterEach, expect, vi } from 'vitest';

expect.extend({
  toBeInTheDocument(received: unknown) {
    const pass =
      received !== null &&
      received !== undefined &&
      typeof received === 'object' &&
      'nodeType' in (received as Node);
    return {
      pass,
      message: () =>
        pass ? 'expected element not to be in document' : 'expected element to be in document'
    };
  },
  toHaveValue(received: unknown, expected: unknown) {
    const pass =
      received !== null &&
      received !== undefined &&
      (received as HTMLInputElement).value === expected;
    return {
      pass,
      message: () =>
        `expected element value to be "${expected}", got "${(received as HTMLInputElement)?.value}"`
    };
  }
});

// Enable React act support
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Mock clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue('')
  },
  configurable: true,
  writable: true
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  })),
  configurable: true,
  writable: true
});

// Mock ResizeObserver
if (typeof ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// Suppress Animation.cancel AbortError in happy-dom
if (typeof Animation !== 'undefined' && Animation.prototype.cancel) {
  const origCancel = Animation.prototype.cancel;
  Animation.prototype.cancel = function () {
    if (this.finished && typeof this.finished.catch === 'function') {
      this.finished.catch(() => {});
    }
    try {
      origCancel.call(this);
    } catch {
      // ignore
    }
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

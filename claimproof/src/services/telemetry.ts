/* ClaimProof Suite — Privacy-Friendly Product Analytics & Scrubbed Error Monitoring.
 *
 * Strictly opt-in. Zero personal data, zero customer identifiers.
 * Never collects or transmits AWBs, order IDs, SKUs, or file names.
 * Tracks ONLY 5 milestone events:
 *   1. onboarding_completed
 *   2. first_label_export
 *   3. first_recording_saved
 *   4. paywall_viewed
 *   5. purchase_started
 */

import { getSetting, setSetting } from '../db/schema';
import {
  TELEMETRY_CONFIG,
  ALLOWED_ANALYTICS_EVENTS,
  type AnalyticsEvent
} from '../config/telemetryConfig';

const TELEMETRY_OPT_IN_KEY = 'cp_telemetry_enabled';
const FIRST_LABEL_KEY = 'cp_first_label_exported';
const FIRST_RECORDING_KEY = 'cp_first_recording_saved';

/**
 * Checks whether the user has explicitly opted into anonymous analytics and error reporting.
 * Defaults strictly to FALSE (opt-in only).
 */
export function isTelemetryEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(TELEMETRY_OPT_IN_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Updates the user's telemetry preference in localStorage and IndexedDB settings.
 */
export async function setTelemetryEnabled(enabled: boolean): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(TELEMETRY_OPT_IN_KEY, String(enabled));
      window.dispatchEvent(new Event('cp-telemetry-changed'));
    } catch {
      /* private mode / quota */
    }
  }
  try {
    await setSetting('telemetry_enabled', enabled);
  } catch {
    /* indexeddb unavailable */
  }
}

/**
 * Initializes telemetry state from IndexedDB on startup.
 */
export async function initTelemetryState(): Promise<boolean> {
  try {
    const saved = await getSetting<boolean>('telemetry_enabled', TELEMETRY_CONFIG.defaultOptIn);
    if (typeof window !== 'undefined') {
      localStorage.setItem(TELEMETRY_OPT_IN_KEY, String(saved));
    }
    return saved;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SENSITIVE DATA SCRUBBING ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Regex patterns designed to capture and redact sensitive warehouse and marketplace data:
 * - Air Waybill (AWB) tracking numbers
 * - Order IDs (Meesho, Flipkart, Amazon, AJIO)
 * - Stock Keeping Units (SKUs)
 * - Local filesystem paths (Windows, Unix) and document/video filenames
 * - Contact numbers and emails
 */
const SENSITIVE_PATTERNS = [
  // 1. Mobile phone numbers (Indian 10-digit mobile numbers with optional +91)
  {
    regex: /(?:\+91[-\s]?)?[6-9]\d{9}\b/g,
    replacement: '[REDACTED_PHONE]'
  },
  // 2. Email addresses
  {
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: '[REDACTED_EMAIL]'
  },
  // 3. Full Windows file paths with filename (e.g. C:\Users\Admin\Desktop\file.pdf or \\?\C:\...)
  {
    regex: /(?:[a-zA-Z]:\\|\\\\)(?:[^"'\n\r\t<>|:*?\s\\]+\\)*[^"'\n\r\t<>|:*?\s\\]+\.[a-zA-Z0-9]{2,5}\b/g,
    replacement: '[REDACTED_PATH]'
  },
  // 4. Windows directory paths
  {
    regex: /(?:[a-zA-Z]:\\|\\\\)(?:[^"'\n\r\t<>|:*?\s\\]+\\)+/g,
    replacement: '[REDACTED_PATH]'
  },
  // 5. Full Unix / Posix file paths (e.g. /home/user/... or /Users/...)
  {
    regex: /\/(?:home|Users|var|tmp|app|src|dist|root|vault|Desktop|Downloads)\/[^\s"'\n\r\t<>|]+\b/g,
    replacement: '[REDACTED_PATH]'
  },
  // 6. User document, video, or label filenames with extensions
  {
    regex: /\b[a-zA-Z0-9_\-.]+\.(?:pdf|mp4|webm|jpg|jpeg|png|cif|mmcif|csv|xlsx)\b/gi,
    replacement: '[REDACTED_FILE]'
  },
  // 7. Amazon India Order format (e.g. 404-0000000-0000001 or 123-1234567-1234567)
  {
    regex: /\b\d{3}-\d{7}-\d{7}\b/g,
    replacement: '[REDACTED_ORDER]'
  },
  // 8. Explicit Order ID prefixes (e.g. ORD-998877, ORDER: 12345, OD8877665544332211)
  {
    regex: /\b(?:ORD|ORDER|ORDERID)[-:\s_]*[A-Za-z0-9_-]+\b/gi,
    replacement: '[REDACTED_ORDER]'
  },
  // 9. Flipkart Order format (e.g. OD3928192831, OD8877665544332211)
  {
    regex: /\bOD\d{10,20}\b/g,
    replacement: '[REDACTED_ORDER]'
  },
  // 10. Explicit AWB prefixes (e.g. AWB-DELHIVERY-12345, AWB: 5894372819, AWB_EKART_554433)
  {
    regex: /\bAWB[-:\s_]*[A-Za-z0-9_-]+\b/gi,
    replacement: '[REDACTED_AWB]'
  },
  // 11. Marketplace / Courier specific AWB codes (e.g. FMPP0982341201, MSH998877665544, SFX123456789)
  {
    regex: /\b(?:FMPP|MSH|SFX|KL|DEL)[0-9]{8,16}\b/gi,
    replacement: '[REDACTED_AWB]'
  },
  // 12. Numeric tracking barcode strings (10 to 18 digits)
  {
    regex: /\b\d{10,18}\b/g,
    replacement: '[REDACTED_AWB]'
  },
  // 13. Explicit SKU tags (e.g. SKU-TSHIRT-RED-M, SKU: JEANS-32)
  {
    regex: /\bSKU[-:\s_]*[A-Za-z0-9_-]+\b/gi,
    replacement: '[REDACTED_SKU]'
  },
  // 14. Hyphenated catalog SKU identifiers (e.g. KURTI-COTTON-ROYAL-BLUE-XL, TSHIRT-BLK-L, MSH-KRT-BLU-XL)
  {
    regex: /\b[A-Z0-9]{2,10}(?:-[A-Z0-9]{1,10}){1,5}\b/g,
    replacement: '[REDACTED_SKU]'
  }
];

/**
 * Scrubs all AWBs, order IDs, SKUs, and file paths/names from arbitrary text.
 */
export function scrubSensitiveData(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let result = text;
  for (const { regex, replacement } of SENSITIVE_PATTERNS) {
    result = result.replace(regex, replacement);
  }
  return result;
}

/**
 * Recursively sanitizes any object or dictionary, scrubbing values and omitting disallowed keys.
 */
export function scrubObject<T>(input: T): T {
  if (!input || typeof input !== 'object') {
    return typeof input === 'string' ? (scrubSensitiveData(input) as unknown as T) : input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => scrubObject(item)) as unknown as T;
  }

  const disallowedKeys = [
    'awb',
    'orderid',
    'order_id',
    'sku',
    'filename',
    'file_name',
    'filepath',
    'file_path',
    'vaultpath',
    'customername',
    'customer_name',
    'address',
    'phone',
    'tracking'
  ];

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const lowerKey = key.toLowerCase();
    if (disallowedKeys.some((bad) => lowerKey.includes(bad))) {
      result[key] = '[REDACTED_FIELD]';
      continue;
    }
    result[key] = scrubObject(value);
  }
  return result as T;
}

/**
 * Scrubs an Error instance, redacting messages and stack traces while preserving line numbers.
 */
export function scrubError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: scrubSensitiveData(error.name || 'Error'),
      message: scrubSensitiveData(error.message || ''),
      stack: error.stack ? scrubSensitiveData(error.stack) : undefined
    };
  }
  const text = typeof error === 'string' ? error : String(error);
  return {
    name: 'Error',
    message: scrubSensitiveData(text)
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT ANALYTICS (Plausible-style / self-hostable)
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalyticsPayload {
  name: AnalyticsEvent;
  url: string;
  domain: string;
  props?: Record<string, string | number | boolean>;
  timestamp: number;
}

// In-memory event buffer for testing and offline inspection
export const __recordedAnalyticsEvents: AnalyticsPayload[] = [];

/**
 * Dispatches a privacy-preserving product analytics event if the user has opted in.
 * Enforces that only the 5 allowed milestone events can ever be tracked.
 */
export async function trackEvent(
  name: AnalyticsEvent,
  props?: Record<string, string | number | boolean>
): Promise<boolean> {
  // 1. Strict opt-in gate: zero events sent if disabled
  if (!isTelemetryEnabled()) {
    return false;
  }

  // 2. Strict whitelist gate: only the 5 specified milestone events
  if (!ALLOWED_ANALYTICS_EVENTS.includes(name)) {
    return false;
  }

  // 3. Strict props scrubbing: strip any potential personal or order data
  let cleanProps: Record<string, string | number | boolean> | undefined;
  if (props && typeof props === 'object') {
    cleanProps = {};
    for (const [key, val] of Object.entries(props)) {
      const lower = key.toLowerCase();
      // Omit any key that sounds like personal, order, or barcode data
      if (
        lower.includes('awb') ||
        lower.includes('order') ||
        lower.includes('sku') ||
        lower.includes('file') ||
        lower.includes('path') ||
        lower.includes('user') ||
        lower.includes('name') ||
        lower.includes('phone')
      ) {
        continue;
      }
      cleanProps[key] = typeof val === 'string' ? scrubSensitiveData(val) : val;
    }
  }

  const payload: AnalyticsPayload = {
    name,
    url: typeof window !== 'undefined' ? window.location.pathname || '/' : '/',
    domain: 'claimproof.in',
    props: cleanProps,
    timestamp: Date.now()
  };

  __recordedAnalyticsEvents.push(payload);

  const endpoint = TELEMETRY_CONFIG.analyticsEndpoint;
  if (!endpoint) {
    return true;
  }

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper to record the "first label export" milestone exactly once.
 */
export async function trackFirstLabelExport(): Promise<boolean> {
  if (typeof window !== 'undefined') {
    try {
      if (localStorage.getItem(FIRST_LABEL_KEY) === '1') {
        return false;
      }
      localStorage.setItem(FIRST_LABEL_KEY, '1');
    } catch {
      /* ignore */
    }
  }
  return trackEvent('first_label_export');
}

/**
 * Helper to record the "first recording saved" milestone exactly once.
 */
export async function trackFirstRecordingSaved(): Promise<boolean> {
  if (typeof window !== 'undefined') {
    try {
      if (localStorage.getItem(FIRST_RECORDING_KEY) === '1') {
        return false;
      }
      localStorage.setItem(FIRST_RECORDING_KEY, '1');
    } catch {
      /* ignore */
    }
  }
  return trackEvent('first_recording_saved');
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR MONITORING (Sentry / GlitchTip equivalent)
// ─────────────────────────────────────────────────────────────────────────────

export interface ErrorReportPayload {
  event_id: string;
  timestamp: string;
  platform: 'javascript';
  level: 'error';
  exception: {
    values: [
      {
        type: string;
        value: string;
        stacktrace?: {
          frames: { filename: string; lineno?: number; colno?: number; function?: string }[];
        };
      }
    ];
  };
  tags: {
    app: string;
    environment: string;
  };
  extra?: Record<string, unknown>;
}

export const __recordedErrorReports: ErrorReportPayload[] = [];

function generateEventId(): string {
  const chars = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 32; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Reports an unhandled or caught application error to Sentry/GlitchTip,
 * with 100% of AWBs, order IDs, SKUs, and file paths completely scrubbed.
 */
export async function reportError(
  error: unknown,
  context?: Record<string, unknown>
): Promise<boolean> {
  // 1. Strict opt-in gate: zero reports sent if disabled
  if (!isTelemetryEnabled()) {
    return false;
  }

  // 2. Scrub the error thoroughly
  const scrubbed = scrubError(error);
  const scrubbedContext = context ? scrubObject(context) : undefined;

  const payload: ErrorReportPayload = {
    event_id: generateEventId(),
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    level: 'error',
    exception: {
      values: [
        {
          type: scrubbed.name,
          value: scrubbed.message,
          stacktrace: scrubbed.stack
            ? {
                frames: [
                  {
                    filename: '[REDACTED_PATH]',
                    function: scrubbed.name
                  }
                ]
              }
            : undefined
        }
      ]
    },
    tags: {
      app: 'claimproof',
      environment: import.meta.env.MODE || 'production'
    },
    extra: scrubbedContext
  };

  __recordedErrorReports.push(payload);

  const endpoint = TELEMETRY_CONFIG.errorMonitoringEndpoint;
  if (!endpoint) {
    return true;
  }

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return true;
  } catch {
    return false;
  }
}

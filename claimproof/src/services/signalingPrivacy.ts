/**
 * SABOOT Suite — Signaling Privacy & Zero-Media Guard.
 *
 * AGENTS.md Rule 4 (Local-First Privacy) & Phone Companion Criterion 2:
 * "Live preview from phone to PC via WebRTC peer-to-peer; any signaling server
 * must carry only connection messages, never video."
 *
 * This module enforces at runtime that no signaling payload (over Supabase Realtime
 * or any signaling relay) ever contains media frames, canvas pixels, video blobs,
 * raw buffers, or base64 data.
 */

export class SignalingPrivacyViolationError extends Error {
  constructor(message: string) {
    super(`[Signaling Privacy Violation] ${message}`);
    this.name = 'SignalingPrivacyViolationError';
  }
}

const FORBIDDEN_KEYS = new Set([
  'video',
  'videoblob',
  'image',
  'canvas',
  'pixels',
  'frame',
  'chunk',
  'chunks',
  'buffer',
  'arraybuffer',
  'media',
  'videomime',
  'photocollage'
]);

const FORBIDDEN_CONTENT_PATTERNS = [
  /^data:video\//i,
  /^data:image\//i,
  /^data:application\/octet-stream/i,
  /base64,/i
];

/**
 * Validates any payload before it is transmitted across the signaling channel.
 * Throws a SignalingPrivacyViolationError if any forbidden media data is detected.
 */
export function assertNoMediaInSignaling(payload: unknown, path = 'payload'): void {
  if (payload === null || payload === undefined) {
    return;
  }

  if (typeof payload === 'string') {
    // Check for media data URI patterns or base64 chunks
    for (const pattern of FORBIDDEN_CONTENT_PATTERNS) {
      if (pattern.test(payload)) {
        throw new SignalingPrivacyViolationError(
          `Disallowed media pattern found at ${path}: payload matches ${pattern}`
        );
      }
    }
    // Check payload size: WebRTC SDP offers/answers are typically < 8KB. Anything larger is rejected.
    if (payload.length > 32768) {
      throw new SignalingPrivacyViolationError(
        `Payload at ${path} is unexpectedly large (${payload.length} chars). Media payloads are prohibited on signaling.`
      );
    }
    return;
  }

  if (typeof payload === 'number' || typeof payload === 'boolean') {
    return;
  }

  if (
    payload instanceof ArrayBuffer ||
    ArrayBuffer.isView(payload) ||
    (typeof Blob !== 'undefined' && payload instanceof Blob)
  ) {
    throw new SignalingPrivacyViolationError(
      `Binary media buffer or Blob detected at ${path}. Only lightweight JSON signaling messages are permitted.`
    );
  }

  if (Array.isArray(payload)) {
    if (payload.length > 500) {
      throw new SignalingPrivacyViolationError(
        `Array at ${path} has ${payload.length} elements. Large arrays of media or chunks are prohibited.`
      );
    }
    payload.forEach((item, index) => {
      assertNoMediaInSignaling(item, `${path}[${index}]`);
    });
    return;
  }

  if (typeof payload === 'object') {
    for (const [key, val] of Object.entries(payload as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (FORBIDDEN_KEYS.has(lowerKey)) {
        throw new SignalingPrivacyViolationError(
          `Forbidden media key "${key}" detected at ${path}.${key}. Signaling must never carry video, frames, or chunks.`
        );
      }
      assertNoMediaInSignaling(val, `${path}.${key}`);
    }
  }
}

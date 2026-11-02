/* SABOOT licensing engine — offline-verifiable ES256 license JWTs.
 *
 * Verification is strictly on-device: the payment webhook or admin script
 * signs a compact JWT with the issuer's P-256 private key; the app only ships
 * the PUBLIC JWK (src/lib/licenseKeys.ts) and validates locally. No account,
 * no server round-trip at activation time.
 *
 * Stable export contract (consumed by quota engine, paywall, settings):
 *   getLicenseState / useLicense / planHasFeature / getDeviceFingerprint /
 *   verifyAndActivateToken / deactivateLicense
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { BRAND } from '../config/brand';
import { db } from '../db/schema';
import { LICENSE_ISSUER, LICENSE_JWT_KID, LICENSE_JWT_PUBLIC_JWK } from '../lib/licenseKeys';
import type {
  ActivationResult,
  LicensePlan,
  LicenseState,
  PlanId,
  ProFeature,
  SubscriptionStatus
} from '../types';

export type { ActivationResult };

const FALLBACK: LicenseState = {
  plan: 'free',
  seats: 1,
  deviceFingerprint: '',
  boundDevices: []
};

/* Boot cache — avoids a 'Free' flash on remounts and after reloads. */
const PLAN_CACHE_KEY = BRAND.storageKeys.lastPlan;
const LEGACY_PLAN_CACHE_KEY = BRAND.storageKeys.legacyLastPlan;
let lastKnown: LicenseState | null = (() => {
  try {
    const raw = localStorage.getItem(PLAN_CACHE_KEY) ?? localStorage.getItem(LEGACY_PLAN_CACHE_KEY);
    return raw ? (JSON.parse(raw) as LicenseState) : null;
  } catch {
    return null;
  }
})();

function remember(state: LicenseState): void {
  lastKnown = state;
  try {
    localStorage.setItem(PLAN_CACHE_KEY, JSON.stringify(state));
  } catch {
    /* private mode etc. */
  }
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/* ── Device fingerprint ──────────────────────────────────────────────── */

/** Reads the GPU renderer/vendor strings via the (vendor-prefixed) debug extension. */
function readWebglInfo(): { renderer: string; vendor: string } {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (!gl) return { renderer: 'no-webgl', vendor: 'no-webgl' };
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg
      ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
    const vendor = dbg
      ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL))
      : String(gl.getParameter(gl.VENDOR));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { renderer, vendor };
  } catch {
    return { renderer: 'no-webgl', vendor: 'no-webgl' };
  }
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Deterministic non-crypto digest for insecure contexts (http:// LAN deploys). */
function fnv1aHex(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv-${h.toString(16).padStart(8, '0')}-${input.length.toString(16)}`;
}

/** Stable per-workstation identity — same machine, same value across sessions. */
async function computeDeviceFingerprint(): Promise<string> {
  const gl = readWebglInfo();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  const parts = [
    gl.renderer,
    gl.vendor,
    String(navigator.hardwareConcurrency ?? 'unknown'),
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    navigator.platform || 'unknown-platform',
    tz
  ];
  const raw = parts.join('|');
  if (crypto?.subtle) return sha256Hex(raw);
  return fnv1aHex(raw); // last-resort fallback, still stable per workstation
}

let fingerprintCache: string | null = null;
let fingerprintPromise: Promise<string> | null = null;

export async function getDeviceFingerprint(): Promise<string> {
  if (fingerprintCache !== null) return fingerprintCache;
  fingerprintPromise ??= computeDeviceFingerprint().then((fp) => {
    fingerprintCache = fp;
    return fp;
  });
  return fingerprintPromise;
}

/* ── JWT primitives ──────────────────────────────────────────────────── */

interface LicenseJwtHeader {
  alg?: unknown;
  kid?: unknown;
  typ?: unknown;
}

interface LicenseJwtPayload {
  iss?: unknown;
  sub?: unknown;
  cid?: unknown;
  plan?: unknown;
  seats?: unknown;
  fp?: unknown;
  devices?: unknown;
  maxDevices?: unknown;
  name?: unknown;
  iat?: unknown;
  exp?: unknown;
  jti?: unknown;
  subscriptionId?: unknown;
  sub_id?: unknown;
  subscriptionStatus?: unknown;
  renewsAt?: unknown;
  current_end?: unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Base64URL → bytes (accepts missing padding and URL-safe alphabet). */
function base64UrlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function parseJsonSegment(s: string, what: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(textDecoder.decode(base64UrlToBytes(s)));
  } catch {
    throw new Error(`Malformed license token ${what}`);
  }
  if (!isRecord(parsed)) throw new Error('Malformed license token');
  return parsed;
}

/* ── Token verification + activation ─────────────────────────────────── */

const VALID_PLANS: PlanId[] = ['starter', 'claimradar', 'warehouse'];

export interface ActivationOptions {
  /** If true, soft device binding allows moving an active license to this device. */
  moveDevice?: boolean;
}

/**
 * Verifies a compact ES256 license JWT entirely on-device and, when valid,
 * persists it as the active license in IndexedDB.
 *
 * Requirements:
 * - Offline ES256 verification using public JWK
 * - Token must contain valid plan, expiry, and customer ID
 * - Soft device binding allowing up to 2 devices per license with move option
 */
export async function verifyAndActivateToken(
  token: string,
  options?: ActivationOptions
): Promise<ActivationResult> {
  try {
    const parts = token.trim().split('.');
    if (parts.length !== 3 || parts.some((p) => p.length === 0)) {
      return { ok: false, error: 'Invalid license token', code: 'INVALID_TOKEN' };
    }
    const [h, p, s] = parts;

    let header: LicenseJwtHeader;
    let payload: LicenseJwtPayload;
    try {
      header = parseJsonSegment(h, 'header') as LicenseJwtHeader;
      payload = parseJsonSegment(p, 'payload') as LicenseJwtPayload;
    } catch {
      return { ok: false, error: 'Invalid license token', code: 'INVALID_TOKEN' };
    }

    // Header must come from our issuer key material
    if (header.alg !== 'ES256' || header.kid !== LICENSE_JWT_KID) {
      return { ok: false, error: 'Invalid license token', code: 'INVALID_TOKEN' };
    }
    if (payload.iss !== LICENSE_ISSUER && payload.iss !== BRAND.legacyLicenseIssuer) {
      return {
        ok: false,
        error: 'Invalid license token: wrong issuer',
        code: 'WRONG_ISSUER'
      };
    }
    if (typeof payload.plan !== 'string' || !VALID_PLANS.includes(payload.plan as PlanId)) {
      return {
        ok: false,
        error: 'Invalid license token: unknown plan',
        code: 'WRONG_PLAN'
      };
    }
    const plan = payload.plan as PlanId;

    // Customer ID requirement (cid or sub)
    const customerId =
      (typeof payload.cid === 'string' && payload.cid.trim()) ||
      (typeof payload.sub === 'string' && payload.sub.trim());
    if (!customerId) {
      return {
        ok: false,
        error: 'Invalid license token: missing customer id',
        code: 'MISSING_CUSTOMER_ID'
      };
    }

    // Expiry (seconds → must still be in the future)
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
      return { ok: false, error: 'Invalid license token', code: 'INVALID_TOKEN' };
    }
    if (payload.exp <= Date.now() / 1000) {
      return { ok: false, error: 'Expired license token', code: 'EXPIRED' };
    }

    // Cryptographic proof — raw r||s WebCrypto signature over `header.payload`
    const key = await crypto.subtle.importKey(
      'jwk',
      LICENSE_JWT_PUBLIC_JWK,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      base64UrlToBytes(s),
      textEncoder.encode(`${h}.${p}`)
    );
    if (!valid) {
      return { ok: false, error: 'Invalid signature', code: 'INVALID_SIGNATURE' };
    }

    const deviceFingerprint = await getDeviceFingerprint();

    // Check token-embedded device binding (if present)
    let tokenDevices: string[] = [];
    if (Array.isArray(payload.devices)) {
      tokenDevices = payload.devices.filter(
        (d): d is string => typeof d === 'string' && d.length > 0
      );
    } else if (typeof payload.fp === 'string' && payload.fp.length > 0) {
      tokenDevices = [payload.fp];
    }

    if (tokenDevices.length > 0 && !tokenDevices.includes(deviceFingerprint)) {
      if (!options?.moveDevice) {
        return {
          ok: false,
          error: 'This token is bound to a different workstation',
          code: 'DEVICE_MISMATCH',
          canMove: true
        };
      }
    }

    // Soft device binding: allow up to maxDevices (default 2)
    const maxDevices =
      typeof payload.maxDevices === 'number' && payload.maxDevices >= 1
        ? Math.floor(payload.maxDevices)
        : 2;

    const existing = await getLicenseState();
    let boundDevices: string[] = [];
    if (existing.token === token || existing.customerId === customerId) {
      boundDevices = Array.isArray(existing.boundDevices)
        ? [...existing.boundDevices]
        : existing.deviceFingerprint
          ? [existing.deviceFingerprint]
          : [];
    }

    if (!boundDevices.includes(deviceFingerprint)) {
      if (boundDevices.length >= maxDevices) {
        if (!options?.moveDevice) {
          return {
            ok: false,
            error: `License device limit reached (max ${maxDevices} devices)`,
            code: 'DEVICE_MISMATCH',
            canMove: true
          };
        }
        // Move license: replace the oldest device entry with the current device
        boundDevices = [
          ...boundDevices.slice(boundDevices.length - (maxDevices - 1)),
          deviceFingerprint
        ];
      } else {
        boundDevices.push(deviceFingerprint);
      }
    }

    const seats =
      typeof payload.seats === 'number' && Number.isFinite(payload.seats) && payload.seats >= 1
        ? Math.floor(payload.seats)
        : plan === 'warehouse'
          ? 3
          : 1;
    const licenseeName = typeof payload.name === 'string' ? payload.name : undefined;

    const subscriptionId =
      typeof payload.subscriptionId === 'string'
        ? payload.subscriptionId
        : typeof payload.sub_id === 'string'
          ? payload.sub_id
          : undefined;

    const renewsAt =
      typeof payload.renewsAt === 'number'
        ? payload.renewsAt * 1000
        : typeof payload.current_end === 'number'
          ? payload.current_end * 1000
          : null;

    let subscriptionStatus =
      typeof payload.subscriptionStatus === 'string'
        ? (payload.subscriptionStatus as SubscriptionStatus)
        : undefined;
    if (!subscriptionStatus) {
      subscriptionStatus = payload.exp * 1000 > Date.now() ? 'active' : 'expired';
    }

    const state: LicenseState = {
      plan,
      seats,
      deviceFingerprint,
      boundDevices,
      customerId,
      subscriptionId,
      subscriptionStatus,
      renewsAt,
      activatedAt: Date.now(),
      expiresAt: payload.exp * 1000,
      token,
      licenseeName
    };
    await db.license_state.put({ key: 'active', value: state });
    remember(state);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Invalid license token', code: 'INVALID_TOKEN' };
  }
}

/* ── Plan / state helpers (unchanged contract) ───────────────────────── */

export async function getLicenseState(): Promise<LicenseState> {
  const row = await db.license_state.get('active');
  const state = row?.value ?? FALLBACK;
  if (state.expiresAt && Date.now() > state.expiresAt) {
    if (state.subscriptionStatus !== 'expired' && state.subscriptionStatus !== 'revoked') {
      state.subscriptionStatus = 'expired';
    }
  }
  remember(state);
  return state;
}

export function useLicense(): LicenseState {
  return useLiveQuery(async () => getLicenseState(), [], lastKnown ?? FALLBACK) ?? FALLBACK;
}

export function planHasFeature(plan: LicensePlan, feature: ProFeature): boolean {
  if (lastKnown?.expiresAt && Date.now() > lastKnown.expiresAt) {
    return false; // Expired, features limited!
  }
  if (lastKnown?.subscriptionStatus === 'revoked' || lastKnown?.subscriptionStatus === 'expired') {
    return false; // Expired, features limited!
  }
  const pro = plan === 'claimradar' || plan === 'warehouse';
  switch (feature) {
    case 'unlimitedLabels':
    case 'unlimitedRecording':
      return plan !== 'free';
    case 'collage':
    case 'claimRadar':
    case 'matcher':
      return pro;
    default:
      return false;
  }
}

/** Testing path — activates a plan locally with no payment and no signature. DEV ONLY. */
export const activateDemoPlan = import.meta.env.DEV
  ? async (plan: PlanId): Promise<void> => {
      const fp = await getDeviceFingerprint();
      const state: LicenseState = {
        plan,
        seats: plan === 'warehouse' ? 3 : 1,
        deviceFingerprint: fp,
        boundDevices: [fp],
        activatedAt: Date.now(),
        demo: true
      };
      await db.license_state.put({
        key: 'active',
        value: state
      });
      remember(state);
    }
  : undefined;

export async function deactivateLicense(): Promise<void> {
  await db.license_state.delete('active');
  remember(FALLBACK);
}

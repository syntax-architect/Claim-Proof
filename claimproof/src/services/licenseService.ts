/* ClaimProof licensing engine — offline-verifiable ES256 license JWTs.
 *
 * Verification is 100% on-device: the payment webhook (Supabase Edge Function)
 * signs a compact JWT with the issuer's P-256 private key; the app only ships
 * the PUBLIC JWK (src/lib/licenseKeys.ts) and validates locally. No account,
 * no server round-trip at activation time.
 *
 * Stable export contract (consumed by quota engine, paywall, settings):
 *   getLicenseState / useLicense / planHasFeature / getDeviceFingerprint /
 *   verifyAndActivateToken / activateDemoPlan / deactivateLicense
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { LICENSE_ISSUER, LICENSE_JWT_KID, LICENSE_JWT_PUBLIC_JWK } from '../lib/licenseKeys';
import type { LicensePlan, LicenseState, PlanId, ProFeature } from '../types';

const FALLBACK: LicenseState = { plan: 'free', seats: 1, deviceFingerprint: '' };

/* Boot cache — avoids a 'Free' flash on remounts and after reloads. */
const PLAN_CACHE_KEY = 'claimproof_last_plan';
let lastKnown: LicenseState | null = (() => {
  try {
    const raw = localStorage.getItem(PLAN_CACHE_KEY);
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
  plan?: unknown;
  seats?: unknown;
  fp?: unknown;
  name?: unknown;
  iat?: unknown;
  exp?: unknown;
  jti?: unknown;
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

const PLANS: PlanId[] = ['starter', 'claimradar', 'warehouse'];

/**
 * Verifies a compact ES256 license JWT entirely on-device and, when valid,
 * persists it as the active license. Friendly errors:
 * 'Expired license token' / 'This token is bound to a different workstation' /
 * 'Invalid signature' (plus 'Invalid license token' for malformed input).
 */
export async function verifyAndActivateToken(token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const parts = token.trim().split('.');
    if (parts.length !== 3 || parts.some((p) => p.length === 0)) {
      return { ok: false, error: 'Invalid license token' };
    }
    const [h, p, s] = parts;

    const header = parseJsonSegment(h, 'header') as LicenseJwtHeader;
    const payload = parseJsonSegment(p, 'payload') as LicenseJwtPayload;

    // Header must come from our issuer key material.
    if (header.alg !== 'ES256' || header.kid !== LICENSE_JWT_KID) {
      return { ok: false, error: 'Invalid license token' };
    }
    if (payload.iss !== LICENSE_ISSUER) {
      return { ok: false, error: 'Invalid license token' };
    }
    if (typeof payload.plan !== 'string' || !PLANS.includes(payload.plan as PlanId)) {
      return { ok: false, error: 'Invalid license token' };
    }
    const plan = payload.plan as PlanId;

    // Expiry (seconds → must still be in the future).
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
      return { ok: false, error: 'Invalid license token' };
    }
    if (payload.exp <= Date.now() / 1000) {
      return { ok: false, error: 'Expired license token' };
    }

    // Device binding: a token minted for another workstation must not activate here.
    const deviceFingerprint = await getDeviceFingerprint();
    if (typeof payload.fp === 'string' && payload.fp.length > 0 && payload.fp !== deviceFingerprint) {
      return { ok: false, error: 'This token is bound to a different workstation' };
    }

    // Cryptographic proof — raw r||s WebCrypto signature over `header.payload`.
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
    if (!valid) return { ok: false, error: 'Invalid signature' };

    const seats =
      typeof payload.seats === 'number' && Number.isFinite(payload.seats) && payload.seats >= 1
        ? Math.floor(payload.seats)
        : 1;
    const licenseeName = typeof payload.name === 'string' ? payload.name : undefined;

    const state: LicenseState = {
      plan,
      seats,
      deviceFingerprint,
      activatedAt: Date.now(),
      expiresAt: payload.exp * 1000,
      token,
      licenseeName
    };
    await db.license_state.put({ key: 'active', value: state });
    return { ok: true };
  } catch {
    // Any unexpected failure (bad base64, missing WebCrypto, …) → generic friendly error.
    return { ok: false, error: 'Invalid license token' };
  }
}

/* ── Plan / state helpers (unchanged contract) ───────────────────────── */

export async function getLicenseState(): Promise<LicenseState> {
  const row = await db.license_state.get('active');
  const state = row?.value ?? FALLBACK;
  remember(state);
  return state;
}

export function useLicense(): LicenseState {
  return useLiveQuery(async () => getLicenseState(), [], lastKnown ?? FALLBACK) ?? FALLBACK;
}

export function planHasFeature(plan: LicensePlan, feature: ProFeature): boolean {
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

/** Testing path — activates a plan locally with no payment and no signature. */
export async function activateDemoPlan(plan: PlanId): Promise<void> {
  const fp = await getDeviceFingerprint();
  await db.license_state.put({
    key: 'active',
    value: {
      plan,
      seats: 1,
      deviceFingerprint: fp,
      activatedAt: Date.now(),
      demo: true
    }
  });
}

export async function deactivateLicense(): Promise<void> {
  await db.license_state.delete('active');
  remember(FALLBACK);
}

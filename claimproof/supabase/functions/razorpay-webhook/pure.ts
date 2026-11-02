// ═══════════════════════════════════════════════════════════════════════
// SABOOT.in — Pure licensing & webhook utilities
// Extracted pure functions for Razorpay webhook signature verification,
// license expiry calculation (with 3-day grace period for subscriptions),
// offline-verifiable ES256 JWT construction, and subscription event handling.
//
// Official Razorpay Documentation Citations:
// - Subscriptions Webhooks: https://razorpay.com/docs/api/payments/subscriptions/webhooks/
// - Subscriptions Payload Entities: https://razorpay.com/docs/webhooks/payloads/subscriptions/
// - Payments Webhook (payment.failed): https://razorpay.com/docs/webhooks/payloads/payments/
// - Refunds Webhook (refund.processed): https://razorpay.com/docs/webhooks/payloads/refunds/
//
// Compatible with both Deno (Supabase Edge Functions) and Node.js / Vitest.
// ═══════════════════════════════════════════════════════════════════════

export const LICENSE_ISSUER = 'https://saboot.in';
export const VALID_PLANS = new Set(['starter', 'claimradar', 'warehouse']);
export const LICENSE_DAYS = 365;

/**
 * Milestone Gate: Per SABOOT Roadmap, recurring automated Razorpay Subscriptions
 * are added only after achieving at least 20 manual sales in Phase 1.
 */
export const MIN_MANUAL_SALES_FOR_SUBSCRIPTIONS = 20;

/**
 * A license expires at the end of the paid period plus a 3-day grace period.
 */
export const SUBSCRIPTION_GRACE_PERIOD_DAYS = 3;
export const SUBSCRIPTION_GRACE_PERIOD_SECONDS = 3 * 24 * 3600;

export const RAZORPAY_DOC_CITATIONS = {
  subscriptions: 'https://razorpay.com/docs/api/payments/subscriptions/webhooks/',
  subscriptionPayloads: 'https://razorpay.com/docs/webhooks/payloads/subscriptions/',
  paymentsPayloads: 'https://razorpay.com/docs/webhooks/payloads/payments/',
  refundsPayloads: 'https://razorpay.com/docs/webhooks/payloads/refunds/'
} as const;

export interface JwtParts {
  headerB64: string;
  payloadB64: string;
  signingInput: string;
  signatureB64: string;
  payload: Record<string, unknown>;
}

export interface LicenseJwtPayloadParams {
  licenseId: string;
  plan: string;
  seats: number;
  fingerprint: string;
  licenseeName?: string;
  iat: number;
  exp: number;
  jti: string;
  iss?: string;
  customerId?: string;
  subscriptionId?: string;
  subscriptionStatus?: string;
  renewsAt?: number;
  current_end?: number;
}

export interface LicenseJwtHeaderOptions {
  alg?: string;
  typ?: string;
  kid?: string;
}

export interface LicenseExpiryResult {
  expiresAt: string;
  exp: number;
}

export interface SubscriptionExpiryResult {
  paidPeriodEndSec: number;
  paidPeriodEndIso: string;
  expiresAtSec: number;
  expiresAtIso: string;
  renewsAtIso: string;
  graceDays: number;
}

/**
 * Base64URL encoding for Uint8Array (no padding, URL-safe alphabet).
 */
export const b64url = (bytes: Uint8Array): string => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/**
 * Constant-time string equality check to mitigate timing attacks.
 */
export const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

/**
 * Calculates standard one-off license expiration timestamp and ISO string.
 * Uses exact millisecond calculation: nowMs + days * 24 * 3600 * 1000
 */
export function calculateLicenseExpiry(
  nowMs: number = Date.now(),
  days: number = LICENSE_DAYS
): LicenseExpiryResult {
  const expiresAtMs = nowMs + days * 24 * 3600 * 1000;
  return {
    expiresAt: new Date(expiresAtMs).toISOString(),
    exp: Math.floor(expiresAtMs / 1000)
  };
}

/**
 * Calculates subscription license expiration at the end of the paid period plus 3-day grace.
 * Citation: https://razorpay.com/docs/api/payments/subscriptions/webhooks/
 */
export function calculateSubscriptionExpiry(
  currentEndSec: number,
  graceDays: number = SUBSCRIPTION_GRACE_PERIOD_DAYS
): SubscriptionExpiryResult {
  const expiresAtSec = currentEndSec + graceDays * 24 * 3600;
  return {
    paidPeriodEndSec: currentEndSec,
    paidPeriodEndIso: new Date(currentEndSec * 1000).toISOString(),
    expiresAtSec,
    expiresAtIso: new Date(expiresAtSec * 1000).toISOString(),
    renewsAtIso: new Date(currentEndSec * 1000).toISOString(),
    graceDays
  };
}

/**
 * Verifies Razorpay webhook HMAC-SHA256 signature against the raw request body.
 */
export async function verifyRazorpaySignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return timingSafeEqual(expected, signature);
}

/**
 * Builds base64url-encoded header, payload, and signing input for an ES256 license JWT.
 */
export function buildLicenseJwtParts(
  params: LicenseJwtPayloadParams,
  headerOptions: LicenseJwtHeaderOptions = {}
): JwtParts {
  const header = {
    alg: headerOptions.alg ?? 'ES256',
    typ: headerOptions.typ ?? 'JWT',
    kid: headerOptions.kid ?? 'cp-dev-1'
  };

  const customerId = params.customerId || params.licenseId;
  const payload: Record<string, unknown> = {
    iss: params.iss ?? LICENSE_ISSUER,
    sub: customerId,
    cid: customerId,
    plan: params.plan,
    seats: params.seats,
    fp: params.fingerprint,
    iat: params.iat,
    exp: params.exp,
    jti: params.jti
  };

  if (params.subscriptionId) payload.subscriptionId = params.subscriptionId;
  if (params.subscriptionStatus) payload.subscriptionStatus = params.subscriptionStatus;
  if (params.renewsAt) payload.renewsAt = params.renewsAt;
  if (params.current_end) payload.current_end = params.current_end;
  if (params.licenseeName) payload.name = params.licenseeName;

  const headerB64 = b64url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  return {
    headerB64,
    payloadB64,
    signingInput,
    signatureB64: '',
    payload
  };
}

/**
 * Signs JWT signing input using ECDSA P-256 private key.
 * WebCrypto ES256 signatures are raw r||s — verified offline by the SABOOT PWA.
 */
export async function signEs256Jwt(parts: JwtParts, privateJwk: JsonWebKey): Promise<string> {
  const key = await crypto.subtle.importKey(
    'jwk',
    privateJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(parts.signingInput)
  );
  return `${parts.headerB64}.${parts.payloadB64}.${b64url(new Uint8Array(sig))}`;
}

/**
 * Builds and cryptographically signs a license JWT in a single step.
 */
export async function buildAndSignLicenseJwt(
  params: LicenseJwtPayloadParams,
  privateJwk: JsonWebKey,
  headerOptions: LicenseJwtHeaderOptions = {}
): Promise<string> {
  const parts = buildLicenseJwtParts(params, headerOptions);
  return signEs256Jwt(parts, privateJwk);
}

/* ── Webhook Database Adapter & Event Dispatcher ─────────────────────── */

export interface WebhookDatabaseAdapter {
  isEventProcessed(eventId: string): Promise<boolean>;
  recordEvent(eventId: string, eventType: string, payload: unknown): Promise<void>;
  getManualSalesCount?(): Promise<number>;
  upsertDevice?(
    fingerprint: string,
    label?: string
  ): Promise<{ id: string } | null>;
  upsertLicense(license: {
    id?: string;
    plan: string;
    seats: number;
    status: string;
    fingerprint_sha?: string;
    device_id?: string | null;
    subscription_id?: string;
    expires_at: string;
    renews_at?: string;
    razorpay_payment_id?: string;
    jti?: string;
    token?: string;
  }): Promise<{ id: string }>;
  getLicenseBySubscriptionId(
    subscriptionId: string
  ): Promise<{ id: string; plan: string; seats: number; fingerprint_sha?: string } | null>;
  getLicenseByPaymentId(
    paymentId: string
  ): Promise<{ id: string; status: string } | null>;
  updateLicense(id: string, updates: Record<string, unknown>): Promise<void>;
  revokeLicenseByPaymentId(paymentId: string, reason?: string): Promise<void>;
  recordPayment(payment: {
    razorpay_payment_id: string;
    razorpay_order_id?: string | null;
    amount: number;
    currency: string;
    status: string;
    plan?: string;
    error_code?: string | null;
    error_description?: string | null;
    license_id?: string;
    subscription_id?: string;
    notes?: Record<string, unknown>;
  }): Promise<void>;
}

export interface ProcessWebhookResult {
  ok: boolean;
  status: number;
  error?: string;
  deduped?: boolean;
  event?: string;
  token?: string;
  licenseId?: string;
  licenseStatus?: string;
  expiresAt?: string;
  renewsAt?: string;
  revoked?: boolean;
  milestoneBlocked?: boolean;
}

/**
 * Pure Razorpay Webhook Event Processor.
 * Handles:
 * - Signature verification
 * - Idempotency deduplication
 * - Milestone gating (only after at least 20 manual sales)
 * - Subscription events: subscription.activated, subscription.charged, subscription.halted, subscription.cancelled
 * - Payment failure: payment.failed
 * - Refund revocation: refund.processed, refund.created
 * - One-off capture: payment.captured
 */
export async function processRazorpayWebhook(
  rawBody: string,
  signature: string,
  secret: string,
  dbAdapter: WebhookDatabaseAdapter,
  options?: {
    signingKey?: JsonWebKey;
    kid?: string;
    eventIdHeader?: string;
    manualSalesCount?: number;
  }
): Promise<ProcessWebhookResult> {
  // 1. Signature verification
  const valid = await verifyRazorpaySignature(rawBody, signature, secret);
  if (!valid) {
    return { ok: false, status: 401, error: 'invalid signature' };
  }

  // 2. Parse payload
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return { ok: false, status: 400, error: 'invalid json' };
  }

  const eventType = String(event.event ?? '');
  const payloadObj = (event.payload ?? {}) as Record<string, unknown>;
  const eventId =
    options?.eventIdHeader ||
    (typeof event.id === 'string' ? event.id : null) ||
    `${eventType}-${event.created_at || Date.now()}`;

  // 3. Idempotency Check
  const alreadyProcessed = await dbAdapter.isEventProcessed(eventId);
  if (alreadyProcessed) {
    return { ok: true, status: 200, deduped: true, event: eventType };
  }
  await dbAdapter.recordEvent(eventId, eventType, event);

  const isSubscriptionEvent = eventType.startsWith('subscription.');

  // 4. Milestone Check: Only after at least 20 manual sales
  if (isSubscriptionEvent) {
    let salesCount = options?.manualSalesCount;
    if (salesCount === undefined && dbAdapter.getManualSalesCount) {
      salesCount = await dbAdapter.getManualSalesCount();
    }
    if (salesCount !== undefined && salesCount < MIN_MANUAL_SALES_FOR_SUBSCRIPTIONS) {
      return {
        ok: false,
        status: 403,
        error: `Subscriptions milestone not reached (requires at least ${MIN_MANUAL_SALES_FOR_SUBSCRIPTIONS} manual sales; current: ${salesCount})`,
        milestoneBlocked: true,
        event: eventType
      };
    }
  }

  const kid = options?.kid ?? 'cp-dev-1';

  // 5. Subscription Activated
  if (eventType === 'subscription.activated') {
    const subEntity = ((payloadObj.subscription as Record<string, unknown>)?.entity ?? {}) as Record<
      string,
      unknown
    >;
    const subId = String(subEntity.id ?? '');
    const currentEnd = Number(subEntity.current_end) || Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
    const notes = ((subEntity.notes ?? {}) as Record<string, string>) || {};
    const plan = String(notes.plan || 'claimradar');
    const fingerprint = String(notes.fingerprint || 'fp_subscription_default');
    const seats = Number(notes.seats) || (plan === 'warehouse' ? 3 : 1);
    const customerId = String(subEntity.customer_id || notes.customerId || subId);

    const { expiresAtSec, expiresAtIso, renewsAtIso } = calculateSubscriptionExpiry(currentEnd, SUBSCRIPTION_GRACE_PERIOD_DAYS);
    const jti = `jti_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const lic = await dbAdapter.upsertLicense({
      subscription_id: subId,
      plan,
      seats,
      status: 'active',
      fingerprint_sha: fingerprint,
      expires_at: expiresAtIso,
      renews_at: renewsAtIso,
      jti
    });

    let token: string | undefined;
    if (options?.signingKey) {
      token = await buildAndSignLicenseJwt(
        {
          licenseId: lic.id,
          customerId,
          subscriptionId: subId,
          subscriptionStatus: 'active',
          plan,
          seats,
          fingerprint,
          current_end: currentEnd,
          renewsAt: currentEnd,
          iat: Math.floor(Date.now() / 1000),
          exp: expiresAtSec,
          jti
        },
        options.signingKey,
        { kid }
      );
      await dbAdapter.updateLicense(lic.id, { token });
    }

    return {
      ok: true,
      status: 200,
      event: eventType,
      licenseId: lic.id,
      licenseStatus: 'active',
      expiresAt: expiresAtIso,
      renewsAt: renewsAtIso,
      token
    };
  }

  // 6. Subscription Charged (Recurring renewal)
  if (eventType === 'subscription.charged') {
    const subEntity = ((payloadObj.subscription as Record<string, unknown>)?.entity ?? {}) as Record<
      string,
      unknown
    >;
    const paymentEntity = ((payloadObj.payment as Record<string, unknown>)?.entity ?? {}) as Record<
      string,
      unknown
    >;
    const subId = String(subEntity.id ?? '');
    const paymentId = String(paymentEntity.id ?? '');
    const currentEnd = Number(subEntity.current_end) || Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
    const { expiresAtSec, expiresAtIso, renewsAtIso } = calculateSubscriptionExpiry(currentEnd, SUBSCRIPTION_GRACE_PERIOD_DAYS);

    await dbAdapter.recordPayment({
      razorpay_payment_id: paymentId,
      razorpay_order_id: paymentEntity.order_id ? String(paymentEntity.order_id) : null,
      amount: Number(paymentEntity.amount ?? 0),
      currency: String(paymentEntity.currency ?? 'INR'),
      status: 'captured',
      subscription_id: subId
    });

    let lic = await dbAdapter.getLicenseBySubscriptionId(subId);
    if (!lic) {
      const notes = ((subEntity.notes ?? {}) as Record<string, string>) || {};
      const plan = String(notes.plan || 'claimradar');
      const seats = Number(notes.seats) || (plan === 'warehouse' ? 3 : 1);
      lic = await dbAdapter.upsertLicense({
        subscription_id: subId,
        plan,
        seats,
        status: 'active',
        expires_at: expiresAtIso,
        renews_at: renewsAtIso,
        razorpay_payment_id: paymentId
      });
    } else {
      await dbAdapter.updateLicense(lic.id, {
        status: 'active',
        expires_at: expiresAtIso,
        renews_at: renewsAtIso,
        razorpay_payment_id: paymentId
      });
    }

    let token: string | undefined;
    if (options?.signingKey) {
      const customerId = String(subEntity.customer_id || lic.id);
      token = await buildAndSignLicenseJwt(
        {
          licenseId: lic.id,
          customerId,
          subscriptionId: subId,
          subscriptionStatus: 'active',
          plan: lic.plan,
          seats: lic.seats,
          fingerprint: lic.fingerprint_sha ?? '',
          current_end: currentEnd,
          renewsAt: currentEnd,
          iat: Math.floor(Date.now() / 1000),
          exp: expiresAtSec,
          jti: `jti_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        },
        options.signingKey,
        { kid }
      );
      await dbAdapter.updateLicense(lic.id, { token });
    }

    return {
      ok: true,
      status: 200,
      event: eventType,
      licenseId: lic.id,
      licenseStatus: 'active',
      expiresAt: expiresAtIso,
      renewsAt: renewsAtIso,
      token
    };
  }

  // 7. Subscription Halted (Retries exhausted, payment method update required)
  if (eventType === 'subscription.halted') {
    const subEntity = ((payloadObj.subscription as Record<string, unknown>)?.entity ?? {}) as Record<
      string,
      unknown
    >;
    const subId = String(subEntity.id ?? '');
    const lic = await dbAdapter.getLicenseBySubscriptionId(subId);
    if (lic) {
      await dbAdapter.updateLicense(lic.id, { status: 'halted' });
    }
    return {
      ok: true,
      status: 200,
      event: eventType,
      licenseId: lic?.id,
      licenseStatus: 'halted'
    };
  }

  // 8. Subscription Cancelled
  if (eventType === 'subscription.cancelled') {
    const subEntity = ((payloadObj.subscription as Record<string, unknown>)?.entity ?? {}) as Record<
      string,
      unknown
    >;
    const subId = String(subEntity.id ?? '');
    const lic = await dbAdapter.getLicenseBySubscriptionId(subId);
    if (lic) {
      await dbAdapter.updateLicense(lic.id, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      });
    }
    return {
      ok: true,
      status: 200,
      event: eventType,
      licenseId: lic?.id,
      licenseStatus: 'cancelled'
    };
  }

  // 9. Payment Failed (Recurring charge or initial debit failure)
  if (eventType === 'payment.failed') {
    const paymentEntity = ((payloadObj.payment as Record<string, unknown>)?.entity ?? {}) as Record<
      string,
      unknown
    >;
    const paymentId = String(paymentEntity.id ?? '');
    const notes = ((paymentEntity.notes ?? {}) as Record<string, string>) || {};
    const subId = notes.subscription_id;

    await dbAdapter.recordPayment({
      razorpay_payment_id: paymentId,
      amount: Number(paymentEntity.amount ?? 0),
      currency: String(paymentEntity.currency ?? 'INR'),
      status: 'failed',
      error_code: String(paymentEntity.error_code ?? 'PAYMENT_FAILED'),
      error_description: String(paymentEntity.error_description ?? 'Payment failed'),
      subscription_id: subId
    });

    let updatedLicenseId: string | undefined;
    if (subId) {
      const lic = await dbAdapter.getLicenseBySubscriptionId(subId);
      if (lic) {
        await dbAdapter.updateLicense(lic.id, { status: 'payment_failed' });
        updatedLicenseId = lic.id;
      }
    }

    return {
      ok: true,
      status: 200,
      event: eventType,
      licenseId: updatedLicenseId,
      licenseStatus: 'payment_failed'
    };
  }

  // 10. Refund Processed / Created (Revoke license row)
  if (eventType === 'refund.processed' || eventType === 'refund.created') {
    const refundEntity = ((payloadObj.refund as Record<string, unknown>)?.entity ?? {}) as Record<
      string,
      unknown
    >;
    const paymentId = String(refundEntity.payment_id ?? '');

    if (paymentId) {
      await dbAdapter.revokeLicenseByPaymentId(paymentId, 'Refund issued to customer');
    }

    return {
      ok: true,
      status: 200,
      event: eventType,
      revoked: true
    };
  }

  // 11. Legacy / One-off payment captured
  if (eventType === 'payment.captured') {
    const payment = ((payloadObj.payment as Record<string, unknown>)?.entity ?? {}) as Record<
      string,
      unknown
    >;
    const paymentId = String(payment.id ?? '');
    const notes = ((payment.notes ?? {}) as Record<string, string>) || {};
    const plan = String(notes.plan ?? '');
    const fingerprint = String(notes.fingerprint ?? '');
    const seats = Math.max(1, Math.min(25, parseInt(String(notes.seats ?? '1'), 10) || 1));
    const licenseeName = notes.licensee_name ?? notes.name ?? undefined;
    const deviceLabel = notes.device_label ?? undefined;

    if (!VALID_PLANS.has(plan) || !fingerprint || !paymentId) {
      return {
        ok: false,
        status: 422,
        error: 'missing plan/fingerprint/payment id in notes',
        event: eventType
      };
    }

    if (dbAdapter.upsertDevice) {
      await dbAdapter.upsertDevice(fingerprint, deviceLabel);
    }

    const nowMs = Date.now();
    const { expiresAt, exp } = calculateLicenseExpiry(nowMs, LICENSE_DAYS);
    const jti = `cp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const lic = await dbAdapter.upsertLicense({
      plan,
      seats,
      status: 'active',
      fingerprint_sha: fingerprint,
      expires_at: expiresAt,
      razorpay_payment_id: paymentId,
      jti
    });

    await dbAdapter.recordPayment({
      razorpay_payment_id: paymentId,
      razorpay_order_id: payment.order_id ? String(payment.order_id) : null,
      amount: Number(payment.amount ?? 0),
      currency: String(payment.currency ?? 'INR'),
      status: String(payment.status ?? 'captured'),
      plan,
      license_id: lic.id,
      notes: (payment.notes as Record<string, unknown>) ?? {}
    });

    let token: string | undefined;
    if (options?.signingKey) {
      token = await buildAndSignLicenseJwt(
        {
          licenseId: lic.id,
          customerId: lic.id,
          plan,
          seats,
          fingerprint,
          licenseeName,
          iat: Math.floor(nowMs / 1000),
          exp,
          jti,
          iss: LICENSE_ISSUER
        },
        options.signingKey,
        { kid }
      );
      await dbAdapter.updateLicense(lic.id, { token });
    }

    return {
      ok: true,
      status: 200,
      event: eventType,
      token,
      licenseId: lic.id,
      licenseStatus: 'active'
    };
  }

  return { ok: true, status: 200, event: eventType };
}

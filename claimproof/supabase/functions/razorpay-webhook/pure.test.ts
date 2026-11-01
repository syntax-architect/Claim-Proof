import { describe, it, expect } from 'vitest';
import {
  b64url,
  timingSafeEqual,
  calculateLicenseExpiry,
  calculateSubscriptionExpiry,
  verifyRazorpaySignature,
  buildLicenseJwtParts,
  signEs256Jwt,
  buildAndSignLicenseJwt,
  processRazorpayWebhook,
  type WebhookDatabaseAdapter,
  LICENSE_DAYS,
  LICENSE_ISSUER,
  VALID_PLANS,
  MIN_MANUAL_SALES_FOR_SUBSCRIPTIONS,
  SUBSCRIPTION_GRACE_PERIOD_DAYS,
  RAZORPAY_DOC_CITATIONS
} from './pure.ts';
import devKeys from '../../../scripts/.license-dev-keys.json';
import { LICENSE_JWT_PUBLIC_JWK, LICENSE_JWT_KID } from '../../../src/lib/licenseKeys';

function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

describe('Pure License & Webhook Utilities', () => {
  describe('calculateLicenseExpiry', () => {
    it('calculates license expiry using LICENSE_DAYS * 24 * 3600 * 1000 without multiplying by 1000 twice', () => {
      const fixedNow = 1700000000000; // Fixed timestamp
      const result = calculateLicenseExpiry(fixedNow, LICENSE_DAYS);

      const expectedDeltaMs = LICENSE_DAYS * 24 * 3600 * 1000;
      const expectedExpiryMs = fixedNow + expectedDeltaMs;

      // Ensure 365 days is ~31.5 million seconds (~1 year), NOT ~1000 years
      expect(expectedDeltaMs).toBe(31_536_000_000);
      expect(new Date(result.expiresAt).getTime()).toBe(expectedExpiryMs);
      expect(result.exp).toBe(Math.floor(expectedExpiryMs / 1000));
      expect(result.expiresAt).toBe(new Date(expectedExpiryMs).toISOString());

      // Explicitly check that it is NOT the old bug (3_600_000 * 1000 = multiplied by 1000 twice)
      const buggyDeltaMs = LICENSE_DAYS * 24 * 3_600_000 * 1000;
      expect(new Date(result.expiresAt).getTime() - fixedNow).not.toBe(buggyDeltaMs);
    });

    it('supports custom duration in days', () => {
      const fixedNow = 1700000000000;
      const result30Days = calculateLicenseExpiry(fixedNow, 30);
      const expectedDelta30 = 30 * 24 * 3600 * 1000;

      expect(new Date(result30Days.expiresAt).getTime() - fixedNow).toBe(expectedDelta30);
      expect(result30Days.exp).toBe(Math.floor((fixedNow + expectedDelta30) / 1000));
    });

    it('defaults to Date.now() when no timestamp is passed', () => {
      const before = Date.now();
      const result = calculateLicenseExpiry();
      const after = Date.now();

      const expectedDelta = LICENSE_DAYS * 24 * 3600 * 1000;
      const expiryMs = new Date(result.expiresAt).getTime();
      expect(expiryMs).toBeGreaterThanOrEqual(before + expectedDelta);
      expect(expiryMs).toBeLessThanOrEqual(after + expectedDelta);
    });
  });

  describe('timingSafeEqual', () => {
    it('returns true for identical strings', () => {
      expect(timingSafeEqual('abcdef123', 'abcdef123')).toBe(true);
      expect(timingSafeEqual('', '')).toBe(true);
    });

    it('returns false for strings of different lengths', () => {
      expect(timingSafeEqual('short', 'longer-string')).toBe(false);
      expect(timingSafeEqual('a', '')).toBe(false);
    });

    it('returns false for strings of the same length with different characters', () => {
      expect(timingSafeEqual('abcdef', 'abcdeg')).toBe(false);
      expect(timingSafeEqual('123456', '654321')).toBe(false);
    });
  });

  describe('verifyRazorpaySignature', () => {
    const secret = 'webhook_secret_key_xyz_789';
    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_999', amount: 49900 } } }
    });

    async function computeValidSignature(body: string, sec: string): Promise<string> {
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(sec),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
      return Array.from(new Uint8Array(mac))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }

    it('verifies a valid HMAC-SHA256 signature correctly', async () => {
      const validSig = await computeValidSignature(payload, secret);
      const isValid = await verifyRazorpaySignature(payload, validSig, secret);
      expect(isValid).toBe(true);
    });

    it('rejects an invalid signature', async () => {
      const validSig = await computeValidSignature(payload, secret);
      const corruptedSig = validSig.slice(0, -2) + '00';
      const isValid = await verifyRazorpaySignature(payload, corruptedSig, secret);
      expect(isValid).toBe(false);
    });

    it('rejects if the payload body is tampered with', async () => {
      const validSig = await computeValidSignature(payload, secret);
      const tamperedBody = payload + ' ';
      const isValid = await verifyRazorpaySignature(tamperedBody, validSig, secret);
      expect(isValid).toBe(false);
    });

    it('rejects if verified against the wrong secret', async () => {
      const validSig = await computeValidSignature(payload, secret);
      const isValid = await verifyRazorpaySignature(payload, validSig, 'wrong_secret');
      expect(isValid).toBe(false);
    });

    it('rejects empty or missing parameters', async () => {
      expect(await verifyRazorpaySignature(payload, '', secret)).toBe(false);
      expect(await verifyRazorpaySignature(payload, 'sig', '')).toBe(false);
    });
  });

  describe('b64url', () => {
    it('produces URL-safe base64 without padding characters', () => {
      // Bytes that produce + and / in standard base64: [251, 239] -> ++8=
      const bytes = new Uint8Array([251, 239]);
      const encoded = b64url(bytes);
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
    });

    it('correctly encodes and decodes ASCII strings', () => {
      const input = 'Hello World from ClaimProof!';
      const encoded = b64url(new TextEncoder().encode(input));
      const decodedBytes = base64UrlToBytes(encoded);
      const decoded = new TextDecoder().decode(decodedBytes);
      expect(decoded).toBe(input);
    });
  });

  describe('buildLicenseJwtParts and signEs256Jwt', () => {
    const payloadParams = {
      licenseId: 'lic_abc_123',
      plan: 'claimradar',
      seats: 2,
      fingerprint: 'sha256_mock_device_fp',
      licenseeName: 'Sharma Electronics',
      iat: 1700000000,
      exp: 1731536000,
      jti: 'jti_unique_token_id',
      iss: LICENSE_ISSUER
    };

    it('builds JWT parts with correct structure, header, and payload', () => {
      const parts = buildLicenseJwtParts(payloadParams, { kid: 'cp-dev-1' });

      expect(parts.headerB64).toBeDefined();
      expect(parts.payloadB64).toBeDefined();
      expect(parts.signingInput).toBe(`${parts.headerB64}.${parts.payloadB64}`);

      const header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts.headerB64)));
      expect(header).toEqual({
        alg: 'ES256',
        typ: 'JWT',
        kid: 'cp-dev-1'
      });

      const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts.payloadB64)));
      expect(payload).toEqual({
        iss: LICENSE_ISSUER,
        sub: 'lic_abc_123',
        cid: 'lic_abc_123',
        plan: 'claimradar',
        seats: 2,
        fp: 'sha256_mock_device_fp',
        iat: 1700000000,
        exp: 1731536000,
        jti: 'jti_unique_token_id',
        name: 'Sharma Electronics'
      });
    });

    it('signs and generates offline-verifiable ES256 token matching public key', async () => {
      const privateJwk = devKeys.priv as JsonWebKey;
      const token = await buildAndSignLicenseJwt(payloadParams, privateJwk, { kid: LICENSE_JWT_KID });

      const parts = token.split('.');
      expect(parts.length).toBe(3);
      const [h, p, s] = parts;

      // Cryptographically verify with public key from src/lib/licenseKeys
      const verifyKey = await crypto.subtle.importKey(
        'jwk',
        LICENSE_JWT_PUBLIC_JWK,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      );

      const isValid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        verifyKey,
        base64UrlToBytes(s),
        new TextEncoder().encode(`${h}.${p}`)
      );

      expect(isValid).toBe(true);
    });

    it('rejects verification if token payload has been tampered with', async () => {
      const privateJwk = devKeys.priv as JsonWebKey;
      const token = await buildAndSignLicenseJwt(payloadParams, privateJwk, { kid: LICENSE_JWT_KID });

      const [h, p, s] = token.split('.');
      const tamperedPayload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(p)));
      tamperedPayload.plan = 'warehouse'; // unauthorized plan tampering
      const tamperedPB64 = b64url(new TextEncoder().encode(JSON.stringify(tamperedPayload)));

      const verifyKey = await crypto.subtle.importKey(
        'jwk',
        LICENSE_JWT_PUBLIC_JWK,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      );

      const isValid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        verifyKey,
        base64UrlToBytes(s),
        new TextEncoder().encode(`${h}.${tamperedPB64}`)
      );

      expect(isValid).toBe(false);
    });
  });

  describe('Constants and Plan Validation', () => {
    it('defines valid plans', () => {
      expect(VALID_PLANS.has('starter')).toBe(true);
      expect(VALID_PLANS.has('claimradar')).toBe(true);
      expect(VALID_PLANS.has('warehouse')).toBe(true);
      expect(VALID_PLANS.has('enterprise')).toBe(false);
    });

    it('has standard 365 days license period and issuer domain', () => {
      expect(LICENSE_DAYS).toBe(365);
      expect(LICENSE_ISSUER).toBe('https://claimproof.in');
    });
  });

  describe('calculateSubscriptionExpiry (Paid period + 3-day grace)', () => {
    it('adds exactly 3 days (259,200 seconds) grace period to current_end', () => {
      const currentEndSec = 1772592000; // e.g. 1 month period
      const result = calculateSubscriptionExpiry(currentEndSec, SUBSCRIPTION_GRACE_PERIOD_DAYS);

      const expectedGraceSec = 3 * 24 * 3600;
      expect(result.paidPeriodEndSec).toBe(currentEndSec);
      expect(result.expiresAtSec).toBe(currentEndSec + expectedGraceSec);
      expect(result.graceDays).toBe(3);
      expect(new Date(result.expiresAtIso).getTime()).toBe((currentEndSec + expectedGraceSec) * 1000);
      expect(new Date(result.renewsAtIso).getTime()).toBe(currentEndSec * 1000);
    });

    it('cites official Razorpay documentation pages', () => {
      expect(RAZORPAY_DOC_CITATIONS.subscriptions).toBe(
        'https://razorpay.com/docs/api/payments/subscriptions/webhooks/'
      );
      expect(RAZORPAY_DOC_CITATIONS.subscriptionPayloads).toBe(
        'https://razorpay.com/docs/webhooks/payloads/subscriptions/'
      );
      expect(RAZORPAY_DOC_CITATIONS.paymentsPayloads).toBe(
        'https://razorpay.com/docs/webhooks/payloads/payments/'
      );
      expect(RAZORPAY_DOC_CITATIONS.refundsPayloads).toBe(
        'https://razorpay.com/docs/webhooks/payloads/refunds/'
      );
    });
  });

  describe('processRazorpayWebhook with Recorded Sample Payloads', () => {
    const secret = 'webhook_secret_sub_test';
    const privateJwk = devKeys.priv as JsonWebKey;

    async function computeSig(body: string): Promise<string> {
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
      return Array.from(new Uint8Array(mac))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }

    interface MockLicenseRecord {
      id: string;
      plan: string;
      seats: number;
      status: string;
      subscription_id?: string;
      razorpay_payment_id?: string;
      expires_at: string;
      renews_at?: string;
      fingerprint_sha?: string;
      revoked_at?: string;
      revocation_reason?: string;
      token?: string;
    }

    function createMockDb(initialManualSales = 20) {
      const events = new Set<string>();
      const licenses = new Map<string, MockLicenseRecord>();
      const payments = new Map<string, Record<string, unknown>>();
      let manualSales = initialManualSales;

      const adapter: WebhookDatabaseAdapter = {
        async isEventProcessed(eventId: string) {
          return events.has(eventId);
        },
        async recordEvent(eventId: string) {
          events.add(eventId);
        },
        async getManualSalesCount() {
          return manualSales;
        },
        async upsertLicense(lic) {
          const id = lic.id || lic.subscription_id || `lic_${Date.now()}`;
          const rec: MockLicenseRecord = {
            id,
            plan: lic.plan,
            seats: lic.seats,
            status: lic.status,
            subscription_id: lic.subscription_id,
            razorpay_payment_id: lic.razorpay_payment_id,
            expires_at: lic.expires_at,
            renews_at: lic.renews_at,
            fingerprint_sha: lic.fingerprint_sha,
            token: lic.token
          };
          licenses.set(id, rec);
          return { id };
        },
        async getLicenseBySubscriptionId(subId: string) {
          for (const lic of licenses.values()) {
            if (lic.subscription_id === subId) return lic;
          }
          return null;
        },
        async getLicenseByPaymentId(paymentId: string) {
          for (const lic of licenses.values()) {
            if (lic.razorpay_payment_id === paymentId) return lic;
          }
          return null;
        },
        async updateLicense(id: string, updates: Record<string, unknown>) {
          const existing = licenses.get(id);
          if (existing) {
            licenses.set(id, { ...existing, ...updates });
          }
        },
        async revokeLicenseByPaymentId(paymentId: string, reason?: string) {
          for (const [id, lic] of licenses.entries()) {
            if (lic.razorpay_payment_id === paymentId) {
              licenses.set(id, {
                ...lic,
                status: 'revoked',
                revoked_at: new Date().toISOString(),
                revocation_reason: reason
              });
            }
          }
        },
        async recordPayment(pmt) {
          payments.set(pmt.razorpay_payment_id, pmt);
        }
      };

      return {
        adapter,
        licenses,
        payments,
        events,
        setManualSales: (count: number) => {
          manualSales = count;
        }
      };
    }

    /* Recorded sample payload: subscription.activated (Official Razorpay Doc Schema) */
    const sampleSubActivated = JSON.stringify({
      entity: 'event',
      account_id: 'acc_1Aa00000000001',
      event: 'subscription.activated',
      contains: ['subscription'],
      payload: {
        subscription: {
          entity: {
            id: 'sub_test_activated_101',
            entity: 'subscription',
            plan_id: 'plan_claimradar_monthly',
            status: 'active',
            current_start: 1770000000,
            current_end: 1772592000,
            ended_at: null,
            quantity: 1,
            charge_at: 1772592000,
            start_at: 1770000000,
            customer_id: 'cust_retail_789',
            notes: {
              plan: 'claimradar',
              fingerprint: 'fp_pc1_test',
              customerId: 'cust_retail_789'
            },
            created_at: 1770000000
          }
        }
      },
      created_at: 1770000005
    });

    /* Recorded sample payload: subscription.charged (Official Razorpay Doc Schema) */
    const sampleSubCharged = JSON.stringify({
      entity: 'event',
      account_id: 'acc_1Aa00000000001',
      event: 'subscription.charged',
      contains: ['subscription', 'payment'],
      payload: {
        subscription: {
          entity: {
            id: 'sub_test_activated_101',
            entity: 'subscription',
            plan_id: 'plan_claimradar_monthly',
            status: 'active',
            current_start: 1772592000,
            current_end: 1775184000,
            customer_id: 'cust_retail_789',
            notes: {
              plan: 'claimradar',
              fingerprint: 'fp_pc1_test'
            }
          }
        },
        payment: {
          entity: {
            id: 'pay_sub_charged_999',
            entity: 'payment',
            amount: 59900,
            currency: 'INR',
            status: 'captured',
            order_id: 'order_sub_charge_101',
            invoice_id: 'inv_sub_charge_101',
            method: 'upi',
            notes: {
              subscription_id: 'sub_test_activated_101',
              plan: 'claimradar'
            }
          }
        }
      },
      created_at: 1772592010
    });

    /* Recorded sample payload: subscription.halted (Official Razorpay Doc Schema) */
    const sampleSubHalted = JSON.stringify({
      entity: 'event',
      account_id: 'acc_1Aa00000000001',
      event: 'subscription.halted',
      contains: ['subscription'],
      payload: {
        subscription: {
          entity: {
            id: 'sub_test_activated_101',
            entity: 'subscription',
            status: 'halted',
            plan_id: 'plan_claimradar_monthly'
          }
        }
      },
      created_at: 1772600000
    });

    /* Recorded sample payload: subscription.cancelled (Official Razorpay Doc Schema) */
    const sampleSubCancelled = JSON.stringify({
      entity: 'event',
      account_id: 'acc_1Aa00000000001',
      event: 'subscription.cancelled',
      contains: ['subscription'],
      payload: {
        subscription: {
          entity: {
            id: 'sub_test_activated_101',
            entity: 'subscription',
            status: 'cancelled',
            ended_at: 1772650000
          }
        }
      },
      created_at: 1772650005
    });

    /* Recorded sample payload: payment.failed (Official Razorpay Doc Schema) */
    const samplePaymentFailed = JSON.stringify({
      entity: 'event',
      account_id: 'acc_1Aa00000000001',
      event: 'payment.failed',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: 'pay_failed_404',
            entity: 'payment',
            amount: 59900,
            currency: 'INR',
            status: 'failed',
            error_code: 'BAD_REQUEST_ERROR',
            error_description: 'Payment was declined by the bank',
            error_reason: 'insufficient_funds',
            notes: {
              subscription_id: 'sub_test_activated_101',
              plan: 'claimradar'
            }
          }
        }
      },
      created_at: 1772592020
    });

    /* Recorded sample payload: refund.processed (Official Razorpay Doc Schema) */
    const sampleRefundProcessed = JSON.stringify({
      entity: 'event',
      account_id: 'acc_1Aa00000000001',
      event: 'refund.processed',
      contains: ['refund', 'payment'],
      payload: {
        refund: {
          entity: {
            id: 'rfnd_refund_777',
            entity: 'refund',
            amount: 59900,
            currency: 'INR',
            payment_id: 'pay_sub_charged_999',
            status: 'processed',
            created_at: 1772700000
          }
        },
        payment: {
          entity: {
            id: 'pay_sub_charged_999',
            entity: 'payment',
            amount: 59900,
            currency: 'INR',
            status: 'captured',
            amount_refunded: 59900,
            refund_status: 'full'
          }
        }
      },
      created_at: 1772700005
    });

    it('enforces the milestone gate: rejects subscriptions before 20 manual sales', async () => {
      const mock = createMockDb(19); // 19 sales -> below threshold
      const sig = await computeSig(sampleSubActivated);

      const res = await processRazorpayWebhook(sampleSubActivated, sig, secret, mock.adapter, {
        signingKey: privateJwk,
        eventIdHeader: 'evt_gate_001'
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe(403);
      expect(res.milestoneBlocked).toBe(true);
      expect(res.error).toContain('at least 20 manual sales');
      expect(mock.licenses.size).toBe(0);
    });

    it('allows subscription activation when at least 20 manual sales milestone is met', async () => {
      const mock = createMockDb(MIN_MANUAL_SALES_FOR_SUBSCRIPTIONS);
      const sig = await computeSig(sampleSubActivated);

      const res = await processRazorpayWebhook(sampleSubActivated, sig, secret, mock.adapter, {
        signingKey: privateJwk,
        eventIdHeader: 'evt_act_001'
      });

      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
      expect(res.event).toBe('subscription.activated');
      expect(res.licenseStatus).toBe('active');
      expect(res.token).toBeDefined();

      const lic = await mock.adapter.getLicenseBySubscriptionId('sub_test_activated_101');
      expect(lic).toBeDefined();
      expect(lic?.status).toBe('active');
      expect(lic?.plan).toBe('claimradar');

      // Expiry includes paid period (1772592000) + 3 days grace (259200s) = 1772851200
      const expectedExpiryMs = (1772592000 + 3 * 24 * 3600) * 1000;
      expect(new Date(lic!.expires_at).getTime()).toBe(expectedExpiryMs);
      expect(new Date(lic!.renews_at!).getTime()).toBe(1772592000 * 1000);
    });

    it('handles subscription.charged: extends paid period + 3-day grace and records payment', async () => {
      const mock = createMockDb(25);
      const sig = await computeSig(sampleSubCharged);

      const res = await processRazorpayWebhook(sampleSubCharged, sig, secret, mock.adapter, {
        signingKey: privateJwk,
        eventIdHeader: 'evt_charged_001'
      });

      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
      expect(res.event).toBe('subscription.charged');

      const lic = await mock.adapter.getLicenseBySubscriptionId('sub_test_activated_101');
      expect(lic).toBeDefined();
      expect(lic?.status).toBe('active');
      expect(lic?.razorpay_payment_id).toBe('pay_sub_charged_999');

      // Extended cycle end: 1775184000 + 3 days grace
      const expectedExtendedMs = (1775184000 + 3 * 24 * 3600) * 1000;
      expect(new Date(lic!.expires_at).getTime()).toBe(expectedExtendedMs);
      expect(new Date(lic!.renews_at!).getTime()).toBe(1775184000 * 1000);

      // Payment record
      const pmt = mock.payments.get('pay_sub_charged_999');
      expect(pmt).toBeDefined();
      expect(pmt?.status).toBe('captured');
    });

    it('handles subscription.halted: sets license status to halted for retry prompt', async () => {
      const mock = createMockDb(25);
      // Pre-seed active license
      await mock.adapter.upsertLicense({
        subscription_id: 'sub_test_activated_101',
        plan: 'claimradar',
        seats: 1,
        status: 'active',
        expires_at: new Date(Date.now() + 86400000).toISOString()
      });

      const sig = await computeSig(sampleSubHalted);
      const res = await processRazorpayWebhook(sampleSubHalted, sig, secret, mock.adapter, {
        eventIdHeader: 'evt_halt_001'
      });

      expect(res.ok).toBe(true);
      expect(res.licenseStatus).toBe('halted');

      const lic = await mock.adapter.getLicenseBySubscriptionId('sub_test_activated_101');
      expect(lic?.status).toBe('halted');
    });

    it('handles subscription.cancelled: marks license cancelled', async () => {
      const mock = createMockDb(25);
      await mock.adapter.upsertLicense({
        subscription_id: 'sub_test_activated_101',
        plan: 'claimradar',
        seats: 1,
        status: 'active',
        expires_at: new Date(Date.now() + 86400000).toISOString()
      });

      const sig = await computeSig(sampleSubCancelled);
      const res = await processRazorpayWebhook(sampleSubCancelled, sig, secret, mock.adapter, {
        eventIdHeader: 'evt_cancel_001'
      });

      expect(res.ok).toBe(true);
      expect(res.licenseStatus).toBe('cancelled');

      const lic = await mock.adapter.getLicenseBySubscriptionId('sub_test_activated_101');
      expect(lic?.status).toBe('cancelled');
    });

    it('handles payment.failed: records error and flags license as payment_failed', async () => {
      const mock = createMockDb(25);
      await mock.adapter.upsertLicense({
        subscription_id: 'sub_test_activated_101',
        plan: 'claimradar',
        seats: 1,
        status: 'active',
        expires_at: new Date(Date.now() + 86400000).toISOString()
      });

      const sig = await computeSig(samplePaymentFailed);
      const res = await processRazorpayWebhook(samplePaymentFailed, sig, secret, mock.adapter, {
        eventIdHeader: 'evt_fail_001'
      });

      expect(res.ok).toBe(true);
      expect(res.licenseStatus).toBe('payment_failed');

      const lic = await mock.adapter.getLicenseBySubscriptionId('sub_test_activated_101');
      expect(lic?.status).toBe('payment_failed');

      const pmt = mock.payments.get('pay_failed_404');
      expect(pmt?.status).toBe('failed');
      expect(pmt?.error_code).toBe('BAD_REQUEST_ERROR');
    });

    it('handles refund.processed: revokes license row', async () => {
      const mock = createMockDb(25);
      // Pre-seed active license linked to payment pay_sub_charged_999
      await mock.adapter.upsertLicense({
        id: 'lic_refund_target',
        plan: 'claimradar',
        seats: 1,
        status: 'active',
        razorpay_payment_id: 'pay_sub_charged_999',
        expires_at: new Date(Date.now() + 86400000).toISOString()
      });

      const sig = await computeSig(sampleRefundProcessed);
      const res = await processRazorpayWebhook(sampleRefundProcessed, sig, secret, mock.adapter, {
        eventIdHeader: 'evt_rfnd_001'
      });

      expect(res.ok).toBe(true);
      expect(res.revoked).toBe(true);

      const lic = await mock.adapter.getLicenseByPaymentId('pay_sub_charged_999');
      expect(lic?.status).toBe('revoked');
    });

    it('enforces idempotency: ignores duplicate event deliveries without mutating state', async () => {
      const mock = createMockDb(25);
      const sig = await computeSig(sampleSubActivated);
      const eventId = 'evt_idempotent_unique_999';

      // First delivery
      const res1 = await processRazorpayWebhook(sampleSubActivated, sig, secret, mock.adapter, {
        signingKey: privateJwk,
        eventIdHeader: eventId
      });
      expect(res1.ok).toBe(true);
      expect(res1.deduped).toBeUndefined();

      // Duplicate delivery (e.g. Razorpay network retry)
      const res2 = await processRazorpayWebhook(sampleSubActivated, sig, secret, mock.adapter, {
        signingKey: privateJwk,
        eventIdHeader: eventId
      });
      expect(res2.ok).toBe(true);
      expect(res2.status).toBe(200);
      expect(res2.deduped).toBe(true);
    });
  });
});

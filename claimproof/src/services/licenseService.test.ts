import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/schema';
import {
  deactivateLicense,
  getDeviceFingerprint,
  getLicenseState,
  planHasFeature,
  verifyAndActivateToken
} from './licenseService';
import devKeys from '../../scripts/.license-dev-keys.json';
import { PLANS } from '../config/plans';

function b64url(input: string | Uint8Array): string {
  let bin = '';
  if (typeof input === 'string') {
    bin = input;
  } else {
    for (const b of input) bin += String.fromCharCode(b);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function mintToken(
  payloadOverrides: Record<string, unknown> = {},
  headerOverrides: Record<string, unknown> = {}
): Promise<string> {
  const header = {
    alg: 'ES256',
    typ: 'JWT',
    kid: 'cp-dev-1',
    ...headerOverrides
  };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'https://claimproof.in',
    sub: 'cust_retail_001',
    cid: 'cust_retail_001',
    plan: 'claimradar',
    seats: 1,
    iat: now,
    exp: now + 365 * 24 * 3600,
    jti: 'test_jwt_jti',
    ...payloadOverrides
  };

  const hB64 = b64url(JSON.stringify(header));
  const pB64 = b64url(JSON.stringify(payload));
  const signingInput = `${hB64}.${pB64}`;

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    devKeys.priv,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${b64url(new Uint8Array(sig))}`;
}

describe('License Service — Offline ES256 Token Verification & Soft Device Binding', () => {
  beforeEach(async () => {
    await db.license_state.delete('active');
  });

  describe('Single Source of Truth: src/config/plans.ts', () => {
    it('defines starter, claimradar, and warehouse plans with INR pricing', () => {
      expect(PLANS).toHaveLength(3);
      const [starter, claimradar, warehouse] = PLANS;

      expect(starter.id).toBe('starter');
      expect(starter.monthlyPrice).toBe(349);
      expect(starter.annualPrice).toBe(2499);

      expect(claimradar.id).toBe('claimradar');
      expect(claimradar.monthlyPrice).toBe(599);
      expect(claimradar.annualPrice).toBe(4499);
      expect(claimradar.best).toBe(true);

      expect(warehouse.id).toBe('warehouse');
      expect(warehouse.monthlyPrice).toBe(1199);
      expect(warehouse.annualPrice).toBe(8999);
      expect(warehouse.seats).toBe(3);
    });
  });

  describe('Valid token verification', () => {
    it('verifies and activates a valid signed token completely offline', async () => {
      const token = await mintToken({ plan: 'claimradar', cid: 'cust_super_seller' });
      const res = await verifyAndActivateToken(token);

      expect(res.ok).toBe(true);
      expect(res.error).toBeUndefined();

      const state = await getLicenseState();
      expect(state.plan).toBe('claimradar');
      expect(state.customerId).toBe('cust_super_seller');
      expect(state.token).toBe(token);
      expect(state.expiresAt).toBeGreaterThan(Date.now());

      const currentFp = await getDeviceFingerprint();
      expect(state.boundDevices).toContain(currentFp);

      expect(planHasFeature(state.plan, 'unlimitedLabels')).toBe(true);
      expect(planHasFeature(state.plan, 'collage')).toBe(true);
      expect(planHasFeature(state.plan, 'claimRadar')).toBe(true);
    });

    it('activates starter plan and enforces feature boundary correctly', async () => {
      const token = await mintToken({ plan: 'starter', cid: 'cust_starter_user' });
      const res = await verifyAndActivateToken(token);

      expect(res.ok).toBe(true);
      const state = await getLicenseState();
      expect(state.plan).toBe('starter');
      expect(planHasFeature(state.plan, 'unlimitedLabels')).toBe(true);
      expect(planHasFeature(state.plan, 'collage')).toBe(false);
      expect(planHasFeature(state.plan, 'claimRadar')).toBe(false);
    });
  });

  describe('Expired token verification', () => {
    it('rejects an expired license token', async () => {
      const pastSec = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const token = await mintToken({ exp: pastSec });

      const res = await verifyAndActivateToken(token);
      expect(res.ok).toBe(false);
      expect(res.code).toBe('EXPIRED');
      expect(res.error).toBe('Expired license token');

      const state = await getLicenseState();
      expect(state.plan).toBe('free');
    });
  });

  describe('Tampered token verification', () => {
    it('rejects a token when the payload has been modified', async () => {
      const token = await mintToken({ plan: 'starter' });
      const [h, p, s] = token.split('.');

      // Attacker attempts to change plan to warehouse without private key
      const payload = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
      payload.plan = 'warehouse';
      const tamperedP = b64url(JSON.stringify(payload));
      const tamperedToken = `${h}.${tamperedP}.${s}`;

      const res = await verifyAndActivateToken(tamperedToken);
      expect(res.ok).toBe(false);
      expect(res.code).toBe('INVALID_SIGNATURE');
      expect(res.error).toBe('Invalid signature');
    });

    it('rejects a token with a corrupted signature', async () => {
      const token = await mintToken();
      const [h, p, s] = token.split('.');
      const corruptedSig = s.slice(0, -4) + 'AAAA';
      const corruptedToken = `${h}.${p}.${corruptedSig}`;

      const res = await verifyAndActivateToken(corruptedToken);
      expect(res.ok).toBe(false);
      expect(res.code).toBe('INVALID_SIGNATURE');
    });
  });

  describe('Wrong issuer verification', () => {
    it('rejects a token signed with an invalid or untrusted issuer', async () => {
      const token = await mintToken({ iss: 'https://pirate-keys.org' });
      const res = await verifyAndActivateToken(token);

      expect(res.ok).toBe(false);
      expect(res.code).toBe('WRONG_ISSUER');
      expect(res.error).toBe('Invalid license token: wrong issuer');
    });
  });

  describe('Wrong plan verification', () => {
    it('rejects a token containing an unrecognized plan', async () => {
      const token = await mintToken({ plan: 'enterprise_custom' });
      const res = await verifyAndActivateToken(token);

      expect(res.ok).toBe(false);
      expect(res.code).toBe('WRONG_PLAN');
      expect(res.error).toBe('Invalid license token: unknown plan');
    });
  });

  describe('Missing customer id verification', () => {
    it('rejects a token missing both cid and sub', async () => {
      const token = await mintToken({ cid: '', sub: '' });
      const res = await verifyAndActivateToken(token);

      expect(res.ok).toBe(false);
      expect(res.code).toBe('MISSING_CUSTOMER_ID');
      expect(res.error).toBe('Invalid license token: missing customer id');
    });
  });

  describe('Soft Device Binding', () => {
    it('soft-fails with canMove when token is bound to another workstation', async () => {
      const token = await mintToken({ fp: 'workstation_gpu_other_machine' });
      const res = await verifyAndActivateToken(token);

      expect(res.ok).toBe(false);
      expect(res.code).toBe('DEVICE_MISMATCH');
      expect(res.canMove).toBe(true);
      expect(res.error).toContain('bound to a different workstation');
    });

    it('allows moving the license to the current workstation with moveDevice option', async () => {
      const token = await mintToken({ fp: 'workstation_gpu_other_machine' });

      // First attempt without moveDevice fails with canMove: true
      const firstTry = await verifyAndActivateToken(token);
      expect(firstTry.ok).toBe(false);
      expect(firstTry.canMove).toBe(true);

      // User selects "Move license to this device"
      const moveRes = await verifyAndActivateToken(token, { moveDevice: true });
      expect(moveRes.ok).toBe(true);

      const state = await getLicenseState();
      expect(state.plan).toBe('claimradar');
      const currentFp = await getDeviceFingerprint();
      expect(state.deviceFingerprint).toBe(currentFp);
      expect(state.boundDevices).toContain(currentFp);
    });

    it('allows up to 2 devices per license and offers move option on 3rd device', async () => {
      const token = await mintToken({ cid: 'cust_two_devices' });

      // Simulate license state already bound to 2 other workstations
      await db.license_state.put({
        key: 'active',
        value: {
          plan: 'claimradar',
          seats: 1,
          customerId: 'cust_two_devices',
          deviceFingerprint: 'device_alpha',
          boundDevices: ['device_alpha', 'device_beta'],
          token
        }
      });

      // 3rd device attempts activation without moveDevice
      const thirdDeviceAttempt = await verifyAndActivateToken(token);
      expect(thirdDeviceAttempt.ok).toBe(false);
      expect(thirdDeviceAttempt.code).toBe('DEVICE_MISMATCH');
      expect(thirdDeviceAttempt.canMove).toBe(true);
      expect(thirdDeviceAttempt.error).toContain('max 2 devices');

      // User chooses "Move license to this device"
      const movedAttempt = await verifyAndActivateToken(token, { moveDevice: true });
      expect(movedAttempt.ok).toBe(true);

      const state = await getLicenseState();
      const currentFp = await getDeviceFingerprint();
      expect(state.boundDevices).toContain(currentFp);
      expect(state.boundDevices).toHaveLength(2);
      expect(state.boundDevices).toContain('device_beta'); // oldest device 'device_alpha' shifted out
    });
  });

  describe('Subscription Lifecycle States (renews on, payment failed, expired features limited)', () => {
    it('activates token with subscription renewsAt and active status', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const renewsAtSec = nowSec + 30 * 24 * 3600;
      const graceExpiresAtSec = renewsAtSec + 3 * 24 * 3600;

      const token = await mintToken({
        subscriptionId: 'sub_test_sub_active',
        subscriptionStatus: 'active',
        renewsAt: renewsAtSec,
        exp: graceExpiresAtSec
      });

      const res = await verifyAndActivateToken(token);
      expect(res.ok).toBe(true);

      const state = await getLicenseState();
      expect(state.subscriptionId).toBe('sub_test_sub_active');
      expect(state.subscriptionStatus).toBe('active');
      expect(state.renewsAt).toBe(renewsAtSec * 1000);
      expect(state.expiresAt).toBe(graceExpiresAtSec * 1000);
      expect(planHasFeature(state.plan, 'claimRadar')).toBe(true);
    });

    it('handles payment_failed / halted subscription state', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const token = await mintToken({
        subscriptionId: 'sub_test_sub_failed',
        subscriptionStatus: 'payment_failed',
        exp: nowSec + 2 * 24 * 3600 // still within 3-day grace period
      });

      const res = await verifyAndActivateToken(token);
      expect(res.ok).toBe(true);

      const state = await getLicenseState();
      expect(state.subscriptionStatus).toBe('payment_failed');
    });

    it('limits features when license expires after 3-day grace period', async () => {
      const pastSec = Math.floor(Date.now() / 1000) - 100;

      // Seed expired license directly into Dexie DB
      await db.license_state.put({
        key: 'active',
        value: {
          plan: 'claimradar',
          seats: 1,
          subscriptionStatus: 'expired',
          expiresAt: pastSec * 1000,
          deviceFingerprint: 'fp_test'
        }
      });

      const state = await getLicenseState();
      expect(state.subscriptionStatus).toBe('expired');

      // Pro features are limited when expired
      expect(planHasFeature(state.plan, 'claimRadar')).toBe(false);
      expect(planHasFeature(state.plan, 'unlimitedLabels')).toBe(false);
      expect(planHasFeature(state.plan, 'collage')).toBe(false);
    });

    it('limits features when license has been revoked due to refund', async () => {
      await db.license_state.put({
        key: 'active',
        value: {
          plan: 'claimradar',
          seats: 1,
          subscriptionStatus: 'revoked',
          expiresAt: Date.now() + 86400000,
          deviceFingerprint: 'fp_test'
        }
      });

      const state = await getLicenseState();
      expect(state.subscriptionStatus).toBe('revoked');
      expect(planHasFeature(state.plan, 'claimRadar')).toBe(false);
    });
  });

  describe('Deactivation', () => {
    it('clears active license and restores fallback state', async () => {
      const token = await mintToken();
      await verifyAndActivateToken(token);

      const activeState = await getLicenseState();
      expect(activeState.plan).toBe('claimradar');

      await deactivateLicense();
      const resetState = await getLicenseState();
      expect(resetState.plan).toBe('free');
    });
  });
});

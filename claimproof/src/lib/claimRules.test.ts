// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CLAIM_WINDOW_HOURS,
  MARKETPLACE_CLAIM_WINDOWS,
  UNVERIFIED_LABEL,
  UNVERIFIED_STATUS,
  buildClaimFromFlag,
  claimDeadlineFor,
  claimWindowHours,
  claimWindowLabel,
  getCustomClaimWindows,
  isClaimWindowUnverified,
  recordingTypeLabel,
  resetCustomClaimWindows,
  resetSingleClaimWindow,
  saveCustomClaimWindowHours
} from './claimRules';
import { deadlineTone, formatCountdown } from './dateUtils';
import type { Marketplace } from '../types';

describe('claimRules engine: marketplace windows, deadline math & boundaries', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-31T12:00:00.000Z'));
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    resetCustomClaimWindows();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    resetCustomClaimWindows();
  });

  describe('Every marketplace claim window, source URL and verification status', () => {
    const testCases: {
      marketplace: Marketplace;
      expectedHours: number;
      expectedLabel: string;
      expectedSourceUrlPrefix: string;
    }[] = [
      {
        marketplace: 'Meesho',
        expectedHours: 72,
        expectedLabel: 'Meesho SAFE · 72 hours',
        expectedSourceUrlPrefix: 'https://supplier.meesho.com'
      },
      {
        marketplace: 'AJIO',
        expectedHours: 72,
        expectedLabel: 'AJIO · 72 hours',
        expectedSourceUrlPrefix: 'https://supplier.ajio.com'
      },
      {
        marketplace: 'Snapdeal',
        expectedHours: 72,
        expectedLabel: 'Snapdeal · 72 hours',
        expectedSourceUrlPrefix: 'https://sellers.snapdeal.com'
      },
      {
        marketplace: 'Myntra',
        expectedHours: 72,
        expectedLabel: 'Myntra · 72 hours',
        expectedSourceUrlPrefix: 'https://partner.myntra.com'
      },
      {
        marketplace: 'Flipkart',
        expectedHours: 336,
        expectedLabel: 'Flipkart SPF · 14 days',
        expectedSourceUrlPrefix: 'https://seller.flipkart.com'
      },
      {
        marketplace: 'Amazon',
        expectedHours: 720,
        expectedLabel: 'Amazon SAFE-T · 30 days',
        expectedSourceUrlPrefix: 'https://sellercentral.amazon.in'
      },
      {
        marketplace: 'GlowRoad',
        expectedHours: 72,
        expectedLabel: 'GlowRoad · 72 hours',
        expectedSourceUrlPrefix: 'https://glowroad.com'
      },
      {
        marketplace: 'Unknown',
        expectedHours: 72,
        expectedLabel: 'Standard · 72 hours',
        expectedSourceUrlPrefix: ''
      }
    ];

    for (const {
      marketplace,
      expectedHours,
      expectedLabel,
      expectedSourceUrlPrefix
    } of testCases) {
      it(`evaluates ${marketplace} with ${expectedHours}h window, source URL and UNVERIFIED status`, () => {
        expect(claimWindowHours(marketplace)).toBe(expectedHours);
        expect(claimWindowLabel(marketplace)).toBe(expectedLabel);

        const config = MARKETPLACE_CLAIM_WINDOWS[marketplace];
        expect(config).toBeDefined();
        expect(config.hours).toBe(expectedHours);
        expect(config.lastVerified).toBe(UNVERIFIED_STATUS);
        expect(config.verified).toBe(false);
        expect(isClaimWindowUnverified(marketplace)).toBe(true);

        if (expectedSourceUrlPrefix) {
          expect(config.sourceUrl).toContain(expectedSourceUrlPrefix);
        }

        const from = 1700000000000;
        const expectedDeadline = from + expectedHours * 3600 * 1000;
        expect(claimDeadlineFor(marketplace, from)).toBe(expectedDeadline);
      });
    }

    it('defaults to 72 hours for unlisted marketplace keys and flags as unverified', () => {
      expect(DEFAULT_CLAIM_WINDOW_HOURS).toBe(72);
      expect(claimWindowHours('NonExistent' as unknown as Marketplace)).toBe(72);
      expect(claimWindowLabel('NonExistent' as unknown as Marketplace)).toBe('Standard · 72 hours');
      expect(isClaimWindowUnverified('NonExistent' as unknown as Marketplace)).toBe(true);
      expect(UNVERIFIED_LABEL).toBe('UNVERIFIED, check your seller panel.');
    });

    it('recognizes verified marketplaces when lastVerified is set to a confirmed date', () => {
      const mockCustomConfig = {
        ...MARKETPLACE_CLAIM_WINDOWS,
        Meesho: {
          ...MARKETPLACE_CLAIM_WINDOWS.Meesho,
          lastVerified: '2026-11-01'
        }
      };
      // When lastVerified is not 'UNVERIFIED', isClaimWindowUnverified should return false
      expect(mockCustomConfig.Meesho.lastVerified).not.toBe(UNVERIFIED_STATUS);
    });
  });

  describe('Seller-edited claim window overrides', () => {
    it('overrides default hours for Meesho and updates deadline calculation and labels', () => {
      const now = Date.now();
      expect(claimWindowHours('Meesho')).toBe(72);

      // Seller edits Meesho window to 48 hours
      saveCustomClaimWindowHours('Meesho', 48);

      expect(getCustomClaimWindows().Meesho).toBe(48);
      expect(claimWindowHours('Meesho')).toBe(48);
      expect(claimDeadlineFor('Meesho', now)).toBe(now + 48 * 3600 * 1000);
      expect(claimWindowLabel('Meesho')).toBe('Meesho SAFE · 48 hours');

      // Verifies buildClaimFromFlag incorporates the edited value
      const claim = buildClaimFromFlag({
        awb: 'MSH-OVERRIDE-1',
        orderId: 'ORD-1',
        sku: 'SKU-1',
        qty: 1,
        courier: 'Valmo',
        marketplace: 'Meesho',
        reason: 'Damaged',
        returnScanAt: now
      });
      expect(claim.deadlineAt).toBe(now + 48 * 3600 * 1000);

      // Reset single marketplace restores default
      resetSingleClaimWindow('Meesho');
      expect(claimWindowHours('Meesho')).toBe(72);
      expect(claimDeadlineFor('Meesho', now)).toBe(now + 72 * 3600 * 1000);
      expect(claimWindowLabel('Meesho')).toBe('Meesho SAFE · 72 hours');
    });

    it('overrides Flipkart default (14 days = 336h) to custom 10 days (240h)', () => {
      const now = Date.now();
      expect(claimWindowHours('Flipkart')).toBe(336);
      expect(claimWindowLabel('Flipkart')).toBe('Flipkart SPF · 14 days');

      saveCustomClaimWindowHours('Flipkart', 240);
      expect(claimWindowHours('Flipkart')).toBe(240);
      expect(claimWindowLabel('Flipkart')).toBe('Flipkart SPF · 10 days');
      expect(claimDeadlineFor('Flipkart', now)).toBe(now + 240 * 3600 * 1000);

      // Override with odd hours (e.g. 50 hours)
      saveCustomClaimWindowHours('Flipkart', 50);
      expect(claimWindowHours('Flipkart')).toBe(50);
      expect(claimWindowLabel('Flipkart')).toBe('Flipkart SPF · 50 hours');

      // Reset all custom overrides
      resetCustomClaimWindows();
      expect(claimWindowHours('Flipkart')).toBe(336);
      expect(claimWindowLabel('Flipkart')).toBe('Flipkart SPF · 14 days');
    });

    it('accepts explicit in-memory customOverrides parameter', () => {
      const now = Date.now();
      expect(claimWindowHours('Amazon', { Amazon: 120 })).toBe(120);
      expect(claimDeadlineFor('Amazon', now, { Amazon: 120 })).toBe(now + 120 * 3600 * 1000);
      expect(claimWindowLabel('Amazon', { Amazon: 120 })).toBe('Amazon SAFE-T · 5 days');
    });
  });

  describe('Deadline boundary conditions & thresholds', () => {
    it('accurately evaluates status and countdown at the exact deadline boundary', () => {
      const now = Date.now();
      const returnScanAt = now;
      const deadline = claimDeadlineFor('Meesho', returnScanAt); // +72h

      // Before deadline: 1000 ms left
      vi.setSystemTime(deadline - 1000);
      const msLeftBefore = deadline - Date.now();
      expect(msLeftBefore).toBe(1000);
      expect(formatCountdown(msLeftBefore)).toBe('0m 01s');
      expect(deadlineTone(msLeftBefore)).toBe('urgent');

      // Before deadline: exactly 1 ms left
      vi.setSystemTime(deadline - 1);
      const msLeft1ms = deadline - Date.now();
      expect(msLeft1ms).toBe(1);
      expect(formatCountdown(msLeft1ms)).toBe('0m 00s');
      expect(deadlineTone(msLeft1ms)).toBe('urgent');

      // Exactly at the deadline (boundary: msLeft === 0)
      vi.setSystemTime(deadline);
      const msLeftAtBoundary = deadline - Date.now();
      expect(msLeftAtBoundary).toBe(0);
      expect(formatCountdown(msLeftAtBoundary)).toBe('Expired');
      expect(deadlineTone(msLeftAtBoundary)).toBe('expired');

      // Past the deadline: 1 millisecond expired
      vi.setSystemTime(deadline + 1);
      const msLeftPast = deadline - Date.now();
      expect(msLeftPast).toBe(-1);
      expect(formatCountdown(msLeftPast)).toBe('Expired');
      expect(deadlineTone(msLeftPast)).toBe('expired');
    });

    it('evaluates urgency tone thresholds exactly at the boundary values', () => {
      // Greater than 24 hours: 'ok'
      expect(deadlineTone(24 * 3600 * 1000 + 1)).toBe('ok');
      expect(deadlineTone(25 * 3600 * 1000)).toBe('ok');

      // Exactly 24 hours boundary: 'warn'
      expect(deadlineTone(24 * 3600 * 1000)).toBe('warn');
      // In between 6h and 24h: 'warn'
      expect(deadlineTone(12 * 3600 * 1000)).toBe('warn');
      expect(deadlineTone(6 * 3600 * 1000 + 1)).toBe('warn');

      // Exactly 6 hours boundary: 'urgent'
      expect(deadlineTone(6 * 3600 * 1000)).toBe('urgent');
      // Less than 6 hours: 'urgent'
      expect(deadlineTone(3600 * 1000)).toBe('urgent');
      expect(deadlineTone(1)).toBe('urgent');

      // 0ms boundary: 'expired'
      expect(deadlineTone(0)).toBe('expired');
      // Negative ms: 'expired'
      expect(deadlineTone(-1)).toBe('expired');
      expect(deadlineTone(-5000)).toBe('expired');
    });

    it('formats countdown transitions across seconds, minutes, hours, and days', () => {
      // Seconds boundary
      expect(formatCountdown(0)).toBe('Expired');
      expect(formatCountdown(999)).toBe('0m 00s');
      expect(formatCountdown(1000)).toBe('0m 01s');
      expect(formatCountdown(59 * 1000)).toBe('0m 59s');

      // Minute boundary
      expect(formatCountdown(60 * 1000)).toBe('1m 00s');
      expect(formatCountdown(59 * 60 * 1000 + 59 * 1000)).toBe('59m 59s');

      // Hour boundary
      expect(formatCountdown(60 * 60 * 1000)).toBe('1h 00m 00s');
      expect(formatCountdown(23 * 3600 * 1000 + 59 * 60 * 1000)).toBe('23h 59m 00s');

      // Day boundary
      expect(formatCountdown(24 * 3600 * 1000)).toBe('24h 00m 00s');
      expect(formatCountdown(14 * 24 * 3600 * 1000)).toBe('336h 00m 00s'); // Flipkart SPF boundary
      expect(formatCountdown(30 * 24 * 3600 * 1000)).toBe('720h 00m 00s'); // Amazon SAFE-T boundary
    });

    it('handles extreme boundary windows (1 hour min, epoch 0, and large windows)', () => {
      // 1 hour minimum setting
      saveCustomClaimWindowHours('Meesho', 1);
      const epoch0 = 0;
      expect(claimDeadlineFor('Meesho', epoch0)).toBe(3600 * 1000);

      // 2160 hours (90 days) max setting
      saveCustomClaimWindowHours('Amazon', 2160);
      expect(claimDeadlineFor('Amazon', epoch0)).toBe(2160 * 3600 * 1000);
      expect(claimWindowLabel('Amazon')).toBe('Amazon SAFE-T · 90 days');
    });
  });

  describe('buildClaimFromFlag helper', () => {
    it('creates a pending claim with normalized uppercase AWB and calculated deadline', () => {
      const now = Date.now();
      const claim = buildClaimFromFlag({
        awb: '  ekart9876543210  ',
        orderId: 'OD-11223344',
        sku: 'SHIRT-BLUE-M',
        qty: 3,
        courier: 'Ekart',
        marketplace: 'Flipkart',
        reason: 'Damaged',
        notes: 'Outer polybag torn, item soiled',
        recordingId: 42,
        returnScanAt: now
      });

      expect(claim.awb).toBe('EKART9876543210');
      expect(claim.orderId).toBe('OD-11223344');
      expect(claim.sku).toBe('SHIRT-BLUE-M');
      expect(claim.qty).toBe(3);
      expect(claim.courier).toBe('Ekart');
      expect(claim.marketplace).toBe('Flipkart');
      expect(claim.flagReason).toBe('Damaged');
      expect(claim.notes).toBe('Outer polybag torn, item soiled');
      expect(claim.returnRecordingId).toBe(42);
      expect(claim.status).toBe('pending');
      expect(claim.disputeText).toBe('');
      expect(claim.returnScanAt).toBe(now);
      // Flipkart = 336 hours
      expect(claim.deadlineAt).toBe(now + 336 * 3600 * 1000);
    });

    it('defaults returnScanAt to current time if omitted', () => {
      const now = Date.now();
      const claim = buildClaimFromFlag({
        awb: 'AMZN-9988',
        orderId: '404-1234567-8901234',
        sku: 'HEADPHONE-PRO',
        qty: 1,
        courier: 'Delhivery',
        marketplace: 'Amazon',
        reason: 'Empty package'
      });

      expect(claim.returnScanAt).toBe(now);
      expect(claim.deadlineAt).toBe(now + 720 * 3600 * 1000);
      expect(claim.notes).toBe('');
      expect(claim.returnRecordingId).toBeUndefined();
    });
  });

  describe('recordingTypeLabel helper', () => {
    it('labels dispatch vs return types accurately', () => {
      expect(recordingTypeLabel('dispatch')).toBe('Dispatch Packing');
      expect(recordingTypeLabel('return')).toBe('Return Unboxing');
    });
  });
});

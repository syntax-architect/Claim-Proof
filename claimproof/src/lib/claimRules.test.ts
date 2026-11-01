import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CLAIM_WINDOW_HOURS,
  buildClaimFromFlag,
  claimDeadlineFor,
  claimWindowHours,
  claimWindowLabel,
  recordingTypeLabel
} from './claimRules';
import { deadlineTone, formatCountdown } from './dateUtils';
import type { Marketplace } from '../types';

describe('claimRules engine: marketplace windows, deadline math & boundaries', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-31T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Every marketplace claim window and label', () => {
    const testCases: {
      marketplace: Marketplace;
      expectedHours: number;
      expectedLabel: string;
    }[] = [
      { marketplace: 'Meesho', expectedHours: 72, expectedLabel: 'Meesho SAFE · 72 hours' },
      { marketplace: 'AJIO', expectedHours: 72, expectedLabel: 'AJIO · 72 hours' },
      { marketplace: 'Snapdeal', expectedHours: 72, expectedLabel: 'Snapdeal · 72 hours' },
      { marketplace: 'Myntra', expectedHours: 72, expectedLabel: 'Myntra · 72 hours' },
      { marketplace: 'Flipkart', expectedHours: 336, expectedLabel: 'Flipkart SPF · 14 days' },
      { marketplace: 'Amazon', expectedHours: 720, expectedLabel: 'Amazon SAFE-T · 30 days' },
      { marketplace: 'Unknown', expectedHours: 72, expectedLabel: 'Standard · 72 hours' }
    ];

    for (const { marketplace, expectedHours, expectedLabel } of testCases) {
      it(`evaluates ${marketplace} with ${expectedHours}h window and correct label`, () => {
        expect(claimWindowHours(marketplace)).toBe(expectedHours);
        expect(claimWindowLabel(marketplace)).toBe(expectedLabel);

        const from = 1700000000000;
        const expectedDeadline = from + expectedHours * 3600 * 1000;
        expect(claimDeadlineFor(marketplace, from)).toBe(expectedDeadline);
      });
    }

    it('defaults to 72 hours for unlisted marketplace keys', () => {
      expect(DEFAULT_CLAIM_WINDOW_HOURS).toBe(72);
      expect(claimWindowHours('NonExistent' as unknown as Marketplace)).toBe(72);
      expect(claimWindowLabel('NonExistent' as unknown as Marketplace)).toBe('Standard · 72 hours');
    });
  });

  describe('Deadline boundary conditions', () => {
    it('accurately evaluates status and countdown at the exact deadline boundary', () => {
      const now = Date.now();
      const returnScanAt = now;
      const deadline = claimDeadlineFor('Meesho', returnScanAt); // +72h

      // Before deadline: 1 second left
      vi.setSystemTime(deadline - 1000);
      const msLeftBefore = deadline - Date.now();
      expect(msLeftBefore).toBe(1000);
      expect(formatCountdown(msLeftBefore)).toBe('0m 01s');
      expect(deadlineTone(msLeftBefore)).toBe('urgent');

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

    it('evaluates tone thresholds (urgent <= 8h, warn <= 24h, ok > 24h)', () => {
      // > 24 hours
      expect(deadlineTone(25 * 3600 * 1000)).toBe('ok');
      // Exactly 24 hours
      expect(deadlineTone(24 * 3600 * 1000)).toBe('warn');
      // 12 hours
      expect(deadlineTone(12 * 3600 * 1000)).toBe('warn');
      // Exactly 8 hours
      expect(deadlineTone(8 * 3600 * 1000)).toBe('urgent');
      // 1 hour
      expect(deadlineTone(3600 * 1000)).toBe('urgent');
      // 0ms
      expect(deadlineTone(0)).toBe('expired');
      // Negative
      expect(deadlineTone(-5000)).toBe('expired');
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

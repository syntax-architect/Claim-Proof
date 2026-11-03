import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MARKETPLACE_CLAIM_WINDOWS,
  UNVERIFIED_LABEL,
  UNVERIFIED_STATUS,
  getClaimWindowHours,
  getCustomClaimWindows,
  isClaimWindowUnverified,
  resetCustomClaimWindows,
  saveCustomClaimWindowHours
} from '../config/claimWindows';
import { claimDeadlineFor, claimWindowHours, claimWindowLabel } from '../lib/claimRules';
import {
  deadlineTone,
  formatCountdown,
  formatIST,
  formatISTForInput,
  formatISTShort,
  parseISTDateTime
} from '../lib/dateUtils';
import { generateClaimIcs } from '../lib/calendarExport';
import {
  checkAndSendClaimNotifications,
  isClaimNotificationsEnabled,
  setClaimNotificationsEnabled
} from '../lib/claimNotifications';
import { db } from '../db/schema';
import { recalculateClaimsForMarketplace } from '../services/claimEngine';
import type { ClaimItem, Marketplace } from '../types';

describe('ClaimRadar Windows, Urgency Boundaries, IST Math & Edge Cases', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-31T12:00:00.000Z'));
    localStorage.clear();
    resetCustomClaimWindows();
    await db.claims.clear();
  });

  afterEach(async () => {
    vi.useRealTimers();
    localStorage.clear();
    resetCustomClaimWindows();
    await db.claims.clear();
  });

  describe('Acceptance Criterion 1: claimWindows.ts structure & unverified status', () => {
    const marketplaces: Marketplace[] = [
      'Meesho',
      'Flipkart',
      'Amazon',
      'AJIO',
      'Snapdeal',
      'Myntra',
      'GlowRoad'
    ];

    it('defines hours, sourceUrl, lastVerified, and verified flag for every marketplace', () => {
      for (const m of marketplaces) {
        const config = MARKETPLACE_CLAIM_WINDOWS[m];
        expect(config).toBeDefined();
        expect(typeof config.hours).toBe('number');
        expect(config.hours).toBeGreaterThan(0);
        expect(typeof config.defaultHours).toBe('number');
        expect(typeof config.sourceUrl).toBe('string');
        expect(config.sourceUrl.length).toBeGreaterThan(0);
        expect(config.lastVerified).toBe(UNVERIFIED_STATUS);
        expect(config.verified).toBe(false);
        expect(isClaimWindowUnverified(m)).toBe(true);
      }
    });

    it('shows exact UNVERIFIED label badge: "UNVERIFIED, check your seller panel."', () => {
      expect(UNVERIFIED_LABEL).toBe('UNVERIFIED, check your seller panel.');
    });
  });

  describe('Acceptance Criterion 2: Editable claim windows', () => {
    it('allows seller to edit any window and persists the custom override', () => {
      expect(getClaimWindowHours('Meesho')).toBe(72);

      // Edit Meesho to 48 hours
      saveCustomClaimWindowHours('Meesho', 48);

      expect(getCustomClaimWindows().Meesho).toBe(48);
      expect(getClaimWindowHours('Meesho')).toBe(48);
      expect(claimWindowHours('Meesho')).toBe(48);
      expect(claimWindowLabel('Meesho')).toContain('48 hours');
    });
  });

  describe('Acceptance Criterion 3 & Tests: Urgency boundary calculations', () => {
    it('evaluates exactly at the deadline (0ms left)', () => {
      expect(formatCountdown(0)).toBe('Expired');
      expect(deadlineTone(0)).toBe('expired');
    });

    it('evaluates exactly one minute before the deadline (60,000ms left)', () => {
      const oneMinuteMs = 60 * 1000;
      expect(formatCountdown(oneMinuteMs)).toBe('1m 00s');
      // Under 6 hours threshold => critical / urgent
      expect(deadlineTone(oneMinuteMs)).toBe('urgent');
    });

    it('evaluates exactly one minute after the deadline (-60,000ms left)', () => {
      const pastOneMinuteMs = -60 * 1000;
      expect(formatCountdown(pastOneMinuteMs)).toBe('Expired');
      expect(deadlineTone(pastOneMinuteMs)).toBe('expired');
    });

    it('evaluates 24 hours boundary (warning transition)', () => {
      const exact24h = 24 * 3_600_000;
      expect(deadlineTone(exact24h)).toBe('warn');

      const oneMsBeyond24h = exact24h + 1;
      expect(deadlineTone(oneMsBeyond24h)).toBe('ok');
    });

    it('evaluates 6 hours boundary (critical transition)', () => {
      const exact6h = 6 * 3_600_000;
      expect(deadlineTone(exact6h)).toBe('urgent');

      const oneMsBeyond6h = exact6h + 1;
      expect(deadlineTone(oneMsBeyond6h)).toBe('warn');
    });
  });

  describe('Acceptance Criterion 5 & Tests: DST-free IST calculations', () => {
    it('verifies IST offset is strictly UTC+05:30 with zero Daylight Saving Time in winter (January)', () => {
      // 2026-01-15 12:00:00 UTC
      const winterUtc = new Date('2026-01-15T12:00:00.000Z').getTime();
      const winterIST = formatIST(winterUtc);

      // In IST (UTC+05:30), 12:00 UTC is 17:30 (5:30 PM)
      expect(winterIST).toContain('15-Jan-2026 05:30:00 PM IST');
      expect(winterIST).toContain('IST');

      // Test short format
      expect(formatISTShort(winterUtc)).toContain('15 Jan');
      expect(formatISTShort(winterUtc)).toMatch(/5:30\s*pm/i);
    });

    it('verifies IST offset is strictly UTC+05:30 with zero Daylight Saving Time in summer (July)', () => {
      // 2026-07-15 12:00:00 UTC
      const summerUtc = new Date('2026-07-15T12:00:00.000Z').getTime();
      const summerIST = formatIST(summerUtc);

      // In IST (UTC+05:30), 12:00 UTC is 17:30 (5:30 PM) with no DST shift
      expect(summerIST).toContain('15-Jul-2026 05:30:00 PM IST');
      expect(summerIST).toContain('IST');

      expect(formatISTShort(summerUtc)).toContain('15 Jul');
      expect(formatISTShort(summerUtc)).toMatch(/5:30\s*pm/i);
    });

    it('parses user-entered datetime in IST and round-trips with formatISTForInput', () => {
      const inputStr = '2026-11-03T16:45';
      const parsedMs = parseISTDateTime(inputStr);
      const formattedBack = formatISTForInput(parsedMs);
      expect(formattedBack).toBe(inputStr);

      const istFormatted = formatIST(parsedMs);
      expect(istFormatted).toContain('03-Nov-2026 04:45:00 PM IST');
    });
  });

  describe('Edge Cases', () => {
    it('handles return delivery dates entered in the past', () => {
      const now = Date.now();
      // Return delivered 5 days ago (120 hours ago)
      const pastDeliveryDate = now - 120 * 3_600_000;

      // Meesho window is 72 hours
      const deadline = claimDeadlineFor('Meesho', pastDeliveryDate);
      const msLeft = deadline - now;

      // Deadline was 48 hours ago
      expect(msLeft).toBeLessThan(0);
      expect(formatCountdown(msLeft)).toBe('Expired');
      expect(deadlineTone(msLeft)).toBe('expired');
    });

    it('handles changed windows after claim creation: recalculates with an explanatory note', async () => {
      const now = Date.now();
      const returnScanAt = now - 10 * 3_600_000; // 10h ago
      const initialDeadline = returnScanAt + 72 * 3_600_000; // 72h window => 62h left

      const claimId = await db.claims.add({
        awb: 'AWB-RECALC-001',
        orderId: 'ORD-RECALC',
        sku: 'SKU-RECALC',
        qty: 1,
        courier: 'Delhivery',
        marketplace: 'Meesho',
        status: 'pending',
        flagReason: 'Damaged',
        notes: 'Initial claim inspection.',
        returnScanAt,
        deadlineAt: initialDeadline
      });

      // Seller changes Meesho window from 72h to 48h
      saveCustomClaimWindowHours('Meesho', 48);
      const updatedCount = await recalculateClaimsForMarketplace('Meesho', 48, 72);
      expect(updatedCount).toBe(1);

      const updatedClaim = await db.claims.get(Number(claimId));
      expect(updatedClaim).toBeDefined();

      // New deadline should be returnScanAt + 48 hours
      expect(updatedClaim?.deadlineAt).toBe(returnScanAt + 48 * 3_600_000);

      // Notes must contain the explanatory note with IST timestamp
      expect(updatedClaim?.notes).toContain('[Window updated from 72h to 48h on');
      expect(updatedClaim?.notes).toContain('IST]');
      expect(updatedClaim?.notes).toContain('Initial claim inspection.');
    });

    it('handles device clock changes gracefully without crashing or returning NaN', () => {
      const now = Date.now();
      // Suppose the device clock jumped back in time or forward in time
      const farPast = now - 1000 * 3600 * 1000;
      expect(formatCountdown(farPast - now)).toBe('Expired');
      expect(deadlineTone(farPast - now)).toBe('expired');

      const farFuture = now + 1000 * 3600 * 1000;
      expect(formatCountdown(farFuture - now)).toContain('h');
      expect(deadlineTone(farFuture - now)).toBe('ok');

      // Invalid input fallback
      expect(parseISTDateTime('')).toBeDefined();
      expect(typeof parseISTDateTime('')).toBe('number');
    });
  });

  describe('Acceptance Criterion 4: .ics calendar file export and browser notifications', () => {
    const sampleClaim: ClaimItem = {
      id: 501,
      awb: 'AWB-CALENDAR-777',
      orderId: 'ORD-CALENDAR',
      sku: 'SKU-CALENDAR-ITEM',
      qty: 2,
      courier: 'Shadowfax',
      marketplace: 'Flipkart',
      status: 'pending',
      flagReason: 'Wrong/Swapped item',
      notes: '',
      returnScanAt: Date.now(),
      deadlineAt: Date.now() + 14 * 24 * 3_600_000
    };

    it('generates a valid RFC 5545 .ics calendar content string with 24h and 6h alarms', () => {
      const ics = generateClaimIcs(sampleClaim);
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('VERSION:2.0');
      expect(ics).toContain('PRODID:-//SABOOT Suite//ClaimRadar Pro//EN');
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('SUMMARY:File Flipkart Dispute Claim — AWB AWB-CALENDAR-777');
      expect(ics).toContain('STATUS:CONFIRMED');
      expect(ics).toContain('BEGIN:VALARM');
      expect(ics).toContain('TRIGGER:-PT24H');
      expect(ics).toContain('TRIGGER:-PT6H');
      expect(ics).toContain('END:VEVENT');
      expect(ics).toContain('END:VCALENDAR');
    });

    it('manages browser notification permissions and fires alerts at 24h and 6h thresholds', () => {
      setClaimNotificationsEnabled(true);
      expect(isClaimNotificationsEnabled()).toBe(false); // Because Notification.permission is not granted by default in mock

      // Mock Notification API
      const notificationSpy = vi.fn();
      globalThis.Notification = Object.assign(notificationSpy, {
        permission: 'granted' as NotificationPermission,
        requestPermission: vi.fn().mockResolvedValue('granted')
      }) as unknown as typeof Notification;

      setClaimNotificationsEnabled(true);
      expect(isClaimNotificationsEnabled()).toBe(true);

      // Claim with 5 hours left (within 6-hour critical threshold)
      const criticalClaim: ClaimItem = {
        ...sampleClaim,
        id: 991,
        deadlineAt: Date.now() + 5 * 3_600_000
      };

      checkAndSendClaimNotifications([criticalClaim]);
      expect(notificationSpy).toHaveBeenCalledTimes(1);
      expect(notificationSpy.mock.calls[0][0]).toContain('URGENT: 6h Left');
    });
  });
});

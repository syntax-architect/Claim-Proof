import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/schema';
import {
  FREE_AWBS_PER_DAY,
  FREE_LABELS_PER_DAY,
  addAwbsRecorded,
  addLabelsCropped,
  checkLabelQuota,
  consumablesAlertDue,
  consumeRecordingQuota,
  getCumulativeLabels,
  getTodayUsage,
  markConsumablesShown
} from './quota';

describe('quota engine', () => {
  beforeEach(async () => {
    await db.license_state.delete('active');
    await db.usage_counters.clear();
    await db.settings.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    // Set to 2026-10-31 10:00:00 IST (UTC + 5:30)
    // 10:00 IST = 04:30 UTC
    vi.setSystemTime(new Date('2026-10-31T04:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Free tier daily limits', () => {
    it('enforces free label cropping quota (40/day)', async () => {
      // Initial state: 0 used
      const initial = await checkLabelQuota(10);
      expect(initial.allowed).toBe(true);
      expect(initial.used).toBe(0);
      expect(initial.limit).toBe(FREE_LABELS_PER_DAY);

      // Crop 35 labels
      await addLabelsCropped(35);
      const usage1 = await getTodayUsage();
      expect(usage1.labelsCropped).toBe(35);

      // 5 more allowed (35 + 5 = 40 <= 40)
      const check1 = await checkLabelQuota(5);
      expect(check1.allowed).toBe(true);
      expect(check1.used).toBe(35);

      // 6 more denied (35 + 6 = 41 > 40)
      const check2 = await checkLabelQuota(6);
      expect(check2.allowed).toBe(false);
      expect(check2.used).toBe(35);

      // Add 5 to hit exactly 40
      await addLabelsCropped(5);
      const check3 = await checkLabelQuota(1);
      expect(check3.allowed).toBe(false);
      expect(check3.used).toBe(40);
    });

    it('enforces free AWB video recording quota (10/day) and increments on consumption', async () => {
      for (let i = 0; i < FREE_AWBS_PER_DAY; i++) {
        const check = await consumeRecordingQuota();
        expect(check.allowed).toBe(true);
        expect(check.used).toBe(i);
        expect(check.limit).toBe(FREE_AWBS_PER_DAY);
      }

      const usage = await getTodayUsage();
      expect(usage.awbsRecorded).toBe(10);

      // 11th recording should be denied without incrementing
      const denied = await consumeRecordingQuota();
      expect(denied.allowed).toBe(false);
      expect(denied.used).toBe(10);
      expect(denied.limit).toBe(FREE_AWBS_PER_DAY);

      const usageAfter = await getTodayUsage();
      expect(usageAfter.awbsRecorded).toBe(10);
    });
  });

  describe('IST day rollover', () => {
    it('resets daily counters when crossing IST midnight', async () => {
      // 2026-10-31 23:45:00 IST -> 18:15:00 UTC
      vi.setSystemTime(new Date('2026-10-31T18:15:00Z'));

      await addLabelsCropped(40);
      await addAwbsRecorded();
      await addAwbsRecorded();

      const usageDay1 = await getTodayUsage();
      expect(usageDay1.date).toBe('2026-10-31');
      expect(usageDay1.labelsCropped).toBe(40);
      expect(usageDay1.awbsRecorded).toBe(2);

      const checkDay1 = await checkLabelQuota(1);
      expect(checkDay1.allowed).toBe(false);

      // Advance by 30 minutes to 2026-11-01 00:15:00 IST -> 18:45:00 UTC
      vi.setSystemTime(new Date('2026-10-31T18:45:00Z'));

      const usageDay2 = await getTodayUsage();
      expect(usageDay2.date).toBe('2026-11-01');
      expect(usageDay2.labelsCropped).toBe(0);
      expect(usageDay2.awbsRecorded).toBe(0);

      // Quota is fresh on new IST day
      const checkDay2 = await checkLabelQuota(40);
      expect(checkDay2.allowed).toBe(true);
      expect(checkDay2.used).toBe(0);

      const recDay2 = await consumeRecordingQuota();
      expect(recDay2.allowed).toBe(true);
      expect(recDay2.used).toBe(0);
    });
  });

  describe('Paid plan bypass', () => {
    it('bypasses label and recording limits when a paid plan is active', async () => {
      await db.license_state.put({
        key: 'active',
        value: {
          plan: 'claimradar',
          seats: 1,
          customerId: 'cust_paid_001',
          deviceFingerprint: 'fp_test',
          boundDevices: ['fp_test'],
          token: 'valid_token'
        }
      });

      // Crop 500 labels (far exceeds 40)
      await addLabelsCropped(500);
      const labelCheck = await checkLabelQuota(100);
      expect(labelCheck.allowed).toBe(true);
      expect(labelCheck.limit).toBeNull();
      expect(labelCheck.used).toBe(500);

      // Record 50 videos (far exceeds 10)
      for (let i = 0; i < 50; i++) {
        await addAwbsRecorded();
      }
      const recCheck = await consumeRecordingQuota();
      expect(recCheck.allowed).toBe(true);
      expect(recCheck.limit).toBeNull();
      expect(recCheck.used).toBe(50);
    });

    it('bypasses limits for starter and warehouse plans', async () => {
      await db.license_state.put({
        key: 'active',
        value: {
          plan: 'starter',
          seats: 1,
          customerId: 'cust_starter',
          deviceFingerprint: 'fp_test',
          boundDevices: ['fp_test'],
          token: 'valid_token'
        }
      });

      const labelCheck = await checkLabelQuota(1000);
      expect(labelCheck.allowed).toBe(true);
      expect(labelCheck.limit).toBeNull();

      const recCheck = await consumeRecordingQuota();
      expect(recCheck.allowed).toBe(true);
      expect(recCheck.limit).toBeNull();
    });
  });

  describe('Consumables alert logic', () => {
    it('tracks cumulative labels and triggers consumables alert threshold at 1,500', async () => {
      expect(await getCumulativeLabels()).toBe(0);

      await addLabelsCropped(1400);
      expect(await getCumulativeLabels()).toBe(1400);
      expect(consumablesAlertDue(1400, 0)).toBe(false);

      await addLabelsCropped(100);
      expect(await getCumulativeLabels()).toBe(1500);
      expect(consumablesAlertDue(1500, 0)).toBe(true);

      // After user sees alert and marks it shown
      await markConsumablesShown(1500);
      expect(consumablesAlertDue(1500, 1500)).toBe(false);

      // Next alert should trigger only after another 1500 (3000 total)
      expect(consumablesAlertDue(2999, 1500)).toBe(false);
      expect(consumablesAlertDue(3000, 1500)).toBe(true);
    });
  });
});

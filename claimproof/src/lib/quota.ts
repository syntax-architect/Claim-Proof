/* Freemium quota engine — free tier limits, daily counters, consumables alert. */

import { db, getSetting, setSetting } from '../db/schema';
import { istDateKey } from './dateUtils';
import type { DailyUsage, LicensePlan } from '../types';

export const FREE_LABELS_PER_DAY = 40;
export const FREE_AWBS_PER_DAY = 10;
export const CONSUMABLES_THRESHOLD = 1500;

export interface QuotaCheck {
  allowed: boolean;
  used: number;
  limit: number | null;
}

export async function getLicensePlan(): Promise<LicensePlan> {
  const row = await db.license_state.get('active');
  return row?.value?.plan ?? 'free';
}

export async function getTodayUsage(): Promise<DailyUsage> {
  const date = istDateKey();
  const row = await db.usage_counters.get(date);
  return {
    date,
    labelsCropped: row?.labelsCropped ?? 0,
    awbsRecorded: row?.awbsRecorded ?? 0
  };
}

export async function addLabelsCropped(n: number): Promise<DailyUsage> {
  const date = istDateKey();
  const row = await db.usage_counters.get(date);
  const next: DailyUsage = {
    date,
    labelsCropped: (row?.labelsCropped ?? 0) + n,
    awbsRecorded: row?.awbsRecorded ?? 0
  };
  await db.usage_counters.put(next);
  const cumulative = await getSetting<number>('cumulative_labels', 0);
  await setSetting('cumulative_labels', cumulative + n);
  return next;
}

export async function addAwbsRecorded(): Promise<DailyUsage> {
  const date = istDateKey();
  const row = await db.usage_counters.get(date);
  const next: DailyUsage = {
    date,
    labelsCropped: row?.labelsCropped ?? 0,
    awbsRecorded: (row?.awbsRecorded ?? 0) + 1
  };
  await db.usage_counters.put(next);
  return next;
}

/** Can `additional` more labels be cropped right now under the free daily quota? */
export async function checkLabelQuota(additional: number): Promise<QuotaCheck> {
  const plan = await getLicensePlan();
  const usage = await getTodayUsage();
  if (plan !== 'free') return { allowed: true, used: usage.labelsCropped, limit: null };
  return {
    allowed: usage.labelsCropped + additional <= FREE_LABELS_PER_DAY,
    used: usage.labelsCropped,
    limit: FREE_LABELS_PER_DAY
  };
}

/** Consume one AWB recording slot. Call BEFORE recording starts. */
export async function consumeRecordingQuota(): Promise<QuotaCheck> {
  const plan = await getLicensePlan();
  const usage = await getTodayUsage();
  if (plan !== 'free') return { allowed: true, used: usage.awbsRecorded, limit: null };
  const allowed = usage.awbsRecorded < FREE_AWBS_PER_DAY;
  if (allowed) await addAwbsRecorded();
  return { allowed, used: usage.awbsRecorded, limit: FREE_AWBS_PER_DAY };
}

export async function getCumulativeLabels(): Promise<number> {
  return getSetting<number>('cumulative_labels', 0);
}

/** Every 1,500 cropped labels → packing-supply reorder card. */
export function consumablesAlertDue(cumulative: number, lastShownAt: number): boolean {
  return cumulative >= CONSUMABLES_THRESHOLD && cumulative - lastShownAt >= CONSUMABLES_THRESHOLD;
}

export async function markConsumablesShown(cumulative: number): Promise<void> {
  await setSetting('consumables_last_shown', cumulative);
}

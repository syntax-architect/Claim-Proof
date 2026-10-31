/* Marketplace claim-window rules (2026 seller rubrics) + claim construction
 * from bad-return flags. Pure functions — shared by the recorder and ClaimRadar. */

import type { ClaimItem, CourierPartner, Marketplace, RecordingType } from '../types';

/** Hours from the return scan within which the seller must file the claim. */
export const CLAIM_WINDOWS_HOURS: Partial<Record<Marketplace, number>> = {
  Meesho: 72, // Meesho SAFE
  AJIO: 72,
  Snapdeal: 72,
  Myntra: 72,
  Flipkart: 336, // Flipkart SPF — 14 days
  Amazon: 720 // Amazon SAFE-T — 30 days
};

export const DEFAULT_CLAIM_WINDOW_HOURS = 72;

export function claimWindowHours(marketplace: Marketplace): number {
  return CLAIM_WINDOWS_HOURS[marketplace] ?? DEFAULT_CLAIM_WINDOW_HOURS;
}

export function claimDeadlineFor(marketplace: Marketplace, fromMs: number = Date.now()): number {
  return fromMs + claimWindowHours(marketplace) * 3_600_000;
}

export function claimWindowLabel(marketplace: Marketplace): string {
  switch (marketplace) {
    case 'Meesho':
      return 'Meesho SAFE · 72 hours';
    case 'Flipkart':
      return 'Flipkart SPF · 14 days';
    case 'Amazon':
      return 'Amazon SAFE-T · 30 days';
    case 'AJIO':
      return 'AJIO · 72 hours';
    case 'Snapdeal':
      return 'Snapdeal · 72 hours';
    case 'Myntra':
      return 'Myntra · 72 hours';
    default:
      return 'Standard · 72 hours';
  }
}

export interface ReturnFlagDetail {
  awb: string;
  orderId: string;
  sku: string;
  qty: number;
  courier: CourierPartner;
  marketplace: Marketplace;
  reason: ClaimItem['flagReason'];
  notes?: string;
  /** The return-unboxing recording that produced this flag. */
  recordingId?: number;
  returnScanAt?: number;
}

/** Builds a pending ClaimItem ready to insert into db.claims. */
export function buildClaimFromFlag(detail: ReturnFlagDetail): ClaimItem {
  const returnScanAt = detail.returnScanAt ?? Date.now();
  return {
    awb: detail.awb.trim().toUpperCase(),
    orderId: detail.orderId,
    marketplace: detail.marketplace,
    courier: detail.courier,
    sku: detail.sku,
    qty: detail.qty,
    flagReason: detail.reason,
    notes: detail.notes ?? '',
    returnScanAt,
    deadlineAt: claimDeadlineFor(detail.marketplace, returnScanAt),
    status: 'pending',
    disputeText: '',
    returnRecordingId: detail.recordingId
  };
}

/** Human label for a recording type. */
export function recordingTypeLabel(type: RecordingType): string {
  return type === 'return' ? 'Return Unboxing' : 'Dispatch Packing';
}

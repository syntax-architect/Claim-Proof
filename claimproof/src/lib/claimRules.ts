/* Marketplace claim-window rules (2026 seller rubrics) + claim construction
 * from bad-return flags. Pure functions — shared by the recorder and ClaimRadar.
 */

import type { ClaimItem, CourierPartner, Marketplace, RecordingType } from '../types';
import {
  CLAIM_WINDOWS_HOURS,
  DEFAULT_CLAIM_WINDOW_HOURS,
  MARKETPLACE_CLAIM_WINDOWS,
  UNVERIFIED_LABEL,
  UNVERIFIED_STATUS,
  type MarketplaceClaimWindowConfig,
  getClaimWindowHours,
  isClaimWindowUnverified,
  saveCustomClaimWindowHours,
  resetCustomClaimWindows,
  resetSingleClaimWindow,
  getCustomClaimWindows
} from '../config/claimWindows';

export {
  CLAIM_WINDOWS_HOURS,
  DEFAULT_CLAIM_WINDOW_HOURS,
  MARKETPLACE_CLAIM_WINDOWS,
  UNVERIFIED_LABEL,
  UNVERIFIED_STATUS,
  type MarketplaceClaimWindowConfig,
  getClaimWindowHours,
  isClaimWindowUnverified,
  saveCustomClaimWindowHours,
  resetCustomClaimWindows,
  resetSingleClaimWindow,
  getCustomClaimWindows
};

/** Hours from the return scan within which the seller must file the claim (with custom overrides support). */
export function claimWindowHours(
  marketplace: Marketplace,
  customOverrides?: Partial<Record<Marketplace, number>>
): number {
  return getClaimWindowHours(marketplace, customOverrides);
}

export function claimDeadlineFor(
  marketplace: Marketplace,
  fromMs: number = Date.now(),
  customOverrides?: Partial<Record<Marketplace, number>>
): number {
  return fromMs + claimWindowHours(marketplace, customOverrides) * 3_600_000;
}

export function claimWindowLabel(
  marketplace: Marketplace,
  customOverrides?: Partial<Record<Marketplace, number>>
): string {
  const hours = claimWindowHours(marketplace, customOverrides);
  const config = MARKETPLACE_CLAIM_WINDOWS[marketplace];
  const name =
    config?.displayName ?? (marketplace === 'Unknown' || !config ? 'Standard' : marketplace);

  let durationText: string;
  if (hours % 24 === 0 && hours >= 48 && (hours === 336 || hours === 720 || hours > 72)) {
    durationText = `${hours / 24} days`;
  } else {
    durationText = `${hours} hours`;
  }

  return `${name} · ${durationText}`;
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
export function buildClaimFromFlag(
  detail: ReturnFlagDetail,
  customOverrides?: Partial<Record<Marketplace, number>>
): ClaimItem {
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
    deadlineAt: claimDeadlineFor(detail.marketplace, returnScanAt, customOverrides),
    status: 'pending',
    disputeText: '',
    returnRecordingId: detail.recordingId,
    amountClaimedPaise: 0,
    amountRecoveredPaise: 0,
    auditTrail: []
  };
}

/** Human label for a recording type. */
export function recordingTypeLabel(type: RecordingType): string {
  return type === 'return' ? 'Return Unboxing' : 'Dispatch Packing';
}

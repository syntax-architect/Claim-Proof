/* SABOOT Suite — shared domain types.
 * This file is the CONTRACT between every module. Keep it stable. */

export type Marketplace =
  'Meesho' | 'Flipkart' | 'Amazon' | 'Myntra' | 'AJIO' | 'Snapdeal' | 'GlowRoad' | 'Unknown';

export type CourierPartner =
  | 'Valmo'
  | 'ValmoPlus'
  | 'Delhivery'
  | 'Shadowfax'
  | 'Xpressbees'
  | 'Ecom Express'
  | 'DTDC'
  | 'Ekart'
  | 'Unknown';

export type CropPreset = '4x6' | '4x4' | 'grid4';

/** Confidence score (0.0 to 1.0) for individual extracted label fields. */
export interface FieldConfidence {
  awb: number;
  orderId: number;
  courier: number;
  marketplace: number;
  sku: number;
  qty: number;
  size: number;
  color: number;
  invoiceTotal: number;
}

/** One physical shipping label = one page of a source PDF, parsed by SmartLabel SKU+. */
export interface ExtractedLabel {
  sourceFile: string;
  /** 1-based page number inside its source PDF. */
  page: number;
  marketplace: Marketplace;
  /** AWB / tracking number. */
  awb: string;
  orderId: string;
  courier: CourierPartner;
  sku: string;
  size: string;
  color: string;
  qty: number;
  /** Rupees, when found. */
  invoiceTotal: number | null;
  /** Content bounding box in PDF user-space points (origin bottom-left) — anchors the crop. */
  contentBox: { x: number; y: number; w: number; h: number };
  /** Confidence score (0.0 to 1.0) per extracted field. */
  confidence?: FieldConfidence;
  /** Flagged when critical fields (AWB or SKU) are missing or require manual review. */
  needsManualEdit?: boolean;
  /** Missing fields list when flagged. */
  missingFields?: ('awb' | 'sku' | 'orderId' | 'courier')[];
  /** Warning or error message explaining issues (e.g. scanned image-only). */
  warning?: string;
  /** True when the page contains no digital text layer (scanned or photo PDF). */
  isImageOnly?: boolean;
}

/** A label persisted to IndexedDB — pre-loaded into memory so the recorder can auto-match AWBs. */
export interface StoredOrder extends ExtractedLabel {
  id?: number;
  batchId: string;
  createdAt: number;
}

export interface LabelBatchSummary {
  id: string;
  createdAt: number;
  files: string[];
  labelCount: number;
  cropPreset: CropPreset;
  valmoPlusAsValmo: boolean;
}

export type RecordingType = 'dispatch' | 'return';

export interface RecordingMeta {
  id?: number;
  awb: string;
  orderId: string;
  sku: string;
  size: string;
  qty: number;
  courier: CourierPartner;
  marketplace: Marketplace;
  type: RecordingType;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  videoMime: string;
  videoBytes: number;
  photoBytes: number;
  photoCollage: boolean;
  /** e.g. `2026-10-31/Dispatch/5894372819` (relative to the vault root). */
  vaultPath: string;
  /** Recorded with the synthetic demo camera (no physical webcam). */
  demo: boolean;
  flagged: boolean;
}

export type FlagReason =
  'Damaged' | 'Used/Worn' | 'Wrong/Swapped item' | 'Missing item' | 'Empty package' | 'Other';

export type ClaimStatus =
  'not_filed' | 'filed' | 'won' | 'partly_won' | 'lost' | 'pending' | 'prepared' | 'submitted';

export interface ClaimAuditEntry {
  timestamp: number;
  changedAt: string;
  fromStatus?: ClaimStatus;
  toStatus?: ClaimStatus;
  fromClaimedPaise?: number;
  toClaimedPaise?: number;
  fromRecoveredPaise?: number;
  toRecoveredPaise?: number;
  notes?: string;
  reason?: string;
  source?: 'user_edit' | 'csv_import' | 'system';
}

export interface ClaimItem {
  id?: number;
  awb: string;
  orderId: string;
  marketplace: Marketplace;
  courier: CourierPartner;
  sku: string;
  qty: number;
  flagReason: FlagReason;
  notes: string;
  returnScanAt: number;
  deadlineAt: number;
  status: ClaimStatus;
  disputeText?: string;
  dispatchRecordingId?: number;
  returnRecordingId?: number;
  /** Monetary amount claimed in integer paise (e.g. ₹500 is 50000 paise). */
  amountClaimedPaise?: number;
  /** Monetary amount recovered in integer paise. */
  amountRecoveredPaise?: number;
  /** Epoch timestamp in ms when the claim was filed. */
  filedAt?: number;
  /** Epoch timestamp in ms when the claim was resolved (won, partly won, or lost). */
  resolvedAt?: number;
  /** Audit log of edits and status changes. */
  auditTrail?: ClaimAuditEntry[];
  /** Epoch timestamp in ms when the 1-click claim kit was generated. */
  claimKitGeneratedAt?: number;
  /** Local folder name or relative path where the claim kit was saved. */
  claimKitPath?: string;
}

export type ReturnCondition = 'good' | 'wrong_item' | 'empty' | 'damaged' | 'used_worn';

export interface ReturnVideoMeta {
  id?: number;
  awb: string;
  orderId: string;
  sku: string;
  size: string;
  qty: number;
  courier: CourierPartner;
  marketplace: Marketplace;
  condition: ReturnCondition;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  videoMime: string;
  videoBytes: number;
  vaultPath: string;
  linkedDispatchRecordingId?: number;
  partial: boolean;
  checklistCompletedCount: number;
  checklistTotalCount: number;
  demo: boolean;
}

export interface ChecklistResultRow {
  id?: number;
  returnVideoId?: number;
  awb: string;
  stepId: string;
  stepOrder: number;
  title: string;
  completed: boolean;
  completedAtOffsetSec?: number;
  timestamp: number;
}

export type PlanId = 'starter' | 'claimradar' | 'warehouse';

export type BillingInterval = 'monthly' | 'annual';

export type LicensePlan = 'free' | PlanId;

export type ProFeature =
  'unlimitedLabels' | 'unlimitedRecording' | 'collage' | 'claimRadar' | 'matcher';

export type SubscriptionStatus =
  'active' | 'authenticated' | 'payment_failed' | 'halted' | 'cancelled' | 'expired' | 'revoked';

export interface LicenseState {
  plan: LicensePlan;
  billingInterval?: BillingInterval;
  seats: number;
  deviceFingerprint: string;
  boundDevices?: string[];
  customerId?: string;
  subscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
  renewsAt?: number | null;
  graceExpiresAt?: number | null;
  activatedAt?: number;
  expiresAt?: number | null;
  /** Raw ES256 license JWT (offline-verifiable). */
  token?: string;
  /** True when activated via the in-app demo path instead of a signed token. */
  demo?: boolean;
  licenseeName?: string;
}

export type ActivationErrorCode =
  | 'INVALID_TOKEN'
  | 'EXPIRED'
  | 'INVALID_SIGNATURE'
  | 'WRONG_ISSUER'
  | 'WRONG_PLAN'
  | 'MISSING_CUSTOMER_ID'
  | 'DEVICE_MISMATCH';

export interface ActivationResult {
  ok: boolean;
  error?: string;
  code?: ActivationErrorCode;
  canMove?: boolean;
}

export interface DailyUsage {
  /** YYYY-MM-DD in IST. */
  date: string;
  labelsCropped: number;
  awbsRecorded: number;
}

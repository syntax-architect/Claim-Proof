/* ClaimProof Suite — shared domain types.
 * This file is the CONTRACT between every module. Keep it stable. */

export type Marketplace =
  | 'Meesho'
  | 'Flipkart'
  | 'Amazon'
  | 'Myntra'
  | 'AJIO'
  | 'Snapdeal'
  | 'GlowRoad'
  | 'Unknown';

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
  | 'Damaged'
  | 'Used/Worn'
  | 'Wrong/Swapped item'
  | 'Missing item'
  | 'Empty package'
  | 'Other';

export type ClaimStatus = 'pending' | 'prepared' | 'submitted' | 'won' | 'lost';

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
  disputeText: string;
  dispatchRecordingId?: number;
  returnRecordingId?: number;
}

export type PlanId = 'starter' | 'claimradar' | 'warehouse';

export type BillingInterval = 'monthly' | 'annual';

export type LicensePlan = 'free' | PlanId;

export type ProFeature =
  | 'unlimitedLabels'
  | 'unlimitedRecording'
  | 'collage'
  | 'claimRadar'
  | 'matcher';

export interface LicenseState {
  plan: LicensePlan;
  billingInterval?: BillingInterval;
  seats: number;
  deviceFingerprint: string;
  activatedAt?: number;
  expiresAt?: number | null;
  /** Raw ES256 license JWT (offline-verifiable). */
  token?: string;
  /** True when activated via the in-app demo path instead of a signed token. */
  demo?: boolean;
  licenseeName?: string;
}

export interface DailyUsage {
  /** YYYY-MM-DD in IST. */
  date: string;
  labelsCropped: number;
  awbsRecorded: number;
}

import Dexie, { type Table } from 'dexie';
import type {
  ClaimItem,
  DailyUsage,
  LabelBatchSummary,
  LicenseState,
  RecordingMeta,
  StoredOrder
} from '../types';

export interface KVRow<T = unknown> {
  key: string;
  value: T;
}

export interface MediaCacheRow {
  id: number;
  video?: Blob;
  photo?: Blob;
  savedAt: number;
}

export class ClaimProofDB extends Dexie {
  /** SmartLabel SKU+ extracted labels (the AWB "memory" the recorder matches against). */
  orders!: Table<StoredOrder, number>;
  batches!: Table<LabelBatchSummary, string>;
  /** ClaimProof AWB recordings metadata (sub-millisecond search by AWB / SKU / courier). */
  recordings!: Table<RecordingMeta, number>;
  /** ClaimRadar flagged-return queue. */
  claims!: Table<ClaimItem, number>;
  license_state!: Table<KVRow<LicenseState>, string>;
  usage_counters!: Table<DailyUsage, string>;
  settings!: Table<KVRow, string>;
  /** Persisted File System Access handle for the on-disk vault. */
  vault!: Table<KVRow<FileSystemDirectoryHandle>, string>;
  /** Rolling blob cache so evidence can be replayed without touching the disk. */
  media_cache!: Table<MediaCacheRow, number>;

  constructor() {
    super('claimproof');
    this.version(1).stores({
      orders: '++id, awb, orderId, sku, courier, marketplace, batchId, createdAt',
      batches: 'id, createdAt',
      recordings: '++id, awb, orderId, type, startedAt, flagged, courier, sku, marketplace',
      claims: '++id, awb, status, marketplace, deadlineAt, returnScanAt',
      license_state: 'key',
      usage_counters: 'date',
      settings: 'key',
      vault: 'key',
      media_cache: 'id, savedAt'
    });
  }
}

export const db = new ClaimProofDB();

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

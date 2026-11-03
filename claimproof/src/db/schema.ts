import Dexie, { type Table } from 'dexie';
import { BRAND } from '../config/brand';
import type {
  ChecklistResultRow,
  ClaimItem,
  DailyUsage,
  LabelBatchSummary,
  LicenseState,
  RecordingMeta,
  ReturnVideoMeta,
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

const DB_STORES_V1 = {
  orders: '++id, awb, orderId, sku, courier, marketplace, batchId, createdAt',
  batches: 'id, createdAt',
  recordings: '++id, awb, orderId, type, startedAt, flagged, courier, sku, marketplace',
  claims: '++id, awb, status, marketplace, deadlineAt, returnScanAt',
  license_state: 'key',
  usage_counters: 'date',
  settings: 'key',
  vault: 'key',
  media_cache: 'id, savedAt'
};

const DB_STORES_V2 = {
  ...DB_STORES_V1,
  returnVideos: '++id, awb, orderId, condition, startedAt, linkedDispatchRecordingId, partial',
  checklistResults: '++id, returnVideoId, awb, stepId, completed, timestamp'
};

const DB_STORES_V3 = {
  ...DB_STORES_V2,
  claims: '++id, awb, status, marketplace, deadlineAt, returnScanAt, filedAt, resolvedAt'
};

const DB_STORES_V4 = {
  ...DB_STORES_V3,
  claims:
    '++id, awb, status, marketplace, deadlineAt, returnScanAt, filedAt, resolvedAt, claimKitGeneratedAt'
};

export class SabootDB extends Dexie {
  /** SmartLabel SKU+ extracted labels (the AWB "memory" the recorder matches against). */
  orders!: Table<StoredOrder, number>;
  batches!: Table<LabelBatchSummary, string>;
  /** SABOOT AWB recordings metadata (sub-millisecond search by AWB / SKU / courier). */
  recordings!: Table<RecordingMeta, number>;
  /** Return unboxing guided videos linked to packing/claims. */
  returnVideos!: Table<ReturnVideoMeta, number>;
  /** Individual checklist step ticks & timestamp offsets for return unboxing. */
  checklistResults!: Table<ChecklistResultRow, number>;
  /** ClaimRadar flagged-return queue. */
  claims!: Table<ClaimItem, number>;
  license_state!: Table<KVRow<LicenseState>, string>;
  usage_counters!: Table<DailyUsage, string>;
  settings!: Table<KVRow, string>;
  /** Persisted File System Access handle for the on-disk vault. */
  vault!: Table<KVRow<FileSystemDirectoryHandle>, string>;
  /** Rolling blob cache so evidence can be replayed without touching the disk. */
  media_cache!: Table<MediaCacheRow, number>;

  constructor(dbName: string = BRAND.dbName) {
    super(dbName);
    this.version(1).stores(DB_STORES_V1);
    this.version(2).stores(DB_STORES_V2);
    this.version(3)
      .stores(DB_STORES_V3)
      .upgrade(async (tx) => {
        await tx
          .table('claims')
          .toCollection()
          .modify((claim) => {
            if (claim.amountClaimedPaise === undefined) claim.amountClaimedPaise = 0;
            if (claim.amountRecoveredPaise === undefined) claim.amountRecoveredPaise = 0;
            if (!Array.isArray(claim.auditTrail)) claim.auditTrail = [];
            if (typeof claim.notes !== 'string') claim.notes = claim.notes || '';
            if (claim.status === 'pending' || claim.status === 'prepared') {
              claim.status = 'not_filed';
            } else if (claim.status === 'submitted') {
              claim.status = 'filed';
            }
          });
      });
    this.version(4)
      .stores(DB_STORES_V4)
      .upgrade(async (tx) => {
        await tx
          .table('claims')
          .toCollection()
          .modify((claim) => {
            if (claim.claimKitGeneratedAt === undefined) {
              claim.claimKitGeneratedAt = 0;
            }
          });
      });
  }
}

export const db = new SabootDB();

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

/**
 * Migrates legacy localStorage keys from `claimproof_*` to `saboot_*`
 * Preserves existing theme, last plan, and user settings seamlessly.
 */
export function migrateLocalStorage(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  let migrated = false;
  try {
    const keyMap: Record<string, string> = {
      [BRAND.storageKeys.legacyTheme]: BRAND.storageKeys.theme,
      [BRAND.storageKeys.legacyLastPlan]: BRAND.storageKeys.lastPlan,
      [BRAND.storageKeys.legacyVaultDirName]: BRAND.storageKeys.vaultDirName,
      claimproof_sw_updated: BRAND.storageKeys.swUpdated
    };

    for (const [oldKey, newKey] of Object.entries(keyMap)) {
      const val = localStorage.getItem(oldKey);
      if (val !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, val);
        migrated = true;
      }
    }

    // Generic prefix migration for any other custom keys
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('claimproof_')) {
        const newK = k.replace(/^claimproof_/, 'saboot_');
        if (localStorage.getItem(newK) === null) {
          const v = localStorage.getItem(k);
          if (v !== null) {
            localStorage.setItem(newK, v);
            migrated = true;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[migration] LocalStorage migration error:', err);
  }
  return migrated;
}

/**
 * Migrates IndexedDB data from legacy database ('claimproof') to new database ('saboot').
 * Preserves all orders, batches, recordings, claims, licenses, and media cache.
 */
export async function migrateLegacyClaimproofDb(): Promise<{
  migrated: boolean;
  counts: Record<string, number>;
}> {
  const counts: Record<string, number> = {};
  if (typeof window === 'undefined') return { migrated: false, counts };

  try {
    const legacyExists = await Dexie.exists(BRAND.legacyDbName);
    if (!legacyExists) {
      return { migrated: false, counts };
    }

    const legacyDb = new Dexie(BRAND.legacyDbName);
    legacyDb.version(1).stores(DB_STORES_V1);
    await legacyDb.open();

    const tableNames = Object.keys(DB_STORES_V1) as Array<keyof typeof DB_STORES_V1>;
    let anyCopied = false;

    for (const name of tableNames) {
      const src = legacyDb.table(name);
      const dest = db.table(name);
      const rows = await src.toArray();
      if (rows && rows.length > 0) {
        await dest.bulkPut(rows);
        counts[name] = rows.length;
        anyCopied = true;
      } else {
        counts[name] = 0;
      }
    }

    legacyDb.close();

    try {
      localStorage.setItem(BRAND.storageKeys.migratedFromClaimproof, 'true');
    } catch {
      /* ignore */
    }

    return { migrated: anyCopied, counts };
  } catch (err) {
    console.warn('[migration] Legacy IndexedDB migration failed:', err);
    return { migrated: false, counts };
  }
}

// Hook migration into Dexie ready lifecycle so it runs before any caller queries
db.on('ready', async () => {
  await migrateLegacyClaimproofDb();
});

// Run localStorage migration on module import
migrateLocalStorage();

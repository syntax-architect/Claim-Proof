import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import 'fake-indexeddb/auto';
import { SabootDB } from '../db/schema';
import type { ClaimItem } from '../types';

describe('Dexie Schema V2 -> V3 Migration for Claims Ledger', () => {
  const TEST_DB_NAME = 'saboot_ledger_migration_test_db';

  beforeEach(async () => {
    await Dexie.delete(TEST_DB_NAME);
  });

  afterEach(async () => {
    await Dexie.delete(TEST_DB_NAME);
  });

  it('migrates legacy V2 claims without data loss and assigns default ledger fields and normalized statuses in V3', async () => {
    // 1. Setup a legacy V2 database
    const v2Db = new Dexie(TEST_DB_NAME);
    v2Db.version(1).stores({
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
    v2Db.version(2).stores({
      orders: '++id, awb, orderId, sku, courier, marketplace, batchId, createdAt',
      batches: 'id, createdAt',
      recordings: '++id, awb, orderId, type, startedAt, flagged, courier, sku, marketplace',
      claims: '++id, awb, status, marketplace, deadlineAt, returnScanAt',
      license_state: 'key',
      usage_counters: 'date',
      settings: 'key',
      vault: 'key',
      media_cache: 'id, savedAt',
      returnVideos: '++id, awb, orderId, condition, startedAt, linkedDispatchRecordingId, partial',
      checklistResults: '++id, returnVideoId, awb, stepId, completed, timestamp'
    });

    await v2Db.open();

    // 2. Insert legacy claims without new fields
    const legacyPendingClaim: any = {
      awb: 'AWB_LEGACY_PENDING',
      orderId: 'ORD_LEGACY_1',
      marketplace: 'Meesho',
      courier: 'Delhivery',
      sku: 'SKU_KURTI',
      qty: 1,
      flagReason: 'Damaged',
      notes: 'Customer returned damaged item',
      returnScanAt: 1700000000000,
      deadlineAt: 1700000000000 + 72 * 3600 * 1000,
      status: 'pending',
      disputeText: ''
    };

    const legacySubmittedClaim: any = {
      awb: 'AWB_LEGACY_SUBMITTED',
      orderId: 'ORD_LEGACY_2',
      marketplace: 'Flipkart',
      courier: 'Ekart',
      sku: 'SKU_JEANS',
      qty: 1,
      flagReason: 'Wrong/Swapped item',
      notes: 'Wrong item received in box',
      returnScanAt: 1700000000000,
      deadlineAt: 1700000000000 + 336 * 3600 * 1000,
      status: 'submitted',
      disputeText: 'Submitted on seller portal'
    };

    const legacyWonClaim: any = {
      awb: 'AWB_LEGACY_WON',
      orderId: 'ORD_LEGACY_3',
      marketplace: 'Amazon',
      courier: 'Amazon',
      sku: 'SKU_WATCH',
      qty: 1,
      flagReason: 'Empty package',
      notes: 'Resolved via SAFE-T claim',
      returnScanAt: 1700000000000,
      deadlineAt: 1700000000000 + 720 * 3600 * 1000,
      status: 'won',
      disputeText: ''
    };

    await v2Db.table('claims').add(legacyPendingClaim);
    await v2Db.table('claims').add(legacySubmittedClaim);
    await v2Db.table('claims').add(legacyWonClaim);

    expect(await v2Db.table('claims').count()).toBe(3);

    v2Db.close();

    // 3. Open with SabootDB (which runs V3 & V4 migrations)
    const v3Db = new SabootDB(TEST_DB_NAME);
    await v3Db.open();

    expect(v3Db.verno).toBe(4);

    // 4. Assert records migrated intact with defaults and normalized status
    const migratedPending = await v3Db.claims.where('awb').equals('AWB_LEGACY_PENDING').first();
    expect(migratedPending).toBeDefined();
    expect(migratedPending?.status).toBe('not_filed'); // 'pending' mapped to 'not_filed'
    expect(migratedPending?.amountClaimedPaise).toBe(0);
    expect(migratedPending?.amountRecoveredPaise).toBe(0);
    expect(Array.isArray(migratedPending?.auditTrail)).toBe(true);
    expect(migratedPending?.notes).toBe('Customer returned damaged item');

    const migratedSubmitted = await v3Db.claims.where('awb').equals('AWB_LEGACY_SUBMITTED').first();
    expect(migratedSubmitted).toBeDefined();
    expect(migratedSubmitted?.status).toBe('filed'); // 'submitted' mapped to 'filed'
    expect(migratedSubmitted?.amountClaimedPaise).toBe(0);
    expect(migratedSubmitted?.amountRecoveredPaise).toBe(0);

    const migratedWon = await v3Db.claims.where('awb').equals('AWB_LEGACY_WON').first();
    expect(migratedWon).toBeDefined();
    expect(migratedWon?.status).toBe('won');
    expect(migratedWon?.amountClaimedPaise).toBe(0);
    expect(migratedWon?.amountRecoveredPaise).toBe(0);

    // 5. Assert we can write new claims with V3 fields
    const newClaim: ClaimItem = {
      awb: 'AWB_V3_NEW',
      orderId: 'ORD_V3_NEW',
      marketplace: 'AJIO',
      courier: 'Delhivery',
      sku: 'SKU_SHOES',
      qty: 1,
      flagReason: 'Used/Worn',
      notes: 'New V3 claim',
      returnScanAt: Date.now(),
      deadlineAt: Date.now() + 72 * 3600 * 1000,
      status: 'partly_won',
      amountClaimedPaise: 150000,
      amountRecoveredPaise: 75000,
      filedAt: Date.now() - 3600000,
      resolvedAt: Date.now(),
      auditTrail: [
        {
          timestamp: Date.now(),
          changedAt: '03-Nov-2026 20:45:00 IST',
          fromStatus: 'filed',
          toStatus: 'partly_won',
          fromRecoveredPaise: 0,
          toRecoveredPaise: 75000,
          reason: 'Partial settlement'
        }
      ]
    };

    const newId = await v3Db.claims.add(newClaim);
    expect(newId).toBeDefined();

    const fetchedNew = await v3Db.claims.get(newId);
    expect(fetchedNew?.awb).toBe('AWB_V3_NEW');
    expect(fetchedNew?.amountClaimedPaise).toBe(150000);
    expect(fetchedNew?.amountRecoveredPaise).toBe(75000);
    expect(fetchedNew?.auditTrail).toHaveLength(1);

    v3Db.close();
  });
});

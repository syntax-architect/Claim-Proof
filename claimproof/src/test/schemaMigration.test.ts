import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import 'fake-indexeddb/auto';
import { SabootDB } from '../db/schema';
import type { ClaimItem } from '../types';

describe('Dexie Schema V3 -> V4 Migration for Claim Kit Fields', () => {
  const TEST_DB_NAME = 'saboot_v4_migration_test_db';

  beforeEach(async () => {
    await Dexie.delete(TEST_DB_NAME);
  });

  afterEach(async () => {
    await Dexie.delete(TEST_DB_NAME);
  });

  it('migrates existing legacy claims to V4 schema and initializes claimKitGeneratedAt without data loss', async () => {
    // 1. Setup a legacy database simulating V3 schema
    const legacyDb = new Dexie(TEST_DB_NAME);
    legacyDb.version(1).stores({
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
    legacyDb.version(2).stores({
      returnVideos: '++id, awb, orderId, condition, startedAt, linkedDispatchRecordingId, partial',
      checklistResults: '++id, returnVideoId, awb, stepId, completed, timestamp'
    });
    legacyDb.version(3).stores({
      claims: '++id, awb, status, marketplace, deadlineAt, returnScanAt, filedAt, resolvedAt'
    });

    await legacyDb.open();

    // 2. Insert legacy claims without claimKitGeneratedAt
    const legacyClaim: ClaimItem = {
      awb: 'AWB_LEGACY_CLAIM_001',
      orderId: 'ORD_LEGACY_001',
      marketplace: 'Meesho',
      courier: 'Shadowfax',
      sku: 'SKU_SAREE_BLUE',
      qty: 1,
      flagReason: 'Wrong/Swapped item',
      notes: 'Customer returned cheap soap instead of silk saree',
      returnScanAt: 1730000000000,
      deadlineAt: 1730259200000,
      status: 'pending',
      disputeText: 'Customer return swapped. Uncut video proof available.'
    };

    const insertedId = await legacyDb.table('claims').add(legacyClaim);
    expect(await legacyDb.table('claims').count()).toBe(1);

    legacyDb.close();

    // 3. Open with current SabootDB (which executes V4 upgrade migration)
    const currentDb = new SabootDB(TEST_DB_NAME);
    await currentDb.open();

    // 4. Verify that schema version is 4 and data was migrated without loss
    expect(currentDb.verno).toBe(4);

    const migratedClaim = await currentDb.claims.get(Number(insertedId));
    expect(migratedClaim).toBeDefined();
    expect(migratedClaim?.awb).toBe('AWB_LEGACY_CLAIM_001');
    expect(migratedClaim?.sku).toBe('SKU_SAREE_BLUE');
    expect(migratedClaim?.marketplace).toBe('Meesho');
    expect(migratedClaim?.disputeText).toContain('Uncut video proof');
    // Ensure claimKitGeneratedAt was initialized by the upgrade handler
    expect(migratedClaim?.claimKitGeneratedAt).toBe(0);

    // 5. Verify new V4 index allows querying by claimKitGeneratedAt
    const queried = await currentDb.claims.where('claimKitGeneratedAt').equals(0).toArray();
    expect(queried.length).toBe(1);
    expect(queried[0].awb).toBe('AWB_LEGACY_CLAIM_001');

    currentDb.close();
  });
});

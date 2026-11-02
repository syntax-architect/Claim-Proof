import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import { BRAND } from '../config/brand';
import { db, migrateLocalStorage, migrateLegacyClaimproofDb } from '../db/schema';
import type { StoredOrder, ClaimItem } from '../types';

describe('Brand Migration (ClaimProof -> SABOOT)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
    if (await Dexie.exists(BRAND.legacyDbName)) {
      await Dexie.delete(BRAND.legacyDbName);
    }
  });

  it('migrates legacy localStorage keys to new saboot_* keys without data loss', () => {
    localStorage.setItem('claimproof_theme', 'dark');
    localStorage.setItem('claimproof_last_plan', JSON.stringify({ active: true, plan: 'starter' }));
    localStorage.setItem('claimproof_custom_pref', 'custom-value');

    const migrated = migrateLocalStorage();
    expect(migrated).toBe(true);

    expect(localStorage.getItem('saboot_theme')).toBe('dark');
    expect(localStorage.getItem('saboot_last_plan')).toContain('starter');
    expect(localStorage.getItem('saboot_custom_pref')).toBe('custom-value');

    // Original keys are preserved so nothing breaks
    expect(localStorage.getItem('claimproof_theme')).toBe('dark');
  });

  it('migrates legacy IndexedDB "claimproof" database to "saboot" database', async () => {
    // 1. Create a legacy database populated with existing user records
    const legacyDb = new Dexie(BRAND.legacyDbName);
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
    await legacyDb.open();

    const sampleOrder: StoredOrder = {
      id: 1,
      awb: 'MSH123456789',
      orderId: 'ORD-9876',
      sku: 'KURTI-RED-XL',
      size: 'XL',
      color: 'Red',
      qty: 1,
      courier: 'Valmo',
      marketplace: 'Meesho',
      batchId: 'batch_001',
      createdAt: 1730000000000,
      sourceFile: 'test.pdf',
      page: 1,
      invoiceTotal: 499,
      contentBox: { x: 0, y: 0, w: 100, h: 150 }
    };

    const sampleClaim: ClaimItem = {
      id: 1,
      awb: 'MSH123456789',
      orderId: 'ORD-9876',
      sku: 'KURTI-RED-XL',
      courier: 'Valmo',
      marketplace: 'Meesho',
      status: 'pending',
      flagReason: 'Damaged',
      deadlineAt: 1730000000000 + 72 * 3600 * 1000,
      returnScanAt: 1730000000000,
      qty: 1,
      notes: '',
      disputeText: ''
    };

    await legacyDb.table('orders').add(sampleOrder);
    await legacyDb.table('claims').add(sampleClaim);
    await legacyDb.table('settings').put({ key: 'custom_warehouse', value: 'Bhiwandi Hub' });
    legacyDb.close();

    // Verify target db is currently empty
    expect(await db.orders.count()).toBe(0);
    expect(await db.claims.count()).toBe(0);

    // 2. Run migration
    const result = await migrateLegacyClaimproofDb();
    expect(result.migrated).toBe(true);
    expect(result.counts.orders).toBe(1);
    expect(result.counts.claims).toBe(1);

    // 3. Verify target saboot DB now contains the migrated records
    const migratedOrder = await db.orders.get(1);
    expect(migratedOrder).toBeDefined();
    expect(migratedOrder?.awb).toBe('MSH123456789');
    expect(migratedOrder?.sku).toBe('KURTI-RED-XL');

    const migratedClaim = await db.claims.get(1);
    expect(migratedClaim).toBeDefined();
    expect(migratedClaim?.awb).toBe('MSH123456789');
    expect(migratedClaim?.flagReason).toBe('Damaged');

    const setting = await db.settings.get('custom_warehouse');
    expect(setting?.value).toBe('Bhiwandi Hub');

    // Migration flag set
    expect(localStorage.getItem(BRAND.storageKeys.migratedFromClaimproof)).toBe('true');
  });

  it('is safe and idempotent when called multiple times', async () => {
    const result1 = await migrateLegacyClaimproofDb();
    expect(typeof result1.migrated).toBe('boolean');

    const result2 = await migrateLegacyClaimproofDb();
    expect(typeof result2.migrated).toBe('boolean');
  });
});

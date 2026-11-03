import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import 'fake-indexeddb/auto';
import { SabootDB } from '../db/schema';
import type { RecordingMeta, StoredOrder } from '../types';

describe('Dexie Schema V1 -> V2 Migration for Return Unboxing', () => {
  const TEST_DB_NAME = 'saboot_migration_test_db';

  beforeEach(async () => {
    await Dexie.delete(TEST_DB_NAME);
  });

  afterEach(async () => {
    await Dexie.delete(TEST_DB_NAME);
  });

  it('preserves all legacy records from V1 and supports new returnVideos & checklistResults tables in V2', async () => {
    // 1. Setup a legacy V1 database
    const v1Db = new Dexie(TEST_DB_NAME);
    v1Db.version(1).stores({
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

    await v1Db.open();

    // Insert legacy data into V1
    const legacyOrder: StoredOrder = {
      sourceFile: 'batch_legacy.pdf',
      page: 1,
      marketplace: 'Meesho',
      awb: 'AWB_LEGACY_123',
      orderId: 'ORD_LEGACY_999',
      courier: 'Delhivery',
      sku: 'SKU_KURTI_RED',
      size: 'XL',
      color: 'Red',
      qty: 1,
      invoiceTotal: 49900,
      contentBox: { x: 0, y: 0, w: 288, h: 432 },
      batchId: 'BATCH_1',
      createdAt: Date.now() - 500000
    };
    await v1Db.table('orders').add(legacyOrder);

    const legacyRecording: RecordingMeta = {
      awb: 'AWB_LEGACY_123',
      orderId: 'ORD_LEGACY_999',
      sku: 'SKU_KURTI_RED',
      size: 'XL',
      qty: 1,
      courier: 'Delhivery',
      marketplace: 'Meesho',
      type: 'dispatch',
      startedAt: Date.now() - 400000,
      endedAt: Date.now() - 370000,
      durationSec: 30,
      videoMime: 'video/webm',
      videoBytes: 4200000,
      photoBytes: 150000,
      photoCollage: true,
      vaultPath: '2026-11-03/Dispatch/AWB_LEGACY_123',
      demo: true,
      flagged: false
    };
    const dispatchId = await v1Db.table('recordings').add(legacyRecording);

    expect(await v1Db.table('orders').count()).toBe(1);
    expect(await v1Db.table('recordings').count()).toBe(1);

    v1Db.close();

    // 2. Open with SabootDB (which runs V1 then V2 migration)
    const v2Db = new SabootDB(TEST_DB_NAME);
    await v2Db.open();

    // 3. Assert all legacy data was preserved without corruption
    const migratedOrder = await v2Db.orders.where('awb').equals('AWB_LEGACY_123').first();
    expect(migratedOrder).toBeDefined();
    expect(migratedOrder?.sku).toBe('SKU_KURTI_RED');
    expect(migratedOrder?.marketplace).toBe('Meesho');

    const migratedRecording = await v2Db.recordings.where('awb').equals('AWB_LEGACY_123').first();
    expect(migratedRecording).toBeDefined();
    expect(migratedRecording?.type).toBe('dispatch');
    expect(migratedRecording?.durationSec).toBe(30);

    // 4. Assert new V2 tables exist and function correctly
    expect(v2Db.returnVideos).toBeDefined();
    expect(v2Db.checklistResults).toBeDefined();

    // Insert a return video linked to the legacy dispatch recording
    const returnVideoId = await v2Db.returnVideos.add({
      awb: 'AWB_LEGACY_123',
      orderId: 'ORD_LEGACY_999',
      sku: 'SKU_KURTI_RED',
      size: 'XL',
      qty: 1,
      courier: 'Delhivery',
      marketplace: 'Meesho',
      condition: 'wrong_item',
      startedAt: Date.now() - 200000,
      endedAt: Date.now() - 170000,
      durationSec: 30,
      videoMime: 'video/webm',
      videoBytes: 3900000,
      vaultPath: '2026-11-03/Return/AWB_LEGACY_123',
      linkedDispatchRecordingId: Number(dispatchId),
      partial: false,
      checklistCompletedCount: 6,
      checklistTotalCount: 6,
      demo: true
    });

    expect(returnVideoId).toBeGreaterThan(0);

    // Insert checklist result rows
    await v2Db.checklistResults.bulkAdd([
      {
        returnVideoId,
        awb: 'AWB_LEGACY_123',
        stepId: 'show_label',
        stepOrder: 1,
        title: 'Show sealed parcel & AWB',
        completed: true,
        completedAtOffsetSec: 3,
        timestamp: Date.now()
      },
      {
        returnVideoId,
        awb: 'AWB_LEGACY_123',
        stepId: 'show_six_sides',
        stepOrder: 2,
        title: 'Show all 6 sides of flyer',
        completed: true,
        completedAtOffsetSec: 8,
        timestamp: Date.now()
      }
    ]);

    const returnRec = await v2Db.returnVideos.where('awb').equals('AWB_LEGACY_123').first();
    expect(returnRec).toBeDefined();
    expect(returnRec?.condition).toBe('wrong_item');
    expect(returnRec?.linkedDispatchRecordingId).toBe(Number(dispatchId));

    const checkRows = await v2Db.checklistResults
      .where('returnVideoId')
      .equals(returnVideoId)
      .toArray();
    expect(checkRows).toHaveLength(2);
    expect(checkRows[0].stepId).toBe('show_label');
    expect(checkRows[0].completed).toBe(true);

    v2Db.close();
  });
});

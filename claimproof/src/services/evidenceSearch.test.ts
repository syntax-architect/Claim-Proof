import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/schema';
import { cleanSearchInput, checkRecordingFileState, searchUnifiedEvidence } from './evidenceSearch';
import type { RecordingMeta, StoredOrder } from '../types';

describe('Global Evidence Search Engine', () => {
  beforeEach(async () => {
    await db.recordings.clear();
    await db.orders.clear();
    await db.claims.clear();
    await db.media_cache.clear();
    await db.settings.clear();
  });

  describe('Input Normalization & Scanner Artifact Cleaning', () => {
    it('trims leading/trailing whitespace and tabs', () => {
      expect(cleanSearchInput('   AWB9876543210   \t')).toBe('AWB9876543210');
    });

    it('strips barcode laser scanner suffixes (\\r, \\n, carriage return bursts)', () => {
      const scannerStream = 'AWB1234567890\r\n';
      expect(cleanSearchInput(scannerStream)).toBe('AWB1234567890');
    });

    it('strips control characters and unprintable ASCII bytes', () => {
      const dirty = '\x02AWB555444333\x03\x1F';
      expect(cleanSearchInput(dirty)).toBe('AWB555444333');
    });

    it('returns empty string for null, empty or whitespace-only inputs', () => {
      expect(cleanSearchInput('')).toBe('');
      expect(cleanSearchInput('   \r\n  ')).toBe('');
    });
  });

  describe('Unified Evidence Search Aggregation & Matching', () => {
    it('finds records by prefix and partial matching across AWB, Order ID, and SKU', async () => {
      await db.recordings.add({
        awb: 'DELHIVERY98765',
        orderId: 'ORD-2026-999',
        sku: 'KURTI-CHANDERI-M',
        size: 'M',
        qty: 1,
        courier: 'Delhivery',
        marketplace: 'Meesho',
        type: 'dispatch',
        startedAt: 1730000000000,
        endedAt: 1730000030000,
        durationSec: 30,
        videoMime: 'video/webm',
        videoBytes: 1500000,
        photoBytes: 250000,
        photoCollage: true,
        vaultPath: '2026-10-27/Dispatch/DELHIVERY98765',
        demo: false,
        flagged: false
      });

      // 1. Exact AWB
      const r1 = await searchUnifiedEvidence('DELHIVERY98765');
      expect(r1.results).toHaveLength(1);
      expect(r1.results[0].awb).toBe('DELHIVERY98765');

      // 2. Prefix AWB (lowercase)
      const r2 = await searchUnifiedEvidence('delhivery98');
      expect(r2.results).toHaveLength(1);
      expect(r2.results[0].sku).toBe('KURTI-CHANDERI-M');

      // 3. Partial Order ID (with scanner trailing enter)
      const r3 = await searchUnifiedEvidence('2026-999\r\n');
      expect(r3.results).toHaveLength(1);
      expect(r3.results[0].orderId).toBe('ORD-2026-999');

      // 4. Partial SKU
      const r4 = await searchUnifiedEvidence('CHANDERI');
      expect(r4.results).toHaveLength(1);
      expect(r4.results[0].sku).toBe('KURTI-CHANDERI-M');
    });

    it('aggregates dispatch video, return video, and ClaimRadar claim into a single dossier', async () => {
      const awb = 'AWB-UNIFIED-1234';

      // Dispatch recording
      await db.recordings.add({
        awb,
        orderId: 'ORD-101',
        sku: 'SAREE-SILK-RED',
        size: 'Free',
        qty: 1,
        courier: 'Shadowfax',
        marketplace: 'Flipkart',
        type: 'dispatch',
        startedAt: 1730000000000,
        endedAt: 1730000045000,
        durationSec: 45,
        videoMime: 'video/webm',
        videoBytes: 2000000,
        photoBytes: 300000,
        photoCollage: true,
        vaultPath: `2026-10-27/Dispatch/${awb}`,
        demo: false,
        flagged: false
      });

      // Return recording
      await db.recordings.add({
        awb,
        orderId: 'ORD-101',
        sku: 'SAREE-SILK-RED',
        size: 'Free',
        qty: 1,
        courier: 'Shadowfax',
        marketplace: 'Flipkart',
        type: 'return',
        startedAt: 1730100000000,
        endedAt: 1730100060000,
        durationSec: 60,
        videoMime: 'video/webm',
        videoBytes: 3000000,
        photoBytes: 400000,
        photoCollage: true,
        vaultPath: `2026-10-28/Return/${awb}`,
        demo: false,
        flagged: true
      });

      // Claim in ClaimRadar
      await db.claims.add({
        awb,
        orderId: 'ORD-101',
        marketplace: 'Flipkart',
        courier: 'Shadowfax',
        sku: 'SAREE-SILK-RED',
        qty: 1,
        flagReason: 'Wrong/Swapped item',
        notes: 'Customer returned cheap polyester cloth instead of silk saree',
        returnScanAt: 1730100000000,
        deadlineAt: 1730100000000 + 72 * 3600 * 1000,
        status: 'pending'
      });

      const res = await searchUnifiedEvidence(awb);
      expect(res.results).toHaveLength(1);

      const dossier = res.results[0];
      expect(dossier.awb).toBe(awb);
      expect(dossier.dispatchRecording?.type).toBe('dispatch');
      expect(dossier.returnRecording?.type).toBe('return');
      expect(dossier.hasPhotoCollage).toBe(true);
      expect(dossier.claim?.flagReason).toBe('Wrong/Swapped item');
      expect(dossier.claim?.status).toBe('pending');
    });

    it('handles return-only edge case (no dispatch video recorded)', async () => {
      const returnOnlyAwb = 'AWB-RETURN-ONLY-999';

      await db.recordings.add({
        awb: returnOnlyAwb,
        orderId: 'ORD-RET-999',
        sku: 'SHOES-SPORT-9',
        size: '9',
        qty: 1,
        courier: 'Xpressbees',
        marketplace: 'Amazon',
        type: 'return',
        startedAt: 1730200000000,
        endedAt: 1730200040000,
        durationSec: 40,
        videoMime: 'video/webm',
        videoBytes: 1800000,
        photoBytes: 0,
        photoCollage: false,
        vaultPath: `2026-10-29/Return/${returnOnlyAwb}`,
        demo: false,
        flagged: true
      });

      const res = await searchUnifiedEvidence(returnOnlyAwb);
      expect(res.results).toHaveLength(1);

      const dossier = res.results[0];
      expect(dossier.dispatchRecording).toBeUndefined();
      expect(dossier.dispatchStatus).toBe('not_recorded');
      expect(dossier.returnRecording).toBeDefined();
      expect(dossier.returnRecording?.type).toBe('return');
    });

    it('handles duplicate recordings for the same AWB gracefully', async () => {
      const dupAwb = 'AWB-DUP-RETRY-01';

      // First dispatch attempt (e.g. stopped early)
      await db.recordings.add({
        awb: dupAwb,
        orderId: 'ORD-DUP',
        sku: 'JEANS-32',
        size: '32',
        qty: 1,
        courier: 'Valmo',
        marketplace: 'Meesho',
        type: 'dispatch',
        startedAt: 1730000000000,
        endedAt: 1730000010000,
        durationSec: 10,
        videoMime: 'video/webm',
        videoBytes: 500000,
        photoBytes: 0,
        photoCollage: false,
        vaultPath: `2026-10-27/Dispatch/${dupAwb}`,
        demo: false,
        flagged: false
      });

      // Second dispatch attempt (final good recording)
      await db.recordings.add({
        awb: dupAwb,
        orderId: 'ORD-DUP',
        sku: 'JEANS-32',
        size: '32',
        qty: 1,
        courier: 'Valmo',
        marketplace: 'Meesho',
        type: 'dispatch',
        startedAt: 1730000100000,
        endedAt: 1730000140000,
        durationSec: 40,
        videoMime: 'video/webm',
        videoBytes: 2500000,
        photoBytes: 150000,
        photoCollage: true,
        vaultPath: `2026-10-27/Dispatch/${dupAwb}`,
        demo: false,
        flagged: false
      });

      const res = await searchUnifiedEvidence(dupAwb);
      expect(res.results).toHaveLength(1);

      const dossier = res.results[0];
      // Primary dispatch recording is the newest one (startedAt: 1730000100000)
      expect(dossier.dispatchRecording?.durationSec).toBe(40);
      // Older attempt is in otherRecordings
      expect(dossier.otherRecordings).toHaveLength(1);
      expect(dossier.otherRecordings[0].durationSec).toBe(10);
    });

    it('detects missing files when vault is disconnected and file not in cache', async () => {
      const recId = (await db.recordings.add({
        awb: 'AWB-MISSING-FILE',
        orderId: 'ORD-MISS',
        sku: 'WATCH-GOLD',
        size: 'Free',
        qty: 1,
        courier: 'Ekart',
        marketplace: 'Flipkart',
        type: 'dispatch',
        startedAt: 1730000000000,
        endedAt: 1730000020000,
        durationSec: 20,
        videoMime: 'video/webm',
        videoBytes: 1000000,
        photoBytes: 0,
        photoCollage: false,
        vaultPath: '2026-10-27/Dispatch/AWB-MISSING-FILE',
        demo: false,
        flagged: false
      })) as number;

      const rec = await db.recordings.get(recId);
      const state = await checkRecordingFileState(rec);
      expect(state).toBe('missing_file');
    });

    it('paginates large result sets accurately', async () => {
      // Add 25 orders with the same SKU
      const batch: StoredOrder[] = [];
      for (let i = 1; i <= 25; i++) {
        batch.push({
          sourceFile: 'batch.pdf',
          page: i,
          marketplace: 'Meesho',
          awb: `AWB-BATCH-${String(i).padStart(3, '0')}`,
          orderId: `ORD-BATCH-${i}`,
          courier: 'Delhivery',
          sku: 'COMMON-SKU-99',
          size: 'M',
          color: 'Blue',
          qty: 1,
          invoiceTotal: 499,
          contentBox: { x: 0, y: 0, w: 288, h: 432 },
          batchId: 'batch-1',
          createdAt: 1730000000000 + i
        });
      }
      await db.orders.bulkAdd(batch);

      // Page 1 (10 per page)
      const p1 = await searchUnifiedEvidence('COMMON-SKU-99', { page: 1, pageSize: 10 });
      expect(p1.total).toBe(25);
      expect(p1.totalPages).toBe(3);
      expect(p1.page).toBe(1);
      expect(p1.results).toHaveLength(10);

      // Page 2
      const p2 = await searchUnifiedEvidence('COMMON-SKU-99', { page: 2, pageSize: 10 });
      expect(p2.page).toBe(2);
      expect(p2.results).toHaveLength(10);

      // Page 3
      const p3 = await searchUnifiedEvidence('COMMON-SKU-99', { page: 3, pageSize: 10 });
      expect(p3.page).toBe(3);
      expect(p3.results).toHaveLength(5);
    });
  });

  describe('Performance Benchmark — 10,000 Records SLA Guard', () => {
    it('executes search across 10,000 records in under 200 ms', async () => {
      // Generate 10,000 realistic recordings in IndexedDB
      const count = 10000;
      const records: RecordingMeta[] = new Array(count);
      const baseTime = 1730000000000;

      for (let i = 0; i < count; i++) {
        records[i] = {
          awb: `AWB${1000000000 + i}`,
          orderId: `ORD-${20000000 + i}`,
          sku: i === 7777 ? 'TARGET-SPECIAL-SKU-7777' : `SKU-ITEM-${i % 250}`,
          size: 'Free',
          qty: 1,
          courier: i % 2 === 0 ? 'Delhivery' : 'Valmo',
          marketplace: i % 3 === 0 ? 'Meesho' : 'Flipkart',
          type: i % 10 === 0 ? 'return' : 'dispatch',
          startedAt: baseTime + i * 1000,
          endedAt: baseTime + i * 1000 + 30000,
          durationSec: 30,
          videoMime: 'video/webm',
          videoBytes: 1500000,
          photoBytes: 0,
          photoCollage: false,
          vaultPath: `2026-10-27/Dispatch/AWB${1000000000 + i}`,
          demo: false,
          flagged: false
        };
      }

      await db.recordings.bulkAdd(records);

      // Benchmark search for target SKU
      const start = performance.now();
      const res = await searchUnifiedEvidence('TARGET-SPECIAL-SKU-7777');
      const duration = performance.now() - start;

      expect(res.results).toHaveLength(1);
      expect(res.results[0].sku).toBe('TARGET-SPECIAL-SKU-7777');
      expect(res.results[0].awb).toBe(`AWB${1000000000 + 7777}`);

      // Hard SLA check: must be under 200ms
      expect(duration).toBeLessThan(200);
      expect(res.latencyMs).toBeLessThan(200);
    });
  });
});

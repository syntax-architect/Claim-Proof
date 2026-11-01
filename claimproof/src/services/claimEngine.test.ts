import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/schema';
import {
  deleteClaim,
  findDispatchEvidence,
  findReturnEvidence,
  generateDisputeText,
  saveDisputeText,
  updateClaimStatus
} from './claimEngine';
import type { ClaimItem, RecordingMeta } from '../types';

describe('claimEngine — evidence pairing & dispute generation', () => {
  const baseTime = 1730000000000;

  beforeEach(async () => {
    await db.claims.clear();
    await db.recordings.clear();
  });

  describe('Finding dispatch and return video evidence', () => {
    it('matches dispatch packing clip for matching AWB recorded within 10 days before return', async () => {
      const dispatchId = await db.recordings.add({
        awb: 'DELHIVERY1001',
        orderId: 'ORD-1001',
        sku: 'SAREE-RED',
        size: 'Free',
        qty: 1,
        courier: 'Delhivery',
        marketplace: 'Meesho',
        type: 'dispatch',
        startedAt: baseTime - 2 * 24 * 3600 * 1000, // 2 days before return
        endedAt: baseTime - 2 * 24 * 3600 * 1000 + 30000,
        durationSec: 30,
        videoMime: 'video/mp4',
        videoBytes: 4500000,
        photoBytes: 500000,
        photoCollage: true,
        vaultPath: '2026-10-25/Dispatch/DELHIVERY1001',
        demo: false,
        flagged: false
      });

      const claim: ClaimItem = {
        id: 1,
        awb: 'DELHIVERY1001',
        orderId: 'ORD-1001',
        marketplace: 'Meesho',
        courier: 'Delhivery',
        sku: 'SAREE-RED',
        qty: 1,
        flagReason: 'Wrong/Swapped item',
        notes: '',
        returnScanAt: baseTime,
        deadlineAt: baseTime + 72 * 3600 * 1000,
        status: 'pending',
        disputeText: ''
      };

      const found = await findDispatchEvidence(claim);
      expect(found).toBeDefined();
      expect(found?.id).toBe(dispatchId);
      expect(found?.type).toBe('dispatch');
    });

    it('falls back to matching by Order ID if AWB was re-labeled', async () => {
      const dispatchId = await db.recordings.add({
        awb: 'ORIGINAL-AWB-99',
        orderId: 'ORD-SHARED-123',
        sku: 'KURTI-M',
        size: 'M',
        qty: 1,
        courier: 'Ekart',
        marketplace: 'Flipkart',
        type: 'dispatch',
        startedAt: baseTime - 3 * 24 * 3600 * 1000,
        endedAt: baseTime - 3 * 24 * 3600 * 1000 + 20000,
        durationSec: 20,
        videoMime: 'video/mp4',
        videoBytes: 3000000,
        photoBytes: 400000,
        photoCollage: true,
        vaultPath: '2026-10-24/Dispatch/ORIGINAL-AWB-99',
        demo: false,
        flagged: false
      });

      const claim: ClaimItem = {
        id: 2,
        awb: 'RETURN-RTO-AWB-88',
        orderId: 'ORD-SHARED-123',
        marketplace: 'Flipkart',
        courier: 'Ekart',
        sku: 'KURTI-M',
        qty: 1,
        flagReason: 'Damaged',
        notes: '',
        returnScanAt: baseTime,
        deadlineAt: baseTime + 336 * 3600 * 1000,
        status: 'pending',
        disputeText: ''
      };

      const found = await findDispatchEvidence(claim);
      expect(found).toBeDefined();
      expect(found?.id).toBe(dispatchId);
    });

    it('matches return unboxing recording for the claim', async () => {
      const returnId = await db.recordings.add({
        awb: 'AMZN-AWB-001',
        orderId: 'ORD-AMZ-001',
        sku: 'WATCH-BLACK',
        size: '',
        qty: 1,
        courier: 'Delhivery',
        marketplace: 'Amazon',
        type: 'return',
        startedAt: baseTime - 10000,
        endedAt: baseTime,
        durationSec: 10,
        videoMime: 'video/mp4',
        videoBytes: 1500000,
        photoBytes: 300000,
        photoCollage: true,
        vaultPath: '2026-10-27/Return/AMZN-AWB-001',
        demo: false,
        flagged: true
      });

      const claim: ClaimItem = {
        id: 3,
        awb: 'AMZN-AWB-001',
        orderId: 'ORD-AMZ-001',
        marketplace: 'Amazon',
        courier: 'Delhivery',
        sku: 'WATCH-BLACK',
        qty: 1,
        flagReason: 'Empty package',
        notes: 'Box delivered empty with seals broken',
        returnScanAt: baseTime,
        deadlineAt: baseTime + 720 * 3600 * 1000,
        status: 'pending',
        disputeText: '',
        returnRecordingId: returnId
      };

      const found = await findReturnEvidence(claim);
      expect(found).toBeDefined();
      expect(found?.id).toBe(returnId);
      expect(found?.type).toBe('return');
    });
  });

  describe('Claim CRUD helpers', () => {
    it('updates claim status, saves dispute text, and deletes claims', async () => {
      const id = await db.claims.add({
        awb: 'AWB-TEST-CRUD',
        orderId: 'ORD-TEST-CRUD',
        marketplace: 'Meesho',
        courier: 'Shadowfax',
        sku: 'JEANS-32',
        qty: 1,
        flagReason: 'Used/Worn',
        notes: '',
        returnScanAt: baseTime,
        deadlineAt: baseTime + 72 * 3600 * 1000,
        status: 'pending',
        disputeText: ''
      });

      await updateClaimStatus(id, 'prepared');
      let row = await db.claims.get(id);
      expect(row?.status).toBe('prepared');

      await saveDisputeText(id, 'Custom seller dispute text submitted via ticket #12345');
      row = await db.claims.get(id);
      expect(row?.disputeText).toContain('ticket #12345');

      await deleteClaim(id);
      row = await db.claims.get(id);
      expect(row).toBeUndefined();
    });
  });

  describe('generateDisputeText', () => {
    const mockDispatch: RecordingMeta = {
      id: 10,
      awb: 'MEESHO-12345',
      orderId: 'ORD-98765',
      sku: 'LEHENGA-GOLD',
      size: 'XL',
      qty: 1,
      courier: 'Valmo',
      marketplace: 'Meesho',
      type: 'dispatch',
      startedAt: baseTime - 48 * 3600 * 1000,
      endedAt: baseTime - 48 * 3600 * 1000 + 25000,
      durationSec: 25,
      videoMime: 'video/mp4',
      videoBytes: 3500000,
      photoBytes: 450000,
      photoCollage: true,
      vaultPath: '2026-10-25/Dispatch/MEESHO-12345',
      demo: false,
      flagged: false
    };

    const mockReturn: RecordingMeta = {
      id: 11,
      awb: 'MEESHO-12345',
      orderId: 'ORD-98765',
      sku: 'LEHENGA-GOLD',
      size: 'XL',
      qty: 1,
      courier: 'Valmo',
      marketplace: 'Meesho',
      type: 'return',
      startedAt: baseTime,
      endedAt: baseTime + 18000,
      durationSec: 18,
      videoMime: 'video/mp4',
      videoBytes: 2500000,
      photoBytes: 400000,
      photoCollage: true,
      vaultPath: '2026-10-27/Return/MEESHO-12345',
      demo: false,
      flagged: true
    };

    it('generates Meesho SAFE-P claim format', () => {
      const claim: ClaimItem = {
        awb: 'MEESHO-12345',
        orderId: 'ORD-98765',
        marketplace: 'Meesho',
        courier: 'Valmo',
        sku: 'LEHENGA-GOLD',
        qty: 1,
        flagReason: 'Wrong/Swapped item',
        notes: 'Customer returned old rags instead of lehenga',
        returnScanAt: baseTime,
        deadlineAt: baseTime + 72 * 3600 * 1000,
        status: 'pending',
        disputeText: ''
      };

      const text = generateDisputeText(claim, mockDispatch, mockReturn);
      expect(text).toContain('Meesho SAFE-P claim');
      expect(text).toContain('MEESHO-12345');
      expect(text).toContain('LEHENGA-GOLD (Qty 1)');
      expect(text).toContain('Dispatch packing video: UNCUT video (25s');
      expect(text).toContain('Return unboxing video: UNCUT video (18s');
      expect(text).toContain('Wrong/Swapped item');
      expect(text).toContain('Customer returned old rags instead of lehenga');
      expect(text).toContain('Meesho SAFE · 72 hours');
    });

    it('generates Flipkart SPF format', () => {
      const claim: ClaimItem = {
        awb: 'FK-AWB-001',
        orderId: 'OD-FK-001',
        marketplace: 'Flipkart',
        courier: 'Ekart',
        sku: 'SHOE-9',
        qty: 2,
        flagReason: 'Damaged',
        notes: '',
        returnScanAt: baseTime,
        deadlineAt: baseTime + 336 * 3600 * 1000,
        status: 'pending',
        disputeText: ''
      };

      const text = generateDisputeText(claim, undefined, mockReturn);
      expect(text).toContain('Flipkart SPF return dispute');
      expect(text).toContain('Dispatch packing video: not available for this parcel.');
      expect(text).toContain('Flipkart SPF · 14 days');
    });

    it('generates Amazon SAFE-T format', () => {
      const claim: ClaimItem = {
        awb: 'AZ-AWB-002',
        orderId: '404-0000000-0000001',
        marketplace: 'Amazon',
        courier: 'Delhivery',
        sku: 'CAMERA-LENS',
        qty: 1,
        flagReason: 'Missing item',
        notes: '',
        returnScanAt: baseTime,
        deadlineAt: baseTime + 720 * 3600 * 1000,
        status: 'pending',
        disputeText: ''
      };

      const text = generateDisputeText(claim, mockDispatch, undefined);
      expect(text).toContain('Amazon SAFE-T claim');
      expect(text).toContain('Return unboxing video: not available for this parcel.');
      expect(text).toContain('Amazon SAFE-T · 30 days');
    });
  });
});

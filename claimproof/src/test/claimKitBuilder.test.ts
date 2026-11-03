import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/schema';
import { createClaimKit, getUniqueKitDirectoryHandle } from '../services/claimKitBuilder';

describe('ClaimKitBuilder Service', () => {
  beforeEach(async () => {
    await db.recordings.clear();
    await db.claims.clear();
    await db.media_cache.clear();
    await db.checklistResults.clear();
  });

  afterEach(async () => {
    await db.recordings.clear();
    await db.claims.clear();
    await db.media_cache.clear();
    await db.checklistResults.clear();
  });

  it('generates a complete ZIP claim kit with videos, stills, PDF, and dispute text', async () => {
    const awb = 'AWB_KIT_TEST_1001';

    // Seed Dispatch Recording
    await db.recordings.add({
      awb,
      orderId: 'ORD_1001',
      sku: 'SKU_JEANS_32',
      size: '32',
      qty: 1,
      courier: 'Delhivery',
      marketplace: 'Meesho',
      type: 'dispatch',
      startedAt: Date.now() - 3600000,
      endedAt: Date.now() - 3570000,
      durationSec: 30,
      videoMime: 'video/mp4',
      videoBytes: 3_000_000,
      photoBytes: 150_000,
      photoCollage: true,
      vaultPath: `2026-11-03/Dispatch/${awb}`,
      demo: true,
      flagged: false
    });

    // Seed Claim
    await db.claims.add({
      awb,
      orderId: 'ORD_1001',
      marketplace: 'Meesho',
      courier: 'Delhivery',
      sku: 'SKU_JEANS_32',
      qty: 1,
      flagReason: 'Wrong/Swapped item',
      notes: 'Customer returned old rags instead of jeans',
      returnScanAt: Date.now() - 100000,
      deadlineAt: Date.now() + 72 * 3600 * 1000,
      status: 'pending',
      disputeText: ''
    });

    const result = await createClaimKit({
      awb,
      destination: 'zip'
    });

    expect(result.success).toBe(true);
    expect(result.mode).toBe('zip');
    expect(result.zipBlob).toBeDefined();
    expect(result.zipBlob!.size).toBeGreaterThan(100);

    // Verify packaged file inventory
    expect(result.filesCreated.some((f) => f.startsWith(`Dispatch_Video_${awb}`))).toBe(true);
    expect(result.filesCreated).toContain(`Claim_Summary_${awb}.pdf`);
    expect(result.filesCreated).toContain(`Dispute_Letter_${awb}.txt`);

    // Verify key frame stills were extracted
    const keyFrames = result.filesCreated.filter((f) => f.startsWith('Key_Frames/'));
    expect(keyFrames.length).toBeGreaterThan(0);

    // Verify claim database record updated
    const updatedClaim = await db.claims.where('awb').equals(awb).first();
    expect(updatedClaim?.claimKitGeneratedAt).toBeGreaterThan(0);
    expect(updatedClaim?.status).toBe('prepared');
  });

  it('handles missing return video gracefully with an informative warning', async () => {
    const awb = 'AWB_NO_RETURN_TEST_2002';

    await db.recordings.add({
      awb,
      orderId: 'ORD_2002',
      sku: 'SKU_TSHIRT_M',
      size: 'M',
      qty: 1,
      courier: 'Delhivery',
      marketplace: 'Flipkart',
      type: 'dispatch',
      startedAt: Date.now() - 4000000,
      endedAt: Date.now() - 3970000,
      durationSec: 30,
      videoMime: 'video/mp4',
      videoBytes: 2_500_000,
      photoBytes: 120_000,
      photoCollage: true,
      vaultPath: `2026-11-03/Dispatch/${awb}`,
      demo: true,
      flagged: false
    });

    const result = await createClaimKit({
      awb,
      destination: 'zip'
    });

    expect(result.success).toBe(true);
    // Must contain warning about missing return video
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('Return unboxing video was not recorded');
    expect(result.filesCreated.some((f) => f.startsWith(`Dispatch_Video_${awb}`))).toBe(true);
  });

  it('cancels kit generation cleanly when AbortSignal is triggered', async () => {
    const awb = 'AWB_CANCEL_TEST_3003';
    const controller = new AbortController();
    controller.abort(); // already aborted

    await expect(
      createClaimKit({
        awb,
        destination: 'zip',
        signal: controller.signal
      })
    ).rejects.toThrow();
  });

  it('handles name collisions in directory handles by appending (1), (2)', async () => {
    const existingDirs = new Set<string>(['ClaimKit_AWB_COLLISION', 'ClaimKit_AWB_COLLISION (1)']);

    // Mock FileSystemDirectoryHandle
    const mockParent = {
      getDirectoryHandle: async (name: string, opts?: { create?: boolean }) => {
        if (!opts?.create && existingDirs.has(name)) {
          return {} as FileSystemDirectoryHandle;
        }
        if (!opts?.create && !existingDirs.has(name)) {
          throw new Error('NotFoundError');
        }
        return { name } as unknown as FileSystemDirectoryHandle;
      }
    } as unknown as FileSystemDirectoryHandle;

    const res = await getUniqueKitDirectoryHandle(mockParent, 'ClaimKit_AWB_COLLISION');
    expect(res.folderName).toBe('ClaimKit_AWB_COLLISION (2)');
  });
});

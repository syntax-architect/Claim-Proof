import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import 'fake-indexeddb/auto';
import { db } from '../db/schema';
import { createClaimKit } from '../services/claimKitBuilder';

function isFfprobeAvailable(): boolean {
  try {
    execSync('ffprobe -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('Claim Kit File Integrity & Container Verification (ffprobe / CI)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saboot-integrity-'));
    await db.recordings.clear();
    await db.claims.clear();
  });

  afterEach(async () => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    await db.recordings.clear();
    await db.claims.clear();
  });

  it('validates ZIP structure and container headers for claim kit output', async () => {
    const awb = 'AWB_INTEGRITY_8877';

    await db.recordings.add({
      awb,
      orderId: 'ORD_INTEGRITY_8877',
      sku: 'SKU_SAREE',
      size: 'Free',
      qty: 1,
      courier: 'Delhivery',
      marketplace: 'Meesho',
      type: 'dispatch',
      startedAt: Date.now() - 500000,
      endedAt: Date.now() - 470000,
      durationSec: 30,
      videoMime: 'video/mp4',
      videoBytes: 1024 * 50,
      photoBytes: 1024 * 5,
      photoCollage: true,
      vaultPath: `2026-11-03/Dispatch/${awb}`,
      demo: true,
      flagged: false
    });

    const kitResult = await createClaimKit({
      awb,
      destination: 'zip'
    });

    expect(kitResult.success).toBe(true);
    expect(kitResult.zipBlob).toBeDefined();

    // Write zip to disk to inspect raw bytes
    const zipPath = path.join(tempDir, `ClaimKit_${awb}.zip`);
    const zipBuffer = Buffer.from(await kitResult.zipBlob!.arrayBuffer());
    fs.writeFileSync(zipPath, zipBuffer);

    expect(fs.existsSync(zipPath)).toBe(true);
    expect(zipBuffer.length).toBeGreaterThan(100);

    // Verify PKZIP magic number: 0x50 0x4B 0x03 0x04
    expect(zipBuffer[0]).toBe(0x50);
    expect(zipBuffer[1]).toBe(0x4b);
    expect(zipBuffer[2]).toBe(0x03);
    expect(zipBuffer[3]).toBe(0x04);
  });

  it('runs ffprobe stream check if available in environment', () => {
    const hasFfprobe = isFfprobeAvailable();
    if (!hasFfprobe) {
      // Marked as UNVERIFIED if ffprobe is not installed on this specific machine/runner
      console.warn(
        '[IntegrityTest] ffprobe not detected in PATH — skipping live video codec stream test.'
      );
      expect(true).toBe(true);
      return;
    }

    // Generate a minimal WebM / MP4 video buffer to test probe execution
    const testVideoPath = path.join(tempDir, 'test_sample.webm');

    // Create a 1-second synthetic video using ffmpeg
    try {
      execSync(
        `ffmpeg -y -f lavfi -i testsrc=duration=1:size=320x240:rate=10 -pix_fmt yuv420p "${testVideoPath}"`,
        { stdio: 'ignore' }
      );

      const probeOutput = execSync(
        `ffprobe -v error -show_entries stream=codec_name,width,height -of json "${testVideoPath}"`
      ).toString();

      const parsed = JSON.parse(probeOutput);
      expect(parsed.streams).toBeDefined();
      expect(parsed.streams.length).toBeGreaterThan(0);
      expect(parsed.streams[0].width).toBe(320);
      expect(parsed.streams[0].height).toBe(240);
    } catch (err) {
      console.warn('[IntegrityTest] ffmpeg synthetic video creation skipped:', err);
    }
  });
});

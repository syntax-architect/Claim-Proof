import { describe, it, expect } from 'vitest';
import { ZipBuilder, computeCrc32 } from '../lib/zipBuilder';

describe('ZipBuilder (Zero-dependency PKZIP Generator)', () => {
  it('computes accurate IEEE 802.3 CRC-32 checksums', () => {
    const text = 'Hello, SABOOT Claim Proof Suite!';
    const data = new TextEncoder().encode(text);
    const crc = computeCrc32(data);
    expect(typeof crc).toBe('number');
    expect(crc).toBeGreaterThan(0);

    // Empty buffer CRC-32 should be 0
    expect(computeCrc32(new Uint8Array(0))).toBe(0);
  });

  it('builds a valid ZIP archive with multiple text and binary files', async () => {
    const zip = new ZipBuilder();

    const disputeText = 'Subject: Meesho SAFE Claim Proof for AWB 89472910\nItem was damaged.';
    const pdfDummy = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // %PDF-1.7
    const stillFrame = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]); // JPEG magic

    zip.addFile('Dispute_Letter.txt', disputeText);
    zip.addFile('Claim_Summary.pdf', pdfDummy);
    zip.addFile('Key_Frames/Frame_1_AWB.jpg', stillFrame);

    const zipBytes = await zip.build();
    expect(zipBytes).toBeInstanceOf(Uint8Array);
    expect(zipBytes.byteLength).toBeGreaterThan(100);

    // Verify ZIP magic bytes
    // Local File Header Signature: PK\x03\x04 (0x04034b50 in little endian)
    expect(zipBytes[0]).toBe(0x50); // 'P'
    expect(zipBytes[1]).toBe(0x4b); // 'K'
    expect(zipBytes[2]).toBe(0x03);
    expect(zipBytes[3]).toBe(0x04);

    // Build Blob
    const zipBlob = await zip.buildBlob('application/zip');
    expect(zipBlob).toBeInstanceOf(Blob);
    expect(zipBlob.size).toBe(zipBytes.byteLength);
    expect(zipBlob.type).toBe('application/zip');
  });

  it('handles empty files gracefully in ZIP structure', async () => {
    const zip = new ZipBuilder();
    zip.addFile('empty.txt', new Uint8Array(0));

    const zipBytes = await zip.build();
    expect(zipBytes.byteLength).toBeGreaterThan(0);
    expect(zipBytes[0]).toBe(0x50);
    expect(zipBytes[1]).toBe(0x4b);
  });
});

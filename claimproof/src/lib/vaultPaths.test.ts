import { describe, expect, it } from 'vitest';
import {
  photoCollageFileName,
  sanitizeAwb,
  vaultSubPath,
  vaultTypeFolder,
  videoExtForMime,
  videoFileName
} from './vaultPaths';

describe('vaultPaths helpers', () => {
  describe('sanitizeAwb', () => {
    it('strips illegal path characters, spaces, and path traversal attempts', () => {
      expect(sanitizeAwb('DELHIVERY/1234..\\5678')).toBe('DELHIVERY12345678');
      expect(sanitizeAwb('AWB 123 @#$ 456')).toBe('AWB123456');
      expect(sanitizeAwb('awb_123-abc')).toBe('awb_123-abc');
    });

    it('limits length to 40 characters', () => {
      const longAwb = 'A'.repeat(60);
      expect(sanitizeAwb(longAwb)).toHaveLength(40);
    });

    it('falls back to UNKNOWN_AWB when input has no alphanumeric characters', () => {
      expect(sanitizeAwb('')).toBe('UNKNOWN_AWB');
      expect(sanitizeAwb('   !@#$%^   ')).toBe('UNKNOWN_AWB');
    });
  });

  describe('vaultTypeFolder', () => {
    it('returns Return for return type and Dispatch for dispatch type', () => {
      expect(vaultTypeFolder('return')).toBe('Return');
      expect(vaultTypeFolder('dispatch')).toBe('Dispatch');
    });
  });

  describe('videoExtForMime', () => {
    it('returns mp4 for mp4 mime types and webm for others', () => {
      expect(videoExtForMime('video/mp4')).toBe('mp4');
      expect(videoExtForMime('video/mp4;codecs="avc1.42E01E"')).toBe('mp4');
      expect(videoExtForMime('video/webm')).toBe('webm');
      expect(videoExtForMime('video/webm;codecs=vp9')).toBe('webm');
    });
  });

  describe('videoFileName & photoCollageFileName', () => {
    it('generates standard video file names with sanitized AWB', () => {
      expect(videoFileName('AWB/123', 'video/mp4')).toBe('AWB123_Video.mp4');
      expect(videoFileName('AWB-456', 'video/webm')).toBe('AWB-456_Video.webm');
    });

    it('generates 2x2 collage JPEG file name with sanitized AWB', () => {
      expect(photoCollageFileName('AWB/123')).toBe('AWB123_Photo_Collage.jpg');
      expect(photoCollageFileName('MYN_9988')).toBe('MYN_9988_Photo_Collage.jpg');
    });
  });

  describe('vaultSubPath', () => {
    it('constructs dated folder hierarchy YYYY-MM-DD/Dispatch|Return/AWB in IST', () => {
      // 2026-10-31 16:00:00 IST = 2026-10-31 10:30:00 UTC
      const startedAt = new Date('2026-10-31T10:30:00Z').getTime();

      const dispatchPath = vaultSubPath('dispatch', startedAt, 'DELHIVERY123');
      expect(dispatchPath).toBe('2026-10-31/Dispatch/DELHIVERY123');

      const returnPath = vaultSubPath('return', startedAt, 'EKART/987..65');
      expect(returnPath).toBe('2026-10-31/Return/EKART98765');
    });
  });
});

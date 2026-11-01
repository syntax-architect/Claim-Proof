import { describe, expect, it, vi } from 'vitest';
import { saveRecordingFiles, type SaveRecordingInput } from './vaultWriter';
import * as schema from '../db/schema';
import * as utils from '../lib/utils';

describe('vaultWriter real-world failure mode handling', () => {
  const dummyInput: SaveRecordingInput = {
    awb: 'AWBTEST12345',
    type: 'dispatch',
    startedAt: 1700000000000,
    video: new Blob(['fake video'], { type: 'video/mp4' }),
    videoMime: 'video/mp4',
    photo: null
  };

  it('handles vault unavailable by falling back to Downloads with vault_unavailable', async () => {
    vi.spyOn(schema, 'getSetting').mockResolvedValue(null);
    const downloadSpy = vi.spyOn(utils, 'downloadBlob').mockImplementation(() => {});

    const result = await saveRecordingFiles(dummyInput);

    expect(result.mode).toBe('downloads');
    expect(result.errorReason).toBe('vault_unavailable');
    expect(downloadSpy).toHaveBeenCalledWith(dummyInput.video, 'AWBTEST12345_Video.mp4');
  });

  it('handles revoked vault permissions by classifying as permission_revoked', async () => {
    const mockRootHandle = {
      queryPermission: vi.fn().mockResolvedValue('denied'),
      requestPermission: vi.fn().mockResolvedValue('denied'),
      getDirectoryHandle: vi.fn()
    };
    vi.spyOn(schema, 'getSetting').mockResolvedValue(mockRootHandle);
    vi.spyOn(utils, 'downloadBlob').mockImplementation(() => {});

    const result = await saveRecordingFiles(dummyInput);

    expect(result.mode).toBe('downloads');
    expect(result.errorReason).toBe('vault_unavailable');
  });

  it('handles disk full (QuotaExceededError) during file write', async () => {
    const mockWriter = {
      write: vi
        .fn()
        .mockRejectedValue(new DOMException('The quota has been exceeded.', 'QuotaExceededError')),
      close: vi.fn()
    };
    const mockFileHandle = {
      createWritable: vi.fn().mockResolvedValue(mockWriter)
    };
    const mockDirHandle = {
      getDirectoryHandle: vi.fn().mockReturnThis(),
      getFileHandle: vi.fn().mockResolvedValue(mockFileHandle)
    };
    const mockRootHandle = {
      queryPermission: vi.fn().mockResolvedValue('granted'),
      getDirectoryHandle: vi.fn().mockResolvedValue(mockDirHandle)
    };

    vi.spyOn(schema, 'getSetting').mockResolvedValue(mockRootHandle);
    vi.spyOn(utils, 'downloadBlob').mockImplementation(() => {});

    const result = await saveRecordingFiles(dummyInput);

    expect(result.mode).toBe('downloads');
    expect(result.errorReason).toBe('disk_full');
  });

  it('handles permission denied during directory write as permission_revoked', async () => {
    const mockRootHandle = {
      queryPermission: vi.fn().mockResolvedValue('granted'),
      getDirectoryHandle: vi
        .fn()
        .mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'))
    };

    vi.spyOn(schema, 'getSetting').mockResolvedValue(mockRootHandle);
    vi.spyOn(utils, 'downloadBlob').mockImplementation(() => {});

    const result = await saveRecordingFiles(dummyInput);

    expect(result.mode).toBe('downloads');
    expect(result.errorReason).toBe('permission_revoked');
  });
});

/* On-disk evidence vault — File System Access API with a Downloads fallback.
 * Layout: <vault>/<YYYY-MM-DD>/<Dispatch|Return>/<AWB>/{AWB}_Video.mp4|webm
 *                                                   /{AWB}_Photo_Collage.jpg */

import { getSetting, setSetting } from '../db/schema';
import { downloadBlob } from '../lib/utils';
import { photoCollageFileName, vaultSubPath, videoFileName } from '../lib/vaultPaths';
import { trackFirstRecordingSaved } from './telemetry';
import type { RecordingType } from '../types';

export type VaultStatus = 'unset' | 'connected' | 'permission' | 'downloads';

export interface SaveRecordingInput {
  awb: string;
  type: RecordingType;
  startedAt: number;
  video: Blob;
  videoMime: string;
  photo: Blob | null;
}

const VAULT_KEY = 'vault_dir';

export async function getVaultStatus(): Promise<VaultStatus> {
  try {
    const handle = await getSetting<FileSystemDirectoryHandle | null>(VAULT_KEY, null);
    if (!handle) {
      const mode = await getSetting<string>('vault_mode', '');
      return mode === 'downloads' ? 'downloads' : 'unset';
    }
    if (handle.queryPermission) {
      const state = await handle.queryPermission({ mode: 'readwrite' });
      return state === 'granted' ? 'connected' : 'permission';
    }
    return 'connected';
  } catch {
    return 'unset';
  }
}

export async function connectVault(): Promise<'fs-api' | 'downloads'> {
  if (!window.showDirectoryPicker) {
    await setSetting('vault_mode', 'downloads');
    return 'downloads';
  }
  const handle = await window.showDirectoryPicker({ id: 'claimproof-vault', mode: 'readwrite' });
  await setSetting(VAULT_KEY, handle);
  await setSetting('vault_mode', 'fs-api');
  return 'fs-api';
}

async function vaultRoot(): Promise<FileSystemDirectoryHandle | null> {
  const root = await getSetting<FileSystemDirectoryHandle | null>(VAULT_KEY, null);
  if (!root) return null;
  if (root.queryPermission) {
    const state = await root.queryPermission({ mode: 'readwrite' });
    if (state !== 'granted') {
      if (!root.requestPermission) return null;
      const granted = await root.requestPermission({ mode: 'readwrite' });
      if (granted !== 'granted') return null;
    }
  }
  return root;
}

export type SaveFailureReason =
  'permission_revoked' | 'disk_full' | 'vault_unavailable' | 'write_error';

export interface SaveRecordingResult {
  vaultPath: string;
  mode: 'fs-api' | 'downloads';
  errorReason?: SaveFailureReason;
  errorMessage?: string;
}

export async function saveRecordingFiles(input: SaveRecordingInput): Promise<SaveRecordingResult> {
  const vaultPath = vaultSubPath(input.type, input.startedAt, input.awb);
  const videoName = videoFileName(input.awb, input.videoMime);
  const photoName = photoCollageFileName(input.awb);
  try {
    const root = await vaultRoot();
    if (!root) throw new Error('vault unavailable');
    let dir = root;
    for (const segment of vaultPath.split('/')) {
      dir = await dir.getDirectoryHandle(segment, { create: true });
    }
    const videoHandle = await dir.getFileHandle(videoName, { create: true });
    const videoWriter = await videoHandle.createWritable();
    await videoWriter.write(input.video);
    await videoWriter.close();
    if (input.photo) {
      const photoHandle = await dir.getFileHandle(photoName, { create: true });
      const photoWriter = await photoHandle.createWritable();
      await photoWriter.write(input.photo);
      await photoWriter.close();
    }
    void trackFirstRecordingSaved();
    return { vaultPath, mode: 'fs-api' };
  } catch (err: unknown) {
    let errorReason: SaveFailureReason = 'write_error';
    const errName = err instanceof Error ? err.name : '';
    const errMessage = err instanceof Error ? err.message : String(err);

    if (
      errName === 'NotAllowedError' ||
      errName === 'SecurityError' ||
      errMessage.toLowerCase().includes('permission')
    ) {
      errorReason = 'permission_revoked';
    } else if (
      errName === 'QuotaExceededError' ||
      errMessage.toLowerCase().includes('quota') ||
      errMessage.toLowerCase().includes('disk') ||
      errMessage.toLowerCase().includes('space')
    ) {
      errorReason = 'disk_full';
    } else if (errMessage.toLowerCase().includes('vault unavailable')) {
      errorReason = 'vault_unavailable';
    }

    downloadBlob(input.video, videoName);
    if (input.photo) downloadBlob(input.photo, photoName);
    void trackFirstRecordingSaved();
    await setSetting('vault_mode', 'downloads');
    return {
      vaultPath,
      mode: 'downloads',
      errorReason,
      errorMessage: errMessage
    };
  }
}

/** Surfaces the AWB's folder in the OS directory picker (closest a web app can
 * get to "reveal in Explorer") and reports whether the folder is reachable. */
export async function revealAwbFolder(
  awb: string,
  type: RecordingType,
  startedAt: number
): Promise<boolean> {
  try {
    const root = await vaultRoot();
    if (!root) return false;
    let dir = root;
    for (const segment of vaultSubPath(type, startedAt, awb).split('/')) {
      dir = await dir.getDirectoryHandle(segment);
    }
    if (window.showDirectoryPicker) {
      void window
        .showDirectoryPicker({ id: 'claimproof-vault', mode: 'readwrite', startIn: dir })
        .catch(() => undefined);
    }
    return true;
  } catch {
    return false;
  }
}

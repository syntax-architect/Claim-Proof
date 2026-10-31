/* Media library — replays recorded evidence inside the app without touching the
 * disk vault. Tries the IndexedDB blob cache first, then the on-disk vault. */

import { db, getSetting } from '../db/schema';
import { photoCollageFileName, vaultSubPath, videoFileName } from '../lib/vaultPaths';

export interface RecordingMedia {
  videoUrl: string | null;
  photoUrl: string | null;
}

export async function cacheRecordingMedia(
  id: number,
  video: Blob,
  photo: Blob | null
): Promise<void> {
  await db.media_cache.put({ id, video, photo: photo ?? undefined, savedAt: Date.now() });
  void pruneMediaCache();
}

/** Keeps the blob cache bounded (LRU by savedAt). */
export async function pruneMediaCache(keep = 120): Promise<void> {
  const count = await db.media_cache.count();
  if (count <= keep) return;
  const excess = count - keep;
  const oldest = await db.media_cache.orderBy('savedAt').limit(excess).primaryKeys();
  await db.media_cache.bulkDelete(oldest);
}

async function readFromVault(id: number): Promise<RecordingMedia | null> {
  const rec = await db.recordings.get(id);
  if (!rec) return null;
  const vault = await getSetting<FileSystemDirectoryHandle | null>('vault_dir', null);
  if (!vault) return null;
  let dir: FileSystemDirectoryHandle = vault;
  for (const segment of vaultSubPath(rec.type, rec.startedAt, rec.awb).split('/')) {
    dir = await dir.getDirectoryHandle(segment);
  }
  const out: RecordingMedia = { videoUrl: null, photoUrl: null };
  try {
    const handle = await dir.getFileHandle(videoFileName(rec.awb, rec.videoMime));
    out.videoUrl = URL.createObjectURL(await handle.getFile());
  } catch {
    /* video missing on disk */
  }
  if (rec.photoCollage) {
    try {
      const handle = await dir.getFileHandle(photoCollageFileName(rec.awb));
      out.photoUrl = URL.createObjectURL(await handle.getFile());
    } catch {
      /* collage missing on disk */
    }
  }
  return out.videoUrl || out.photoUrl ? out : null;
}

export async function loadRecordingMedia(id: number): Promise<RecordingMedia | null> {
  const cached = await db.media_cache.get(id);
  if (cached && (cached.video || cached.photo)) {
    return {
      videoUrl: cached.video ? URL.createObjectURL(cached.video) : null,
      photoUrl: cached.photo ? URL.createObjectURL(cached.photo) : null
    };
  }
  try {
    return await readFromVault(id);
  } catch {
    return null;
  }
}

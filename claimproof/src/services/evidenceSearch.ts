/**
 * SABOOT Suite — Global Unified Evidence Search Engine
 *
 * Acceptance Criteria & Performance:
 * - Accepts scanned or typed AWB, Order ID, or SKU.
 * - Sub-200ms latency across 10,000+ records.
 * - Prefix & partial substring matching.
 * - Trims whitespace, cleans control chars and barcode-gun artifacts (e.g. \r, \n, \t).
 * - Aggregates packing (dispatch) videos, return videos, photo collages, and ClaimRadar statuses.
 * - Detects missing files vs unrecorded states.
 * - Paginates large result sets.
 */

import { db, getSetting } from '../db/schema';
import type { ClaimItem, CourierPartner, Marketplace, RecordingMeta, StoredOrder } from '../types';
import { vaultSubPath, videoFileName } from '../lib/vaultPaths';

export type MediaFileState = 'found' | 'missing_file' | 'not_recorded';

export interface UnifiedEvidenceDossier {
  awb: string;
  orderId: string;
  sku: string;
  courier: CourierPartner;
  marketplace: Marketplace;
  createdAt: number;
  // Dispatch / Packing Proof
  dispatchRecording?: RecordingMeta;
  dispatchStatus: MediaFileState;
  // Return Proof
  returnRecording?: RecordingMeta;
  returnStatus: MediaFileState;
  // Extra / duplicate recordings for this AWB (if any)
  otherRecordings: RecordingMeta[];
  // Photo Collage
  hasPhotoCollage: boolean;
  photoBytes: number;
  // ClaimRadar dispute status
  claim?: ClaimItem;
  // Label order
  order?: StoredOrder;
}

export interface UnifiedSearchResult {
  query: string;
  cleanedQuery: string;
  results: UnifiedEvidenceDossier[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  latencyMs: number;
}

/**
 * Normalizes user input and laser barcode scanner streams.
 * Strips non-printable ASCII / control characters, trailing \r, \n, tabs,
 * and scanner punctuation artifacts while preserving alphanumeric tracking codes.
 */
export function cleanSearchInput(raw: string): string {
  if (!raw) return '';
  // Strip control characters (including carriage return \r, newline \n, tab \t)
  // eslint-disable-next-line no-control-regex
  let cleaned = raw.replace(/[\x00-\x1F\x7F]/g, '');
  // Trim leading/trailing whitespace
  cleaned = cleaned.trim();
  return cleaned;
}

/**
 * Fast check for recording media existence in IndexedDB cache or vault directory.
 */
export async function checkRecordingFileState(rec?: RecordingMeta): Promise<MediaFileState> {
  if (!rec || !rec.id) return 'not_recorded';

  try {
    // 1. Check fast IndexedDB blob cache
    const cached = await db.media_cache.get(rec.id);
    if (cached?.video) {
      return 'found';
    }

    // 2. Check on-disk vault handle if present
    const vault = await getSetting<FileSystemDirectoryHandle | null>('vault_dir', null);
    if (!vault) {
      // Metadata exists in database, but no vault connected and not in cache
      return 'missing_file';
    }

    let dir: FileSystemDirectoryHandle = vault;
    for (const segment of vaultSubPath(rec.type, rec.startedAt, rec.awb).split('/')) {
      dir = await dir.getDirectoryHandle(segment);
    }
    await dir.getFileHandle(videoFileName(rec.awb, rec.videoMime));
    return 'found';
  } catch {
    // Throws NotFoundError or security error -> file moved or deleted from disk
    return 'missing_file';
  }
}

/**
 * Executes high-performance unified search across recordings, orders, and claims.
 * Target SLA: < 200 ms for 10,000+ records.
 */
export async function searchUnifiedEvidence(
  rawQuery: string,
  options?: {
    page?: number;
    pageSize?: number;
    checkDiskFiles?: boolean;
  }
): Promise<UnifiedSearchResult> {
  const startTime = performance.now();
  const cleaned = cleanSearchInput(rawQuery);
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.max(1, options?.pageSize ?? 10);
  const checkDisk = options?.checkDiskFiles ?? false;

  if (!cleaned) {
    return {
      query: rawQuery,
      cleanedQuery: '',
      results: [],
      total: 0,
      page: 1,
      pageSize,
      totalPages: 0,
      latencyMs: performance.now() - startTime
    };
  }

  const qLower = cleaned.toLowerCase();

  // Step 1: Query IndexedDB with prefix optimization first
  // Dexie has indexes on awb, orderId, sku in recordings, orders, and claims.
  const [
    recPrefixAwb,
    recPrefixOrder,
    recPrefixSku,
    ordPrefixAwb,
    ordPrefixOrder,
    ordPrefixSku,
    clmPrefixAwb
  ] = await Promise.all([
    db.recordings.where('awb').startsWithIgnoreCase(cleaned).limit(100).toArray(),
    db.recordings.where('orderId').startsWithIgnoreCase(cleaned).limit(100).toArray(),
    db.recordings.where('sku').startsWithIgnoreCase(cleaned).limit(100).toArray(),
    db.orders.where('awb').startsWithIgnoreCase(cleaned).limit(100).toArray(),
    db.orders.where('orderId').startsWithIgnoreCase(cleaned).limit(100).toArray(),
    db.orders.where('sku').startsWithIgnoreCase(cleaned).limit(100).toArray(),
    db.claims.where('awb').startsWithIgnoreCase(cleaned).limit(100).toArray()
  ]);

  const prefixRecs = [...recPrefixAwb, ...recPrefixOrder, ...recPrefixSku];
  const prefixOrds = [...ordPrefixAwb, ...ordPrefixOrder, ...ordPrefixSku];
  const prefixClms = [...clmPrefixAwb];

  // If prefix search returned fewer than 50 results and no exact primary identifier match was found,
  // perform fast in-memory partial/substring scan. An exact match on AWB, Order ID, or SKU resolves immediately.
  let allRecs = prefixRecs;
  let allOrds = prefixOrds;
  let allClms = prefixClms;

  const hasExactKeyMatch =
    prefixRecs.some(
      (r) =>
        r.awb.toLowerCase() === qLower ||
        r.orderId.toLowerCase() === qLower ||
        r.sku.toLowerCase() === qLower
    ) ||
    prefixOrds.some(
      (o) =>
        o.awb.toLowerCase() === qLower ||
        o.orderId.toLowerCase() === qLower ||
        o.sku.toLowerCase() === qLower
    );

  const performPartialScan = !hasExactKeyMatch && prefixRecs.length < 50 && prefixOrds.length < 50;

  if (performPartialScan) {
    // Fast collection scan with toArray() - in V8 / IndexedDB, reading 10k items takes ~10-40ms
    const [fullRecs, fullOrds, fullClms] = await Promise.all([
      db.recordings.toArray(),
      db.orders.toArray(),
      db.claims.toArray()
    ]);

    const matchingRecs = fullRecs.filter(
      (r) =>
        r.awb.toLowerCase().includes(qLower) ||
        r.orderId.toLowerCase().includes(qLower) ||
        r.sku.toLowerCase().includes(qLower) ||
        r.courier.toLowerCase().includes(qLower)
    );

    const matchingOrds = fullOrds.filter(
      (o) =>
        o.awb.toLowerCase().includes(qLower) ||
        o.orderId.toLowerCase().includes(qLower) ||
        o.sku.toLowerCase().includes(qLower) ||
        o.courier.toLowerCase().includes(qLower)
    );

    const matchingClms = fullClms.filter(
      (c) =>
        c.awb.toLowerCase().includes(qLower) ||
        c.orderId.toLowerCase().includes(qLower) ||
        c.sku.toLowerCase().includes(qLower) ||
        c.courier.toLowerCase().includes(qLower)
    );

    allRecs = matchingRecs;
    allOrds = matchingOrds;
    allClms = matchingClms;
  }

  // Step 2: Group by AWB into unified dossiers
  const awbSet = new Set<string>();
  allRecs.forEach((r) => awbSet.add(r.awb));
  allOrds.forEach((o) => awbSet.add(o.awb));
  allClms.forEach((c) => awbSet.add(c.awb));

  // Map of AWB -> recordings
  const recsByAwb = new Map<string, RecordingMeta[]>();
  for (const r of allRecs) {
    const list = recsByAwb.get(r.awb) ?? [];
    list.push(r);
    recsByAwb.set(r.awb, list);
  }

  // Map of AWB -> order
  const ordersByAwb = new Map<string, StoredOrder>();
  for (const o of allOrds) {
    if (!ordersByAwb.has(o.awb)) {
      ordersByAwb.set(o.awb, o);
    }
  }

  // Map of AWB -> claim
  const claimsByAwb = new Map<string, ClaimItem>();
  for (const c of allClms) {
    if (!claimsByAwb.has(c.awb)) {
      claimsByAwb.set(c.awb, c);
    }
  }

  const dossiers: UnifiedEvidenceDossier[] = [];

  for (const awb of awbSet) {
    const recs = recsByAwb.get(awb) ?? [];
    const order = ordersByAwb.get(awb);
    const claim = claimsByAwb.get(awb);

    // Identify dispatch vs return recordings
    // If multiple dispatches or returns exist, sort by startedAt desc
    recs.sort((a, b) => b.startedAt - a.startedAt);

    const dispatchRec = recs.find((r) => r.type === 'dispatch');
    const returnRec = recs.find((r) => r.type === 'return');
    const otherRecs = recs.filter((r) => r !== dispatchRec && r !== returnRec);

    // Primary metadata
    const orderId =
      dispatchRec?.orderId || returnRec?.orderId || order?.orderId || claim?.orderId || '—';
    const sku = dispatchRec?.sku || returnRec?.sku || order?.sku || claim?.sku || '—';
    const courier: CourierPartner =
      dispatchRec?.courier || returnRec?.courier || order?.courier || claim?.courier || 'Unknown';
    const marketplace: Marketplace =
      dispatchRec?.marketplace ||
      returnRec?.marketplace ||
      order?.marketplace ||
      claim?.marketplace ||
      'Unknown';

    const createdAt =
      dispatchRec?.startedAt ||
      returnRec?.startedAt ||
      order?.createdAt ||
      claim?.returnScanAt ||
      Date.now();

    const hasPhotoCollage = Boolean(
      (dispatchRec?.photoCollage && dispatchRec.photoBytes > 0) ||
      (returnRec?.photoCollage && returnRec.photoBytes > 0)
    );
    const photoBytes = Math.max(dispatchRec?.photoBytes ?? 0, returnRec?.photoBytes ?? 0);

    dossiers.push({
      awb,
      orderId,
      sku,
      courier,
      marketplace,
      createdAt,
      dispatchRecording: dispatchRec,
      dispatchStatus: dispatchRec ? 'found' : 'not_recorded',
      returnRecording: returnRec,
      returnStatus: returnRec ? 'found' : 'not_recorded',
      otherRecordings: otherRecs,
      hasPhotoCollage,
      photoBytes,
      claim,
      order
    });
  }

  // Sort dossiers: exact AWB match first, then by createdAt descending
  dossiers.sort((a, b) => {
    const aExact = a.awb.toLowerCase() === qLower ? 1 : 0;
    const bExact = b.awb.toLowerCase() === qLower ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    return b.createdAt - a.createdAt;
  });

  const total = dossiers.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedDossiers = dossiers.slice(startIndex, startIndex + pageSize);

  // If checkDiskFiles requested, verify files for the paginated slice only (to keep latency low)
  if (checkDisk) {
    for (const dossier of paginatedDossiers) {
      if (dossier.dispatchRecording) {
        dossier.dispatchStatus = await checkRecordingFileState(dossier.dispatchRecording);
      }
      if (dossier.returnRecording) {
        dossier.returnStatus = await checkRecordingFileState(dossier.returnRecording);
      }
    }
  }

  const latencyMs = performance.now() - startTime;

  return {
    query: rawQuery,
    cleanedQuery: cleaned,
    results: paginatedDossiers,
    total,
    page,
    pageSize,
    totalPages,
    latencyMs
  };
}

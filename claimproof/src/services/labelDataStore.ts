/* SmartLabel SKU+ — persistence for extracted labels.
 * Everything the recorder needs to auto-match an AWB lands here. */

import { db } from '../db/schema';
import { uid } from '../lib/utils';
import type { CropPreset, ExtractedLabel, LabelBatchSummary, StoredOrder } from '../types';

export async function saveLabelBatch(
  labels: ExtractedLabel[],
  files: string[],
  cropPreset: CropPreset,
  valmoPlusAsValmo: boolean
): Promise<LabelBatchSummary> {
  const batchId = uid('batch');
  const createdAt = Date.now();
  const orders: StoredOrder[] = labels.map((label) => ({
    ...label,
    awb: label.awb.trim().toUpperCase(),
    batchId,
    createdAt
  }));
  await db.batches.put({
    id: batchId,
    createdAt,
    files,
    labelCount: labels.length,
    cropPreset,
    valmoPlusAsValmo
  });
  await db.orders.bulkAdd(orders);
  return { id: batchId, createdAt, files, labelCount: labels.length, cropPreset, valmoPlusAsValmo };
}

export async function findOrderByAwb(awb: string): Promise<StoredOrder | undefined> {
  return db.orders.where('awb').equals(awb.trim().toUpperCase()).first();
}

export async function latestBatch(): Promise<LabelBatchSummary | undefined> {
  const rows = await db.batches.orderBy('createdAt').reverse().limit(1).toArray();
  return rows[0];
}

export async function clearAllOrders(): Promise<void> {
  await db.orders.clear();
}

/* ClaimRadar Pro engine — evidence matching, deadline data, dispute text. */

import { useLiveQuery } from 'dexie-react-hooks';
import { BRAND } from '../config/brand';
import { db } from '../db/schema';
import { claimWindowHours, claimWindowLabel } from '../lib/claimRules';
import { formatIST } from '../lib/dateUtils';
import type { ClaimItem, ClaimStatus, Marketplace, RecordingMeta } from '../types';
import {
  getDisputeTemplate,
  renderDisputeTemplate,
  type DisputeRenderResult,
  type DisputeTemplateCategory,
  type DisputeTemplateData,
  type DisputeTemplateLanguage
} from '../config/disputeTemplates';

const TEN_DAYS_MS = 10 * 24 * 3_600_000;

export function useClaims(): ClaimItem[] {
  return useLiveQuery(() => db.claims.orderBy('deadlineAt').toArray(), [], []) ?? [];
}

async function findEvidence(
  claim: ClaimItem,
  type: RecordingMeta['type']
): Promise<RecordingMeta | undefined> {
  const windowStart = claim.returnScanAt - TEN_DAYS_MS;
  const windowEnd = type === 'dispatch' ? claim.returnScanAt : Date.now();

  const byAwb = (await db.recordings.where('awb').equals(claim.awb).toArray()).filter(
    (r) => r.type === type && r.startedAt >= windowStart && r.startedAt <= windowEnd
  );
  if (byAwb.length > 0) {
    return byAwb.sort((a, b) => b.startedAt - a.startedAt)[0];
  }
  if (claim.orderId && claim.orderId !== 'UNKNOWN') {
    const byOrder = (await db.recordings.where('orderId').equals(claim.orderId).toArray()).filter(
      (r) => r.type === type && r.startedAt >= windowStart && r.startedAt <= windowEnd
    );
    if (byOrder.length > 0) {
      return byOrder.sort((a, b) => b.startedAt - a.startedAt)[0];
    }
  }
  return undefined;
}

/** The dispatch packing clip for this AWB, recorded up to 10 days before the return. */
export function findDispatchEvidence(claim: ClaimItem): Promise<RecordingMeta | undefined> {
  return findEvidence(claim, 'dispatch');
}

/** The return-unboxing clip that produced this claim. */
export function findReturnEvidence(claim: ClaimItem): Promise<RecordingMeta | undefined> {
  return findEvidence(claim, 'return');
}

export async function updateClaimStatus(id: number, status: ClaimStatus): Promise<void> {
  await db.claims.update(id, { status });
}

export async function saveDisputeText(id: number, text: string): Promise<void> {
  await db.claims.update(id, { disputeText: text });
}

export async function deleteClaim(id: number): Promise<void> {
  await db.claims.delete(id);
}

/**
 * Recalculates dispute deadlines and appends an IST explanatory note for all active
 * claims of a given marketplace when window hours are updated.
 */
export async function recalculateClaimsForMarketplace(
  marketplace: Marketplace,
  newHours: number,
  oldHours?: number
): Promise<number> {
  const activeClaims = await db.claims
    .where('marketplace')
    .equals(marketplace)
    .filter((c) => c.status === 'pending' || c.status === 'prepared' || c.status === 'submitted')
    .toArray();

  let count = 0;
  const nowMs = Date.now();
  const istNow = formatIST(nowMs);

  for (const claim of activeClaims) {
    if (claim.id === undefined) continue;
    const prevHours = oldHours ?? Math.round((claim.deadlineAt - claim.returnScanAt) / 3_600_000);
    const newDeadlineAt = claim.returnScanAt + newHours * 3_600_000;
    const noteLine = `[Window updated from ${prevHours}h to ${newHours}h on ${istNow}]`;
    const updatedNotes = claim.notes ? `${claim.notes}\n${noteLine}` : noteLine;

    await db.claims.update(claim.id, {
      deadlineAt: newDeadlineAt,
      notes: updatedNotes
    });
    count++;
  }
  return count;
}

/**
 * Updates the user-entered return delivery date and recalculates deadline in IST.
 */
export async function updateClaimReturnDeliveryDate(
  id: number,
  newReturnScanAt: number,
  marketplace: Marketplace
): Promise<void> {
  const hours = claimWindowHours(marketplace);
  const deadlineAt = newReturnScanAt + hours * 3_600_000;
  await db.claims.update(id, {
    returnScanAt: newReturnScanAt,
    deadlineAt
  });
}

/* ── marketplace-tailored dispute text ───────────────────────────────── */

function evidenceLine(role: string, rec: RecordingMeta | undefined): string {
  if (!rec) {
    return `- ${role}: not available for this parcel.`;
  }
  return `- ${role}: UNCUT video (${rec.durationSec}s, burnt-in IST timestamp) recorded ${formatIST(rec.startedAt)}; barcode "${rec.awb}" verified by scanner before recording started.`;
}

export function generateDisputeText(
  claim: ClaimItem,
  dispatch: RecordingMeta | undefined,
  returnRec: RecordingMeta | undefined
): string {
  const lines: string[] = [];

  switch (claim.marketplace) {
    case 'Meesho':
      lines.push('Subject: Meesho SAFE-P claim — evidence of dispatch condition');
      lines.push('');
      lines.push(
        'Dear Meesho Support Team, this return is being disputed under the SAFE-P policy. The parcel below was packed on camera and the return was unboxed on camera.'
      );
      break;
    case 'Flipkart':
      lines.push('Subject: Flipkart SPF return dispute — barcode-verified video evidence');
      lines.push('');
      lines.push(
        'Dear Flipkart Seller Support, this SPF return is disputed. Both the dispatch packing and the customer-return unboxing were recorded as uncut, timestamped video.'
      );
      break;
    case 'Amazon':
      lines.push('Subject: Amazon SAFE-T claim — uncut dispatch proof');
      lines.push('');
      lines.push(
        'Dear Amazon Seller Support, we are filing a SAFE-T claim for the shipment below. Uncut, timestamped video evidence covers dispatch condition and the return unboxing.'
      );
      break;
    default:
      lines.push(`Subject: ${claim.marketplace} return dispute — video evidence`);
      lines.push('');
      lines.push(
        `Dear ${claim.marketplace === 'Unknown' ? 'Seller Support' : claim.marketplace + ' Support'} Team, we dispute this return. Uncut, timestamped video evidence covers the dispatch packing and the return unboxing.`
      );
  }

  lines.push('');
  lines.push('SHIPMENT DETAILS');
  lines.push(`- AWB / Tracking: ${claim.awb}`);
  lines.push(`- Order ID: ${claim.orderId}`);
  lines.push(`- Item: ${claim.sku} (Qty ${claim.qty})`);
  lines.push(`- Courier partner: ${claim.courier}`);
  lines.push('');
  lines.push(`VIDEO EVIDENCE (${BRAND.name} AWB station)`);
  lines.push(evidenceLine('Dispatch packing video', dispatch));
  lines.push(evidenceLine('Return unboxing video', returnRec));
  if (claim.returnRecordingId && !returnRec) {
    lines.push(`- Return unboxing video: recorded via ${BRAND.name} AWB (metadata on file).`);
  }
  lines.push('');
  lines.push(
    `FINDING: During return unboxing at ${formatIST(claim.returnScanAt)}, the item was found "${claim.flagReason}". The dispatch clip proves the parcel left us sealed and in sellable condition${claim.notes ? `. Additional notes: ${claim.notes}` : '.'}`
  );
  lines.push('');
  lines.push(
    'Both clips are uncut with burnt-in timestamps and barcode verification, so the footage cannot have been edited between scan and seal. Auto-generated 2x2 photo collages summarise each stage.'
  );
  lines.push('');
  lines.push(
    `Per the ${claimWindowLabel(claim.marketplace)} rubric, we request reversal of the return deduction / full compensation for this shipment. Evidence is available on request as MP4 + JPEG collage.`
  );
  lines.push('');
  lines.push('Regards,');
  lines.push(`Seller — via ${BRAND.domain}`);

  return lines.join('\n');
}

export function buildDisputeTemplateData(
  claim: ClaimItem,
  dispatch?: RecordingMeta,
  _returnRec?: RecordingMeta,
  language: DisputeTemplateLanguage = 'en'
): DisputeTemplateData {
  const rawOrderId = claim.orderId && claim.orderId !== 'UNKNOWN' ? claim.orderId : '';
  const rawAwb = claim.awb && claim.awb !== 'UNKNOWN' ? claim.awb : '';
  const rawSku = claim.sku && claim.sku !== 'UNKNOWN' ? claim.sku : '';
  const dispatchDate = dispatch?.startedAt ? formatIST(dispatch.startedAt) : '';
  const returnDate = claim.returnScanAt ? formatIST(claim.returnScanAt) : '';

  let whatWasSent = '';
  if (rawSku) {
    const sizeStr = dispatch?.size && dispatch.size !== 'Free' ? `Size: ${dispatch.size}, ` : '';
    whatWasSent =
      language === 'hi'
        ? `${rawSku} (${sizeStr}मात्रा: ${claim.qty || 1})`
        : `${rawSku} (${sizeStr}Qty: ${claim.qty || 1})`;
  }

  let whatWasReceived = claim.notes ? claim.notes.trim() : '';
  if (!whatWasReceived) {
    if (language === 'hi') {
      switch (claim.flagReason) {
        case 'Wrong/Swapped item':
          whatWasReceived = 'भिन्न / बदला हुआ सामान प्राप्त हुआ';
          break;
        case 'Damaged':
          whatWasReceived = 'क्षतिग्रस्त / टूटा हुआ उत्पाद प्राप्त हुआ';
          break;
        case 'Used/Worn':
          whatWasReceived = 'इस्तेमाल किया हुआ / पुराना उत्पाद प्राप्त हुआ';
          break;
        case 'Empty package':
          whatWasReceived = 'खाली पार्सल (सामग्री गायब) प्राप्त हुआ';
          break;
        case 'Missing item':
          whatWasReceived = 'सामग्री अधूरी / गायब प्राप्त हुई';
          break;
        default:
          whatWasReceived = 'अनुचित स्थिति में सामान प्राप्त हुआ';
      }
    } else {
      switch (claim.flagReason) {
        case 'Wrong/Swapped item':
          whatWasReceived = 'Different / swapped item received';
          break;
        case 'Damaged':
          whatWasReceived = 'Damaged / broken item received';
          break;
        case 'Used/Worn':
          whatWasReceived = 'Used / worn item received';
          break;
        case 'Empty package':
          whatWasReceived = 'Empty parcel with missing contents';
          break;
        case 'Missing item':
          whatWasReceived = 'Partial shipment with missing items';
          break;
        default:
          whatWasReceived = 'Discrepant return item received';
      }
    }
  }

  return {
    orderId: rawOrderId,
    awb: rawAwb,
    sku: rawSku,
    dispatchDate,
    returnDate,
    whatWasSent,
    whatWasReceived,
    notes: claim.notes || ''
  };
}

export function generateTemplateDisputeMessage(
  claim: ClaimItem,
  dispatch?: RecordingMeta,
  returnRec?: RecordingMeta,
  category?: DisputeTemplateCategory,
  language: DisputeTemplateLanguage = 'en'
): DisputeRenderResult {
  const chosenCategory: DisputeTemplateCategory =
    category ??
    (claim.flagReason === 'Wrong/Swapped item'
      ? 'wrong_item'
      : claim.flagReason === 'Damaged' || claim.flagReason === 'Used/Worn'
        ? 'damaged'
        : claim.flagReason === 'Empty package' || claim.flagReason === 'Missing item'
          ? 'empty'
          : 'general');

  const templateDef = getDisputeTemplate(chosenCategory, language);
  const data = buildDisputeTemplateData(claim, dispatch, returnRec, language);
  return renderDisputeTemplate(templateDef.template, data, language);
}

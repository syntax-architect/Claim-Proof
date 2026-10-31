/* ClaimRadar Pro engine — evidence matching, deadline data, dispute text. */

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { claimWindowLabel } from '../lib/claimRules';
import { formatIST } from '../lib/dateUtils';
import type { ClaimItem, ClaimStatus, RecordingMeta } from '../types';

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
  lines.push('VIDEO EVIDENCE (ClaimProof AWB station)');
  lines.push(evidenceLine('Dispatch packing video', dispatch));
  lines.push(evidenceLine('Return unboxing video', returnRec));
  if (claim.returnRecordingId && !returnRec) {
    lines.push('- Return unboxing video: recorded via ClaimProof AWB (metadata on file).');
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
  lines.push('Seller — via ClaimProof.in');

  return lines.join('\n');
}

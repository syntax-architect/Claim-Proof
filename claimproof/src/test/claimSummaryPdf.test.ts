import { describe, it, expect } from 'vitest';
import { generateClaimSummaryPdf } from '../services/claimSummaryPdf';
import type { ChecklistResultRow, ClaimItem, RecordingMeta } from '../types';

describe('Claim Summary PDF Generator', () => {
  const mockClaim: ClaimItem = {
    id: 1,
    awb: 'AWB_PDF_TEST_9988',
    orderId: 'ORD_TEST_1234',
    marketplace: 'Meesho',
    courier: 'Delhivery',
    sku: 'SKU_COTTON_KURTI_XL',
    qty: 2,
    flagReason: 'Wrong/Swapped item',
    notes: 'Received empty parcel with torn outer seal',
    returnScanAt: 1730450000000,
    deadlineAt: 1730709200000,
    status: 'prepared',
    disputeText: 'Subject: Meesho SAFE claim proof\nItem was swapped on delivery.'
  };

  const mockDispatchRec: RecordingMeta = {
    id: 10,
    awb: 'AWB_PDF_TEST_9988',
    orderId: 'ORD_TEST_1234',
    sku: 'SKU_COTTON_KURTI_XL',
    size: 'XL',
    qty: 2,
    courier: 'Delhivery',
    marketplace: 'Meesho',
    type: 'dispatch',
    startedAt: 1730000000000,
    endedAt: 1730000030000,
    durationSec: 30,
    videoMime: 'video/mp4',
    videoBytes: 4_500_000,
    photoBytes: 180_000,
    photoCollage: true,
    vaultPath: '2026-10-27/Dispatch/AWB_PDF_TEST_9988',
    demo: false,
    flagged: false
  };

  const mockChecklistRows: ChecklistResultRow[] = [
    {
      id: 1,
      awb: 'AWB_PDF_TEST_9988',
      stepId: 'outer_box',
      stepOrder: 1,
      title: 'Inspect outer courier flyer & label',
      completed: true,
      completedAtOffsetSec: 2,
      timestamp: 1730450002000
    },
    {
      id: 2,
      awb: 'AWB_PDF_TEST_9988',
      stepId: 'seal_intact',
      stepOrder: 2,
      title: 'Check tamper seal integrity',
      completed: true,
      completedAtOffsetSec: 5,
      timestamp: 1730450005000
    }
  ];

  it('generates a valid binary PDF with complete evidence sections', async () => {
    const pdfBytes = await generateClaimSummaryPdf({
      claim: mockClaim,
      dispatchRec: mockDispatchRec,
      returnRec: null,
      checklistRows: mockChecklistRows,
      disputeText: mockClaim.disputeText ?? ''
    });

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.byteLength).toBeGreaterThan(1000);

    // Verify PDF Magic Bytes (%PDF-1.x)
    const header = new TextDecoder('latin1').decode(pdfBytes.slice(0, 8));
    expect(header).toContain('%PDF');
  });

  it('handles claim without return recording gracefully', async () => {
    const pdfBytes = await generateClaimSummaryPdf({
      claim: mockClaim,
      dispatchRec: mockDispatchRec,
      returnRec: undefined,
      checklistRows: [],
      disputeText: 'Notice: return unboxing clip was not recorded.'
    });

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.byteLength).toBeGreaterThan(1000);
  });
});

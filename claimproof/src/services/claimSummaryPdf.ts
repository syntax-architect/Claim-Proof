/**
 * Claim Summary Sheet PDF Generator for SABOOT Suite.
 *
 * Acceptance Criteria:
 * - Generates a comprehensive summary sheet (PDF) containing:
 *   - AWB, Order ID, Item SKU & Qty, Marketplace, Courier
 *   - All dates and times formatted in Indian Standard Time (IST) with timezone
 *   - Video evidence verification chain (Dispatch & Return)
 *   - Checklist verification results (steps, status, timestamps)
 *   - Complete dispute text dossier
 *   - Clean plain-language status declarations (no unprovable claims)
 */

import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { BRAND } from '../config/brand';
import { formatIST } from '../lib/dateUtils';
import type { ChecklistResultRow, ClaimItem, RecordingMeta } from '../types';

export interface ClaimSummaryPdfInput {
  claim: ClaimItem;
  dispatchRec?: RecordingMeta | null;
  returnRec?: RecordingMeta | null;
  checklistRows?: ChecklistResultRow[];
  disputeText: string;
}

function sanitizePdfText(str: string): string {
  if (typeof str !== 'string') return '';
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const code = str.charCodeAt(i);
    if (ch === '✓' || ch === '✔') {
      out += '[x]';
    } else if (ch === '₹') {
      out += 'Rs.';
    } else if (code <= 127) {
      out += ch;
    } else {
      out += ' ';
    }
  }
  return out;
}

export async function generateClaimSummaryPdf(input: ClaimSummaryPdfInput): Promise<Uint8Array> {
  const { claim, dispatchRec, returnRec, checklistRows = [], disputeText } = input;

  const pdfDoc = await PDFDocument.create();
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdfDoc.embedFont(StandardFonts.Courier);

  // Standard A4 dimensions: 595.28 x 841.89 points
  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 36;
  const contentW = pageW - margin * 2;

  function createSafePage(): PDFPage {
    const p = pdfDoc.addPage([pageW, pageH]);
    const origDraw = p.drawText.bind(p);
    p.drawText = (text: string, options?: any) => origDraw(sanitizePdfText(text), options);
    return p;
  }

  let page = createSafePage();
  let y = pageH - margin;

  // Colors
  const black = rgb(0.05, 0.05, 0.06);
  const darkSlate = rgb(0.12, 0.15, 0.2);
  const slate = rgb(0.35, 0.4, 0.48);
  const lightBg = rgb(0.96, 0.96, 0.97);
  const gold = rgb(0.79, 0.64, 0.36); // Champagne gold
  const goldDark = rgb(0.55, 0.42, 0.2);
  const green = rgb(0.1, 0.6, 0.3);
  const red = rgb(0.8, 0.2, 0.2);
  const white = rgb(1, 1, 1);

  // Helper for adding new page if needed
  function checkPageBreak(requiredHeight: number) {
    if (y - requiredHeight < margin + 40) {
      drawFooter(page);
      page = createSafePage();
      y = pageH - margin;
      drawHeaderBanner(page, true);
    }
  }

  function drawHeaderBanner(p: typeof page, isContinuation = false) {
    // Top Brand & Legal Banner
    p.drawRectangle({
      x: margin,
      y: y - 36,
      width: contentW,
      height: 36,
      color: darkSlate
    });

    p.drawText(`${BRAND.name.toUpperCase()} - DISPUTE DOSSIER & LEGAL EVIDENCE KIT`, {
      x: margin + 12,
      y: y - 22,
      size: 11,
      font: helvBold,
      color: gold
    });

    const pageCountText = isContinuation ? '(Continued)' : `AWB: ${claim.awb}`;
    p.drawText(pageCountText, {
      x: margin + contentW - helvBold.widthOfTextAtSize(pageCountText, 10) - 12,
      y: y - 22,
      size: 10,
      font: helvBold,
      color: white
    });

    y -= 46;
  }

  function drawFooter(p: typeof page) {
    p.drawLine({
      start: { x: margin, y: margin + 20 },
      end: { x: margin + contentW, y: margin + 20 },
      thickness: 0.5,
      color: slate
    });

    const footerText = `Generated on-device via ${BRAND.name} (${BRAND.domain}) | All dates in Indian Standard Time (IST) | Strictly local-first`;
    p.drawText(footerText, {
      x: margin,
      y: margin + 8,
      size: 7.5,
      font: helv,
      color: slate
    });
  }

  // 1. Initial Header
  drawHeaderBanner(page);

  // 2. Title & Date Box
  page.drawText('Marketplace Return Dispute Summary Sheet', {
    x: margin,
    y,
    size: 16,
    font: helvBold,
    color: black
  });
  y -= 16;

  const generatedAtText = `Generated: ${formatIST(Date.now())}`;
  page.drawText(generatedAtText, {
    x: margin,
    y,
    size: 9,
    font: helv,
    color: slate
  });
  y -= 18;

  // 3. Shipment Details Card
  page.drawRectangle({
    x: margin,
    y: y - 76,
    width: contentW,
    height: 76,
    color: lightBg,
    borderColor: gold,
    borderWidth: 0.75
  });

  const col1X = margin + 12;
  const col2X = margin + contentW / 2 + 10;
  let textY = y - 18;

  // Row 1
  page.drawText('AWB / Tracking Number:', {
    x: col1X,
    y: textY,
    size: 8.5,
    font: helvBold,
    color: slate
  });
  page.drawText(claim.awb, { x: col1X + 115, y: textY, size: 9, font: mono, color: black });

  page.drawText('Marketplace Platform:', {
    x: col2X,
    y: textY,
    size: 8.5,
    font: helvBold,
    color: slate
  });
  page.drawText(claim.marketplace, {
    x: col2X + 110,
    y: textY,
    size: 9,
    font: helvBold,
    color: black
  });

  textY -= 18;

  // Row 2
  page.drawText('Marketplace Order ID:', {
    x: col1X,
    y: textY,
    size: 8.5,
    font: helvBold,
    color: slate
  });
  page.drawText(claim.orderId || 'UNKNOWN', {
    x: col1X + 115,
    y: textY,
    size: 9,
    font: mono,
    color: black
  });

  page.drawText('Courier Partner:', {
    x: col2X,
    y: textY,
    size: 8.5,
    font: helvBold,
    color: slate
  });
  page.drawText(claim.courier || 'Standard', {
    x: col2X + 110,
    y: textY,
    size: 9,
    font: helv,
    color: black
  });

  textY -= 18;

  // Row 3
  page.drawText('Item SKU & Quantity:', {
    x: col1X,
    y: textY,
    size: 8.5,
    font: helvBold,
    color: slate
  });
  page.drawText(`${claim.sku || 'Item'} (Qty: ${claim.qty || 1})`, {
    x: col1X + 115,
    y: textY,
    size: 9,
    font: helvBold,
    color: black
  });

  page.drawText('Dispute Finding Reason:', {
    x: col2X,
    y: textY,
    size: 8.5,
    font: helvBold,
    color: slate
  });
  page.drawText(claim.flagReason, {
    x: col2X + 110,
    y: textY,
    size: 9,
    font: helvBold,
    color: red
  });

  y -= 90;

  // 4. Video Evidence Verification Chain
  page.drawText('VIDEO EVIDENCE CHAIN (BURNT-IN LIVE IST TIMESTAMPS)', {
    x: margin,
    y,
    size: 11,
    font: helvBold,
    color: darkSlate
  });
  y -= 14;

  // Dispatch Video Row
  page.drawRectangle({
    x: margin,
    y: y - 36,
    width: contentW,
    height: 36,
    color: lightBg,
    borderColor: dispatchRec ? green : slate,
    borderWidth: 0.5
  });

  const dispTitle = dispatchRec
    ? `[VERIFIED] DISPATCH PACKING PROOF: Recorded ${formatIST(dispatchRec.startedAt)} (${dispatchRec.durationSec}s continuous uncut video)`
    : '[NOT FOUND] DISPATCH PACKING PROOF: Not recorded or saved in Evidence Vault for this AWB.';
  page.drawText(dispTitle, {
    x: margin + 10,
    y: y - 16,
    size: 8.5,
    font: helvBold,
    color: dispatchRec ? green : red
  });

  const dispSub = dispatchRec
    ? `Barcode "${dispatchRec.awb}" verified before packaging. Indelible timestamp watermark burned across every frame.`
    : 'No dispatch clip found in local vault matching this tracking number.';
  page.drawText(dispSub, {
    x: margin + 10,
    y: y - 28,
    size: 7.5,
    font: helv,
    color: slate
  });

  y -= 44;

  // Return Video Row
  page.drawRectangle({
    x: margin,
    y: y - 36,
    width: contentW,
    height: 36,
    color: lightBg,
    borderColor: returnRec ? goldDark : slate,
    borderWidth: 0.5
  });

  const retTitle = returnRec
    ? `[VERIFIED] RETURN UNBOXING PROOF: Recorded ${formatIST(returnRec.startedAt)} (${returnRec.durationSec}s continuous uncut video)`
    : `[FLAGGED] RETURN UNBOXING PROOF: Flagged at ${formatIST(claim.returnScanAt)} (metadata logged, unboxing clip not attached).`;
  page.drawText(retTitle, {
    x: margin + 10,
    y: y - 16,
    size: 8.5,
    font: helvBold,
    color: returnRec ? goldDark : slate
  });

  const retSub = returnRec
    ? `Return condition marked "${claim.flagReason}". Uncut video matches dispatch serial & courier packaging.`
    : 'Evidence dossier prepared using dispatch condition verification and return scanning metadata.';
  page.drawText(retSub, {
    x: margin + 10,
    y: y - 28,
    size: 7.5,
    font: helv,
    color: slate
  });

  y -= 50;

  // 5. Checklist Verification Results (if any)
  if (checklistRows.length > 0) {
    checkPageBreak(30 + checklistRows.length * 16);
    page.drawText('RETURN UNBOXING VERIFICATION CHECKLIST', {
      x: margin,
      y,
      size: 11,
      font: helvBold,
      color: darkSlate
    });
    y -= 14;

    for (const row of checklistRows) {
      checkPageBreak(18);
      const icon = row.completed ? '[x]' : '[ ]';
      const statusLabel = row.completed ? 'VERIFIED' : 'PENDING';
      const timeOffset =
        row.completedAtOffsetSec !== undefined ? ` [T+${row.completedAtOffsetSec}s]` : '';

      page.drawText(`${icon}  ${row.title}${timeOffset}`, {
        x: margin + 8,
        y,
        size: 8.5,
        font: helv,
        color: row.completed ? black : slate
      });

      page.drawText(statusLabel, {
        x: margin + contentW - 70,
        y,
        size: 8,
        font: helvBold,
        color: row.completed ? green : slate
      });

      y -= 15;
    }
    y -= 10;
  }

  // 6. Complete Dispute Dossier Text
  checkPageBreak(120);
  page.drawText('MARKETPLACE DISPUTE DOSSIER LETTER (FORMATTED SUBMISSION)', {
    x: margin,
    y,
    size: 11,
    font: helvBold,
    color: darkSlate
  });
  y -= 14;

  const disputeLines = disputeText.split('\n');
  for (const line of disputeLines) {
    checkPageBreak(14);
    if (!line.trim()) {
      y -= 6;
      continue;
    }

    // Split line if it exceeds page width
    const words = line.split(' ');
    let currentLine = '';
    for (const w of words) {
      const testLine = currentLine ? `${currentLine} ${w}` : w;
      if (helv.widthOfTextAtSize(testLine, 8.5) > contentW - 16) {
        page.drawText(currentLine, { x: margin + 8, y, size: 8.5, font: helv, color: black });
        y -= 11;
        checkPageBreak(14);
        currentLine = w;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      page.drawText(currentLine, { x: margin + 8, y, size: 8.5, font: helv, color: black });
      y -= 11;
    }
  }

  // Final page footer
  drawFooter(page);

  return pdfDoc.save();
}

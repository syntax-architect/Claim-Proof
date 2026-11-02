// ═══════════════════════════════════════════════════════════════════════
// SABOOT.in — Synthetic Label PDF Generator for Stress Testing
// Generates realistic marketplace shipping label PDFs with 1, 100, 500, 2000
// pages in each supported layout ('4x6', '4x4', 'grid4').
// ═══════════════════════════════════════════════════════════════════════

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pdfLib from 'pdf-lib';

const { PDFDocument, StandardFonts, rgb } = pdfLib;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const SUPPORTED_LAYOUTS = ['4x6', '4x4', 'grid4'];
export const PAGE_COUNTS = [1, 100, 500, 2000];

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const THERMAL_4X4 = 288;
const THERMAL_4X6_W = 288;
const THERMAL_4X6_H = 432;

const MARKETPLACES = ['Meesho', 'Flipkart', 'Amazon', 'Myntra', 'AJIO'];
const COURIERS = [
  'Valmo Courier',
  'Delhivery',
  'Ekart Logistics',
  'XpressBees',
  'Shadowfax',
  'ValmoPlus Express'
];

/**
 * Draws a mock barcode pattern onto a PDF page.
 */
function drawBarcode(page, x, y, text, height = 40) {
  let bx = x;
  for (let i = 0; i < text.length * 3; i++) {
    const code = text.charCodeAt(i % text.length) + i * 7;
    const bw = (code % 3) + 1.2;
    if (i % 2 === 0) {
      page.drawRectangle({ x: bx, y, width: bw, height, color: rgb(0, 0, 0) });
    }
    bx += bw + 1.2;
  }
}

/**
 * Generates an in-memory PDFDocument for the specified layout and page count.
 */
export async function generateSyntheticPdfDoc(layout, pageCount) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  if (layout === '4x6') {
    // 4×6 single-label per A4 sheet (standard marketplace label top half)
    for (let i = 0; i < pageCount; i++) {
      const page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
      const top = A4_HEIGHT;
      const mp = MARKETPLACES[i % MARKETPLACES.length];
      const courier = COURIERS[i % COURIERS.length];
      const awb = '5894' + String(1000000 + i);
      const orderId = 'OD' + String(7000000 + i);
      const sku = `SKU-${mp.slice(0, 3).toUpperCase()}-${String(i % 50).padStart(3, '0')}`;
      const qty = (i % 7 === 0) ? 2 : 1;

      // Header
      page.drawText(mp.toUpperCase(), { x: 50, y: top - 60, size: 22, font: bold });
      page.drawText('SHIPPING LABEL · PREPAID', { x: 50, y: top - 78, size: 8, font });

      // Barcode & AWB
      drawBarcode(page, 50, top - 150, awb, 45);
      page.drawText(`AWB No: ${awb}`, { x: 50, y: top - 170, size: 14, font: bold });

      // Meta fields
      page.drawText(`Order ID: ${orderId}`, { x: 50, y: top - 200, size: 11, font });
      page.drawText(`SKU: ${sku}`, { x: 50, y: top - 218, size: 11, font: bold });
      page.drawText(`Qty: ${qty}`, { x: 50, y: top - 236, size: 11, font });
      page.drawText(`Courier Partner: ${courier}`, { x: 50, y: top - 254, size: 11, font });
      page.drawText(`Invoice Total: Rs. ${(499 + (i % 20) * 50).toFixed(2)}`, {
        x: 50,
        y: top - 272,
        size: 11,
        font
      });
    }
  } else if (layout === '4x4') {
    // 4×4 inch square thermal format
    for (let i = 0; i < pageCount; i++) {
      const page = doc.addPage([THERMAL_4X4, THERMAL_4X4]);
      const top = THERMAL_4X4;
      const mp = MARKETPLACES[i % MARKETPLACES.length];
      const courier = COURIERS[i % COURIERS.length];
      const awb = '4400' + String(1000000 + i);
      const orderId = 'OD44' + String(7000000 + i);
      const sku = `SQ-${mp.slice(0, 3).toUpperCase()}-${String(i % 40).padStart(3, '0')}`;
      const qty = 1;

      page.drawText(mp.toUpperCase(), { x: 20, y: top - 35, size: 16, font: bold });
      drawBarcode(page, 20, top - 90, awb, 35);
      page.drawText(`AWB No: ${awb}`, { x: 20, y: top - 110, size: 11, font: bold });
      page.drawText(`Order ID: ${orderId}`, { x: 20, y: top - 130, size: 9, font });
      page.drawText(`SKU: ${sku}`, { x: 20, y: top - 146, size: 9, font: bold });
      page.drawText(`Qty: ${qty}`, { x: 20, y: top - 162, size: 9, font });
      page.drawText(`Courier: ${courier}`, { x: 20, y: top - 178, size: 9, font });
    }
  } else if (layout === 'grid4') {
    // 4 labels per A4 page in 4 quadrants
    for (let p = 0; p < pageCount; p++) {
      const page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
      const halfW = A4_WIDTH / 2;
      const halfH = A4_HEIGHT / 2;

      // 4 quadrants per sheet
      const quadrants = [
        { q: 0, x0: 25, y0: halfH + 20, top: A4_HEIGHT - 20 }, // Top-Left
        { q: 1, x0: halfW + 25, y0: halfH + 20, top: A4_HEIGHT - 20 }, // Top-Right
        { q: 2, x0: 25, y0: 20, top: halfH - 20 }, // Bottom-Left
        { q: 3, x0: halfW + 25, y0: 20, top: halfH - 20 } // Bottom-Right
      ];

      for (const quad of quadrants) {
        const itemIdx = p * 4 + quad.q;
        const mp = MARKETPLACES[itemIdx % MARKETPLACES.length];
        const courier = COURIERS[itemIdx % COURIERS.length];
        const awb = 'GRID' + String(10000000 + itemIdx);
        const orderId = 'ODGR' + String(7000000 + itemIdx);
        const sku = `G4-${mp.slice(0, 3).toUpperCase()}-${String(itemIdx % 50).padStart(3, '0')}`;
        const qty = itemIdx % 5 === 0 ? 2 : 1;

        page.drawText(mp.toUpperCase(), { x: quad.x0, y: quad.top - 20, size: 14, font: bold });
        drawBarcode(page, quad.x0, quad.top - 70, awb, 30);
        page.drawText(`AWB No: ${awb}`, { x: quad.x0, y: quad.top - 88, size: 10, font: bold });
        page.drawText(`Order ID: ${orderId}`, { x: quad.x0, y: quad.top - 104, size: 8, font });
        page.drawText(`SKU: ${sku}`, { x: quad.x0, y: quad.top - 118, size: 8, font: bold });
        page.drawText(`Qty: ${qty}`, { x: quad.x0, y: quad.top - 132, size: 8, font });
        page.drawText(`Courier: ${courier}`, { x: quad.x0, y: quad.top - 146, size: 8, font });
      }
    }
  }

  return doc;
}

/**
 * Generates synthetic PDF as Uint8Array bytes.
 */
export async function generateSyntheticPdfBytes(layout, pageCount) {
  const doc = await generateSyntheticPdfDoc(layout, pageCount);
  return doc.save();
}

/**
 * CLI runner when executed directly: node scripts/generate_stress_labels.mjs
 */
async function main() {
  const outDir = join(__dirname, '..', 'test-fixtures', 'stress-labels');
  mkdirSync(outDir, { recursive: true });

  console.log(`Generating synthetic label PDFs in ${outDir}...`);
  for (const layout of SUPPORTED_LAYOUTS) {
    for (const pages of PAGE_COUNTS) {
      const start = Date.now();
      const bytes = await generateSyntheticPdfBytes(layout, pages);
      const elapsedMs = Date.now() - start;
      const fileName = `synthetic_${layout}_${pages}p.pdf`;
      writeFileSync(join(outDir, fileName), bytes);
      console.log(
        `✓ ${fileName.padEnd(26)}: ${pages} pages in ${elapsedMs}ms (${(bytes.length / 1024 / 1024).toFixed(2)} MB)`
      );
    }
  }
  console.log('All synthetic stress label PDFs generated successfully.');
}

if (process.argv[1] && process.argv[1].endsWith('generate_stress_labels.mjs')) {
  main().catch((err) => {
    console.error('Error generating stress labels:', err);
    process.exit(1);
  });
}

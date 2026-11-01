import pdfLib from 'pdf-lib';
import { copyFileSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePdfBuffer } from '../src/services/pdfLabelProcessor.js';

const { PDFDocument, StandardFonts, rgb, degrees } = pdfLib;

const targetDirs = [
  join(process.cwd(), 'tests', 'fixtures'),
  join(process.cwd(), '..', 'tests', 'fixtures')
];

for (const dir of targetDirs) {
  mkdirSync(dir, { recursive: true });
}

// 1. Copy sample PDFs to fixtures
const samples = [
  { name: 'meesho', src: join(process.cwd(), 'samples', 'sample_labels_meesho.pdf') },
  { name: 'flipkart', src: join(process.cwd(), 'samples', 'sample_labels_flipkart.pdf') },
  { name: 'amazon', src: join(process.cwd(), 'samples', 'sample_labels_amazon.pdf') }
];

async function createScannedPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  // Draw a gray rectangle (simulating a scanned image background) with NO text
  page.drawRectangle({
    x: 40,
    y: 400,
    width: 515,
    height: 380,
    color: rgb(0.9, 0.9, 0.9)
  });
  return await doc.save();
}

async function createRotatedPdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595.28, 841.89]);
  page.setRotation(degrees(90));

  page.drawText('Flipkart Logistics', { x: 50, y: 780, size: 14, font: bold, color: rgb(0, 0, 0) });
  page.drawText('AWB: FMP9928374610', { x: 50, y: 750, size: 12, font: bold, color: rgb(0, 0, 0) });
  page.drawText('Order ID: OD99283746101', { x: 50, y: 720, size: 10, font, color: rgb(0, 0, 0) });
  page.drawText('SKU: FKT-ROT-TEST-M', { x: 50, y: 690, size: 10, font: bold, color: rgb(0, 0, 0) });
  page.drawText('Courier: Ekart Logistics', { x: 50, y: 660, size: 10, font, color: rgb(0, 0, 0) });
  page.drawText('Qty: 1 pcs', { x: 50, y: 630, size: 10, font, color: rgb(0, 0, 0) });

  return await doc.save();
}

async function createMissingFieldsPdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595.28, 841.89]);

  page.drawText('Meesho Package', { x: 50, y: 780, size: 14, font: bold, color: rgb(0, 0, 0) });
  page.drawText('Order ID: 9988776655', { x: 50, y: 750, size: 10, font, color: rgb(0, 0, 0) });
  page.drawText('Courier: Delhivery', { x: 50, y: 720, size: 10, font, color: rgb(0, 0, 0) });
  page.drawText('Qty: 2', { x: 50, y: 690, size: 10, font, color: rgb(0, 0, 0) });
  page.drawText('Invoice Total: Rs. 499.00', { x: 50, y: 660, size: 10, font, color: rgb(0, 0, 0) });
  // Notice: No AWB and no SKU

  return await doc.save();
}

async function main() {
  const fixtures = [];

  for (const s of samples) {
    const bytes = readFileSync(s.src);
    fixtures.push({ name: s.name, bytes });
  }

  fixtures.push({ name: 'scanned_image_only', bytes: await createScannedPdf() });
  fixtures.push({ name: 'rotated_label', bytes: await createRotatedPdf() });
  fixtures.push({ name: 'missing_fields', bytes: await createMissingFieldsPdf() });

  for (const f of fixtures) {
    const labels = await parsePdfBuffer(f.bytes, `${f.name}.pdf`);

    // Standardize expected format: clean up volatile fields like sourceFile
    const expected = labels.map((l) => ({
      page: l.page,
      marketplace: l.marketplace,
      awb: l.awb,
      orderId: l.orderId,
      courier: l.courier,
      sku: l.sku,
      size: l.size,
      color: l.color,
      qty: l.qty,
      invoiceTotal: l.invoiceTotal,
      confidence: l.confidence,
      needsManualEdit: l.needsManualEdit ?? false,
      missingFields: l.missingFields ?? [],
      isImageOnly: l.isImageOnly ?? false,
      warning: l.warning
    }));

    for (const baseDir of targetDirs) {
      const fixDir = join(baseDir, f.name);
      mkdirSync(fixDir, { recursive: true });
      writeFileSync(join(fixDir, 'label.pdf'), f.bytes);
      writeFileSync(join(fixDir, 'expected.json'), JSON.stringify(expected, null, 2) + '\n');
    }

    console.log(`Generated fixture "${f.name}": ${labels.length} labels`);
  }
}

main().catch(console.error);

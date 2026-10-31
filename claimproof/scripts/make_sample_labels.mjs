/* Generates realistic sample marketplace label PDFs for testing the parser:
 *   samples/sample_labels_meesho.pdf    (3 labels — Valmo, Delhivery, ValmoPlus, multi-qty)
 *   samples/sample_labels_flipkart.pdf  (2 labels — Ekart, multi-qty)
 *   samples/sample_labels_amazon.pdf    (1 label — XpressBees, numeric AWB fallback)
 * Run: node scripts/make_sample_labels.mjs */
import pdfLib from 'pdf-lib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'samples');
mkdirSync(outDir, { recursive: true });

const { PDFDocument, StandardFonts, rgb } = pdfLib;

const A4 = [595.28, 841.89];
const INK = rgb(0.08, 0.1, 0.13);
const MUTED = rgb(0.4, 0.45, 0.52);
const LINE = rgb(0.78, 0.8, 0.84);

const BATCHES = [
  {
    file: 'sample_labels_meesho.pdf',
    labels: [
      { marketplace: 'Meesho', awb: '5894372819', orderId: '6283749213', sku: 'MSH-KRT-BLU-XL', size: 'XL', qty: 1, total: 'Rs. 899.00', courier: 'Valmo Courier' },
      { marketplace: 'Meesho', awb: '5894372820', orderId: '6283749214', sku: 'MSH-SAR-RED-FS', size: 'FS', qty: 2, total: 'Rs. 1,249.00', courier: 'Delhivery' },
      { marketplace: 'Meesho', awb: '5894372821', orderId: '6283749215', sku: 'MSH-TSH-GRN-M', size: 'M', qty: 3, total: 'Rs. 599.00', courier: 'ValmoPlus Express' }
    ]
  },
  {
    file: 'sample_labels_flipkart.pdf',
    labels: [
      { marketplace: 'Flipkart', awb: 'FMP3902178445', orderId: 'OD32918475612', sku: 'FKT-TSH-GRN-M', size: 'M', qty: 1, total: 'Rs. 649.00', courier: 'Ekart Logistics' },
      { marketplace: 'Flipkart', awb: 'FMP3902178446', orderId: 'OD32918475613', sku: 'FKT-KRT-BLU-XL', size: 'XL', qty: 2, total: 'Rs. 1,199.00', courier: 'Ekart Logistics' }
    ]
  },
  {
    file: 'sample_labels_amazon.pdf',
    labels: [
      { marketplace: 'Amazon', awb: '3901827364551', orderId: '402-7364521-8875323', sku: 'AMZ-EAR-BLK-1', size: 'ONE SIZE', qty: 1, total: 'Rs. 1,499.00', courier: 'XpressBees Logistics' }
    ]
  }
];

function drawBarcode(page, x, y, text, height) {
  let bx = x;
  for (let i = 0; i < text.length * 3; i++) {
    const code = text.charCodeAt(i % text.length) + i * 7;
    const bw = (code % 3) + 1.4;
    if (i % 2 === 0) {
      page.drawRectangle({ x: bx, y, width: bw, height, color: rgb(0, 0, 0) });
    }
    bx += bw + 1.2;
  }
  return bx;
}

async function build(batch) {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const label of batch.labels) {
    const page = doc.addPage(A4);
    const top = 841.89;

    /* Dashed cut border around the top-half label area. */
    page.drawRectangle({
      x: 40, y: top - 380, width: 515, height: 340,
      borderColor: LINE, borderWidth: 1, borderDashArray: [6, 5]
    });

    page.drawText(label.marketplace.toUpperCase(), { x: 60, y: top - 80, size: 26, font: bold, color: INK });
    page.drawText('SHIPPING LABEL  ·  PREPAID', { x: 60, y: top - 100, size: 9, font: helv, color: MUTED });

    page.drawLine({ start: { x: 60, y: top - 116 }, end: { x: 535, y: top - 116 }, thickness: 1, color: LINE });

    /* Barcode + AWB. */
    const end = drawBarcode(page, 60, top - 210, label.awb, 54);
    page.drawText(`AWB No: ${label.awb}`, { x: 60, y: top - 232, size: 15, font: bold, color: INK });
    page.drawText('(Scan at every hub)', { x: end + 14, y: top - 196, size: 8, font: helv, color: MUTED });

    /* Field block. */
    const fields = [
      `Order ID: ${label.orderId}`,
      `SKU: ${label.sku}`,
      `Size: ${label.size || 'NA'}`,
      `Qty: ${label.qty}`,
      `Invoice Total: ${label.total}`,
      `Courier Partner: ${label.courier}`
    ];
    let fy = top - 262;
    for (const f of fields) {
      page.drawText(f, { x: 60, y: fy, size: 12, font: bold, color: INK });
      fy -= 22;
    }

    /* Address block. */
    page.drawText('DELIVER TO:', { x: 330, y: top - 262, size: 9, font: bold, color: MUTED });
    const addr = ['Riya Sharma', 'H No 42, Sector 14, Vashi', 'Navi Mumbai, Maharashtra 400703', 'Phone: 98XXXXXX21'];
    let ay = top - 278;
    for (const line of addr) {
      page.drawText(line, { x: 330, y: ay, size: 10, font: helv, color: INK });
      ay -= 15;
    }

    page.drawText(`Weight: 0.${(label.qty * 137) % 900} kg   ·   COD: Prepaid`, {
      x: 60, y: top - 352, size: 9, font: helv, color: MUTED
    });
    page.drawText('If undelivered, return to origin warehouse. Keep slip for refund claims.', {
      x: 60, y: top - 368, size: 8, font: helv, color: MUTED
    });
  }

  const bytes = await doc.save();
  writeFileSync(join(outDir, batch.file), bytes);
  console.log('wrote samples/' + batch.file, `(${batch.labels.length} labels)`);
}

for (const batch of BATCHES) {
  await build(batch);
}
console.log('samples done');

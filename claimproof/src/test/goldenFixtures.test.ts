import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pdfLib from 'pdf-lib';
import { parsePdfBuffer } from '../services/pdfLabelProcessor';

const { PDFDocument, StandardFonts, rgb, degrees } = pdfLib;

const fixtureRoots = [
  join(process.cwd(), 'tests', 'fixtures'),
  join(process.cwd(), '..', 'tests', 'fixtures')
];

// Helper to create synthetic PDFs for edge cases
async function createScannedPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  // Background only — zero text layer
  page.drawRectangle({
    x: 40,
    y: 300,
    width: 515,
    height: 400,
    color: rgb(0.92, 0.92, 0.92)
  });
  return await doc.save();
}

async function createRotatedPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595.28, 841.89]);
  page.setRotation(degrees(90));

  page.drawText('Flipkart Logistics Hub', {
    x: 50,
    y: 780,
    size: 14,
    font: bold,
    color: rgb(0, 0, 0)
  });
  page.drawText('AWB: FMP9928374610', { x: 50, y: 740, size: 12, font: bold, color: rgb(0, 0, 0) });
  page.drawText('Order ID: OD99283746101', { x: 50, y: 710, size: 10, font, color: rgb(0, 0, 0) });
  page.drawText('SKU: FKT-ROT-TEST-M', {
    x: 50,
    y: 680,
    size: 10,
    font: bold,
    color: rgb(0, 0, 0)
  });
  page.drawText('Courier: Ekart Logistics', { x: 50, y: 650, size: 10, font, color: rgb(0, 0, 0) });
  page.drawText('Qty: 1 pcs', { x: 50, y: 620, size: 10, font, color: rgb(0, 0, 0) });

  return await doc.save();
}

async function createMissingFieldsPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595.28, 841.89]);

  page.drawText('Meesho Package Receipt', {
    x: 50,
    y: 780,
    size: 14,
    font: bold,
    color: rgb(0, 0, 0)
  });
  page.drawText('Order ID: 9988776655', { x: 50, y: 740, size: 10, font, color: rgb(0, 0, 0) });
  page.drawText('Courier: Delhivery', { x: 50, y: 710, size: 10, font, color: rgb(0, 0, 0) });
  page.drawText('Qty: 2', { x: 50, y: 680, size: 10, font, color: rgb(0, 0, 0) });
  page.drawText('Invoice Total: Rs. 499.00', {
    x: 50,
    y: 650,
    size: 10,
    font,
    color: rgb(0, 0, 0)
  });

  return await doc.save();
}

async function ensureSeedFixtures() {
  for (const root of fixtureRoots) {
    mkdirSync(root, { recursive: true });

    // Seed sample marketplace labels if not present
    const samples = [
      { name: 'meesho', src: join(process.cwd(), 'samples', 'sample_labels_meesho.pdf') },
      { name: 'flipkart', src: join(process.cwd(), 'samples', 'sample_labels_flipkart.pdf') },
      { name: 'amazon', src: join(process.cwd(), 'samples', 'sample_labels_amazon.pdf') }
    ];

    for (const s of samples) {
      const fixDir = join(root, s.name);
      if (!existsSync(fixDir)) mkdirSync(fixDir, { recursive: true });
      const pdfPath = join(fixDir, 'label.pdf');
      const expPath = join(fixDir, 'expected.json');

      if (!existsSync(pdfPath) && existsSync(s.src)) {
        writeFileSync(pdfPath, readFileSync(s.src));
      }

      if (existsSync(pdfPath) && !existsSync(expPath)) {
        const labels = await parsePdfBuffer(readFileSync(pdfPath), `${s.name}.pdf`);
        const golden = labels.map((l) => ({
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
          missingFields: l.missingFields ?? []
        }));
        writeFileSync(expPath, JSON.stringify(golden, null, 2) + '\n');
      }
    }

    // Seed synthetic edge cases: scanned, rotated, missing_fields
    const synthetic = [
      { name: 'scanned_image_only', makePdf: createScannedPdf },
      { name: 'rotated_label', makePdf: createRotatedPdf },
      { name: 'missing_fields', makePdf: createMissingFieldsPdf }
    ];

    for (const syn of synthetic) {
      const fixDir = join(root, syn.name);
      if (!existsSync(fixDir)) mkdirSync(fixDir, { recursive: true });
      const pdfPath = join(fixDir, 'label.pdf');
      const expPath = join(fixDir, 'expected.json');

      if (!existsSync(pdfPath)) {
        const bytes = await syn.makePdf();
        writeFileSync(pdfPath, bytes);
      }

      if (existsSync(pdfPath) && !existsSync(expPath)) {
        const labels = await parsePdfBuffer(readFileSync(pdfPath), `${syn.name}.pdf`);
        const golden = labels.map((l) => ({
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
        writeFileSync(expPath, JSON.stringify(golden, null, 2) + '\n');
      }
    }
  }
}

describe('Golden-file label PDF test setup', () => {
  beforeAll(async () => {
    await ensureSeedFixtures();
  });

  it('discovers and verifies every fixture PDF against its expected.json', async () => {
    // Gather all fixtures across target roots
    const tested = new Set<string>();

    for (const baseRoot of fixtureRoots) {
      if (!existsSync(baseRoot)) continue;
      const entries = readdirSync(baseRoot, { withFileTypes: true });

      for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        const dir = join(baseRoot, ent.name);
        const expPath = join(dir, 'expected.json');
        if (!existsSync(expPath)) continue;

        // Find the PDF file in this directory
        const pdfFiles = readdirSync(dir).filter((f) => f.endsWith('.pdf'));
        if (pdfFiles.length === 0) continue;

        const fixtureKey = `${ent.name}`;
        if (tested.has(fixtureKey)) continue;
        tested.add(fixtureKey);

        const pdfPath = join(dir, pdfFiles[0]);
        const pdfBytes = readFileSync(pdfPath);
        const expectedJson = JSON.parse(readFileSync(expPath, 'utf8'));

        const actualLabels = await parsePdfBuffer(pdfBytes, pdfFiles[0]);

        // 1. Length must match exactly
        expect(actualLabels.length, `Fixture ${fixtureKey} label count mismatch`).toBe(
          expectedJson.length
        );

        // 2. Each field in expected.json must match actual
        for (let i = 0; i < expectedJson.length; i++) {
          const expected = expectedJson[i];
          const actual = actualLabels[i];

          expect(actual.page, `${fixtureKey}[${i}].page`).toBe(expected.page);
          expect(actual.marketplace, `${fixtureKey}[${i}].marketplace`).toBe(expected.marketplace);
          expect(actual.awb, `${fixtureKey}[${i}].awb`).toBe(expected.awb);
          expect(actual.sku, `${fixtureKey}[${i}].sku`).toBe(expected.sku);
          expect(actual.orderId, `${fixtureKey}[${i}].orderId`).toBe(expected.orderId);
          expect(actual.courier, `${fixtureKey}[${i}].courier`).toBe(expected.courier);
          expect(actual.qty, `${fixtureKey}[${i}].qty`).toBe(expected.qty);

          if (expected.size !== undefined) {
            expect(actual.size, `${fixtureKey}[${i}].size`).toBe(expected.size);
          }
          if (expected.needsManualEdit !== undefined) {
            expect(actual.needsManualEdit ?? false, `${fixtureKey}[${i}].needsManualEdit`).toBe(
              expected.needsManualEdit
            );
          }
          if (expected.isImageOnly !== undefined) {
            expect(actual.isImageOnly ?? false, `${fixtureKey}[${i}].isImageOnly`).toBe(
              expected.isImageOnly
            );
          }
          if (expected.missingFields !== undefined) {
            expect(actual.missingFields ?? [], `${fixtureKey}[${i}].missingFields`).toEqual(
              expected.missingFields
            );
          }
          if (expected.confidence !== undefined) {
            expect(actual.confidence, `${fixtureKey}[${i}].confidence`).toBeDefined();
            for (const [field, score] of Object.entries(expected.confidence)) {
              expect(
                (actual.confidence as any)?.[field],
                `${fixtureKey}[${i}].confidence.${field}`
              ).toBe(score);
            }
          }
        }
      }
    }

    expect(tested.size, 'Should have tested at least 5 fixtures').toBeGreaterThanOrEqual(5);
  });
});

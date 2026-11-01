import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  chunksToText,
  cleanText,
  extractAwb,
  extractColor,
  extractCourier,
  extractInvoiceTotal,
  extractMarketplace,
  extractOrderId,
  extractQty,
  extractSize,
  extractSku,
  firstMatch,
  labelFromChunks,
  parsePdfBuffer,
  processLabelFiles
} from './pdfLabelProcessor';

describe('pdfLabelProcessor pure helpers & sample PDF parser', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-31T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Pure text extraction helpers', () => {
    it('cleanText cleans whitespace, control characters, and trims', () => {
      expect(cleanText('   hello   world   \n  \t  ')).toBe('hello world');
      expect(cleanText('')).toBe('');
      expect(cleanText('AWB-123\u00A0456')).toBe('AWB-123 456');
    });

    it('chunksToText concatenates text chunks ordered spatially', () => {
      const chunks = [
        { str: 'DELHIVERY', x: 20, y: 100, w: 60, h: 12 },
        { str: 'AWB: 1234567890', x: 20, y: 80, w: 100, h: 10 },
        { str: 'SKU: KURTI-XL', x: 20, y: 60, w: 80, h: 10 }
      ];
      const text = chunksToText(chunks);
      expect(text).toContain('DELHIVERY');
      expect(text).toContain('AWB: 1234567890');
      expect(text).toContain('SKU: KURTI-XL');
    });

    it('firstMatch matches first regex pattern in candidate list', () => {
      const text = 'Tracking No: 9988776655 Order: ORD-12345';
      const patterns = [
        /AWB[:\s]+([A-Z0-9]+)/i,
        /Tracking No[:\s]+([0-9]+)/i,
        /Order[:\s]+([A-Z0-9-]+)/i
      ];
      expect(firstMatch(text, patterns)).toBe('9988776655');
    });

    it('extractAwb extracts barcode/tracking strings across couriers', () => {
      const valmoText = 'Valmo Express AWB: 5894372819 Courier Partner: Valmo';
      const valmoRes = extractAwb(valmoText);
      expect(valmoRes.awb).toBe('5894372819');
      expect(valmoRes.confidence).toBeGreaterThan(0.7);

      const delhiveryText = 'Delhivery Airway Bill # 149204928174 SKU: TSHIRT';
      const delhiveryRes = extractAwb(delhiveryText);
      expect(delhiveryRes.awb).toBe('149204928174');

      const ekartText = 'Ekart Logistics Tracking ID: FMPC1234567890';
      const ekartRes = extractAwb(ekartText);
      expect(ekartRes.awb).toBe('FMPC1234567890');
    });

    it('extractSku extracts product identifier', () => {
      const text = 'Item Name: Cotton T-Shirt SKU: TSHIRT-BLK-L Qty: 1';
      const res = extractSku(text);
      expect(res.sku).toBe('TSHIRT-BLK-L');
      expect(res.confidence).toBeGreaterThan(0.5);

      const noSkuText = 'General Shipping Label with no product code';
      const fallback = extractSku(noSkuText);
      expect(fallback.sku).toBe('');
      expect(fallback.confidence).toBe(0);
    });

    it('extractOrderId extracts order numbers from various formats', () => {
      // Flipkart format OD...
      expect(extractOrderId('Order ID: OD123456789012345000').orderId).toBe(
        'OD123456789012345000'
      );

      // Amazon format 3-7-7 digits
      expect(extractOrderId('Order # 404-1234567-7654321').orderId).toBe(
        '404-1234567-7654321'
      );

      // Meesho format
      expect(extractOrderId('Sub-Order No: 987654321_1').orderId).toBe('987654321_1');
    });

    it('extractCourier identifies standard courier partners', () => {
      expect(extractCourier('Delivered by Delhivery Surface').courier).toBe('Delhivery');
      expect(extractCourier('Valmo Delivery Network').courier).toBe('Valmo');
      expect(extractCourier('Ekart Logistics Courier').courier).toBe('Ekart');
      expect(extractCourier('Shadowfax Technologies Pvt Ltd').courier).toBe('Shadowfax');
      expect(extractCourier('Xpressbees Express Logistics').courier).toBe('Xpressbees');
      expect(extractCourier('Ecom Express Limited').courier).toBe('Ecom Express');
      expect(extractCourier('DTDC Courier & Cargo').courier).toBe('DTDC');
    });

    it('extractMarketplace identifies major Indian e-commerce marketplaces', () => {
      expect(extractMarketplace('Meesho Supply Pvt Ltd').marketplace).toBe('Meesho');
      expect(extractMarketplace('Sold on Flipkart Internet Private Limited').marketplace).toBe(
        'Flipkart'
      );
      expect(extractMarketplace('Amazon Seller Services Pvt Ltd').marketplace).toBe('Amazon');
      expect(extractMarketplace('Reliance Retail AJIO').marketplace).toBe('AJIO');
      expect(extractMarketplace('Myntra Designs Pvt Ltd').marketplace).toBe('Myntra');
    });

    it('extractQty extracts unit quantity with fallback to 1', () => {
      expect(extractQty('Quantity: 4 Units').qty).toBe(4);
      expect(extractQty('QTY : 2').qty).toBe(2);
      expect(extractQty('No quantity mentioned here').qty).toBe(1);
    });

    it('extractSize extracts apparel / footwear sizing', () => {
      expect(extractSize('Size: XL Color: Blue').size).toBe('XL');
      expect(extractSize('Size : Free Size').size).toBe('FREE SIZE');
      expect(extractSize('Size: 32').size).toBe('32');
    });

    it('extractColor extracts product color attributes', () => {
      expect(extractColor('Color: Navy Blue SKU: S-1').color).toBe('Navy Blue');
      expect(extractColor('Colour: Maroon\nSize: M').color).toBe('Maroon');
    });

    it('extractInvoiceTotal parses INR invoice totals', () => {
      expect(extractInvoiceTotal('Invoice Total: ₹ 1,499.00').total).toBe(1499);
      expect(extractInvoiceTotal('Total Amount: Rs. 499').total).toBe(499);
      expect(extractInvoiceTotal('No price on this packing slip').total).toBeNull();
    });

    it('labelFromChunks builds a complete ExtractedLabel record with bbox', () => {
      const chunks = [
        { str: 'Meesho Marketplace', x: 50, y: 700, w: 100, h: 12 },
        { str: 'AWB: 5894372819', x: 50, y: 650, w: 120, h: 14 },
        { str: 'Order ID: 987654321', x: 50, y: 620, w: 110, h: 12 },
        { str: 'SKU: MSH-KRT-BLU-XL', x: 50, y: 580, w: 100, h: 12 },
        { str: 'Size: XL', x: 50, y: 560, w: 50, h: 10 },
        { str: 'Qty: 2', x: 120, y: 560, w: 40, h: 10 },
        { str: 'Valmo Logistics', x: 50, y: 500, w: 90, h: 10 }
      ];

      const pageInfo = {
        fileIndex: 0,
        fileName: 'test_label.pdf',
        pageIndex: 0,
        pageW: 595,
        pageH: 842,
        chunks
      };

      const label = labelFromChunks(pageInfo, chunks);
      expect(label.awb).toBe('5894372819');
      expect(label.sku).toBe('MSH-KRT-BLU-XL');
      expect(label.orderId).toBe('987654321');
      expect(label.size).toBe('XL');
      expect(label.qty).toBe(2);
      expect(label.courier).toBe('Valmo');
      expect(label.marketplace).toBe('Meesho');
      expect(label.contentBox).toBeDefined();
      expect(label.contentBox.w).toBeGreaterThan(0);
      expect(label.contentBox.h).toBeGreaterThan(0);
    });
  });

  describe('Sample PDF parser tests (/samples)', () => {
    const samplesDir = join(process.cwd(), 'samples');

    it('parses sample_labels_meesho.pdf accurately', async () => {
      const filePath = join(samplesDir, 'sample_labels_meesho.pdf');
      if (!existsSync(filePath)) return;

      const buffer = readFileSync(filePath);
      const labels = await parsePdfBuffer(buffer, 'sample_labels_meesho.pdf');

      expect(labels.length).toBeGreaterThan(0);
      const first = labels[0];
      expect(first.marketplace).toBe('Meesho');
      expect(first.awb).toBeDefined();
      expect(first.sku).toBeDefined();
      expect(first.courier).toBeDefined();
    });

    it('parses sample_labels_flipkart.pdf accurately', async () => {
      const filePath = join(samplesDir, 'sample_labels_flipkart.pdf');
      if (!existsSync(filePath)) return;

      const buffer = readFileSync(filePath);
      const labels = await parsePdfBuffer(buffer, 'sample_labels_flipkart.pdf');

      expect(labels.length).toBeGreaterThan(0);
      const first = labels[0];
      expect(first.marketplace).toBe('Flipkart');
      expect(first.awb).toBeDefined();
    });

    it('parses sample_labels_amazon.pdf accurately', async () => {
      const filePath = join(samplesDir, 'sample_labels_amazon.pdf');
      if (!existsSync(filePath)) return;

      const buffer = readFileSync(filePath);
      const labels = await parsePdfBuffer(buffer, 'sample_labels_amazon.pdf');

      expect(labels.length).toBeGreaterThan(0);
      const first = labels[0];
      expect(first.marketplace).toBe('Amazon');
      expect(first.awb).toBeDefined();
    });

    it('processes label files into 4x6 cropped vector PDF with manifest', async () => {
      const filePath = join(samplesDir, 'sample_labels_meesho.pdf');
      if (!existsSync(filePath)) return;

      const buffer = readFileSync(filePath);
      const fileInput = {
        name: 'sample_labels_meesho.pdf',
        arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      };

      const result = await processLabelFiles([fileInput], {
        preset: '4x6',
        stampSku: true,
        multiQtyGuard: true,
        valmoPlusAsValmo: true,
        withManifest: true,
        isFree: false
      });

      expect(result.pdfBytes).toBeDefined();
      expect(result.pdfBytes.length).toBeGreaterThan(100);
      expect(result.labels.length).toBeGreaterThan(0);
      expect(result.fileName).toContain('ClaimProof_Labels');
    });
  });
});

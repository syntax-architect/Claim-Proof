import { describe, it, expect } from 'vitest';
import {
  extractAwb,
  extractSku,
  extractOrderId,
  extractCourier,
  extractQty
} from '../services/pdfLabelProcessor';

describe('Regex helpers property-style robustness tests', () => {
  const unicodePunctuation = ['\u200B', '\u200C', '\u200D', '\uFEFF'];
  const unicodeWhitespace = [' ', '\t', '\n', '\r\n', '\u00A0', '\u2000', '\u2003', '\u202F'];
  const unicodeScripts = [
    'पार्सल और सामान', // Devanagari
    '📦 🚚 🏷️ ✅', // Emojis
    '包裹与快递', // CJK
    'طرد شحن سريع', // Arabic
    'Заказ и доставка', // Cyrillic
    'Référence d’expédition' // Accented Latin
  ];

  describe('AWB extraction with weird inputs', () => {
    it('handles extra spaces, tabs, newlines, and non-breaking spaces around prefixes', () => {
      const inputs = [
        'AWB:   5894372819',
        'AWB \t\t : \t 5894372819',
        'AWB \n\n : \n 5894372819',
        'A.W.B.   No.   :   5894372819',
        'Tracking   ID  #   5894372819',
        'Consignment   Number   :   5894372819',
        'Waybill   No   :   5894372819',
        'LRN   :   5894372819',
        'AWB\u00A0:\u00A05894372819',
        'AWB\u2003:\u20035894372819',
        'AWB\u202FNo\u202F:\u202F5894372819'
      ];

      for (const text of inputs) {
        const res = extractAwb(text);
        expect(res.awb, `Failed on input: ${JSON.stringify(text)}`).toBe('5894372819');
        expect(res.confidence).toBe(1.0);
      }
    });

    it('extracts AWBs surrounded by unicode scripts, emojis, and zero-width chars', () => {
      for (const script of unicodeScripts) {
        const text = `${script} \u200B AWB: 5894372819 \uFEFF ${script}`;
        const res = extractAwb(text);
        expect(res.awb, `Failed with script: ${script}`).toBe('5894372819');
        expect(res.confidence).toBe(1.0);
      }
    });

    it('handles very long noise strings without ReDoS or memory issues', () => {
      const noise = 'A random warehouse label text noise with numbers 123 and words. '.repeat(500); // ~32,000 chars
      const targetAwb = 'FMP9988776655';
      const text = `${noise}\nTracking ID: ${targetAwb}\n${noise}`;

      const t0 = performance.now();
      const res = extractAwb(text);
      const elapsed = performance.now() - t0;

      expect(res.awb).toBe(targetAwb);
      expect(res.confidence).toBe(1.0);
      expect(elapsed).toBeLessThan(150); // Bounded execution time
    });

    it('never throws or hangs on adversarial repeating patterns', () => {
      const adversarial = 'AWB: AWB: AWB: '.repeat(1000) + '5894372819';
      const t0 = performance.now();
      const res = extractAwb(adversarial);
      const elapsed = performance.now() - t0;

      expect(res.awb).toBe('5894372819');
      expect(elapsed).toBeLessThan(100);
    });

    it('falls back gracefully to numeric runs and gives 0.7 confidence', () => {
      const raw = 'Parcels to deliver: 5894372819 in batch';
      const res = extractAwb(raw);
      expect(res.awb).toBe('5894372819');
      expect(res.confidence).toBe(0.7);
    });

    it('returns empty string and 0 confidence when no AWB is found', () => {
      const res = extractAwb('Just some text with no tracking numbers at all.');
      expect(res.awb).toBe('');
      expect(res.confidence).toBe(0);
    });
  });

  describe('SKU extraction with weird inputs', () => {
    it('handles extra whitespace and unicode spaces around SKU prefixes', () => {
      const inputs = [
        'SKU:   MSH-KRT-BLU-XL',
        'SKU \t\t : \t MSH-KRT-BLU-XL',
        'SKU \n Code : \n MSH-KRT-BLU-XL',
        'Product Code : MSH-KRT-BLU-XL',
        'Item Code : MSH-KRT-BLU-XL',
        'SKU\u00A0:\u00A0MSH-KRT-BLU-XL',
        'SKU\u2003#\u2003MSH-KRT-BLU-XL'
      ];

      for (const text of inputs) {
        const res = extractSku(text);
        expect(res.sku, `Failed on: ${text}`).toBe('MSH-KRT-BLU-XL');
        expect(res.confidence).toBe(1.0);
      }
    });

    it('handles SKUs with special characters like dots, slashes, and underscores', () => {
      const skus = [
        'ABC/DEF/GHI',
        'ITEM.SIZE.XL',
        'TSH_BLK_2026',
        'CLOTH-100%COTTON',
        'A1-B2-C3-D4'
      ];

      for (const sku of skus) {
        const text = `Package contents:\nSKU: ${sku}\nHandle with care.`;
        const res = extractSku(text);
        expect(res.sku.startsWith(sku.slice(0, 10))).toBe(true);
        expect(res.confidence).toBe(1.0);
      }
    });

    it('handles very long noise strings around SKU without performance degradation', () => {
      const noise = 'Noise line with product description and seller address details. '.repeat(600);
      const targetSku = 'AMZ-PROD-9988-BLK';
      const text = `${noise}\nSKU Code: ${targetSku}\n${noise}`;

      const t0 = performance.now();
      const res = extractSku(text);
      const elapsed = performance.now() - t0;

      expect(res.sku).toBe(targetSku);
      expect(res.confidence).toBe(1.0);
      expect(elapsed).toBeLessThan(100);
    });

    it('returns empty string and 0 confidence when no SKU is present', () => {
      const res = extractSku('Invoice details without any product identifier');
      expect(res.sku).toBe('');
      expect(res.confidence).toBe(0);
    });
  });

  describe('Fuzzing & Property Invariants (100 randomized cases)', () => {
    const awbPrefixes = ['AWB:', 'AWB No:', 'Tracking ID:', 'Consignment#', 'LRN:', 'Waybill:'];
    const skuPrefixes = ['SKU:', 'SKU Code:', 'Product Code:', 'Item Code:'];

    it('consistently parses randomized fuzzed text combinations', () => {
      for (let i = 0; i < 100; i++) {
        const awbPrefix = awbPrefixes[i % awbPrefixes.length];
        const skuPrefix = skuPrefixes[i % skuPrefixes.length];
        const space1 = unicodeWhitespace[i % unicodeWhitespace.length].repeat((i % 4) + 1);
        const space2 = unicodeWhitespace[(i + 1) % unicodeWhitespace.length].repeat((i % 3) + 1);
        const punc = unicodePunctuation[i % unicodePunctuation.length];
        const script = unicodeScripts[i % unicodeScripts.length];

        const targetAwb = `99${i.toString().padStart(6, '0')}12`;
        const targetSku = `SKU-FUZZ-${i}-XL`;

        const text = [
          script,
          `${awbPrefix}${space1}${punc}${targetAwb}${punc}`,
          script,
          `${skuPrefix}${space2}${targetSku}`,
          'Order ID: OD12345678901',
          'Courier: Delhivery',
          'Qty: 2 pcs'
        ].join('\n');

        const awbRes = extractAwb(text);
        const skuRes = extractSku(text);
        const orderRes = extractOrderId(text);
        const courierRes = extractCourier(text);
        const qtyRes = extractQty(text);

        expect(awbRes.awb).toBe(targetAwb);
        expect(awbRes.confidence).toBe(1.0);

        expect(skuRes.sku).toBe(targetSku);
        expect(skuRes.confidence).toBe(1.0);

        expect(orderRes.orderId).toBe('OD12345678901');
        expect(orderRes.confidence).toBe(1.0);

        expect(courierRes.courier).toBe('Delhivery');
        expect(courierRes.confidence).toBe(1.0);

        expect(qtyRes.qty).toBe(2);
        expect(qtyRes.confidence).toBe(1.0);
      }
    });
  });
});

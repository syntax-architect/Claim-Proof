import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePdfBuffer } from '../services/pdfLabelProcessor';

describe('pdfLabelProcessor parsePdfBuffer', () => {
  it('parses Meesho sample PDF', async () => {
    const filePath = join(process.cwd(), 'samples', 'sample_labels_meesho.pdf');
    const bytes = readFileSync(filePath);
    const labels = await parsePdfBuffer(bytes, 'sample_labels_meesho.pdf');

    expect(labels.length).toBe(3);
    expect(labels[0].marketplace).toBe('Meesho');
    expect(labels[0].awb).toBe('5894372819');
    expect(labels[0].sku).toBe('MSH-KRT-BLU-XL');
    expect(labels[0].courier).toBe('Valmo');
    expect(labels[0].confidence).toBeDefined();
    expect(labels[0].confidence?.awb).toBeGreaterThan(0);
    expect(labels[0].confidence?.sku).toBeGreaterThan(0);
  });
});

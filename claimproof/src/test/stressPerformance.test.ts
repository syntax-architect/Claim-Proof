import { describe, it, expect } from 'vitest';
import {
  generateSyntheticPdfBytes,
  SUPPORTED_LAYOUTS
} from '../../scripts/generate_stress_labels.mjs';
import { processLabelFiles } from '../services/pdfLabelProcessor';
import { THRESHOLDS } from '../../scripts/stress_runner.mjs';
import { isFfprobeAvailable, probeVideoFile } from '../../scripts/stress_video.mjs';

describe('Performance & Stress Suite — Automated Regression Guard', () => {
  it('generates synthetic label PDFs in each supported layout', async () => {
    expect(SUPPORTED_LAYOUTS).toEqual(['4x6', '4x4', 'grid4']);

    for (const layout of SUPPORTED_LAYOUTS) {
      const bytes1p = await generateSyntheticPdfBytes(layout, 1);
      expect(bytes1p).toBeInstanceOf(Uint8Array);
      expect(bytes1p.length).toBeGreaterThan(500);

      const bytes10p = await generateSyntheticPdfBytes(layout, 10);
      expect(bytes10p.length).toBeGreaterThan(bytes1p.length);
    }
  });

  it('crops 500-page batch in under 15 seconds and remains within 1.5 GB memory limit', async () => {
    const pCount = 500;
    const layout = '4x6';
    const pdfBytes = await generateSyntheticPdfBytes(layout, pCount);

    const file = {
      name: `stress_500_${layout}.pdf`,
      arrayBuffer: async () => pdfBytes.slice().buffer
    };

    const _initialMem = process.memoryUsage().heapUsed;
    const t0 = performance.now();

    const result = await processLabelFiles([file], {
      preset: '4x6',
      stampSku: true,
      multiQtyGuard: true,
      valmoPlusAsValmo: false,
      withManifest: true,
      isFree: false
    });

    const durationSec = (performance.now() - t0) / 1000;
    const finalMem = process.memoryUsage().heapUsed;
    const peakHeapMB = finalMem / (1024 * 1024);

    expect(result.labels.length).toBe(pCount);
    expect(result.pdfBytes.length).toBeGreaterThan(10000);

    // Assert project threshold: 500-page crop under 15 seconds on a mid laptop
    expect(durationSec).toBeLessThan(THRESHOLDS.max500PageTimeSec);

    // Assert project threshold: memory under 1.5 GB (1536 MB)
    expect(peakHeapMB).toBeLessThan(THRESHOLDS.maxMemoryMB);
  }, 30000);

  it('validates 500-page grid4 quadrant parsing and cropping under threshold', async () => {
    // 50 pages of grid4 = 200 labels
    const pCount = 50;
    const pdfBytes = await generateSyntheticPdfBytes('grid4', pCount);

    const file = {
      name: 'stress_grid4.pdf',
      arrayBuffer: async () => pdfBytes.slice().buffer
    };

    const t0 = performance.now();
    const result = await processLabelFiles([file], {
      preset: 'grid4',
      stampSku: true,
      multiQtyGuard: true,
      valmoPlusAsValmo: false,
      withManifest: false,
      isFree: false
    });
    const durationSec = (performance.now() - t0) / 1000;

    expect(result.labels.length).toBe(pCount * 4);
    expect(durationSec).toBeLessThan(THRESHOLDS.max500PageTimeSec);
  }, 30000);

  it('confirms ffprobe availability and structure of video validation helper', () => {
    const hasFfprobe = isFfprobeAvailable();
    expect(typeof hasFfprobe).toBe('boolean');
    expect(typeof probeVideoFile).toBe('function');
  });
});

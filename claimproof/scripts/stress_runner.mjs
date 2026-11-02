// ═══════════════════════════════════════════════════════════════════════
// SABOOT.in — Comprehensive Stress & Performance Benchmark Suite
// Benchmarks:
//   1. Synthetic label PDF parsing & cropping for 1, 100, 500, 2000 pages
//      across supported layouts ('4x6', '4x4', 'grid4') in headless Chromium.
//   2. Measures execution time & peak memory (JS heap via CDP).
//   3. Simulates 200 rapid laser barcode gun scans.
//   4. Records video via headless Chromium fake camera and verifies playability (ffprobe).
//   5. Enforces Thresholds:
//      - 500-page crop < 15.0 seconds
//      - Peak memory < 1.5 GB (1536 MB)
//      - Video playable & ffprobe valid
//      - Zero barcode scan errors
// ═══════════════════════════════════════════════════════════════════════

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import {
  SUPPORTED_LAYOUTS,
  PAGE_COUNTS,
  generateSyntheticPdfBytes
} from './generate_stress_labels.mjs';
import { runVideoStressTest, isFfprobeAvailable } from './stress_video.mjs';
import { runBarcodeScanStressTest } from './stress_barcode_scans.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Performance thresholds required by project specifications:
export const THRESHOLDS = {
  max500PageTimeSec: 15.0, // 500-page crop must be under 15 seconds
  maxMemoryMB: 1536.0, // Peak memory must remain under 1.5 GB (1536 MB)
  maxScanLatencyP95Ms: 50.0 // P95 latency per barcode scan under 50ms
};

/**
 * Runs the PDF label processing benchmark for a given layout and page count in headless Chromium.
 */
async function benchmarkLabelProcessing(page, cdp, layout, pageCount) {
  console.log(`  [PDF Stress] Generating ${layout} (${pageCount} pages)...`);
  const pdfBytes = await generateSyntheticPdfBytes(layout, pageCount);
  const base64 = Buffer.from(pdfBytes).toString('base64');

  console.log(`  [PDF Stress] Processing in headless Chromium...`);
  const res = await page.evaluate(
    async ({ b64, presetName, pCount }) => {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const file = {
        name: `stress_${presetName}_${pCount}p.pdf`,
        arrayBuffer: async () => bytes.slice().buffer
      };

      const mod = await import('/src/services/pdfLabelProcessor.ts');
      const t0 = performance.now();
      const result = await mod.processLabelFiles(
        [file],
        {
          preset: presetName,
          stampSku: true,
          multiQtyGuard: true,
          valmoPlusAsValmo: false,
          withManifest: true,
          isFree: false
        }
      );
      const t1 = performance.now();

      return {
        durationMs: t1 - t0,
        labelsExtracted: result.labels.length,
        outputPdfBytes: result.pdfBytes.length
      };
    },
    { b64: base64, presetName: layout, pCount: pageCount }
  );

  const metrics = await cdp.send('Performance.getMetrics');
  const jsHeapUsed = metrics.metrics.find((m) => m.name === 'JSHeapUsedSize')?.value || 0;
  const jsHeapTotal = metrics.metrics.find((m) => m.name === 'JSHeapTotalSize')?.value || 0;

  return {
    layout,
    pageCount,
    labelsExtracted: res.labelsExtracted,
    timeSec: res.durationMs / 1000,
    throughputPagesPerSec: pageCount / (res.durationMs / 1000),
    outputSizeMB: (res.outputPdfBytes / (1024 * 1024)).toFixed(2),
    heapUsedMB: jsHeapUsed / (1024 * 1024),
    heapTotalMB: jsHeapTotal / (1024 * 1024)
  };
}

/**
 * Formats results into a clean markdown performance table.
 */
function renderPerformanceTable(pdfResults, scanResult, videoResult) {
  const lines = [];
  lines.push('### SABOOT Performance & Stress Benchmark Report\n');
  lines.push('| Benchmark / Layout | Input Units | Time (s) | Throughput | Peak Heap (MB) | Threshold SLA | Status |');
  lines.push('|:---|:---:|:---:|:---:|:---:|:---:|:---:|');

  for (const r of pdfResults) {
    const is500p = r.pageCount === 500;
    const slaPass = is500p ? r.timeSec < THRESHOLDS.max500PageTimeSec : true;
    const memPass = r.heapUsedMB < THRESHOLDS.maxMemoryMB;
    const status = slaPass && memPass ? '✅ PASS' : '❌ FAIL';
    const slaTarget = is500p ? `< ${THRESHOLDS.max500PageTimeSec}s` : 'N/A';

    lines.push(
      `| PDF Crop (${r.layout}) | ${r.pageCount} pages | ${r.timeSec.toFixed(2)}s | ${(r.pageCount / r.timeSec).toFixed(1)} p/s | ${r.heapUsedMB.toFixed(1)} MB | ${slaTarget} | ${status} |`
    );
  }

  // Barcode scans row
  const scanPass = scanResult.passed && scanResult.p95LatencyMs < THRESHOLDS.maxScanLatencyP95Ms;
  lines.push(
    `| Barcode Gun Scans | ${scanResult.totalScans} scans | ${scanResult.totalDurationSec}s | ${(scanResult.totalScans / Number(scanResult.totalDurationSec)).toFixed(1)} scans/s | ${scanResult.finalHeapMB} MB | P95 < 50ms (got ${scanResult.p95LatencyMs}ms) | ${scanPass ? '✅ PASS' : '❌ FAIL'} |`
  );

  // Video recording row
  const vidPass = videoResult.isPlayable && Number(videoResult.peakHeapMB) < THRESHOLDS.maxMemoryMB;
  lines.push(
    `| Fake Cam Recording | ${videoResult.durationSeconds}s (${videoResult.resolution}) | ${videoResult.wallClockSec}s | ${videoResult.bitrateKbps || '~1200'} kbps | ${videoResult.peakHeapMB} MB | Playable via ffprobe | ${vidPass ? '✅ PASS' : '❌ FAIL'} |`
  );

  return lines.join('\n');
}

/**
 * Main stress test orchestrator.
 */
export async function runFullStressSuite(options = {}) {
  const isCi = options.ci ?? false;
  const rootDir = join(__dirname, '..');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' SABOOT Suite — Automated Stress & Performance Test Suite ');
  console.log(' Thresholds: 500-page crop < 15s | Memory < 1.5 GB             ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (!isFfprobeAvailable()) {
    console.warn('⚠️ Warning: ffprobe/ffmpeg not found in PATH. Video playability verification will be skipped.');
  }

  // 1. Start local Vite server
  const server = await createServer({
    root: rootDir,
    server: { port: 5190, host: '127.0.0.1' },
    logLevel: 'error'
  });
  await server.listen();
  const port = server.config.server.port;

  // 2. Headless Chromium session
  const browser = await chromium.launch({
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
  });
  const context = await browser.newContext({ permissions: ['camera'] });
  const page = await context.newPage();

  await page.addInitScript(() => {
    localStorage.setItem('saboot_onboarding_completed', 'true');
    localStorage.setItem('saboot_onboarding_skipped', 'true');
  });
  await page.goto(`http://127.0.0.1:${port}/#labels`);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');

  const pdfResults = [];
  const testMatrix = isCi
    ? [
        // CI runs: 1, 100, 500 pages for all layouts (and 2000 for primary 4x6)
        { layout: '4x6', pages: [1, 100, 500, 2000] },
        { layout: '4x4', pages: [1, 100, 500] },
        { layout: 'grid4', pages: [1, 100, 500] }
      ]
    : [
        // Full stress run: 1, 100, 500, 2000 for every supported layout
        { layout: '4x6', pages: PAGE_COUNTS },
        { layout: '4x4', pages: PAGE_COUNTS },
        { layout: 'grid4', pages: PAGE_COUNTS }
      ];

  console.log('\n--- 1. PDF Crop & Label Processing Matrix ---');
  for (const { layout, pages } of testMatrix) {
    for (const pageCount of pages) {
      const res = await benchmarkLabelProcessing(page, cdp, layout, pageCount);
      pdfResults.push(res);
      console.log(
        `  ✓ ${res.layout} (${String(res.pageCount).padStart(4)}p): ${res.timeSec.toFixed(2)}s | ${res.throughputPagesPerSec.toFixed(1)} p/s | heap: ${res.heapUsedMB.toFixed(1)} MB`
      );
    }
  }

  await browser.close();
  await server.close();

  // 2. 200 Rapid Barcode Scans
  console.log('\n--- 2. Simulating 200 Rapid Barcode Scans ---');
  const scanResult = await runBarcodeScanStressTest(200);
  console.log(
    `  ✓ 200 scans finished in ${scanResult.totalDurationSec}s (avg: ${scanResult.avgLatencyMs}ms, P95: ${scanResult.p95LatencyMs}ms, peak heap: ${scanResult.finalHeapMB} MB)`
  );

  // 3. Fake Camera Video Recording & ffprobe Validation
  const videoSec = options.videoDuration ?? (isCi ? 30 : 1800); // 1800s (30m) or 30s in CI
  console.log(`\n--- 3. Recording Video with Fake Camera (${videoSec}s) & ffprobe Validation ---`);
  const videoResult = await runVideoStressTest(videoSec);
  console.log(
    `  ✓ Video: ${videoResult.fileSizeMB} MB, ${videoResult.codec} ${videoResult.resolution}, playable: ${videoResult.isPlayable}`
  );

  // 4. Output Performance Table
  const tableMarkdown = renderPerformanceTable(pdfResults, scanResult, videoResult);
  console.log('\n' + tableMarkdown + '\n');

  // 5. Evaluate Thresholds & Enforce Regression Gate
  const failures = [];

  // Threshold 1: 500-page crop under 15 seconds
  const crops500 = pdfResults.filter((r) => r.pageCount === 500);
  for (const c of crops500) {
    if (c.timeSec > THRESHOLDS.max500PageTimeSec) {
      failures.push(
        `THRESHOLD REGRESSION: ${c.layout} 500-page crop took ${c.timeSec.toFixed(2)}s (max allowed: ${THRESHOLDS.max500PageTimeSec}s)`
      );
    }
  }

  // Threshold 2: Peak memory under 1.5 GB
  const maxHeapObserved = Math.max(
    ...pdfResults.map((r) => r.heapUsedMB),
    Number(scanResult.finalHeapMB),
    Number(videoResult.peakHeapMB)
  );
  if (maxHeapObserved > THRESHOLDS.maxMemoryMB) {
    failures.push(
      `MEMORY REGRESSION: Peak memory observed was ${maxHeapObserved.toFixed(1)} MB (max allowed: ${THRESHOLDS.maxMemoryMB} MB / 1.5 GB)`
    );
  }

  // Threshold 3: Video playability
  if (!videoResult.isPlayable) {
    failures.push(`VIDEO PLAYABILITY REGRESSION: Recorded video failed ffprobe/ffmpeg decode check!`);
  }

  // Threshold 4: Barcode scan errors
  if (!scanResult.passed) {
    failures.push(`BARCODE SCAN REGRESSION: ${scanResult.errorCount} errors occurred during rapid scanning!`);
  }

  if (failures.length > 0) {
    console.error('❌ REGRESSION CHECKS FAILED:');
    failures.forEach((f) => console.error(`  - ${f}`));
    return { passed: false, failures, pdfResults, scanResult, videoResult, tableMarkdown };
  }

  console.log('✅ ALL PERFORMANCE THRESHOLDS PASSED. No regressions detected.');
  return { passed: true, failures: [], pdfResults, scanResult, videoResult, tableMarkdown };
}

/**
 * CLI execution: node scripts/stress_runner.mjs [--ci] [--video-duration=30]
 */
async function main() {
  const args = process.argv.slice(2);
  const isCi = args.includes('--ci');
  const durArg = args.find((a) => a.startsWith('--video-duration='));
  const videoDuration = durArg ? parseInt(durArg.split('=')[1], 10) : undefined;

  const result = await runFullStressSuite({ ci: isCi, videoDuration });
  if (!result.passed) {
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('stress_runner.mjs')) {
  main().catch((err) => {
    console.error('Stress test suite execution error:', err);
    process.exit(1);
  });
}

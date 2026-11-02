// ═══════════════════════════════════════════════════════════════════════
// SABOOT.in — 200 Rapid Barcode Scans Stress Test
// Simulates rapid-fire physical USB/Bluetooth HID laser gun scans (<80ms burst)
// in headless Chromium on the AWB Video Recorder Station.
// ═══════════════════════════════════════════════════════════════════════

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Runs 200 rapid barcode scans in headless Chromium.
 * @param {number} scanCount - number of scans to simulate (default 200)
 */
export async function runBarcodeScanStressTest(scanCount = 200) {
  const rootDir = join(__dirname, '..');
  console.log(`Starting local server for barcode scan stress test (${scanCount} scans)...`);

  const server = await createServer({
    root: rootDir,
    server: { port: 5188, host: '127.0.0.1' },
    logLevel: 'error'
  });
  await server.listen();
  const port = server.config.server.port;

  const browser = await chromium.launch({
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
  });
  const context = await browser.newContext({ permissions: ['camera'] });
  const page = await context.newPage();

  // Mark onboarding complete in storage
  await page.addInitScript(() => {
    localStorage.setItem('saboot_onboarding_completed', 'true');
    localStorage.setItem('saboot_onboarding_skipped', 'true');
  });

  await page.goto(`http://127.0.0.1:${port}/#recorder`);
  await page.waitForTimeout(600);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');

  const initialMetrics = await cdp.send('Performance.getMetrics');
  const initialHeapBytes =
    initialMetrics.metrics.find((m) => m.name === 'JSHeapUsedSize')?.value || 0;

  console.log(`Simulating ${scanCount} rapid barcode scans...`);
  const t0 = Date.now();

  const scanStats = await page.evaluate(async (totalScans) => {
    const latencies = [];
    const errors = [];

    window.addEventListener('error', (e) => errors.push(e.message));
    window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));

    for (let i = 1; i <= totalScans; i++) {
      const code = `AWB-BURST-${String(i).padStart(4, '0')}`;
      const start = performance.now();

      // Simulate HID laser gun keystroke burst (<80ms) ending with Enter
      for (const char of code) {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: char, bubbles: true, cancelable: true })
        );
      }
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      );

      const latency = performance.now() - start;
      latencies.push(latency);

      // Warehouse table pace: ~30ms gap between rapid parcel swipes
      await new Promise((r) => setTimeout(r, 25));
    }

    return {
      count: latencies.length,
      minLatencyMs: Math.min(...latencies),
      avgLatencyMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      maxLatencyMs: Math.max(...latencies),
      p95LatencyMs: latencies.slice().sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)],
      errors
    };
  }, scanCount);

  const totalDurationMs = Date.now() - t0;

  const finalMetrics = await cdp.send('Performance.getMetrics');
  const finalHeapBytes = finalMetrics.metrics.find((m) => m.name === 'JSHeapUsedSize')?.value || 0;

  await browser.close();
  await server.close();

  const result = {
    totalScans: scanStats.count,
    totalDurationSec: (totalDurationMs / 1000).toFixed(2),
    avgLatencyMs: scanStats.avgLatencyMs.toFixed(2),
    p95LatencyMs: scanStats.p95LatencyMs.toFixed(2),
    maxLatencyMs: scanStats.maxLatencyMs.toFixed(2),
    initialHeapMB: (initialHeapBytes / (1024 * 1024)).toFixed(2),
    finalHeapMB: (finalHeapBytes / (1024 * 1024)).toFixed(2),
    heapGrowthMB: ((finalHeapBytes - initialHeapBytes) / (1024 * 1024)).toFixed(2),
    errorCount: scanStats.errors.length,
    passed: scanStats.errors.length === 0
  };

  return result;
}

/**
 * CLI execution: node scripts/stress_barcode_scans.mjs [--count=200]
 */
async function main() {
  const args = process.argv.slice(2);
  let count = 200;
  const countArg = args.find((a) => a.startsWith('--count='));
  if (countArg) {
    count = parseInt(countArg.split('=')[1], 10);
  }

  const result = await runBarcodeScanStressTest(count);
  console.log('\n--- 200 Rapid Barcode Scans Results ---');
  console.table([result]);

  if (!result.passed) {
    console.error('FAIL: Rapid barcode scans encountered errors/rejections!');
    process.exit(1);
  }
  console.log(`SUCCESS: ${result.totalScans} barcode scans processed cleanly with avg latency ${result.avgLatencyMs}ms.`);
}

if (process.argv[1] && process.argv[1].endsWith('stress_barcode_scans.mjs')) {
  main().catch((err) => {
    console.error('Barcode stress test failed:', err);
    process.exit(1);
  });
}

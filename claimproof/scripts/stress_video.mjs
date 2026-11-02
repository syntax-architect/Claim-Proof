// ═══════════════════════════════════════════════════════════════════════
// SABOOT.in — Fake Camera Video Recording & ffprobe Playability Stress Test
// Records video from Chromium's fake camera device with the live forensic banner,
// saves the media, and validates stream integrity and playability with ffprobe/ffmpeg.
// ═══════════════════════════════════════════════════════════════════════

import http from 'node:http';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Checks if ffprobe is available in system PATH.
 */
export function isFfprobeAvailable() {
  try {
    execSync('ffprobe -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Runs ffprobe validation on the target video file.
 */
export function probeVideoFile(filePath) {
  const probeRaw = execSync(
    `ffprobe -v error -show_entries format=duration,format_name,size,bit_rate:stream=codec_name,width,height -of json "${filePath}"`
  ).toString();
  const data = JSON.parse(probeRaw);

  const stream = data.streams?.[0];
  if (!stream) {
    throw new Error('ffprobe found no video stream in the recording.');
  }

  // Confirm playability with ffmpeg full frame decode test
  let playabilityError = null;
  try {
    const decodeCheck = execSync(`ffmpeg -v error -i "${filePath}" -f null -`).toString().trim();
    if (decodeCheck) {
      playabilityError = decodeCheck;
    }
  } catch (err) {
    playabilityError = err instanceof Error ? err.message : String(err);
  }

  return {
    codec: stream.codec_name,
    width: stream.width,
    height: stream.height,
    format: data.format?.format_name,
    fileSizeMB: (Number(data.format?.size || 0) / (1024 * 1024)).toFixed(2),
    bitrateKbps: Math.round(Number(data.format?.bit_rate || 0) / 1000),
    isPlayable: !playabilityError,
    playabilityError
  };
}

/**
 * Executes the headless Chromium fake camera recording.
 * @param {number} durationSeconds - duration to record in seconds (default 1800s = 30m)
 * @param {string} [outputFilePath] - optional path to save recording
 */
export async function runVideoStressTest(durationSeconds = 1800, outputFilePath = null) {
  // Ephemeral HTTP server for secure context (required for navigator.mediaDevices)
  const server = http
    .createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html><html><body><h1>SABOOT Video Stress Test</h1></body></html>`);
    })
    .listen(0);

  const port = server.address().port;
  const outPath =
    outputFilePath ||
    join(__dirname, '..', 'test-fixtures', `fake_cam_stress_${durationSeconds}s.webm`);
  mkdirSync(dirname(outPath), { recursive: true });

  console.log(`Starting fake camera video recording for ${durationSeconds} seconds (${(durationSeconds / 60).toFixed(1)} mins)...`);

  const browser = await chromium.launch({
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding'
    ]
  });

  const context = await browser.newContext({ permissions: ['camera'] });
  const page = await context.newPage();
  await page.goto(`http://localhost:${port}`);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');

  const tStart = Date.now();
  let peakHeapBytes = 0;

  // Poll memory periodically during recording
  const memCheckInterval = setInterval(async () => {
    try {
      const metrics = await cdp.send('Performance.getMetrics');
      const used = metrics.metrics.find((m) => m.name === 'JSHeapUsedSize')?.value || 0;
      if (used > peakHeapBytes) peakHeapBytes = used;
    } catch {
      // Session closing
    }
  }, 5000);

  const videoBase64 = await page.evaluate(async (recordSec) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: false
    });

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();

    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    const canvasStream = canvas.captureStream(24);

    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : 'video/webm';

    const recorder = new MediaRecorder(canvasStream, {
      mimeType: mime,
      videoBitsPerSecond: 1_200_000
    });

    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.start(250);

    const interval = setInterval(() => {
      ctx.drawImage(video, 0, 0, 1280, 720);
      // Burn-in indelible forensic evidence bar
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(0, 0, 1280, 46);
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 16px monospace';
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 23);
      ctx.fillText(`VERIFIED UNCUT PROOF | AWB-30MIN-STRESS | LIVE IST: ${nowStr}`, 20, 28);
    }, 1000 / 24);

    await new Promise((resolve) => setTimeout(resolve, recordSec * 1000));
    clearInterval(interval);

    return new Promise((resolve) => {
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mime });
        const reader = new FileReader();
        reader.onloadend = () => {
          const b64 = reader.result.split(',')[1];
          resolve(b64);
        };
        reader.readAsDataURL(blob);
      };
      recorder.stop();
    });
  }, durationSeconds);

  clearInterval(memCheckInterval);

  const finalMetrics = await cdp.send('Performance.getMetrics');
  const finalHeap = finalMetrics.metrics.find((m) => m.name === 'JSHeapUsedSize')?.value || 0;
  if (finalHeap > peakHeapBytes) peakHeapBytes = finalHeap;

  await browser.close();
  server.close();

  const videoBuffer = Buffer.from(videoBase64, 'base64');
  writeFileSync(outPath, videoBuffer);
  const wallClockMs = Date.now() - tStart;

  console.log(`Video recorded: ${(videoBuffer.length / (1024 * 1024)).toFixed(2)} MB saved to ${outPath}`);

  // ffprobe validation
  const probe = probeVideoFile(outPath);

  return {
    durationSeconds,
    wallClockSec: (wallClockMs / 1000).toFixed(1),
    fileSizeMB: probe.fileSizeMB,
    codec: probe.codec,
    resolution: `${probe.width}x${probe.height}`,
    format: probe.format,
    bitrateKbps: probe.bitrateKbps,
    isPlayable: probe.isPlayable,
    playabilityError: probe.playabilityError,
    peakHeapMB: (peakHeapBytes / (1024 * 1024)).toFixed(2),
    filePath: outPath
  };
}

/**
 * CLI execution: node scripts/stress_video.mjs [--duration=1800] [--ci]
 */
async function main() {
  const args = process.argv.slice(2);
  let duration = 1800; // default 30 minutes (1800 seconds)

  const durArg = args.find((a) => a.startsWith('--duration='));
  if (durArg) {
    duration = parseInt(durArg.split('=')[1], 10);
  } else if (args.includes('--ci') || args.includes('--quick')) {
    duration = 30; // 30s quick check in CI
  }

  const result = await runVideoStressTest(duration);
  console.log('\n--- Video Stress Test Results ---');
  console.table([result]);

  if (!result.isPlayable) {
    console.error('FAIL: Recorded video is not playable according to ffprobe/ffmpeg!');
    process.exit(1);
  }
  console.log('SUCCESS: Video file is valid, intact, and confirmed playable via ffprobe.');
}

if (process.argv[1] && process.argv[1].endsWith('stress_video.mjs')) {
  main().catch((err) => {
    console.error('Video stress test failed:', err);
    process.exit(1);
  });
}

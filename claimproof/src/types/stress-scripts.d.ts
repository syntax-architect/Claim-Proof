declare module '*generate_stress_labels.mjs' {
  export const SUPPORTED_LAYOUTS: string[];
  export const PAGE_COUNTS: number[];
  export function generateSyntheticPdfDoc(layout: string, pageCount: number): Promise<unknown>;
  export function generateSyntheticPdfBytes(layout: string, pageCount: number): Promise<Uint8Array>;
}

declare module '*stress_runner.mjs' {
  export const THRESHOLDS: {
    max500PageTimeSec: number;
    maxMemoryMB: number;
    maxScanLatencyP95Ms: number;
  };
  export function runFullStressSuite(options?: { ci?: boolean; videoDuration?: number }): Promise<{
    passed: boolean;
    failures: string[];
    pdfResults: unknown[];
    scanResult: unknown;
    videoResult: unknown;
    tableMarkdown: string;
  }>;
}

declare module '*stress_video.mjs' {
  export function isFfprobeAvailable(): boolean;
  export function probeVideoFile(filePath: string): {
    codec: string;
    width: number;
    height: number;
    format: string;
    fileSizeMB: string;
    bitrateKbps: number;
    isPlayable: boolean;
    playabilityError: string | null;
  };
  export function runVideoStressTest(
    durationSeconds?: number,
    outputFilePath?: string | null
  ): Promise<{
    durationSeconds: number;
    wallClockSec: string;
    fileSizeMB: string;
    codec: string;
    resolution: string;
    format: string;
    bitrateKbps: number;
    isPlayable: boolean;
    playabilityError: string | null;
    peakHeapMB: string;
    filePath: string;
  }>;
}

declare module '*stress_barcode_scans.mjs' {
  export function runBarcodeScanStressTest(scanCount?: number): Promise<{
    totalScans: number;
    totalDurationSec: string;
    avgLatencyMs: string;
    p95LatencyMs: string;
    maxLatencyMs: string;
    initialHeapMB: string;
    finalHeapMB: string;
    heapGrowthMB: string;
    errorCount: number;
    passed: boolean;
  }>;
}

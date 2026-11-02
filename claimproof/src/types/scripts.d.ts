declare module '*/generate_stress_labels.mjs' {
  export const SUPPORTED_LAYOUTS: string[];
  export function generateSyntheticPdfBytes(layout: string, pages: number): Promise<Uint8Array>;
}

declare module '*/stress_runner.mjs' {
  export const THRESHOLDS: Record<string, number>;
}

declare module '*/stress_video.mjs' {
  export function isFfprobeAvailable(): boolean;
  export function probeVideoFile(
    path: string
  ): Promise<{ duration: number; width: number; height: number; fps: number }>;
}

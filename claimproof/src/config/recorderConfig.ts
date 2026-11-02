/**
 * Recorder & Video Configuration for SABOOT.
 *
 * NOTE: Marketplace video size limits or policies vary across platforms
 * and are NOT claimed by SABOOT. Target video size and maximum duration
 * are user-configurable settings. Values below are default operational safeguards
 * marked as "needs verification" per project policy.
 */

export const RECORDER_CONFIG = {
  // Default target video file size in megabytes (needs verification)
  defaultTargetSizeMB: 25 as number,
  // Default maximum recording duration safeguard in seconds (needs verification: 5 minutes default)
  defaultMaxDurationSec: 300 as number,
  // Video recording bitrate in bps (~1.2 Mbps = ~150 KB/sec)
  videoBitsPerSecond: 1_200_000,
  // Approximate bytes per second
  bytesPerSecond: 150_000,
  // Minimum elapsed time before scanning the same AWB triggers stop (bounce guard in seconds)
  duplicateBounceGuardSec: 2
} as const;

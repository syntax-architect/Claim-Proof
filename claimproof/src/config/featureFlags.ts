/**
 * Feature Flags Configuration for SABOOT Suite.
 *
 * Rules:
 * - Every new capability must be gated behind a feature flag.
 * - Flags can be toggled via settings or localStorage for isolated testing and safe rollout.
 */

export interface FeatureFlags {
  /** 1-click Claim Kit packaging (videos, stills, PDF dossier, dispute text). */
  claimKitBuilder: boolean;
  /** Re-encoding video to fit marketplace target file size limits. */
  claimKitTargetSize: boolean;
  /** Optional blurring of buyer address on shipping label for public/external sharing. */
  claimKitAddressBlur: boolean;
  /** Return unboxing guided checklist overlay. */
  returnChecklist: boolean;
  /** Template-based dispute messages in English and Hindi with missing field preview. */
  disputeTemplates: boolean;
  /** Synthetic demo camera testing for warehouse stations without physical webcams. */
  demoCamera: boolean;
  /** High-speed keyboard-wedge USB scanner detection with Enter/Tab suffix and noise filtering. */
  advancedHidScanner: boolean;
  /** Scanner test page showing raw stream, timing diagnostics, and live barcode verification. */
  scannerTestWorkbench: boolean;
  /** Camera torch and zoom hardware controls for barcode scanning. */
  cameraTorchZoom: boolean;
  /** Money & Claims Ledger tracking disputes, recoveries, and plan ROI. */
  moneyLedger: boolean;
  /** High-visibility urgency alert banner across all app pages at 24h and 6h deadline marks. */
  claimRadarUrgencyBanner: boolean;
  /** RFC 5545 .ics iCalendar file export for dispute deadlines. */
  claimCalendarExport: boolean;
  /** Optional browser notifications 24h and 6h before dispute windows expire. */
  claimNotifications: boolean;
  /** WebRTC phone companion for live video streaming, local phone recording, and chunked transfer. */
  phoneCompanion: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  claimKitBuilder: true,
  claimKitTargetSize: true,
  claimKitAddressBlur: true,
  returnChecklist: true,
  disputeTemplates: true,
  demoCamera: true,
  advancedHidScanner: true,
  scannerTestWorkbench: true,
  cameraTorchZoom: true,
  moneyLedger: true,
  claimRadarUrgencyBanner: true,
  claimCalendarExport: true,
  claimNotifications: true,
  phoneCompanion: true
};

const STORAGE_PREFIX = 'saboot_flag_';

/**
 * Checks whether a specific feature flag is currently active.
 * Allows localStorage override (e.g. `saboot_flag_claimKitBuilder = "false"`).
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${flag}`);
      if (stored !== null) {
        return stored === 'true';
      }
    } catch {
      // Fallback to defaults if localStorage is restricted
    }
  }
  return DEFAULT_FEATURE_FLAGS[flag] ?? false;
}

/**
 * Sets a runtime override for a feature flag.
 */
export function setFeatureFlag(flag: keyof FeatureFlags, enabled: boolean): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${flag}`, String(enabled));
    } catch {
      // Ignore
    }
  }
}

/**
 * Resets all feature flags to their default state.
 */
export function resetFeatureFlags(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      for (const key of Object.keys(DEFAULT_FEATURE_FLAGS)) {
        localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      }
    } catch {
      // Ignore
    }
  }
}

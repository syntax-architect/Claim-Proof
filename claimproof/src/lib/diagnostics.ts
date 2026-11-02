/**
 * Zero-PII Diagnostic Info Collector for SABOOT Support.
 *
 * Collects ONLY technical capabilities, storage metrics, and browser specifications.
 * Strictly guarantees that ZERO personal data (no customer details, order IDs,
 * AWBs, video paths, or label contents) is included in the diagnostic payload.
 */

import { BRAND } from '../config/brand';
import { getTodayUsage } from './quota';
import { getVaultStatus } from '../services/vaultWriter';
import { formatIST } from './dateUtils';
import { db } from '../db/schema';

export interface WorkstationDiagnostics {
  app: {
    name: string;
    version: string;
    timestampIST: string;
    environment: string;
  };
  system: {
    userAgent: string;
    platform: string;
    language: string;
    screenResolution: string;
    devicePixelRatio: number;
    online: boolean;
  };
  capabilities: {
    mediaDevices: boolean;
    nativeBarcodeDetector: boolean;
    fileSystemAccessApi: boolean;
    indexedDb: boolean;
    serviceWorker: boolean;
    webCodecs: boolean;
  };
  storage: {
    vaultMode: 'fs-api' | 'downloads' | 'permission' | 'unconfigured';
    quotaEstimatedMB?: number;
    quotaUsedMB?: number;
    indexedDbRecords: {
      ordersIndexed: number;
      recordingsIndexed: number;
      claimsTracked: number;
    };
  };
  license: {
    planTier: string;
    hasActiveToken: boolean;
  };
  todayActivityCounts: {
    labelsCroppedToday: number;
    awbsRecordedToday: number;
  };
  privacyNotice: string;
}

/**
 * Compiles a sanitized technical summary of the user's workstation.
 * Excludes any personal data, customer names, addresses, AWBs, order IDs, or video payloads.
 */
export async function getDiagnosticInfo(): Promise<WorkstationDiagnostics> {
  const isBrowser = typeof window !== 'undefined';
  const nav = isBrowser ? window.navigator : undefined;

  let vaultMode: 'fs-api' | 'downloads' | 'permission' | 'unconfigured' = 'unconfigured';
  try {
    const status = await getVaultStatus();
    vaultMode =
      status === 'connected'
        ? 'fs-api'
        : status === 'downloads'
          ? 'downloads'
          : status === 'permission'
            ? 'permission'
            : 'unconfigured';
  } catch {
    vaultMode = 'unconfigured';
  }

  let quotaEstimatedMB: number | undefined;
  let quotaUsedMB: number | undefined;

  if (nav?.storage?.estimate) {
    try {
      const est = await nav.storage.estimate();
      if (est.quota) quotaEstimatedMB = Math.round(est.quota / (1024 * 1024));
      if (est.usage) quotaUsedMB = Math.round(est.usage / (1024 * 1024));
    } catch {
      // Storage estimation failure handled silently
    }
  }

  let ordersIndexed = 0;
  let recordingsIndexed = 0;
  let claimsTracked = 0;
  let planTier = 'free';
  let hasActiveToken = false;
  let labelsCroppedToday = 0;
  let awbsRecordedToday = 0;

  try {
    ordersIndexed = await db.orders.count();
    recordingsIndexed = await db.recordings.count();
    claimsTracked = await db.claims.count();
    const lic = await db.license_state.get('active');
    if (lic?.value) {
      planTier = lic.value.plan ?? 'free';
      hasActiveToken = Boolean(lic.value.token);
    }
    const usage = await getTodayUsage();
    labelsCroppedToday = usage.labelsCropped;
    awbsRecordedToday = usage.awbsRecorded;
  } catch {
    // Database access errors in headless/test environments handled safely
  }

  return {
    app: {
      name: `${BRAND.name} Suite`,
      version: '1.0.0',
      timestampIST: formatIST(Date.now()),
      environment: 'Local-First Desktop PWA'
    },
    system: {
      userAgent: nav?.userAgent || 'Headless / Automated Test',
      platform: nav?.platform || 'Unknown',
      language: nav?.language || 'en-IN',
      screenResolution: isBrowser
        ? `${window.screen?.width || window.innerWidth || 0}x${window.screen?.height || window.innerHeight || 0}`
        : 'Headless',
      devicePixelRatio: isBrowser ? window.devicePixelRatio || 1 : 1,
      online: nav ? nav.onLine : true
    },
    capabilities: {
      mediaDevices: Boolean(nav?.mediaDevices?.getUserMedia),
      nativeBarcodeDetector: isBrowser && 'BarcodeDetector' in window,
      fileSystemAccessApi: isBrowser && 'showDirectoryPicker' in window,
      indexedDb: typeof indexedDB !== 'undefined',
      serviceWorker: Boolean(nav && 'serviceWorker' in nav),
      webCodecs: isBrowser && 'VideoEncoder' in window
    },
    storage: {
      vaultMode,
      quotaEstimatedMB,
      quotaUsedMB,
      indexedDbRecords: {
        ordersIndexed,
        recordingsIndexed,
        claimsTracked
      }
    },
    license: {
      planTier,
      hasActiveToken
    },
    todayActivityCounts: {
      labelsCroppedToday,
      awbsRecordedToday
    },
    privacyNotice:
      'Zero personal data guarantee: No order IDs, AWBs, customer identities, video frames, or label contents are included.'
  };
}

/**
 * Formats diagnostic info as formatted JSON string suitable for clipboard copying.
 */
export async function getFormattedDiagnosticString(): Promise<string> {
  const info = await getDiagnosticInfo();
  return JSON.stringify(info, null, 2);
}

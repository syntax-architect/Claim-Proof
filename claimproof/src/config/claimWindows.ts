/* Marketplace claim-window configuration & seller dispute deadlines.
 * Official seller help URLs and verification status.
 * Unverified windows are marked 'UNVERIFIED' per SPEC.md until confirmed by the seller.
 */

import type { Marketplace } from '../types';
import { BRAND } from './brand';

export interface MarketplaceClaimWindowConfig {
  marketplace: Marketplace;
  displayName: string;
  hours: number;
  sourceUrl: string;
  lastVerified: string; // 'UNVERIFIED' or ISO date string (e.g. '2026-11-02')
}

export const DEFAULT_CLAIM_WINDOW_HOURS = 72;
export const UNVERIFIED_STATUS = 'UNVERIFIED';
export const UNVERIFIED_LABEL = 'UNVERIFIED - check your seller panel';

export const CLAIM_WINDOWS_STORAGE_KEY = BRAND.storageKeys.claimWindows;
export const LEGACY_CLAIM_WINDOWS_STORAGE_KEY = BRAND.storageKeys.legacyClaimWindows;

export const MARKETPLACE_CLAIM_WINDOWS: Record<Marketplace, MarketplaceClaimWindowConfig> = {
  Meesho: {
    marketplace: 'Meesho',
    displayName: 'Meesho SAFE',
    hours: 72,
    sourceUrl: 'https://supplier.meesho.com/support',
    lastVerified: UNVERIFIED_STATUS
  },
  Flipkart: {
    marketplace: 'Flipkart',
    displayName: 'Flipkart SPF',
    hours: 336, // 14 days
    sourceUrl: 'https://seller.flipkart.com/help/protection-fund',
    lastVerified: UNVERIFIED_STATUS
  },
  Amazon: {
    marketplace: 'Amazon',
    displayName: 'Amazon SAFE-T',
    hours: 720, // 30 days
    sourceUrl: 'https://sellercentral.amazon.in/help/hub/reference/G202103440',
    lastVerified: UNVERIFIED_STATUS
  },
  AJIO: {
    marketplace: 'AJIO',
    displayName: 'AJIO',
    hours: 72,
    sourceUrl: 'https://supplier.ajio.com/',
    lastVerified: UNVERIFIED_STATUS
  },
  Snapdeal: {
    marketplace: 'Snapdeal',
    displayName: 'Snapdeal',
    hours: 72,
    sourceUrl: 'https://sellers.snapdeal.com/',
    lastVerified: UNVERIFIED_STATUS
  },
  Myntra: {
    marketplace: 'Myntra',
    displayName: 'Myntra',
    hours: 72,
    sourceUrl: 'https://partner.myntra.com/',
    lastVerified: UNVERIFIED_STATUS
  },
  GlowRoad: {
    marketplace: 'GlowRoad',
    displayName: 'GlowRoad',
    hours: 72,
    sourceUrl: 'https://glowroad.com/',
    lastVerified: UNVERIFIED_STATUS
  },
  Unknown: {
    marketplace: 'Unknown',
    displayName: 'Standard',
    hours: DEFAULT_CLAIM_WINDOW_HOURS,
    sourceUrl: '',
    lastVerified: UNVERIFIED_STATUS
  }
};

/** Default hours mapping for backward compatibility. */
export const CLAIM_WINDOWS_HOURS: Partial<Record<Marketplace, number>> = {
  Meesho: MARKETPLACE_CLAIM_WINDOWS.Meesho.hours,
  AJIO: MARKETPLACE_CLAIM_WINDOWS.AJIO.hours,
  Snapdeal: MARKETPLACE_CLAIM_WINDOWS.Snapdeal.hours,
  Myntra: MARKETPLACE_CLAIM_WINDOWS.Myntra.hours,
  Flipkart: MARKETPLACE_CLAIM_WINDOWS.Flipkart.hours,
  Amazon: MARKETPLACE_CLAIM_WINDOWS.Amazon.hours,
  GlowRoad: MARKETPLACE_CLAIM_WINDOWS.GlowRoad.hours
};

/** Retrieves custom window hour overrides set by the seller in Settings. */
export function getCustomClaimWindows(): Partial<Record<Marketplace, number>> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw =
      localStorage.getItem(CLAIM_WINDOWS_STORAGE_KEY) ||
      localStorage.getItem(LEGACY_CLAIM_WINDOWS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** Persists a custom claim window hour override for a specific marketplace. */
export function saveCustomClaimWindowHours(marketplace: Marketplace, hours: number): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const current = getCustomClaimWindows();
    current[marketplace] = hours;
    localStorage.setItem(CLAIM_WINDOWS_STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(
      new CustomEvent('cp-claim-windows-changed', {
        detail: { marketplace, hours }
      })
    );
  } catch {
    // Storage access error handling in constrained environments
  }
}

/** Resets all custom claim window overrides back to defaults. */
export function resetCustomClaimWindows(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.removeItem(CLAIM_WINDOWS_STORAGE_KEY);
    localStorage.removeItem(LEGACY_CLAIM_WINDOWS_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('cp-claim-windows-changed'));
  } catch {
    // ignore
  }
}

/** Resets a single marketplace claim window override back to default. */
export function resetSingleClaimWindow(marketplace: Marketplace): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const current = getCustomClaimWindows();
    delete current[marketplace];
    localStorage.setItem(CLAIM_WINDOWS_STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new CustomEvent('cp-claim-windows-changed', { detail: { marketplace } }));
  } catch {
    // ignore
  }
}

/**
 * Returns effective claim window hours for a marketplace,
 * prioritizing seller-customized values over defaults.
 */
export function getClaimWindowHours(
  marketplace: Marketplace,
  customOverrides?: Partial<Record<Marketplace, number>>
): number {
  if (customOverrides && typeof customOverrides[marketplace] === 'number') {
    return customOverrides[marketplace]!;
  }
  const custom = getCustomClaimWindows();
  if (typeof custom[marketplace] === 'number') {
    return custom[marketplace]!;
  }
  return MARKETPLACE_CLAIM_WINDOWS[marketplace]?.hours ?? DEFAULT_CLAIM_WINDOW_HOURS;
}

/** Checks whether a marketplace claim window has not yet been confirmed by the seller. */
export function isClaimWindowUnverified(marketplace: Marketplace): boolean {
  const config = MARKETPLACE_CLAIM_WINDOWS[marketplace];
  if (!config) return true;
  return config.lastVerified === UNVERIFIED_STATUS || !config.lastVerified;
}

/** Gets the configuration entry for a given marketplace. */
export function getClaimWindowConfig(marketplace: Marketplace): MarketplaceClaimWindowConfig {
  return (
    MARKETPLACE_CLAIM_WINDOWS[marketplace] ?? {
      marketplace,
      displayName: marketplace === 'Unknown' ? 'Standard' : marketplace,
      hours: DEFAULT_CLAIM_WINDOW_HOURS,
      sourceUrl: '',
      lastVerified: UNVERIFIED_STATUS
    }
  );
}

/**
 * Marketplace attachment and video size limits configuration.
 *
 * Rules:
 * - Do not invent marketplace rules, deadlines, or file size limits.
 * - Store all rules in centralized config with official source URL and lastVerified date.
 * - Items awaiting seller confirmation must be marked 'UNVERIFIED'.
 */

import type { Marketplace } from '../types';

export interface MarketplaceLimitConfig {
  marketplace: Marketplace;
  displayName: string;
  maxVideoMB: number;
  maxTotalMB: number;
  recommendedFormat: 'mp4' | 'webm';
  sourceUrl: string;
  lastVerified: string; // 'UNVERIFIED' or ISO date string
  notes: string;
}

export const UNVERIFIED_LIMIT_STATUS = 'UNVERIFIED';

export const MARKETPLACE_LIMITS: Record<Marketplace, MarketplaceLimitConfig> = {
  Meesho: {
    marketplace: 'Meesho',
    displayName: 'Meesho SAFE-P',
    maxVideoMB: 50,
    maxTotalMB: 100,
    recommendedFormat: 'mp4',
    sourceUrl: 'https://supplier.meesho.com/support',
    lastVerified: UNVERIFIED_LIMIT_STATUS,
    notes: 'Standard seller support ticket upload limit for video evidence.'
  },
  Flipkart: {
    marketplace: 'Flipkart',
    displayName: 'Flipkart SPF',
    maxVideoMB: 100,
    maxTotalMB: 200,
    recommendedFormat: 'mp4',
    sourceUrl: 'https://seller.flipkart.com/help/protection-fund',
    lastVerified: UNVERIFIED_LIMIT_STATUS,
    notes: 'Seller Protection Fund portal attachment limit for packaging videos.'
  },
  Amazon: {
    marketplace: 'Amazon',
    displayName: 'Amazon SAFE-T',
    maxVideoMB: 25,
    maxTotalMB: 50,
    recommendedFormat: 'mp4',
    sourceUrl: 'https://sellercentral.amazon.in/help/hub/reference/G202103440',
    lastVerified: UNVERIFIED_LIMIT_STATUS,
    notes: 'SAFE-T communication case attachment size limit.'
  },
  AJIO: {
    marketplace: 'AJIO',
    displayName: 'AJIO Supplier Portal',
    maxVideoMB: 50,
    maxTotalMB: 100,
    recommendedFormat: 'mp4',
    sourceUrl: 'https://supplier.ajio.com/',
    lastVerified: UNVERIFIED_LIMIT_STATUS,
    notes: 'Supplier dispute ticket attachment limit.'
  },
  Snapdeal: {
    marketplace: 'Snapdeal',
    displayName: 'Snapdeal Seller Zone',
    maxVideoMB: 50,
    maxTotalMB: 100,
    recommendedFormat: 'mp4',
    sourceUrl: 'https://sellers.snapdeal.com/',
    lastVerified: UNVERIFIED_LIMIT_STATUS,
    notes: 'Seller dispute claims attachment limit.'
  },
  Myntra: {
    marketplace: 'Myntra',
    displayName: 'Myntra Partner Portal',
    maxVideoMB: 50,
    maxTotalMB: 100,
    recommendedFormat: 'mp4',
    sourceUrl: 'https://partner.myntra.com/',
    lastVerified: UNVERIFIED_LIMIT_STATUS,
    notes: 'Partner portal dispute evidence attachment limit.'
  },
  GlowRoad: {
    marketplace: 'GlowRoad',
    displayName: 'GlowRoad Supplier Portal',
    maxVideoMB: 50,
    maxTotalMB: 100,
    recommendedFormat: 'mp4',
    sourceUrl: 'https://glowroad.com/',
    lastVerified: UNVERIFIED_LIMIT_STATUS,
    notes: 'Supplier return dispute ticket attachment limit.'
  },
  Unknown: {
    marketplace: 'Unknown',
    displayName: 'Standard E-commerce',
    maxVideoMB: 50,
    maxTotalMB: 100,
    recommendedFormat: 'mp4',
    sourceUrl: '',
    lastVerified: UNVERIFIED_LIMIT_STATUS,
    notes: 'Default recommendation when marketplace is unidentified.'
  }
};

/**
 * Returns the recommended target size (in MB) for a marketplace, or null if no preset.
 */
export function getMarketplaceTargetSizeMB(marketplace: Marketplace): number {
  return MARKETPLACE_LIMITS[marketplace]?.maxVideoMB ?? 50;
}

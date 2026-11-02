/* SABOOT Suite — Single source of truth for pricing and plans.
 * All prices are in INR (₹). Consumed by PricingPage, PaywallModal, marketing site, and tests.
 *
 * Official Razorpay Documentation Citations:
 * - Razorpay Payment Links API: https://razorpay.com/docs/api/payments/payment-links/
 * - Razorpay Standard Payment Links: https://razorpay.com/docs/payments/payment-links/
 * - Razorpay UPI Intent & Dynamic QR: https://razorpay.com/docs/payments/payment-methods/upi/
 * - Razorpay Subscriptions & Webhooks: https://razorpay.com/docs/api/payments/subscriptions/webhooks/
 */

import type { BillingInterval, PlanId } from '../types';

export const RAZORPAY_DOCS = {
  paymentLinks: 'https://razorpay.com/docs/payments/payment-links/',
  paymentLinksApi: 'https://razorpay.com/docs/api/payments/payment-links/',
  upiFlows: 'https://razorpay.com/docs/payments/payment-methods/upi/',
  subscriptions: 'https://razorpay.com/docs/api/payments/subscriptions/webhooks/'
} as const;

export interface PlanConfig {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  annualStrike: number;
  dailyAnnualCost: number;
  annualSavingsPercent: number;
  seats: number;
  tag?: string;
  best?: boolean;
  features: string[];
}

/**
 * Safely parses numeric environment variables with a positive fallback.
 */
export function parsePriceEnv(val: unknown, fallback: number): number {
  if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
    return Math.round(val);
  }
  if (typeof val === 'string') {
    const parsed = parseInt(val.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
}

/**
 * Builds the canonical list of plans.
 * Prices are loaded from environment variables with sensible defaults:
 * - Starter: ₹349 / mo, ₹2,499 / yr
 * - ClaimRadar Pro: ₹599 / mo, ₹4,499 / yr
 * - Warehouse 3-Table Pack: ₹1,199 / mo, ₹8,999 / yr
 *
 * This allows changing prices in staging or production via environment variables
 * without modifying any application code.
 */
export function buildPlans(
  env: Record<string, string | undefined> = (typeof import.meta !== 'undefined' &&
    (import.meta.env as unknown as Record<string, string | undefined>)) ||
    {}
): PlanConfig[] {
  // 1. Starter Station
  const starterMonthly = parsePriceEnv(env.VITE_PRICE_STARTER_MONTHLY, 349);
  const starterAnnual = parsePriceEnv(
    env.VITE_PRICE_STARTER_ANNUAL || env.VITE_PRICE_STARTER_YEARLY,
    2499
  );
  const starterStrike = starterMonthly * 12;

  // 2. ClaimRadar Pro
  const claimradarMonthly = parsePriceEnv(env.VITE_PRICE_CLAIMRADAR_MONTHLY, 599);
  const claimradarAnnual = parsePriceEnv(
    env.VITE_PRICE_CLAIMRADAR_ANNUAL || env.VITE_PRICE_CLAIMRADAR_YEARLY,
    4499
  );
  const claimradarStrike = claimradarMonthly * 12;

  // 3. Warehouse 3-Table Pack
  const warehouseMonthly = parsePriceEnv(env.VITE_PRICE_WAREHOUSE_MONTHLY, 1199);
  const warehouseAnnual = parsePriceEnv(
    env.VITE_PRICE_WAREHOUSE_ANNUAL || env.VITE_PRICE_WAREHOUSE_YEARLY,
    8999
  );
  const warehouseStrike = warehouseMonthly * 12;

  return [
    {
      id: 'starter',
      name: 'Starter Station',
      tagline: 'Unlimited label cropping & barcode packing videos for 1 workstation',
      monthlyPrice: starterMonthly,
      annualPrice: starterAnnual,
      annualStrike: starterStrike,
      dailyAnnualCost: Math.max(1, Math.round(starterAnnual / 365)),
      annualSavingsPercent:
        starterStrike > starterAnnual
          ? Math.round(((starterStrike - starterAnnual) / starterStrike) * 100)
          : 0,
      seats: 1,
      features: [
        'Unlimited 4×6 / 4×4 label cropping & sorting',
        'Unlimited uncut AWB packing & unboxing videos',
        'Burnt-in IST live timestamp watermark',
        'Warehouse picklists & handover manifests',
        '1 PC workstation offline license'
      ]
    },
    {
      id: 'claimradar',
      name: 'ClaimRadar Pro',
      tagline: 'Dispute evidence studio for return parcel claims',
      monthlyPrice: claimradarMonthly,
      annualPrice: claimradarAnnual,
      annualStrike: claimradarStrike,
      dailyAnnualCost: Math.max(1, Math.round(claimradarAnnual / 365)),
      annualSavingsPercent:
        claimradarStrike > claimradarAnnual
          ? Math.round(((claimradarStrike - claimradarAnnual) / claimradarStrike) * 100)
          : 0,
      seats: 1,
      tag: 'MOST POPULAR',
      best: true,
      features: [
        'Everything in Starter Station',
        'Auto 4-photo evidence collage (T+0.5, 3, 6, 9s)',
        '72-hr / 14-day / 30-day claim deadline radar',
        'Dispatch-to-return side-by-side evidence matcher',
        '1-click auto-generated dispute text for Meesho, Flipkart & Amazon'
      ]
    },
    {
      id: 'warehouse',
      name: 'Warehouse 3-Table Pack',
      tagline: 'Multi-table packing team license for factories & wholesale hubs',
      monthlyPrice: warehouseMonthly,
      annualPrice: warehouseAnnual,
      annualStrike: warehouseStrike,
      dailyAnnualCost: Math.max(1, Math.round(warehouseAnnual / 365)),
      annualSavingsPercent:
        warehouseStrike > warehouseAnnual
          ? Math.round(((warehouseStrike - warehouseAnnual) / warehouseStrike) * 100)
          : 0,
      seats: 3,
      features: [
        'Everything in ClaimRadar Pro',
        '3 simultaneous PC licenses for packing tables',
        'Phone-as-scanner companion seats',
        'Shared central vault folder support',
        'Priority 1-on-1 WhatsApp dispute support'
      ]
    }
  ];
}

export const PLANS: PlanConfig[] = buildPlans();
export const PLAN_MAP = new Map<PlanId, PlanConfig>(PLANS.map((p) => [p.id, p]));

export function getPlan(id: PlanId): PlanConfig | undefined {
  return PLAN_MAP.get(id);
}

/**
 * Resolves the Razorpay payment link or page URL from environment variables.
 *
 * Supported variables:
 * - VITE_PAYMENT_LINK (generic payment URL)
 * - VITE_PAYMENT_LINK_STARTER, VITE_PAYMENT_LINK_CLAIMRADAR, VITE_PAYMENT_LINK_WAREHOUSE
 * - Legacy fallbacks: VITE_RAZORPAY_PAYMENT_URL*
 *
 * If no payment link variable is set, returns null. This instructs the UI to
 * hide the checkout button and present "Contact support to buy" via WhatsApp.
 *
 * Official Razorpay Documentation:
 * - https://razorpay.com/docs/payments/payment-links/
 * - https://razorpay.com/docs/api/payments/payment-links/
 */
export function getPaymentUrl(
  planId?: PlanId,
  _interval?: BillingInterval,
  env: Record<string, string | undefined> = (typeof import.meta !== 'undefined' &&
    (import.meta.env as unknown as Record<string, string | undefined>)) ||
    {}
): string | null {
  if (planId === 'starter') {
    const specific = env.VITE_PAYMENT_LINK_STARTER || env.VITE_RAZORPAY_PAYMENT_URL_STARTER;
    if (specific && specific.trim().length > 0) return specific.trim();
  }
  if (planId === 'claimradar') {
    const specific = env.VITE_PAYMENT_LINK_CLAIMRADAR || env.VITE_RAZORPAY_PAYMENT_URL_CLAIMRADAR;
    if (specific && specific.trim().length > 0) return specific.trim();
  }
  if (planId === 'warehouse') {
    const specific = env.VITE_PAYMENT_LINK_WAREHOUSE || env.VITE_RAZORPAY_PAYMENT_URL_WAREHOUSE;
    if (specific && specific.trim().length > 0) return specific.trim();
  }

  const generic = env.VITE_PAYMENT_LINK || env.VITE_RAZORPAY_PAYMENT_URL;
  if (generic && generic.trim().length > 0) return generic.trim();

  return null;
}

/**
 * Convenience boolean check whether a live payment link is configured.
 */
export function hasPaymentLink(
  planId?: PlanId,
  interval?: BillingInterval,
  env?: Record<string, string | undefined>
): boolean {
  return Boolean(getPaymentUrl(planId, interval, env));
}

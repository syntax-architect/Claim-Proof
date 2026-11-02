/* SABOOT Suite — Single source of truth for pricing and plans.
 * All prices are in INR (₹). Consumed by PricingPage, PaywallModal, and tests.
 */

import type { BillingInterval, PlanId } from '../types';

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

export const PLANS: PlanConfig[] = [
  {
    id: 'starter',
    name: 'Starter Station',
    tagline: 'Unlimited label cropping & barcode packing videos for 1 workstation',
    monthlyPrice: 349,
    annualPrice: 2499,
    annualStrike: 4188,
    dailyAnnualCost: 7,
    annualSavingsPercent: 40,
    seats: 1,
    features: [
      'Unlimited 4×6 / 4×4 label cropping & sorting',
      'Unlimited uncut AWB packing & unboxing videos',
      'Burnt-in IST forensic timestamp watermark',
      'Warehouse picklists & handover manifests',
      '1 PC workstation offline license'
    ]
  },
  {
    id: 'claimradar',
    name: 'ClaimRadar Pro',
    tagline: 'Complete forensic dispute proof suite to overturn rejected claims',
    monthlyPrice: 599,
    annualPrice: 4499,
    annualStrike: 7188,
    dailyAnnualCost: 12,
    annualSavingsPercent: 37,
    seats: 1,
    tag: 'MOST POPULAR',
    best: true,
    features: [
      'Everything in Starter Station',
      'Auto 4-photo forensic collage (T+0.5, 3, 6, 9s)',
      '72-hr / 14-day / 30-day claim deadline radar',
      'Dispatch-to-return side-by-side evidence matcher',
      '1-click auto-generated dispute text for Meesho, Flipkart & Amazon'
    ]
  },
  {
    id: 'warehouse',
    name: 'Warehouse 3-Table Pack',
    tagline: 'Multi-table packing team license for factories & wholesale hubs',
    monthlyPrice: 1199,
    annualPrice: 8999,
    annualStrike: 14388,
    dailyAnnualCost: 25,
    annualSavingsPercent: 37,
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

export const PLAN_MAP = new Map<PlanId, PlanConfig>(PLANS.map((p) => [p.id, p]));

export function getPlan(id: PlanId): PlanConfig | undefined {
  return PLAN_MAP.get(id);
}

/**
 * Resolves the Razorpay payment link or page URL from environment variables,
 * supporting optional per-plan overrides and a default generic payment URL.
 */
export function getPaymentUrl(planId?: PlanId, _interval?: BillingInterval): string {
  if (planId === 'starter' && import.meta.env.VITE_RAZORPAY_PAYMENT_URL_STARTER) {
    return import.meta.env.VITE_RAZORPAY_PAYMENT_URL_STARTER;
  }
  if (planId === 'claimradar' && import.meta.env.VITE_RAZORPAY_PAYMENT_URL_CLAIMRADAR) {
    return import.meta.env.VITE_RAZORPAY_PAYMENT_URL_CLAIMRADAR;
  }
  if (planId === 'warehouse' && import.meta.env.VITE_RAZORPAY_PAYMENT_URL_WAREHOUSE) {
    return import.meta.env.VITE_RAZORPAY_PAYMENT_URL_WAREHOUSE;
  }
  return import.meta.env.VITE_RAZORPAY_PAYMENT_URL || 'https://rzp.io/l/saboot';
}

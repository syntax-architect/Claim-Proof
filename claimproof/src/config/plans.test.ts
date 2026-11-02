import { describe, it, expect } from 'vitest';
import {
  buildPlans,
  getPaymentUrl,
  getPlan,
  hasPaymentLink,
  parsePriceEnv,
  PLANS,
  RAZORPAY_DOCS
} from './plans';

describe('src/config/plans.ts — Single Price List & Configurable Pricing', () => {
  describe('Sensible Default Pricing', () => {
    it('defines starter, claimradar, and warehouse with sensible default INR prices', () => {
      expect(PLANS).toHaveLength(3);
      const [starter, claimradar, warehouse] = PLANS;

      // Starter
      expect(starter.id).toBe('starter');
      expect(starter.name).toBe('Starter Station');
      expect(starter.monthlyPrice).toBe(349);
      expect(starter.annualPrice).toBe(2499);
      expect(starter.annualStrike).toBe(349 * 12);
      expect(starter.dailyAnnualCost).toBe(7);
      expect(starter.annualSavingsPercent).toBe(40);
      expect(starter.seats).toBe(1);

      // ClaimRadar Pro
      expect(claimradar.id).toBe('claimradar');
      expect(claimradar.name).toBe('ClaimRadar Pro');
      expect(claimradar.monthlyPrice).toBe(599);
      expect(claimradar.annualPrice).toBe(4499);
      expect(claimradar.annualStrike).toBe(599 * 12);
      expect(claimradar.dailyAnnualCost).toBe(12);
      expect(claimradar.annualSavingsPercent).toBe(37);
      expect(claimradar.best).toBe(true);

      // Warehouse
      expect(warehouse.id).toBe('warehouse');
      expect(warehouse.name).toBe('Warehouse 3-Table Pack');
      expect(warehouse.monthlyPrice).toBe(1199);
      expect(warehouse.annualPrice).toBe(8999);
      expect(warehouse.annualStrike).toBe(1199 * 12);
      expect(warehouse.dailyAnnualCost).toBe(25);
      expect(warehouse.annualSavingsPercent).toBe(37);
      expect(warehouse.seats).toBe(3);
    });

    it('retrieves individual plans by plan id via getPlan()', () => {
      const plan = getPlan('claimradar');
      expect(plan).toBeDefined();
      expect(plan?.id).toBe('claimradar');
      expect(plan?.best).toBe(true);
    });
  });

  describe('Dynamic Pricing from Environment Variables', () => {
    it('parses valid numeric strings and ignores invalid or negative inputs', () => {
      expect(parsePriceEnv('499', 349)).toBe(499);
      expect(parsePriceEnv(799, 349)).toBe(799);
      expect(parsePriceEnv('-50', 349)).toBe(349);
      expect(parsePriceEnv('invalid', 349)).toBe(349);
      expect(parsePriceEnv(undefined, 349)).toBe(349);
      expect(parsePriceEnv(null, 349)).toBe(349);
    });

    it('sets prices from environment variables and recalculates savings dynamically without code edits', () => {
      const customEnv = {
        VITE_PRICE_STARTER_MONTHLY: '399',
        VITE_PRICE_STARTER_ANNUAL: '2999',
        VITE_PRICE_CLAIMRADAR_MONTHLY: '699',
        VITE_PRICE_CLAIMRADAR_ANNUAL: '4999',
        VITE_PRICE_WAREHOUSE_MONTHLY: '1499',
        VITE_PRICE_WAREHOUSE_ANNUAL: '10999'
      };

      const plans = buildPlans(customEnv);
      const [starter, claimradar, warehouse] = plans;

      // Starter with custom prices
      expect(starter.monthlyPrice).toBe(399);
      expect(starter.annualPrice).toBe(2999);
      expect(starter.annualStrike).toBe(399 * 12); // 4788
      expect(starter.dailyAnnualCost).toBe(Math.round(2999 / 365)); // 8
      expect(starter.annualSavingsPercent).toBe(Math.round(((4788 - 2999) / 4788) * 100)); // 37%

      // ClaimRadar with custom prices
      expect(claimradar.monthlyPrice).toBe(699);
      expect(claimradar.annualPrice).toBe(4999);
      expect(claimradar.annualStrike).toBe(699 * 12); // 8388
      expect(claimradar.dailyAnnualCost).toBe(Math.round(4999 / 365)); // 14
      expect(claimradar.annualSavingsPercent).toBe(Math.round(((8388 - 4999) / 8388) * 100)); // 40%

      // Warehouse with custom prices
      expect(warehouse.monthlyPrice).toBe(1499);
      expect(warehouse.annualPrice).toBe(10999);
      expect(warehouse.annualStrike).toBe(1499 * 12); // 17988
      expect(warehouse.dailyAnnualCost).toBe(Math.round(10999 / 365)); // 30
      expect(warehouse.annualSavingsPercent).toBe(Math.round(((17988 - 10999) / 17998) * 100)); // 39%
    });

    it('supports alternative VITE_PRICE_*_YEARLY variable naming', () => {
      const customEnv = {
        VITE_PRICE_STARTER_YEARLY: '2799',
        VITE_PRICE_CLAIMRADAR_YEARLY: '4799',
        VITE_PRICE_WAREHOUSE_YEARLY: '9799'
      };

      const plans = buildPlans(customEnv);
      expect(plans[0].annualPrice).toBe(2799);
      expect(plans[1].annualPrice).toBe(4799);
      expect(plans[2].annualPrice).toBe(9799);
    });
  });

  describe('Payment URL Resolution & States (VITE_PAYMENT_LINK)', () => {
    it('returns null when VITE_PAYMENT_LINK is not set', () => {
      const emptyEnv = {};
      expect(getPaymentUrl('starter', 'annual', emptyEnv)).toBeNull();
      expect(getPaymentUrl('claimradar', 'annual', emptyEnv)).toBeNull();
      expect(getPaymentUrl('warehouse', 'annual', emptyEnv)).toBeNull();
      expect(hasPaymentLink('claimradar', 'annual', emptyEnv)).toBe(false);
    });

    it('returns the generic VITE_PAYMENT_LINK when set', () => {
      const env = { VITE_PAYMENT_LINK: 'https://rzp.io/l/saboot_official' };
      expect(getPaymentUrl('starter', 'annual', env)).toBe('https://rzp.io/l/saboot_official');
      expect(getPaymentUrl('claimradar', 'monthly', env)).toBe('https://rzp.io/l/saboot_official');
      expect(hasPaymentLink('claimradar', 'annual', env)).toBe(true);
    });

    it('prioritizes plan-specific VITE_PAYMENT_LINK_* over generic payment link', () => {
      const env = {
        VITE_PAYMENT_LINK: 'https://rzp.io/l/generic',
        VITE_PAYMENT_LINK_STARTER: 'https://rzp.io/l/starter_direct',
        VITE_PAYMENT_LINK_CLAIMRADAR: 'https://rzp.io/l/claimradar_direct',
        VITE_PAYMENT_LINK_WAREHOUSE: 'https://rzp.io/l/warehouse_direct'
      };

      expect(getPaymentUrl('starter', 'annual', env)).toBe('https://rzp.io/l/starter_direct');
      expect(getPaymentUrl('claimradar', 'annual', env)).toBe('https://rzp.io/l/claimradar_direct');
      expect(getPaymentUrl('warehouse', 'annual', env)).toBe('https://rzp.io/l/warehouse_direct');
    });

    it('supports backward-compatible VITE_RAZORPAY_PAYMENT_URL variables', () => {
      const env = {
        VITE_RAZORPAY_PAYMENT_URL: 'https://rzp.io/l/legacy_url',
        VITE_RAZORPAY_PAYMENT_URL_STARTER: 'https://rzp.io/l/legacy_starter'
      };

      expect(getPaymentUrl('starter', 'annual', env)).toBe('https://rzp.io/l/legacy_starter');
      expect(getPaymentUrl('claimradar', 'annual', env)).toBe('https://rzp.io/l/legacy_url');
    });
  });

  describe('Official Razorpay Documentation Citations', () => {
    it('cites official Razorpay documentation pages without inventing behavior', () => {
      expect(RAZORPAY_DOCS.paymentLinks).toBe('https://razorpay.com/docs/payments/payment-links/');
      expect(RAZORPAY_DOCS.paymentLinksApi).toBe(
        'https://razorpay.com/docs/api/payments/payment-links/'
      );
      expect(RAZORPAY_DOCS.upiFlows).toBe(
        'https://razorpay.com/docs/payments/payment-methods/upi/'
      );
      expect(RAZORPAY_DOCS.subscriptions).toBe(
        'https://razorpay.com/docs/api/payments/subscriptions/webhooks/'
      );
    });
  });
});

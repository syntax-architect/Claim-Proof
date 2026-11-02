import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import PricingPage from './PricingPage';
import { ToastProvider } from '../components/ui';
import * as plans from '../config/plans';

expect.extend(toHaveNoViolations);

vi.mock('../services/licenseService', () => ({
  useLicense: () => ({
    plan: 'free',
    seats: 1,
    deviceFingerprint: 'test-fingerprint',
    boundDevices: ['test-fingerprint'],
    demo: false
  }),
  getDeviceFingerprint: vi.fn().mockResolvedValue('test-fingerprint'),
  verifyAndActivateToken: vi.fn(),
  deactivateLicense: vi.fn(),
  activateDemoPlan: vi.fn()
}));

function renderPricingPage() {
  return render(
    <ToastProvider>
      <PricingPage />
    </ToastProvider>
  );
}

describe('PricingPage Component — Payment States & Pricing Display', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all plans from src/config/plans.ts with correct names and feature list', () => {
    renderPricingPage();

    expect(screen.getByText('Starter Station')).toBeDefined();
    expect(screen.getByText('ClaimRadar Pro')).toBeDefined();
    expect(screen.getByText('Warehouse 3-Table Pack')).toBeDefined();
    expect(screen.getByText(/Complete Feature Comparison/i)).toBeDefined();
  });

  describe('Payment Links vs Contact Support on Plans Grid', () => {
    it('State A: when VITE_PAYMENT_LINK is set, renders payment buttons for all plans', async () => {
      vi.spyOn(plans, 'getPaymentUrl').mockReturnValue('https://rzp.io/l/test_buy_link');

      const { container } = renderPricingPage();

      expect(screen.getByRole('button', { name: /Buy Starter Station/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Buy ClaimRadar Pro/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Buy Warehouse 3-Table Pack/i })).toBeDefined();

      // "Contact support to buy" should NOT be rendered when payment links are configured
      expect(screen.queryByRole('link', { name: /Contact support to buy/i })).toBeNull();

      const results = await axe(container, {
        rules: { region: { enabled: false } }
      });
      expect(results).toHaveNoViolations();
    });

    it('State B: when VITE_PAYMENT_LINK is NOT set, hides payment buttons and renders "Contact support to buy" with WhatsApp links', async () => {
      vi.spyOn(plans, 'getPaymentUrl').mockReturnValue(null);

      const { container } = renderPricingPage();

      // Payment buttons must be hidden
      expect(screen.queryByRole('button', { name: /Buy Starter Station/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /Buy ClaimRadar Pro/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /Buy Warehouse 3-Table Pack/i })).toBeNull();

      // "Contact support to buy" links must be rendered with WhatsApp URLs
      const supportLinks = screen.getAllByRole('link', { name: /Contact support to buy/i });
      expect(supportLinks).toHaveLength(3);

      for (const link of supportLinks) {
        expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\d+/);
        expect(link.getAttribute('href')).toContain('text=');
      }

      const results = await axe(container, {
        rules: { region: { enabled: false } }
      });
      expect(results).toHaveNoViolations();
    });
  });
});

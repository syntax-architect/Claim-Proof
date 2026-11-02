import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { BRAND } from '../../config/brand';
import { PaywallModal } from './PaywallModal';
import { PaywallProvider, usePaywall } from '../../providers/PaywallProvider';
import { ToastProvider } from '../ui';
import * as licenseService from '../../services/licenseService';
import * as plans from '../../config/plans';

expect.extend(toHaveNoViolations);

function TestHarness({ reason = 'Free plan limit reached' }: { reason?: string }) {
  const { openPaywall } = usePaywall();

  useEffect(() => {
    openPaywall({ plan: 'claimradar', reason });
  }, [openPaywall, reason]);

  return (
    <main>
      <button type="button" onClick={() => openPaywall({ plan: 'claimradar', reason })}>
        Trigger Paywall
      </button>
      <PaywallModal />
    </main>
  );
}

function renderPaywall(props?: { reason?: string }) {
  return render(
    <ToastProvider>
      <PaywallProvider>
        <TestHarness {...props} />
      </PaywallProvider>
    </ToastProvider>
  );
}

describe('PaywallModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: [] })),
      putImageData: vi.fn(),
      createImageData: vi.fn(),
      clearRect: vi.fn()
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  it('renders modal dialog when opened with header, reason banner, and passes axe', async () => {
    const { container } = renderPaywall({
      reason: 'Free plan daily recording limit reached'
    });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();

    expect(
      screen.getByRole('heading', { name: new RegExp(`Unlock ${BRAND.name} Suite`, 'i') })
    ).toBeDefined();
    expect(screen.getByText(/Free plan daily recording limit reached/i)).toBeDefined();

    const results = await axe(container, {
      rules: { region: { enabled: false } }
    });
    expect(results).toHaveNoViolations();
  });

  it('allows selecting plans and billing intervals with accessible updates and passes axe', async () => {
    vi.spyOn(plans, 'getPaymentUrl').mockReturnValue('https://rzp.io/l/test_checkout');

    const { container } = renderPaywall();

    // Initial state: default plan is ClaimRadar Pro, interval is Annual Pass
    const buyButton = screen.getByRole('button', {
      name: /Buy ClaimRadar Pro via Razorpay/i
    });
    expect(buyButton).toBeDefined();

    // Select Starter Station plan card
    const starterCard = screen.getAllByRole('button', {
      name: /Starter Station/i
    })[0];
    fireEvent.click(starterCard);

    expect(
      screen.getByRole('button', {
        name: /Buy Starter Station via Razorpay/i
      })
    ).toBeDefined();

    // Switch to Monthly Billing interval
    const monthlyBtn = screen.getByRole('button', {
      name: /Monthly Billing/i
    });
    fireEvent.click(monthlyBtn);

    expect(screen.getByText(/Recurring monthly billing/i)).toBeDefined();

    // Select Warehouse 3-Table Pack plan card
    const warehouseCard = screen.getAllByRole('button', {
      name: /Warehouse 3-Table Pack/i
    })[0];
    fireEvent.click(warehouseCard);

    expect(
      screen.getByRole('button', {
        name: /Buy Warehouse 3-Table Pack via Razorpay/i
      })
    ).toBeDefined();

    const results = await axe(container, {
      rules: { region: { enabled: false } }
    });
    expect(results).toHaveNoViolations();
  });

  describe('Payment Link vs Contact Support States (VITE_PAYMENT_LINK)', () => {
    it('State A: when VITE_PAYMENT_LINK is set, displays payment button and opens checkout on click', async () => {
      vi.spyOn(plans, 'getPaymentUrl').mockReturnValue('https://rzp.io/l/configured_payment_link');
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      const { container } = renderPaywall();

      const buyButton = screen.getByRole('button', {
        name: /Buy ClaimRadar Pro via Razorpay/i
      });
      expect(buyButton).toBeDefined();

      // Contact support to buy must NOT be shown when payment link exists
      expect(screen.queryByRole('link', { name: /Contact support to buy/i })).toBeNull();

      fireEvent.click(buyButton);
      expect(openSpy).toHaveBeenCalledWith(
        'https://rzp.io/l/configured_payment_link',
        '_blank',
        'noopener,noreferrer'
      );

      const results = await axe(container, {
        rules: { region: { enabled: false } }
      });
      expect(results).toHaveNoViolations();
    });

    it('State B: when VITE_PAYMENT_LINK is NOT set, hides payment button and displays "Contact support to buy" with WhatsApp link', async () => {
      // Simulate VITE_PAYMENT_LINK is unset
      vi.spyOn(plans, 'getPaymentUrl').mockReturnValue(null);

      const { container } = renderPaywall();

      // Payment button must be hidden
      expect(
        screen.queryByRole('button', {
          name: /Buy .* via Razorpay/i
        })
      ).toBeNull();

      // "Contact support to buy" link must be visible and point to WhatsApp
      const supportLink = screen.getByRole('link', {
        name: /Contact support to buy/i
      });
      expect(supportLink).toBeDefined();
      expect(supportLink.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\d+/);
      expect(supportLink.getAttribute('href')).toContain('text=');

      const results = await axe(container, {
        rules: { region: { enabled: false } }
      });
      expect(results).toHaveNoViolations();
    });
  });

  it('handles license key entry and successful activation', async () => {
    const activateSpy = vi.spyOn(licenseService, 'verifyAndActivateToken').mockResolvedValue({
      ok: true
    });

    const { container } = renderPaywall();

    const keyInput = screen.getByLabelText(/License key/i);
    expect(keyInput).toBeDefined();

    fireEvent.change(keyInput, {
      target: { value: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.validtoken' }
    });

    const activateBtn = screen.getByRole('button', {
      name: /Activate License/i
    });
    fireEvent.click(activateBtn);

    await waitFor(() => {
      expect(activateSpy).toHaveBeenCalledWith(
        'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.validtoken',
        undefined
      );
    });

    const results = await axe(container, {
      rules: { region: { enabled: false } }
    });
    expect(results).toHaveNoViolations();
  });

  it('displays validation and error messages for empty, invalid, and device-mismatch tokens', async () => {
    const activateSpy = vi.spyOn(licenseService, 'verifyAndActivateToken');

    const { container } = renderPaywall();

    // 1. Submit empty token
    const activateBtn = screen.getByRole('button', {
      name: /Activate License/i
    });
    fireEvent.click(activateBtn);
    expect(activateSpy).not.toHaveBeenCalled();

    // 2. Submit invalid token
    activateSpy.mockResolvedValueOnce({
      ok: false,
      error: 'Invalid ES256 cryptographic signature'
    });

    const keyInput = screen.getByLabelText(/License key/i);
    fireEvent.change(keyInput, { target: { value: 'invalid.token.payload' } });
    fireEvent.click(activateBtn);

    await waitFor(() => {
      expect(activateSpy).toHaveBeenCalledWith('invalid.token.payload', undefined);
    });

    // 3. Submit token with soft device binding limit exceeded
    activateSpy.mockResolvedValueOnce({
      ok: false,
      error: 'License bound to other devices',
      canMove: true
    });

    fireEvent.change(keyInput, { target: { value: 'bound.on.another.pc' } });
    fireEvent.click(activateBtn);

    const moveBtn = await screen.findByRole('button', {
      name: /Move license to this device/i
    });
    expect(moveBtn).toBeDefined();
    expect(screen.getAllByText(/License bound to other devices/i).length).toBeGreaterThan(0);

    // Click move license button
    activateSpy.mockResolvedValueOnce({
      ok: true
    });
    fireEvent.click(moveBtn);

    await waitFor(() => {
      expect(activateSpy).toHaveBeenCalledWith('bound.on.another.pc', {
        moveDevice: true
      });
    });

    const results = await axe(container, {
      rules: { region: { enabled: false } }
    });
    expect(results).toHaveNoViolations();
  });
});

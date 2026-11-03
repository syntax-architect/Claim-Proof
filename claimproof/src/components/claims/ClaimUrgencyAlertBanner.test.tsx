import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ClaimUrgencyAlertBanner } from './ClaimUrgencyAlertBanner';
import * as claimEngine from '../../services/claimEngine';
import type { ClaimItem } from '../../types';

expect.extend(toHaveNoViolations);

describe('ClaimUrgencyAlertBanner Component', () => {
  const navigateMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-31T12:00:00.000Z'));
    localStorage.clear();
    navigateMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('renders nothing when there are no pending claims expiring within 24h', () => {
    const safeClaim: ClaimItem = {
      id: 1,
      awb: 'AWB-SAFE-100',
      orderId: 'ORD-100',
      sku: 'SKU-SAFE',
      qty: 1,
      courier: 'Delhivery',
      marketplace: 'Meesho',
      status: 'pending',
      flagReason: 'Damaged',
      notes: '',
      returnScanAt: Date.now(),
      deadlineAt: Date.now() + 48 * 3_600_000 // 48h left (> 24h)
    };

    vi.spyOn(claimEngine, 'useClaims').mockReturnValue([safeClaim]);

    const { container } = render(<ClaimUrgencyAlertBanner navigate={navigateMock} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders warning banner at 24 hours threshold with warn tone and passes axe', async () => {
    const warningClaim: ClaimItem = {
      id: 2,
      awb: 'AWB-WARN-24H',
      orderId: 'ORD-24H',
      sku: 'SKU-WARN',
      qty: 1,
      courier: 'Shadowfax',
      marketplace: 'Flipkart',
      status: 'pending',
      flagReason: 'Wrong/Swapped item',
      notes: '',
      returnScanAt: Date.now() - 320 * 3_600_000,
      deadlineAt: Date.now() + 16 * 3_600_000 // 16h left (<= 24h & > 6h)
    };

    vi.spyOn(claimEngine, 'useClaims').mockReturnValue([warningClaim]);

    const { container } = render(<ClaimUrgencyAlertBanner navigate={navigateMock} />);

    expect(screen.getByTestId('claim-urgency-banner')).toBeDefined();
    expect(screen.getByText('AWB-WARN-24H')).toBeDefined();
    expect(screen.getByText('DEADLINE · < 24H')).toBeDefined();
    expect(screen.getByText(/Flipkart dispute closes in/i)).toBeDefined();

    // Prepare button triggers navigation
    const prepareBtn = screen.getByRole('button', { name: /Prepare Claim/i });
    fireEvent.click(prepareBtn);
    expect(navigateMock).toHaveBeenCalledWith('claims');

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders critical banner at 6 hours threshold with danger tone', async () => {
    const criticalClaim: ClaimItem = {
      id: 3,
      awb: 'AWB-CRITICAL-6H',
      orderId: 'ORD-6H',
      sku: 'SKU-CRIT',
      qty: 2,
      courier: 'Ekart',
      marketplace: 'Amazon',
      status: 'pending',
      flagReason: 'Empty package',
      notes: '',
      returnScanAt: Date.now() - 716 * 3_600_000,
      deadlineAt: Date.now() + 4 * 3_600_000 // 4h left (<= 6h)
    };

    vi.spyOn(claimEngine, 'useClaims').mockReturnValue([criticalClaim]);

    const { container } = render(<ClaimUrgencyAlertBanner navigate={navigateMock} />);

    expect(screen.getByTestId('claim-urgency-banner')).toBeDefined();
    expect(screen.getByText('AWB-CRITICAL-6H')).toBeDefined();
    expect(screen.getByText('CRITICAL · < 6H')).toBeDefined();

    const banner = screen.getByTestId('claim-urgency-banner');
    expect(banner.className).toContain('border-danger-500');

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('hides the banner when the dismiss button is clicked', () => {
    const urgentClaim: ClaimItem = {
      id: 4,
      awb: 'AWB-DISMISS-ME',
      orderId: 'ORD-DISMISS',
      sku: 'SKU-DISMISS',
      qty: 1,
      courier: 'Valmo',
      marketplace: 'Meesho',
      status: 'pending',
      flagReason: 'Damaged',
      notes: '',
      returnScanAt: Date.now() - 60 * 3_600_000,
      deadlineAt: Date.now() + 12 * 3_600_000
    };

    vi.spyOn(claimEngine, 'useClaims').mockReturnValue([urgentClaim]);

    render(<ClaimUrgencyAlertBanner navigate={navigateMock} />);

    expect(screen.getByTestId('claim-urgency-banner')).toBeDefined();

    const dismissBtn = screen.getByRole('button', { name: /Dismiss urgency reminder/i });
    fireEvent.click(dismissBtn);

    expect(screen.queryByTestId('claim-urgency-banner')).toBeNull();
  });
});

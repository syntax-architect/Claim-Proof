import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ClaimRadarDashboard } from './ClaimRadarDashboard';
import { ToastProvider } from '../ui';
import { PaywallProvider } from '../../providers/PaywallProvider';
import * as claimEngine from '../../services/claimEngine';
import * as licenseService from '../../services/licenseService';
import { UNVERIFIED_LABEL } from '../../config/claimWindows';
import type { ClaimItem } from '../../types';

expect.extend(toHaveNoViolations);

const mockActiveClaim: ClaimItem = {
  id: 101,
  awb: 'AWB-DELHIVERY-12345',
  orderId: 'ORD-998877',
  sku: 'TSHIRT-RED-M',
  qty: 2,
  courier: 'Delhivery',
  marketplace: 'Meesho',
  status: 'pending',
  flagReason: 'Damaged',
  notes: '',
  disputeText: '',
  returnScanAt: Date.now() - 3_600_000, // 1 hour ago
  deadlineAt: Date.now() + 71 * 3_600_000 // 71 hours left
};

const mockExpiredClaim: ClaimItem = {
  id: 102,
  awb: 'AWB-EKART-554433',
  orderId: 'ORD-112233',
  sku: 'JEANS-SLIM-32',
  qty: 1,
  courier: 'Ekart',
  marketplace: 'Flipkart',
  status: 'pending',
  flagReason: 'Wrong/Swapped item',
  notes: '',
  disputeText: '',
  returnScanAt: Date.now() - 15 * 24 * 3_600_000, // 15 days ago
  deadlineAt: Date.now() - 3_600_000 // Expired 1 hour ago
};

function renderDashboard() {
  return render(
    <ToastProvider>
      <PaywallProvider>
        <main>
          <ClaimRadarDashboard />
        </main>
      </PaywallProvider>
    </ToastProvider>
  );
}

describe('ClaimRadarDashboard Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(licenseService, 'useLicense').mockReturnValue({
      plan: 'claimradar',
      seats: 1,
      deviceFingerprint: 'mock-fp',
      boundDevices: []
    });
  });

  it('renders accessible empty state when no claims exist and passes axe', async () => {
    vi.spyOn(claimEngine, 'useClaims').mockReturnValue([]);

    const { container } = renderDashboard();

    expect(screen.getByRole('heading', { name: /ClaimRadar Pro/i })).toBeDefined();

    expect(screen.getByText(/No return claims in your radar/i)).toBeDefined();

    const openRecorderBtn = screen.getByRole('button', {
      name: /Open AWB Recorder/i
    });
    expect(openRecorderBtn).toBeDefined();

    const results = await axe(container, {
      rules: { region: { enabled: false }, 'heading-order': { enabled: false } }
    });
    expect(results).toHaveNoViolations();
  });

  it('renders active claim with countdown, prepare action, and passes axe', async () => {
    vi.spyOn(claimEngine, 'useClaims').mockReturnValue([mockActiveClaim]);
    const updateStatusSpy = vi.spyOn(claimEngine, 'updateClaimStatus').mockResolvedValue();

    const { container } = renderDashboard();

    // Check stats and AWB
    expect(screen.getByText('AWB-DELHIVERY-12345')).toBeDefined();
    expect(screen.getAllByText(/left to file/i).length).toBeGreaterThan(0);

    // Shows unverified badge next to unconfirmed window
    expect(screen.getAllByText(UNVERIFIED_LABEL).length).toBeGreaterThan(0);

    const prepareBtn = screen.getByRole('button', {
      name: /Prepare Claim/i
    });
    expect(prepareBtn).toBeDefined();

    // Change status to Won
    const wonBtn = screen.getByRole('button', { name: 'Won' });
    fireEvent.click(wonBtn);
    expect(updateStatusSpy).toHaveBeenCalledWith(101, 'won');

    // Delete button accessible
    const deleteBtn = screen.getByRole('button', { name: /Delete claim/i });
    expect(deleteBtn).toBeDefined();

    const results = await axe(container, {
      rules: { region: { enabled: false }, 'heading-order': { enabled: false } }
    });
    expect(results).toHaveNoViolations();
  });

  it('renders expired claim with urgency warning and passes axe', async () => {
    vi.spyOn(claimEngine, 'useClaims').mockReturnValue([mockExpiredClaim]);

    const { container } = renderDashboard();

    expect(screen.getByText('AWB-EKART-554433')).toBeDefined();
    expect(screen.getByText(/WINDOW EXPIRED — file manually with proof of delay/i)).toBeDefined();
    expect(screen.getByText('END')).toBeDefined();

    // Verify unverified badge for Flipkart
    expect(screen.getAllByText(UNVERIFIED_LABEL).length).toBeGreaterThan(0);

    const results = await axe(container, {
      rules: { region: { enabled: false }, 'heading-order': { enabled: false } }
    });
    expect(results).toHaveNoViolations();
  });

  it('renders claim right at 0ms boundary with expired indicator and passes axe', async () => {
    const boundaryClaim: ClaimItem = {
      id: 103,
      awb: 'AWB-BOUNDARY-0MS',
      orderId: 'ORD-BOUNDARY',
      sku: 'SKU-BOUNDARY',
      qty: 1,
      courier: 'Delhivery',
      marketplace: 'Meesho',
      status: 'pending',
      flagReason: 'Damaged',
      notes: '',
      disputeText: '',
      returnScanAt: Date.now() - 72 * 3600 * 1000,
      deadlineAt: Date.now() // exactly at deadline (0ms)
    };

    vi.spyOn(claimEngine, 'useClaims').mockReturnValue([boundaryClaim]);

    const { container } = renderDashboard();
    expect(screen.getByText('AWB-BOUNDARY-0MS')).toBeDefined();
    expect(screen.getByText('END')).toBeDefined();
    expect(screen.getByText(/WINDOW EXPIRED — file manually with proof of delay/i)).toBeDefined();

    const results = await axe(container, {
      rules: { region: { enabled: false }, 'heading-order': { enabled: false } }
    });
    expect(results).toHaveNoViolations();
  });
});

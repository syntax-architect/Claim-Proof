import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import 'fake-indexeddb/auto';
import MoneyPage from './MoneyPage';
import { ToastProvider } from '../components/ui';
import { PaywallProvider } from '../providers/PaywallProvider';
import { db } from '../db/schema';
import type { ClaimItem } from '../types';

expect.extend(toHaveNoViolations);

function renderMoneyPage() {
  return render(
    <ToastProvider>
      <PaywallProvider>
        <main>
          <MoneyPage />
        </main>
      </PaywallProvider>
    </ToastProvider>
  );
}

describe('MoneyPage Component', () => {
  beforeEach(async () => {
    localStorage.clear();
    await db.claims.clear();
    await db.settings.clear();
  });

  describe('Empty State', () => {
    it('renders empty ledger state inviting user to log first claim, and passes axe', async () => {
      const { container } = renderMoneyPage();

      // Heading and subtitle
      expect(
        screen.getByRole('heading', { level: 1, name: /Money & Claims Ledger/i })
      ).toBeDefined();

      // Empty state text
      expect(await screen.findByText(/No claims in ledger yet/i)).toBeDefined();
      expect(
        screen.getByText(
          /Track return disputes, filed claims, and revenue recoveries across Meesho/i
        )
      ).toBeDefined();

      // Action buttons in empty state
      expect(screen.getByRole('button', { name: /Log your first claim/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Import from CSV/i })).toBeDefined();

      // Percentage unlock notice
      expect(
        screen.getByText(/Percentage statistics unlock after 10 resolved claims/i)
      ).toBeDefined();

      // Plan meter should be hidden when no data/cost
      expect(screen.queryByText(/Plan Breakeven Meter/i)).toBeNull();
      expect(screen.queryByText(/Your plan has paid for itself/i)).toBeNull();

      // Axe accessibility check
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Filled State & Interactions', () => {
    beforeEach(async () => {
      const sampleClaims: ClaimItem[] = [
        {
          awb: 'AWB-MEESHO-1001',
          orderId: 'ORD-1001',
          marketplace: 'Meesho',
          courier: 'Delhivery',
          sku: 'KURTI-L',
          qty: 1,
          flagReason: 'Damaged',
          notes: 'Torn polybag, broken zipper',
          returnScanAt: Date.now() - 3600000,
          deadlineAt: Date.now() + 71 * 3600000,
          status: 'won',
          amountClaimedPaise: 80000, // ₹800
          amountRecoveredPaise: 80000, // ₹800
          filedAt: Date.now() - 3600000,
          resolvedAt: Date.now()
        },
        {
          awb: 'AWB-FLIPKART-2002',
          orderId: 'ORD-2002',
          marketplace: 'Flipkart',
          courier: 'Ekart',
          sku: 'SHIRT-M',
          qty: 2,
          flagReason: 'Wrong/Swapped item',
          notes: 'Received duplicate polyester rag',
          returnScanAt: Date.now() - 86400000,
          deadlineAt: Date.now() + 13 * 86400000,
          status: 'partly_won',
          amountClaimedPaise: 120000, // ₹1,200
          amountRecoveredPaise: 60000, // ₹600
          filedAt: Date.now() - 86400000,
          resolvedAt: Date.now()
        },
        {
          awb: 'AWB-AMAZON-3003',
          orderId: 'ORD-3003',
          marketplace: 'Amazon',
          courier: 'Delhivery',
          sku: 'EARPHONES',
          qty: 1,
          flagReason: 'Empty package',
          notes: 'Empty box',
          returnScanAt: Date.now() - 7200000,
          deadlineAt: Date.now() + 29 * 86400000,
          status: 'lost',
          amountClaimedPaise: 150000, // ₹1,500
          amountRecoveredPaise: 0,
          filedAt: Date.now() - 7200000,
          resolvedAt: Date.now()
        },
        {
          awb: 'AWB-AJIO-4004',
          orderId: 'ORD-4004',
          marketplace: 'AJIO',
          courier: 'Delhivery',
          sku: 'SHOES-9',
          qty: 1,
          flagReason: 'Used/Worn',
          notes: 'Customer worn shoes',
          returnScanAt: Date.now() - 10000,
          deadlineAt: Date.now() + 72 * 3600000,
          status: 'not_filed',
          amountClaimedPaise: 200000 // ₹2,000
        }
      ];

      await db.claims.bulkAdd(sampleClaims);
    });

    it('renders claims table rows and rupee totals in metric cards, and passes axe', async () => {
      const { container } = renderMoneyPage();

      // Verify table rows rendered
      expect(await screen.findByText('AWB-MEESHO-1001')).toBeDefined();
      expect(screen.getByText('AWB-FLIPKART-2002')).toBeDefined();
      expect(screen.getByText('AWB-AMAZON-3003')).toBeDefined();
      expect(screen.getByText('AWB-AJIO-4004')).toBeDefined();

      // Check statuses rendered
      expect(screen.getAllByText('Won').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Partly won').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Lost').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Not filed').length).toBeGreaterThan(0);

      // Check Recovered amount in summary (₹800 + ₹600 = ₹1,400)
      expect(screen.getByText(/₹1,400/)).toBeDefined();

      // Axe check
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('displays and updates plan cost breakeven meter when user enters plan cost', async () => {
      renderMoneyPage();

      // Click "Enter Plan Cost"
      const enterCostBtn = await screen.findByRole('button', { name: /Set or update plan cost/i });
      fireEvent.click(enterCostBtn);

      // Modal appears
      expect(screen.getByRole('heading', { name: /Set Your Software Plan Cost/i })).toBeDefined();

      const input = screen.getByLabelText(/Plan cost in rupees/i);
      fireEvent.change(input, { target: { value: '4499' } });

      const saveBtn = screen.getByRole('button', { name: /Save plan cost/i });
      fireEvent.click(saveBtn);

      // Plan Breakeven Meter now appears
      await waitFor(() => {
        expect(screen.getByText(/Plan Breakeven Meter/i)).toBeDefined();
      });

      // 1,400 of 4,499 recovered (31.1% ROI)
      expect(screen.getByText(/31.1% ROI/i)).toBeDefined();
      expect(screen.getByText(/₹3,099 left to break even/i)).toBeDefined();
    });

    it('celebrates when total recovered exceeds plan cost', async () => {
      // Enter plan cost as ₹1,000 (which is less than ₹1,400 recovered)
      localStorage.setItem('saboot_user_plan_cost_paise', '100000');

      renderMoneyPage();

      await waitFor(() => {
        expect(screen.getByText(/Your plan has paid for itself!/i)).toBeDefined();
      });

      expect(screen.getByText(/140% ROI/i)).toBeDefined();
      expect(screen.getByText(/\+₹400/i)).toBeDefined();
    });
  });
});

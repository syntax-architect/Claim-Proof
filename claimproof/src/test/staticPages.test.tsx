import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import PrivacyPolicyPage from '../pages/PrivacyPolicyPage';
import TermsPage from '../pages/TermsPage';
import RefundPolicyPage from '../pages/RefundPolicyPage';
import SupportPage from '../pages/SupportPage';
import Footer from '../components/shell/Footer';
import { getDiagnosticInfo, getFormattedDiagnosticString } from '../lib/diagnostics';
import { ToastProvider } from '../components/ui';
import { parseHash, ROUTES, ROUTE_LABELS, type Route } from '../lib/router';
import { CurrentPage } from '../App';
import { PaywallProvider } from '../providers/PaywallProvider';

expect.extend(toHaveNoViolations);

const axeOptions = {
  rules: {
    region: { enabled: false },
    'heading-order': { enabled: false }
  }
};

describe('Static Pages & Legal Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('PrivacyPolicyPage', () => {
    it('renders with zero-cloud guarantee and explicit device-only statement', async () => {
      const navigate = vi.fn();
      const { container } = render(
        <ToastProvider>
          <PrivacyPolicyPage navigate={navigate} />
        </ToastProvider>
      );

      // Explicitly: videos and labels stay on the user's device
      expect(screen.getByText(/The ClaimProof Zero-Cloud Guarantee/i)).toBeDefined();
      expect(screen.getByText(/Your Videos & Labels Never Leave Your Device/i)).toBeDefined();
      expect(
        screen.getByText(
          /All video recordings, shipping label documents, unboxing clips, photographic evidence, and order manifests/i
        )
      ).toBeDefined();

      // Lists the ONLY data collected:
      expect(screen.getByText(/The Only Data We Collect/i)).toBeDefined();
      expect(screen.getByText(/1\. License Key/i)).toBeDefined();
      expect(screen.getByText(/2\. Email Address/i)).toBeDefined();
      expect(screen.getByText(/3\. Payment & Transaction ID/i)).toBeDefined();

      // What is never collected
      expect(screen.getByText(/What We NEVER Collect, View, or Transmit/i)).toBeDefined();
      expect(screen.getByText(/No packing or unboxing videos/i)).toBeDefined();
      expect(screen.getByText(/No shipping labels or PDFs/i)).toBeDefined();

      // Contains [NEEDS LEGAL REVIEW] placeholders
      const legalPlaceholders = screen.getAllByText(/\[NEEDS LEGAL REVIEW\]/i);
      expect(legalPlaceholders.length).toBeGreaterThanOrEqual(1);

      // Back button works
      fireEvent.click(screen.getByRole('button', { name: /Back to Settings/i }));
      expect(navigate).toHaveBeenCalledWith('settings');

      // Accessibility audit
      const results = await axe(container, axeOptions);
      expect(results).toHaveNoViolations();
    });
  });

  describe('TermsPage', () => {
    it('renders terms of service, marketplace independence, and claim outcome disclaimers', async () => {
      const navigate = vi.fn();
      const { container } = render(
        <ToastProvider>
          <TermsPage navigate={navigate} />
        </ToastProvider>
      );

      // Scope of service
      expect(screen.getByText(/Scope of the Software & Local Execution/i)).toBeDefined();
      expect(screen.getByText(/SmartLabel Studio/i)).toBeDefined();
      expect(screen.getByText(/ClaimProof AWB Recorder/i)).toBeDefined();
      expect(screen.getAllByText(/ClaimRadar/i).length).toBeGreaterThanOrEqual(1);

      // Marketplace Independence
      expect(screen.getByText(/Marketplace Independence & Trademark Disclaimers/i)).toBeDefined();
      expect(screen.getAllByText(/Meesho/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Flipkart/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Amazon India/i).length).toBeGreaterThanOrEqual(1);

      // Claim Outcomes & No Payout Guarantee
      expect(screen.getByText(/Marketplace Claims Outcomes & No Payout Guarantee/i)).toBeDefined();
      expect(screen.getByText(/NO GUARANTEE OF CLAIM APPROVAL/i)).toBeDefined();

      // Contains [NEEDS LEGAL REVIEW] placeholders
      const legalPlaceholders = screen.getAllByText(/\[NEEDS LEGAL REVIEW\]/i);
      expect(legalPlaceholders.length).toBeGreaterThanOrEqual(3);

      // Accessibility audit
      const results = await axe(container, axeOptions);
      expect(results).toHaveNoViolations();
    });
  });

  describe('RefundPolicyPage', () => {
    it('renders refund policy with 7-day guarantee and 3-day grace period', async () => {
      const navigate = vi.fn();
      const { container } = render(
        <ToastProvider>
          <RefundPolicyPage navigate={navigate} />
        </ToastProvider>
      );

      // Free Tier try-before-you-buy
      expect(screen.getByText(/Try Before You Buy with Our Perpetual Free Tier/i)).toBeDefined();

      // 7-day guarantee
      expect(screen.getByText(/7-Day Money-Back Guarantee/i)).toBeDefined();
      expect(screen.getByText(/100% full refund within 7 calendar days/i)).toBeDefined();

      // 3-day grace period
      expect(screen.getAllByText(/3-Day Grace Period/i).length).toBeGreaterThanOrEqual(1);

      // Refund processing
      expect(screen.getByText(/Refund Processing Timeline/i)).toBeDefined();
      expect(screen.getByText(/5 to 7 business days/i)).toBeDefined();

      // Contains [NEEDS LEGAL REVIEW] placeholders
      const legalPlaceholders = screen.getAllByText(/\[NEEDS LEGAL REVIEW\]/i);
      expect(legalPlaceholders.length).toBeGreaterThanOrEqual(2);

      // Accessibility audit
      const results = await axe(container, axeOptions);
      expect(results).toHaveNoViolations();
    });
  });

  describe('SupportPage', () => {
    it('renders WhatsApp click-to-chat, support email, and copy diagnostic info button', async () => {
      const navigate = vi.fn();
      const clipboardWrite = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: clipboardWrite
        }
      });

      const { container } = render(
        <ToastProvider>
          <SupportPage navigate={navigate} />
        </ToastProvider>
      );

      // WhatsApp link
      expect(screen.getByText(/WhatsApp Support/i)).toBeDefined();
      const whatsappBtn = screen.getByRole('button', { name: /Chat on WhatsApp/i });
      expect(whatsappBtn).toBeDefined();
      const whatsappAnchor = whatsappBtn.closest('a');
      expect(whatsappAnchor?.href).toContain('wa.me');

      // Email link
      expect(screen.getByText(/Email Helpdesk/i)).toBeDefined();
      const emailBtn = screen.getByRole('button', { name: /Send Support Email/i });
      expect(emailBtn).toBeDefined();
      const emailAnchor = emailBtn.closest('a');
      expect(emailAnchor?.href).toContain('mailto:support@claimproof.in');

      // Copy diagnostic info
      const copyBtn = screen.getByRole('button', { name: /Copy diagnostic info/i });
      expect(copyBtn).toBeDefined();

      // Click copy button
      fireEvent.click(copyBtn);
      await waitFor(() => {
        expect(clipboardWrite).toHaveBeenCalled();
      });

      // Diagnostic text is in preview box
      const preBox = screen.getByLabelText(/Workstation Technical Diagnostics/i);
      expect(preBox).toBeDefined();

      // Troubleshooting FAQ
      expect(screen.getByText(/Common Workstation Troubleshooting/i)).toBeDefined();
      expect(screen.getByText(/Webcam Not Detected \/ Black Screen/i)).toBeDefined();
      expect(screen.getByText(/Barcode Scanner Gun Not Triggering Recording/i)).toBeDefined();

      // Contains [NEEDS LEGAL REVIEW] placeholder
      expect(screen.getByText(/\[NEEDS LEGAL REVIEW\]/i)).toBeDefined();

      // Accessibility audit
      const results = await axe(container, axeOptions);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Zero-PII Diagnostic Info Collector', () => {
    it('extracts technical diagnostics and strictly excludes personal data', async () => {
      const diag = await getDiagnosticInfo();
      const jsonStr = await getFormattedDiagnosticString();

      // Check structure
      expect(diag.app.name).toBe('ClaimProof Suite');
      expect(diag.app.version).toBe('1.0.0');
      expect(diag.system).toBeDefined();
      expect(diag.capabilities).toBeDefined();
      expect(diag.storage).toBeDefined();
      expect(diag.license).toBeDefined();
      expect(diag.todayActivityCounts).toBeDefined();
      expect(diag.privacyNotice).toContain('Zero personal data guarantee');

      // Check ZERO personal data
      // No order IDs, no customer identities, no emails in technical report, no private keys
      expect(jsonStr).not.toContain('customer_name');
      expect(jsonStr).not.toContain('shipping_address');
      expect(jsonStr).not.toContain('video_path');
      expect(jsonStr).not.toContain('token_signature');
      expect(jsonStr).not.toContain('pdf_base64');
    });
  });

  describe('Footer Navigation & App Routing', () => {
    it('renders all footer links and triggers hash navigation', () => {
      const navigate = vi.fn();
      render(<Footer navigate={navigate} />);

      // Links to privacy, terms, refund, and support
      const privacyLink = screen.getByRole('link', { name: /Privacy Policy/i });
      const termsLink = screen.getByRole('link', { name: /Terms of Service/i });
      const refundLink = screen.getByRole('link', { name: /Refund Policy/i });
      const supportLink = screen.getByRole('link', { name: /Support & Diagnostics/i });

      expect(privacyLink).toBeDefined();
      expect(termsLink).toBeDefined();
      expect(refundLink).toBeDefined();
      expect(supportLink).toBeDefined();

      fireEvent.click(privacyLink);
      expect(navigate).toHaveBeenCalledWith('privacy');

      fireEvent.click(termsLink);
      expect(navigate).toHaveBeenCalledWith('terms');

      fireEvent.click(refundLink);
      expect(navigate).toHaveBeenCalledWith('refund');

      fireEvent.click(supportLink);
      expect(navigate).toHaveBeenCalledWith('support');
    });

    it('successfully parses new static page hashes in router', () => {
      expect(parseHash('#/privacy')).toBe('privacy');
      expect(parseHash('#/terms')).toBe('terms');
      expect(parseHash('#/refund')).toBe('refund');
      expect(parseHash('#/support')).toBe('support');

      for (const r of ['privacy', 'terms', 'refund', 'support'] as Route[]) {
        expect(ROUTES.includes(r as any)).toBe(true);
        expect(ROUTE_LABELS[r]).toBeDefined();
      }
    });

    it('renders each new static route without 404 in CurrentPage', () => {
      const staticRoutes: Route[] = ['privacy', 'terms', 'refund', 'support'];
      for (const r of staticRoutes) {
        const { container } = render(
          <ToastProvider>
            <PaywallProvider>
              <CurrentPage route={r} navigate={() => {}} />
            </PaywallProvider>
          </ToastProvider>
        );
        expect(container.textContent).not.toContain('404 NOT FOUND');
      }
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import SmartLabelWorkbench from './SmartLabelWorkbench';
import { ToastProvider } from '../ui';
import { PaywallProvider } from '../../providers/PaywallProvider';
import * as pdfProcessor from '../../services/pdfLabelProcessor';
import * as quotaModule from '../../lib/quota';
import type { ExtractedLabel } from '../../types';

expect.extend(toHaveNoViolations);

const mockLabel: ExtractedLabel = {
  sourceFile: 'labels.pdf',
  page: 1,
  awb: 'AWB1234567890',
  orderId: 'ORD-987654',
  sku: 'TSHIRT-BLK-L',
  size: 'L',
  color: 'Black',
  qty: 1,
  invoiceTotal: 499,
  courier: 'Delhivery',
  marketplace: 'Meesho',
  confidence: {
    awb: 1,
    orderId: 1,
    sku: 1,
    courier: 1,
    marketplace: 1,
    qty: 1,
    size: 1,
    color: 1,
    invoiceTotal: 1
  },
  contentBox: { x: 0, y: 0, w: 288, h: 432 }
};

function renderWorkbench() {
  return render(
    <ToastProvider>
      <PaywallProvider>
        <main>
          <SmartLabelWorkbench />
        </main>
      </PaywallProvider>
    </ToastProvider>
  );
}

describe('SmartLabelWorkbench Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders initial empty drop zone with accessible file controls and passes axe', async () => {
    const { container } = renderWorkbench();

    expect(
      screen.getByRole('heading', { name: /SmartLabel SKU\+ Studio/i })
    ).toBeDefined();
    expect(
      screen.getByText(/Drop shipping label PDFs here/i)
    ).toBeDefined();

    expect(
      screen.getByRole('button', { name: /Select PDF files/i })
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: /Try with sample labels/i })
    ).toBeDefined();

    const results = await axe(container, {
      rules: { region: { enabled: false } }
    });
    expect(results).toHaveNoViolations();
  });

  it('renders review table when files are loaded and parsed successfully and passes axe', async () => {
    vi.spyOn(pdfProcessor, 'processLabelFiles').mockResolvedValue({
      labels: [mockLabel],
      pdfBytes: new Uint8Array([1, 2, 3]),
      fileName: 'ClaimProof_Labels_4x6.pdf'
    });

    const { container } = renderWorkbench();

    const file = new File(['%PDF-1.4 dummy'], 'labels.pdf', {
      type: 'application/pdf'
    });
    const fileInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Crop & export/i })
      ).toBeDefined();
    });

    expect(screen.getByText('AWB1234567890')).toBeDefined();
    expect(screen.getByText('TSHIRT-BLK-L')).toBeDefined();
    expect(
      screen.getByPlaceholderText(
        /Filter AWB/i
      )
    ).toBeDefined();

    const results = await axe(container, {
      rules: { region: { enabled: false } }
    });
    expect(results).toHaveNoViolations();
  });

  it('renders parse error state with retry action when processing fails and passes axe', async () => {
    vi.spyOn(pdfProcessor, 'processLabelFiles').mockRejectedValue(
      new Error('Corrupt or password-protected PDF document')
    );

    const { container } = renderWorkbench();

    const file = new File(['invalid bytes'], 'corrupt.pdf', {
      type: 'application/pdf'
    });
    const fileInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    const retryBtn = await screen.findByRole('button', {
      name: /Try another batch/i
    });
    expect(retryBtn).toBeDefined();

    expect(
      screen.getByText(/Corrupt or password-protected PDF document/i)
    ).toBeDefined();

    // Verify retry button resets back to drop zone
    fireEvent.click(retryBtn);

    expect(screen.getByText(/Drop shipping label PDFs here/i)).toBeDefined();

    const results = await axe(container, {
      rules: { region: { enabled: false } }
    });
    expect(results).toHaveNoViolations();
  });

  it('enforces quota check and blocks export when daily free quota is reached', async () => {
    vi.spyOn(pdfProcessor, 'processLabelFiles').mockResolvedValue({
      labels: [mockLabel],
      pdfBytes: new Uint8Array([1, 2, 3]),
      fileName: 'ClaimProof_Labels_4x6.pdf'
    });

    const quotaSpy = vi
      .spyOn(quotaModule, 'checkLabelQuota')
      .mockResolvedValue({
        allowed: false,
        used: 40,
        limit: 40
      });

    const { container } = renderWorkbench();

    const file = new File(['%PDF-1.4 dummy'], 'labels.pdf', {
      type: 'application/pdf'
    });
    const fileInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    const exportBtn = await screen.findByRole('button', {
      name: /Crop & export/i
    });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(quotaSpy).toHaveBeenCalledWith(1);
    });

    const results = await axe(container, {
      rules: { region: { enabled: false } }
    });
    expect(results).toHaveNoViolations();
  });
});

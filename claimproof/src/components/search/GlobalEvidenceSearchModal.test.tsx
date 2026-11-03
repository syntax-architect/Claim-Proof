import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { db } from '../../db/schema';
import { GlobalEvidenceSearchModal } from './GlobalEvidenceSearchModal';
import { ToastProvider } from '../ui';

expect.extend(toHaveNoViolations);

const axeOptions = {
  rules: {
    region: { enabled: false },
    'heading-order': { enabled: false }
  }
};

function renderModal(props: { open: boolean; onClose: () => void; initialQuery?: string }) {
  return render(
    <ToastProvider>
      <main>
        <GlobalEvidenceSearchModal {...props} />
      </main>
    </ToastProvider>
  );
}

describe('GlobalEvidenceSearchModal Component', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await db.recordings.clear();
    await db.orders.clear();
    await db.claims.clear();
    await db.media_cache.clear();
    await db.settings.clear();
  });

  it('renders initial empty search state with instructions and passes axe', async () => {
    const onClose = vi.fn();
    const { container } = renderModal({ open: true, onClose });

    expect(screen.getByRole('dialog', { name: 'Global Evidence Search' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Scan barcode or type AWB/i)).toBeInTheDocument();
    expect(screen.getByText('Search Proof & Claims')).toBeInTheDocument();

    const results = await axe(container, axeOptions);
    expect(results).toHaveNoViolations();
  });

  it('renders unified evidence dossier with packing video, return video, and claim status', async () => {
    const awb = 'AWB-FULL-SUITE-1';
    await db.recordings.add({
      awb,
      orderId: 'ORD-900',
      sku: 'COTTON-SHIRT-L',
      size: 'L',
      qty: 1,
      courier: 'Delhivery',
      marketplace: 'Meesho',
      type: 'dispatch',
      startedAt: 1730000000000,
      endedAt: 1730000030000,
      durationSec: 30,
      videoMime: 'video/webm',
      videoBytes: 1500000,
      photoBytes: 200000,
      photoCollage: true,
      vaultPath: `2026-10-27/Dispatch/${awb}`,
      demo: false,
      flagged: false
    });

    await db.claims.add({
      awb,
      orderId: 'ORD-900',
      marketplace: 'Meesho',
      courier: 'Delhivery',
      sku: 'COTTON-SHIRT-L',
      qty: 1,
      flagReason: 'Damaged',
      notes: 'Crushed box',
      returnScanAt: 1730000000000,
      deadlineAt: 1730000000000 + 72 * 3600 * 1000,
      status: 'pending'
    });

    const onClose = vi.fn();
    const { container } = renderModal({ open: true, onClose, initialQuery: awb });

    await waitFor(() => {
      expect(screen.getByText(awb)).toBeInTheDocument();
    });

    expect(screen.getByText('Packing Video (Dispatch)')).toBeInTheDocument();
    expect(screen.getByText('Dispute: PENDING')).toBeInTheDocument();
    expect(screen.getByText('Damaged')).toBeInTheDocument();

    const results = await axe(container, axeOptions);
    expect(results).toHaveNoViolations();
  });

  it('displays missing file state with relink vault action when video file is not on disk', async () => {
    const awb = 'AWB-MISSING-ON-DISK';
    await db.recordings.add({
      awb,
      orderId: 'ORD-404',
      sku: 'SILK-TIE',
      size: 'Free',
      qty: 1,
      courier: 'Shadowfax',
      marketplace: 'Flipkart',
      type: 'dispatch',
      startedAt: 1730000000000,
      endedAt: 1730000020000,
      durationSec: 20,
      videoMime: 'video/webm',
      videoBytes: 1000000,
      photoBytes: 0,
      photoCollage: false,
      vaultPath: `2026-10-27/Dispatch/${awb}`,
      demo: false,
      flagged: false
    });

    const onClose = vi.fn();
    renderModal({ open: true, onClose, initialQuery: awb });

    await waitFor(() => {
      expect(screen.getByText('Video file not found on disk')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Relink Vault Folder/i })).toBeInTheDocument();
  });

  it('handles return-only parcel with missing dispatch notice and direct packing station CTA', async () => {
    const awb = 'AWB-RETURN-ONLY';
    await db.recordings.add({
      awb,
      orderId: 'ORD-500',
      sku: 'JEANS-30',
      size: '30',
      qty: 1,
      courier: 'Valmo',
      marketplace: 'Meesho',
      type: 'return',
      startedAt: 1730100000000,
      endedAt: 1730100040000,
      durationSec: 40,
      videoMime: 'video/webm',
      videoBytes: 2000000,
      photoBytes: 0,
      photoCollage: false,
      vaultPath: `2026-10-28/Return/${awb}`,
      demo: false,
      flagged: true
    });

    const onClose = vi.fn();
    renderModal({ open: true, onClose, initialQuery: awb });

    await waitFor(() => {
      expect(screen.getByText(awb)).toBeInTheDocument();
    });

    expect(screen.getByText('No packing video was recorded for this AWB.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open Packing Station/i })).toBeInTheDocument();
  });

  it('closes on Escape key press', async () => {
    const onClose = vi.fn();
    renderModal({ open: true, onClose });

    const input = screen.getByPlaceholderText(/Scan barcode or type AWB/i);
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });
});

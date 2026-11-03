import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ToastProvider } from '../ui';
import { DisputeMessageStudio } from './DisputeMessageStudio';
import type { ClaimItem, RecordingMeta } from '../../types';

expect.extend(toHaveNoViolations);

function renderStudio(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('DisputeMessageStudio Component', () => {
  const baseTime = 1730000000000;

  const mockClaim: ClaimItem = {
    id: 1,
    awb: 'DELHIVERY1001',
    orderId: 'ORD-1001',
    marketplace: 'Meesho',
    courier: 'Delhivery',
    sku: 'SAREE-RED',
    qty: 1,
    flagReason: 'Wrong/Swapped item',
    notes: 'Received an old torn bedsheet instead of saree',
    returnScanAt: baseTime,
    deadlineAt: baseTime + 72 * 3600 * 1000,
    status: 'pending',
    disputeText: ''
  };

  const mockDispatch: RecordingMeta = {
    id: 10,
    awb: 'DELHIVERY1001',
    orderId: 'ORD-1001',
    sku: 'SAREE-RED',
    size: 'Free',
    qty: 1,
    courier: 'Delhivery',
    marketplace: 'Meesho',
    type: 'dispatch',
    startedAt: baseTime - 2 * 24 * 3600 * 1000,
    endedAt: baseTime - 2 * 24 * 3600 * 1000 + 30000,
    durationSec: 30,
    videoMime: 'video/mp4',
    videoBytes: 4000000,
    photoBytes: 400000,
    photoCollage: true,
    vaultPath: '2026-10-25/Dispatch/DELHIVERY1001',
    demo: false,
    flagged: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders studio with prefilled data and passes accessibility check', async () => {
    const { container } = renderStudio(
      <DisputeMessageStudio claim={mockClaim} dispatchRec={mockDispatch} />
    );

    expect(screen.getByTestId('dispute-preview')).toBeInTheDocument();
    expect(screen.getByTestId('char-counter')).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('allows user to switch between Preview and Edit tabs', () => {
    renderStudio(<DisputeMessageStudio claim={mockClaim} dispatchRec={mockDispatch} />);

    // Initially in Preview tab
    expect(screen.getByTestId('dispute-preview')).toBeInTheDocument();
    expect(screen.queryByTestId('dispute-textarea')).not.toBeInTheDocument();

    // Click Edit tab
    fireEvent.click(screen.getByTestId('tab-edit'));
    expect(screen.getByTestId('dispute-textarea')).toBeInTheDocument();
    expect(screen.queryByTestId('dispute-preview')).not.toBeInTheDocument();

    // Click Preview tab again
    fireEvent.click(screen.getByTestId('tab-preview'));
    expect(screen.getByTestId('dispute-preview')).toBeInTheDocument();
  });

  it('allows user to edit text before copying and updates character counter live', () => {
    const handleTextChange = vi.fn();
    renderStudio(
      <DisputeMessageStudio
        claim={mockClaim}
        dispatchRec={mockDispatch}
        onTextChange={handleTextChange}
      />
    );

    // Switch to edit tab
    fireEvent.click(screen.getByTestId('tab-edit'));
    const textarea = screen.getByTestId('dispute-textarea') as HTMLTextAreaElement;

    // Custom user edit
    const customText = 'Custom dispute note for Meesho team.';
    fireEvent.change(textarea, { target: { value: customText } });

    expect(textarea.value).toBe(customText);
    expect(handleTextChange).toHaveBeenCalledWith(customText);

    // Verify character counter updated
    const counter = screen.getByTestId('char-counter');
    expect(counter.textContent).toContain(`${customText.length} characters`);
  });

  it('displays copy button and writes edited text to clipboard', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    renderStudio(<DisputeMessageStudio claim={mockClaim} dispatchRec={mockDispatch} />);

    fireEvent.click(screen.getByTestId('tab-edit'));
    const textarea = screen.getByTestId('dispute-textarea');
    fireEvent.change(textarea, { target: { value: 'Text to copy' } });

    const copyBtn = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith('Text to copy');
  });

  it('highlights missing fields in preview when order information is missing', () => {
    const incompleteClaim: ClaimItem = {
      ...mockClaim,
      orderId: 'UNKNOWN', // Missing order ID
      awb: '' // Missing AWB
    };

    renderStudio(
      <DisputeMessageStudio
        claim={incompleteClaim}
        dispatchRec={null} // Missing dispatch date
      />
    );

    // Missing fields banner should be shown
    expect(screen.getByTestId('missing-fields-banner')).toBeInTheDocument();

    // Missing field markers in preview should be rendered
    const missingHighlights = screen.getAllByTestId('missing-field');
    expect(missingHighlights.length).toBeGreaterThan(0);

    const missingTexts = missingHighlights.map((el) => el.textContent);
    expect(missingTexts.some((t) => t?.includes('Order ID'))).toBe(true);
    expect(missingTexts.some((t) => t?.includes('Dispatch Date'))).toBe(true);
  });

  it('toggles language between English and Hindi', () => {
    renderStudio(<DisputeMessageStudio claim={mockClaim} dispatchRec={mockDispatch} />);

    // Switch to Hindi
    const hindiBtn = screen.getByRole('button', { name: /हिंदी/i });
    fireEvent.click(hindiBtn);

    const preview = screen.getByTestId('dispute-preview');
    expect(preview.textContent).toContain('प्रिय सेलर सपोर्ट टीम');
    expect(preview.textContent).toContain('आर्डर विवरण');

    // Switch back to English
    const englishBtn = screen.getByRole('button', { name: /english/i });
    fireEvent.click(englishBtn);

    expect(preview.textContent).toContain('Dear Seller Support Team');
    expect(preview.textContent).toContain('Order Information');
  });

  it('switches template categories (Damaged, Empty, General, Wrong Item)', () => {
    renderStudio(<DisputeMessageStudio claim={mockClaim} dispatchRec={mockDispatch} />);

    // Click Damaged Item template
    const damagedBtn = screen.getByRole('button', { name: /damaged item/i });
    fireEvent.click(damagedBtn);

    const preview = screen.getByTestId('dispute-preview');
    expect(preview.textContent).toContain('Damaged return received');

    // Click Empty Package template
    const emptyBtn = screen.getByRole('button', { name: /empty package/i });
    fireEvent.click(emptyBtn);

    expect(preview.textContent).toContain('Empty package return received');
  });
});

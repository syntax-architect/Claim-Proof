import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReturnChecklistOverlay } from '../components/recorder/ReturnChecklistOverlay';
import type { RecordingMeta } from '../types';

describe('ReturnChecklistOverlay Component', () => {
  const dummyDispatch: RecordingMeta = {
    id: 42,
    awb: 'AWB998877',
    orderId: 'ORD1234',
    sku: 'SKU_SHIRT_BLUE',
    size: 'M',
    qty: 1,
    courier: 'Shadowfax',
    marketplace: 'Meesho',
    type: 'dispatch',
    startedAt: Date.now() - 600000,
    endedAt: Date.now() - 570000,
    durationSec: 30,
    videoMime: 'video/webm',
    videoBytes: 3000000,
    photoBytes: 120000,
    photoCollage: true,
    vaultPath: '2026-11-03/Dispatch/AWB998877',
    demo: true,
    flagged: false
  };

  it('renders marketplace checklist profile, UNVERIFIED tag, and continuous recording notice', () => {
    render(
      <ReturnChecklistOverlay
        marketplace="Meesho"
        elapsedSec={10}
        isRecording={true}
        linkedDispatch={dummyDispatch}
        selectedCondition={null}
        onSelectCondition={vi.fn()}
        stepTicks={{}}
        onToggleStep={vi.fn()}
      />
    );

    expect(screen.getByText('Meesho Return Unboxing')).toBeInTheDocument();
    expect(screen.getByText('UNVERIFIED - check your seller panel')).toBeInTheDocument();
    expect(screen.getByText(/Continuous Video Rule:/i)).toBeInTheDocument();
    expect(screen.getByText(/Linked to Dispatch #42/i)).toBeInTheDocument();
    expect(screen.getByText(/Show sealed parcel & AWB/i)).toBeInTheDocument();
    expect(screen.getByText(/Show all 6 sides of flyer/i)).toBeInTheDocument();
  });

  it('renders standalone badge when no linked dispatch video is provided', () => {
    render(
      <ReturnChecklistOverlay
        marketplace="Flipkart"
        elapsedSec={5}
        isRecording={true}
        linkedDispatch={null}
        selectedCondition={null}
        onSelectCondition={vi.fn()}
        stepTicks={{}}
        onToggleStep={vi.fn()}
      />
    );

    expect(
      screen.getByText(/Standalone Return \(No dispatch video on file\)/i)
    ).toBeInTheDocument();
  });

  it('allows clicking steps to toggle completed state', () => {
    const onToggleStep = vi.fn();
    render(
      <ReturnChecklistOverlay
        marketplace="Meesho"
        elapsedSec={15}
        isRecording={true}
        linkedDispatch={null}
        selectedCondition={null}
        onSelectCondition={vi.fn()}
        stepTicks={{
          show_label: { completed: true, completedAtOffsetSec: 4 }
        }}
        onToggleStep={onToggleStep}
      />
    );

    expect(screen.getByText('T+4s')).toBeInTheDocument();

    const secondStepBtn = screen.getByRole('button', { name: /Show all 6 sides of flyer/i });
    fireEvent.click(secondStepBtn);
    expect(onToggleStep).toHaveBeenCalledWith('show_six_sides');
  });

  it('handles keyboard shortcuts (1-6 and T) to advance steps during recording', () => {
    const onToggleStep = vi.fn();
    render(
      <ReturnChecklistOverlay
        marketplace="Meesho"
        elapsedSec={12}
        isRecording={true}
        linkedDispatch={null}
        selectedCondition={null}
        onSelectCondition={vi.fn()}
        stepTicks={{}}
        onToggleStep={onToggleStep}
      />
    );

    // Press key '1'
    fireEvent.keyDown(window, { key: '1' });
    expect(onToggleStep).toHaveBeenCalledWith('show_label');

    // Press key '3'
    fireEvent.keyDown(window, { key: '3' });
    expect(onToggleStep).toHaveBeenCalledWith('open_uncut');

    // Press key 't' for next unticked
    fireEvent.keyDown(window, { key: 't' });
    expect(onToggleStep).toHaveBeenCalledWith('show_label');
  });

  it('selects condition outcomes and displays condition required warning when indicated', () => {
    const onSelectCondition = vi.fn();
    const { rerender } = render(
      <ReturnChecklistOverlay
        marketplace="Meesho"
        elapsedSec={20}
        isRecording={true}
        linkedDispatch={null}
        selectedCondition={null}
        onSelectCondition={onSelectCondition}
        stepTicks={{}}
        onToggleStep={vi.fn()}
        showConditionRequiredWarning={true}
      />
    );

    expect(
      screen.getByText(/Select one package condition tag below before saving/i)
    ).toBeInTheDocument();

    const damagedBtn = screen.getByRole('button', { name: /Damaged Product/i });
    fireEvent.click(damagedBtn);
    expect(onSelectCondition).toHaveBeenCalledWith('damaged');

    // Re-render with condition selected
    rerender(
      <ReturnChecklistOverlay
        marketplace="Meesho"
        elapsedSec={20}
        isRecording={true}
        linkedDispatch={null}
        selectedCondition="damaged"
        onSelectCondition={onSelectCondition}
        stepTicks={{}}
        onToggleStep={vi.fn()}
        showConditionRequiredWarning={false}
      />
    );

    expect(
      screen.queryByText(/Select one package condition tag below before saving/i)
    ).not.toBeInTheDocument();
    expect(screen.getByText('Condition selected')).toBeInTheDocument();
  });
});

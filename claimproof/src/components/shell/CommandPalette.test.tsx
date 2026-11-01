import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { useState, useEffect } from 'react';
import { CommandPalette } from './CommandPalette';
import { ToastProvider } from '../ui';

expect.extend(toHaveNoViolations);

const axeOptions = {
  rules: {
    region: { enabled: false },
    'heading-order': { enabled: false }
  }
};

/**
 * Test harness mimicking the global keyboard listener in App.tsx
 */
function CommandPaletteHarness({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <ToastProvider>
      <main>
        <CommandPalette open={open} onClose={() => setOpen(false)} />
      </main>
    </ToastProvider>
  );
}

describe('CommandPalette Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.location.hash = '';
    if (!window.HTMLElement.prototype.scrollIntoView) {
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
    }
  });

  it('opens with Ctrl+K shortcut, passes axe audit, and closes on backdrop click / Escape', async () => {
    const { container } = render(<CommandPaletteHarness defaultOpen={false} />);

    // Initially closed
    expect(screen.queryByRole('dialog', { name: /Command palette/i })).toBeNull();

    // Trigger Ctrl+K
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    // Verify dialog opened
    const dialog = screen.getByRole('dialog', { name: /Command palette/i });
    expect(dialog).toBeDefined();

    // Verify search input is present
    const searchInput = screen.getByRole('textbox', { name: /Search commands/i });
    expect(searchInput).toBeDefined();

    // Accessibility check on open state
    const results = await axe(container, axeOptions);
    expect(results).toHaveNoViolations();

    // Press Escape to close
    fireEvent.keyDown(searchInput, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Command palette/i })).toBeNull();
    }, { timeout: 8000 });

    // Reopen with Ctrl+K
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog', { name: /Command palette/i })).toBeDefined();

    // Close using the backdrop button
    const backdropBtn = screen.getByRole('button', { name: /Close command palette/i });
    fireEvent.click(backdropBtn);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Command palette/i })).toBeNull();
    }, { timeout: 8000 });
  });

  it('filters command list by query and renders empty state with clear button', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <ToastProvider>
        <main>
          <CommandPalette open={true} onClose={onClose} />
        </main>
      </ToastProvider>
    );

    // Initial commands visible
    expect(screen.getByRole('button', { name: /SmartLabel Studio/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /AWB Recorder/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Settings/i })).toBeDefined();

    const searchInput = screen.getByRole('textbox', { name: /Search commands/i });

    // Filter by "recorder"
    fireEvent.change(searchInput, { target: { value: 'recorder' } });

    expect(screen.getByRole('button', { name: /AWB Recorder/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /SmartLabel Studio/i })).toBeNull();

    // Accessibility check during filtered state
    const filteredAxe = await axe(container, axeOptions);
    expect(filteredAxe).toHaveNoViolations();

    // Filter with no matches
    fireEvent.change(searchInput, { target: { value: 'nonexistent-command-xyz' } });

    // Verify empty state
    expect(screen.getByRole('heading', { name: /No matching commands/i })).toBeDefined();
    const clearBtn = screen.getByRole('button', { name: /Clear search/i });
    expect(clearBtn).toBeDefined();

    // Accessibility check during empty state
    const emptyAxe = await axe(container, axeOptions);
    expect(emptyAxe).toHaveNoViolations();

    // Click "Clear search"
    fireEvent.click(clearBtn);

    // Initial commands restored
    expect(screen.getByRole('button', { name: /SmartLabel Studio/i })).toBeDefined();
    expect((searchInput as HTMLInputElement).value).toBe('');
  });

  it('navigates via mouse click and keyboard arrow/enter, triggering onClose and updating hash', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <ToastProvider>
        <main>
          <CommandPalette open={true} onClose={onClose} />
        </main>
      </ToastProvider>
    );

    // Accessibility check
    const axeResults = await axe(container, axeOptions);
    expect(axeResults).toHaveNoViolations();

    // Click on "SmartLabel Studio"
    const smartLabelBtn = screen.getByRole('button', { name: /SmartLabel Studio/i });
    fireEvent.click(smartLabelBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('#/labels');

    // Test keyboard navigation (ArrowDown then Enter)
    const searchInput = screen.getByRole('textbox', { name: /Search commands/i });
    // Index starts at 0 (Overview). ArrowDown moves to 1 (SmartLabel Studio), next ArrowDown to 2 (AWB Recorder)
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(window.location.hash).toBe('#/recorder');
  });
});

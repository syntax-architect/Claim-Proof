import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import SettingsPage from './SettingsPage';
import { ToastProvider } from '../components/ui';
import { isTelemetryEnabled, setTelemetryEnabled } from '../services/telemetry';
import {
  getCustomClaimWindows,
  resetCustomClaimWindows,
  UNVERIFIED_LABEL
} from '../config/claimWindows';

expect.extend(toHaveNoViolations);

const axeOptions = {
  rules: {
    region: { enabled: false },
    'heading-order': { enabled: false }
  }
};

function renderSettingsPage() {
  return render(
    <ToastProvider>
      <SettingsPage />
    </ToastProvider>
  );
}

describe('SettingsPage - Telemetry & Privacy Controls', () => {
  beforeEach(async () => {
    localStorage.clear();
    resetCustomClaimWindows();
    await setTelemetryEnabled(false);
    vi.restoreAllMocks();
  });

  it('renders anonymous telemetry section clearly describing what is collected and passes axe', async () => {
    const { container } = renderSettingsPage();

    // Section title
    expect(screen.getByText(/Anonymous product analytics & error reporting/i)).toBeInTheDocument();

    // Toggle description
    expect(
      screen.getByText(/Share anonymous milestone statistics & scrubbed error reports/i)
    ).toBeInTheDocument();

    // What is collected list
    expect(screen.getByText(/What is collected \(only when enabled\):/i)).toBeInTheDocument();
    expect(screen.getByText(/Only 5 milestone events:/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Onboarding completed, first label export, first recording saved, paywall viewed, purchase started\./i
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Scrubbed error reports:/i)).toBeInTheDocument();

    // What is NEVER collected list
    expect(screen.getByText(/What is NEVER collected or uploaded:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/No shipping labels, PDFs, or customer addresses\./i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /No packing or unboxing videos or photos \(files write strictly to your hard drive\)\./i
      )
    ).toBeInTheDocument();

    // Accessibility check
    const results = await axe(container, axeOptions);
    expect(results).toHaveNoViolations();
  });

  it('toggles telemetry preference from off to on and persists to localStorage', async () => {
    renderSettingsPage();

    expect(isTelemetryEnabled()).toBe(false);

    // Find the toggle button
    const toggle = screen.getByRole('switch', {
      name: /Share anonymous milestone statistics & scrubbed error reports/i
    });
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    // Click toggle to enable
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(isTelemetryEnabled()).toBe(true);
      expect(toggle.getAttribute('aria-checked')).toBe('true');
    });

    // Click toggle again to disable
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(isTelemetryEnabled()).toBe(false);
      expect(toggle.getAttribute('aria-checked')).toBe('false');
    });
  });
});

describe('SettingsPage - Marketplace Claim Windows Customization', () => {
  beforeEach(() => {
    localStorage.clear();
    resetCustomClaimWindows();
    vi.restoreAllMocks();
  });

  it('renders marketplace claim windows section with unverified badges, official links, and passes axe', async () => {
    const { container } = renderSettingsPage();

    // Section title
    expect(screen.getByText('Marketplace claim filing windows')).toBeInTheDocument();

    // Unverified warning badges
    const unverifiedBadges = screen.getAllByText(UNVERIFIED_LABEL);
    expect(unverifiedBadges.length).toBeGreaterThanOrEqual(6);

    // Specific marketplaces displayed
    expect(screen.getByText('Meesho SAFE')).toBeInTheDocument();
    expect(screen.getByText('Flipkart SPF')).toBeInTheDocument();
    expect(screen.getByText('Amazon SAFE-T')).toBeInTheDocument();

    // Official help links present
    const officialLinks = screen.getAllByRole('link', { name: /Official seller help/i });
    expect(officialLinks.length).toBeGreaterThanOrEqual(5);

    // Verify accessible inputs
    const meeshoInput = screen.getByRole('spinbutton', {
      name: /Meesho SAFE claim window hours/i
    });
    expect(meeshoInput).toBeInTheDocument();
    expect((meeshoInput as HTMLInputElement).value).toBe('72');

    const flipkartInput = screen.getByRole('spinbutton', {
      name: /Flipkart SPF claim window hours/i
    });
    expect(flipkartInput).toBeInTheDocument();
    expect((flipkartInput as HTMLInputElement).value).toBe('336');

    // Accessibility check
    const results = await axe(container, axeOptions);
    expect(results).toHaveNoViolations();
  });

  it('allows seller to edit claim window hours and overrides default in storage and UI', async () => {
    renderSettingsPage();

    const meeshoInput = screen.getByRole('spinbutton', {
      name: /Meesho SAFE claim window hours/i
    });
    expect((meeshoInput as HTMLInputElement).value).toBe('72');

    // Change Meesho from 72 to 48 hours
    fireEvent.change(meeshoInput, { target: { value: '48' } });

    await waitFor(() => {
      expect((meeshoInput as HTMLInputElement).value).toBe('48');
      expect(getCustomClaimWindows().Meesho).toBe(48);
    });

    // Custom badge appears
    expect(screen.getByText('Custom')).toBeInTheDocument();

    // Reset button appears and can be clicked to restore default
    const resetBtn = screen.getByRole('button', {
      name: /Reset Meesho SAFE to default/i
    });
    expect(resetBtn).toBeInTheDocument();

    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect((meeshoInput as HTMLInputElement).value).toBe('72');
      expect(getCustomClaimWindows().Meesho).toBeUndefined();
    });
  });

  it('allows resetting all claim windows to defaults', async () => {
    renderSettingsPage();

    const meeshoInput = screen.getByRole('spinbutton', {
      name: /Meesho SAFE claim window hours/i
    });
    const flipkartInput = screen.getByRole('spinbutton', {
      name: /Flipkart SPF claim window hours/i
    });

    fireEvent.change(meeshoInput, { target: { value: '24' } });
    fireEvent.change(flipkartInput, { target: { value: '120' } });

    await waitFor(() => {
      expect(getCustomClaimWindows().Meesho).toBe(24);
      expect(getCustomClaimWindows().Flipkart).toBe(120);
    });

    const resetAllBtn = screen.getByRole('button', {
      name: /Reset all claim windows to default/i
    });
    fireEvent.click(resetAllBtn);

    await waitFor(() => {
      expect((meeshoInput as HTMLInputElement).value).toBe('72');
      expect((flipkartInput as HTMLInputElement).value).toBe('336');
      expect(getCustomClaimWindows().Meesho).toBeUndefined();
      expect(getCustomClaimWindows().Flipkart).toBeUndefined();
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import SettingsPage from './SettingsPage';
import { ToastProvider } from '../components/ui';
import { isTelemetryEnabled, setTelemetryEnabled } from '../services/telemetry';

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
    await setTelemetryEnabled(false);
    vi.restoreAllMocks();
  });

  it('renders anonymous telemetry section clearly describing what is collected and passes axe', async () => {
    const { container } = renderSettingsPage();

    // Section title
    expect(
      screen.getByText(/Anonymous product analytics & error reporting/i)
    ).toBeInTheDocument();

    // Toggle description
    expect(
      screen.getByText(/Share anonymous milestone statistics & scrubbed error reports/i)
    ).toBeInTheDocument();

    // What is collected list
    expect(screen.getByText(/What is collected \(only when enabled\):/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Only 5 milestone events:/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Onboarding completed, first label export, first recording saved, paywall viewed, purchase started\./i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Scrubbed error reports:/i)
    ).toBeInTheDocument();

    // What is NEVER collected list
    expect(screen.getByText(/What is NEVER collected or uploaded:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/No shipping labels, PDFs, or customer addresses\./i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No packing or unboxing videos or photos \(files write strictly to your hard drive\)\./i)
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

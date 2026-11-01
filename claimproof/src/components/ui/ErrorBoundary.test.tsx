import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function CrashingPage({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Simulated critical crash in parcel table');
  }
  return <div data-testid="page-content">Parcel Table Loaded Successfully</div>;
}

function MockAppShell({ shouldThrow, route }: { shouldThrow: boolean; route: string }) {
  return (
    <div data-testid="app-shell" className="app-shell-container">
      <aside data-testid="sidebar-shell">
        <div data-testid="sidebar-brand">ClaimProof.in</div>
        <nav data-testid="sidebar-nav">
          <a href="#labels">SmartLabel SKU+</a>
          <a href="#recorder">ClaimProof AWB</a>
          <a href="#claims">ClaimRadar Pro</a>
        </nav>
      </aside>

      <div data-testid="app-body">
        <header data-testid="topbar-shell">
          <span data-testid="topbar-title">Packing Station</span>
        </header>

        <main data-testid="main-content">
          <ErrorBoundary level="page" resetKey={route}>
            <CrashingPage shouldThrow={shouldThrow} />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

describe('ErrorBoundary', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
  });

  function renderComponent(ui: React.ReactNode) {
    act(() => {
      root?.render(ui);
    });
  }

  it('catches an error in a page component, displays fallback UI, and ensures the shell survives', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderComponent(<MockAppShell shouldThrow={true} route="recorder" />);

    // 1. Per-page ErrorBoundary caught the crash and rendered the fallback
    const boundary = container?.querySelector('[data-testid="page-error-boundary"]');
    expect(boundary).not.toBeNull();

    // 2. Plain language message (what happened)
    expect(boundary?.textContent).toContain('Something went wrong');
    expect(boundary?.textContent).toContain('encountered an unexpected issue');

    // 3. User reassurance: "Your videos and labels are safe on your computer."
    expect(boundary?.textContent).toContain('Your videos and labels are safe on your computer.');

    // 4. Offer "Reload page"
    const reloadBtn = container?.querySelector(
      '[data-testid="reload-page-button"]'
    ) as HTMLButtonElement;
    expect(reloadBtn).not.toBeNull();
    expect(reloadBtn.textContent).toContain('Reload page');

    // 5. Offer "Copy error details"
    const copyBtn = container?.querySelector(
      '[data-testid="copy-error-details-button"]'
    ) as HTMLButtonElement;
    expect(copyBtn).not.toBeNull();
    expect(copyBtn.textContent).toContain('Copy error details');

    // 6. Strictly NO stack trace rendered to the user
    expect(boundary?.textContent).not.toContain('at CrashingPage');
    expect(boundary?.textContent).not.toContain('ErrorBoundary.test.tsx');

    // 7. CRITICAL: The App shell survives!
    expect(container?.querySelector('[data-testid="app-shell"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="sidebar-shell"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="sidebar-brand"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="sidebar-nav"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="topbar-shell"]')).not.toBeNull();

    errorSpy.mockRestore();
  });

  it('resets when user navigates away via resetKey', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderComponent(<MockAppShell shouldThrow={true} route="recorder" />);
    expect(container?.querySelector('[data-testid="page-error-boundary"]')).not.toBeNull();

    // Navigate to a working page
    renderComponent(<MockAppShell shouldThrow={false} route="labels" />);

    expect(container?.querySelector('[data-testid="page-error-boundary"]')).toBeNull();
    const pageContent = container?.querySelector('[data-testid="page-content"]');
    expect(pageContent).not.toBeNull();
    expect(pageContent?.textContent).toContain('Parcel Table Loaded Successfully');

    errorSpy.mockRestore();
  });

  it('copies error details to clipboard when "Copy error details" is clicked', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true,
      writable: true
    });

    renderComponent(
      <ErrorBoundary level="page">
        <CrashingPage shouldThrow={true} />
      </ErrorBoundary>
    );

    const copyBtn = container?.querySelector(
      '[data-testid="copy-error-details-button"]'
    ) as HTMLButtonElement;
    expect(copyBtn).not.toBeNull();

    await act(async () => {
      copyBtn.click();
    });

    expect(writeTextSpy).toHaveBeenCalledTimes(1);
    const copiedText = writeTextSpy.mock.calls[0][0];

    expect(copiedText).toContain('=== ClaimProof Error Report ===');
    expect(copiedText).toContain('Simulated critical crash in parcel table');
    expect(copiedText).toContain('=== Stack Trace ===');

    errorSpy.mockRestore();
  });

  it('renders top-level boundary properly if catastrophic error occurs', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderComponent(
      <ErrorBoundary level="top">
        <CrashingPage shouldThrow={true} />
      </ErrorBoundary>
    );

    const boundary = container?.querySelector('[data-testid="top-error-boundary"]');
    expect(boundary).not.toBeNull();
    expect(boundary?.textContent).toContain('Something went wrong');
    expect(boundary?.textContent).toContain('Your videos and labels are safe on your computer.');
    expect(container?.querySelector('[data-testid="reload-page-button"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="copy-error-details-button"]')).not.toBeNull();

    // No stack trace in the DOM
    expect(boundary?.textContent).not.toContain('at CrashingPage');

    errorSpy.mockRestore();
  });
});

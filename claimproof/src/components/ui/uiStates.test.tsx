import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertCircle, HelpCircle, Video } from 'lucide-react';
import { EmptyState, LoadingSkeleton, ErrorState } from './index';

describe('UI Primitives: EmptyState, LoadingSkeleton, ErrorState', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  describe('EmptyState', () => {
    it('renders with title, description, and accessibility role', async () => {
      await act(async () => {
        root.render(
          <EmptyState
            icon={HelpCircle}
            title="No items found"
            description="Try adjusting your filter or search query."
          />
        );
      });

      const region = container.querySelector('[role="region"][aria-label="No items found"]');
      expect(region).not.toBeNull();
      expect(container.textContent).toContain('No items found');
      expect(container.textContent).toContain('Try adjusting your filter or search query.');
    });

    it('renders primary action and triggers onClick when clicked', async () => {
      const handlePrimary = vi.fn();
      await act(async () => {
        root.render(
          <EmptyState
            icon={Video}
            title="No videos"
            description="Record your first video clip."
            primaryAction={{
              label: 'Start Recording',
              onClick: handlePrimary,
              icon: Video
            }}
          />
        );
      });

      const btn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Start Recording')
      );
      expect(btn).toBeDefined();
      act(() => {
        btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(handlePrimary).toHaveBeenCalledTimes(1);
    });

    it('renders secondary link with accessible action', async () => {
      const handleSecondary = vi.fn();
      await act(async () => {
        root.render(
          <EmptyState
            icon={HelpCircle}
            title="Need help"
            description="Detailed guidance is available."
            secondaryLink={{
              label: 'View documentation',
              onClick: handleSecondary
            }}
          />
        );
      });

      const secondaryBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('View documentation')
      );
      expect(secondaryBtn).toBeDefined();
      act(() => {
        secondaryBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(handleSecondary).toHaveBeenCalledTimes(1);
    });
  });

  describe('LoadingSkeleton', () => {
    it('renders with role="status" and default aria label', async () => {
      await act(async () => {
        root.render(<LoadingSkeleton />);
      });
      const skeleton = container.querySelector('[role="status"][aria-label="Loading content..."]');
      expect(skeleton).not.toBeNull();
    });

    it('supports card variant', async () => {
      await act(async () => {
        root.render(<LoadingSkeleton variant="card" ariaLabel="Loading card details" />);
      });
      const skeleton = container.querySelector(
        '[role="status"][aria-label="Loading card details"]'
      );
      expect(skeleton).not.toBeNull();
    });

    it('supports table variant with multiple rows', async () => {
      await act(async () => {
        root.render(<LoadingSkeleton variant="table" lines={3} ariaLabel="Loading table rows" />);
      });
      const skeleton = container.querySelector('[role="status"][aria-label="Loading table rows"]');
      expect(skeleton).not.toBeNull();
    });

    it('supports circle variant', async () => {
      await act(async () => {
        root.render(<LoadingSkeleton variant="circle" ariaLabel="Loading avatar" />);
      });
      const skeleton = container.querySelector('[role="status"][aria-label="Loading avatar"]');
      expect(skeleton).not.toBeNull();
    });
  });

  describe('ErrorState', () => {
    it('renders with role="alert", message, and retry button', async () => {
      const handleRetry = vi.fn();
      await act(async () => {
        root.render(
          <ErrorState
            title="Unable to load data"
            message="Connection failed. Please check your network."
            icon={AlertCircle}
            onRetry={handleRetry}
            retryLabel="Try again now"
          />
        );
      });

      const alert = container.querySelector('[role="alert"]');
      expect(alert).not.toBeNull();
      expect(container.textContent).toContain('Unable to load data');
      expect(container.textContent).toContain('Connection failed. Please check your network.');

      const retryBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Try again now')
      );
      expect(retryBtn).toBeDefined();
      act(() => {
        retryBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(handleRetry).toHaveBeenCalledTimes(1);
    });

    it('renders secondary action in error state', async () => {
      const handleSecondary = vi.fn();
      await act(async () => {
        root.render(
          <ErrorState
            message="An error occurred."
            secondaryAction={{
              label: 'Return to overview',
              onClick: handleSecondary
            }}
          />
        );
      });

      const secondaryBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Return to overview')
      );
      expect(secondaryBtn).toBeDefined();
      act(() => {
        secondaryBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(handleSecondary).toHaveBeenCalledTimes(1);
    });
  });
});

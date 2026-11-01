import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { UpdatePrompt } from './UpdatePrompt';

describe('UpdatePrompt Component', () => {
  beforeEach(() => {
    delete (window as unknown as { __cpWaitingWorker?: ServiceWorker }).__cpWaitingWorker;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when there is no waiting service worker', () => {
    const { container } = render(<UpdatePrompt />);
    expect(container.firstChild).toBeNull();
  });

  it('displays update prompt when cp-sw-update event is dispatched', () => {
    render(<UpdatePrompt />);
    expect(screen.queryByText(/Update available, reload/i)).not.toBeInTheDocument();

    const mockWorker = {
      postMessage: vi.fn()
    } as unknown as ServiceWorker;

    act(() => {
      window.dispatchEvent(
        new CustomEvent('cp-sw-update', { detail: { worker: mockWorker } })
      );
    });

    expect(screen.getByText('Update available, reload')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  });

  it('sends SKIP_WAITING to waiting worker when reload is clicked', () => {
    const mockPostMessage = vi.fn();
    const mockWorker = {
      postMessage: mockPostMessage
    } as unknown as ServiceWorker;

    window.__cpWaitingWorker = mockWorker;

    render(<UpdatePrompt />);
    expect(screen.getByText('Update available, reload')).toBeInTheDocument();

    const reloadBtn = screen.getByRole('button', { name: /reload/i });
    fireEvent.click(reloadBtn);

    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('can be dismissed with the close button', () => {
    window.__cpWaitingWorker = { postMessage: vi.fn() } as unknown as ServiceWorker;
    render(<UpdatePrompt />);

    expect(screen.getByText('Update available, reload')).toBeInTheDocument();
    const dismissBtn = screen.getByLabelText(/Dismiss update banner/i);
    fireEvent.click(dismissBtn);

    expect(screen.queryByText(/Update available, reload/i)).not.toBeInTheDocument();
  });
});

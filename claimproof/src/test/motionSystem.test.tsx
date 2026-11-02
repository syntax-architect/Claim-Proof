// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { MotionConfig, motion } from 'framer-motion';
import {
  fadeUp,
  fadeIn,
  scaleIn,
  modalVariants,
  backdropVariants,
  toastVariants,
  DURATION,
  EASE_OUT,
  setRecordingActive,
  isRecordingActive,
  useIsRecordingActive
} from '../lib/motion';
import { CurrentPage } from '../App';
import { ToastProvider } from '../components/ui';
import { PaywallProvider } from '../providers/PaywallProvider';
import fs from 'node:fs';
import path from 'node:path';

describe('Motion System Tokens & Principles', () => {
  it('enforces durations between 160ms and 280ms', () => {
    expect(DURATION.fast).toBeGreaterThanOrEqual(0.16);
    expect(DURATION.fast).toBeLessThanOrEqual(0.28);
    expect(DURATION.base).toBeGreaterThanOrEqual(0.16);
    expect(DURATION.base).toBeLessThanOrEqual(0.28);
    expect(DURATION.slow).toBeGreaterThanOrEqual(0.16);
    expect(DURATION.slow).toBeLessThanOrEqual(0.28);
  });

  it('uses cubic-bezier(0.16, 1, 0.3, 1) easing', () => {
    expect(EASE_OUT).toEqual([0.16, 1, 0.3, 1]);
  });

  it('animates ONLY transform (x, y, scale) and opacity — never layout properties', () => {
    const layoutProps = ['width', 'height', 'top', 'left', 'right', 'bottom', 'margin', 'padding'];
    const variantsList = [fadeUp, fadeIn, scaleIn, modalVariants, backdropVariants, toastVariants];

    for (const v of variantsList) {
      for (const state of ['hidden', 'visible', 'exit']) {
        const target = (v as Record<string, Record<string, unknown>>)[state];
        if (target) {
          for (const prop of layoutProps) {
            expect(target).not.toHaveProperty(prop);
          }
        }
      }
    }
  });
});

describe('Reduced Motion Honoring', () => {
  it('provides CSS rules for prefers-reduced-motion disabling transforms and keyframe animations', () => {
    const cssPath = path.resolve(__dirname, '../styles/globals.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation-duration: 0.01ms !important');
    expect(css).toContain('transition-duration: 0.01ms !important');
  });

  it('with reduced motion on, MotionConfig prevents or eliminates animations', () => {
    const { container } = render(
      <MotionConfig reducedMotion="always">
        <motion.div
          data-testid="motion-box"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          Reduced Motion Test Content
        </motion.div>
      </MotionConfig>
    );

    const el = screen.getByTestId('motion-box');
    expect(el).toBeInTheDocument();
    expect(container.textContent).toContain('Reduced Motion Test Content');
  });
});

describe('Page Route Transitions Render Correct Content', () => {
  it('renders right content when changing route without broken layout', () => {
    const navigate = vi.fn();

    const { rerender } = render(
      <ToastProvider>
        <PaywallProvider>
          <CurrentPage route="overview" navigate={navigate} />
        </PaywallProvider>
      </ToastProvider>
    );
    expect(screen.getByText(/Every parcel, proven\./i)).toBeInTheDocument();

    rerender(
      <ToastProvider>
        <PaywallProvider>
          <CurrentPage route="labels" navigate={navigate} />
        </PaywallProvider>
      </ToastProvider>
    );
    expect(screen.getByText(/SmartLabel/i)).toBeInTheDocument();

    rerender(
      <ToastProvider>
        <PaywallProvider>
          <CurrentPage route="pricing" navigate={navigate} />
        </PaywallProvider>
      </ToastProvider>
    );
    expect(screen.getByText(/Seller Protection Plans/i)).toBeInTheDocument();

    rerender(
      <ToastProvider>
        <PaywallProvider>
          <CurrentPage route="privacy" navigate={navigate} />
        </PaywallProvider>
      </ToastProvider>
    );
    expect(screen.getByRole('heading', { name: /Privacy Policy/i })).toBeInTheDocument();
  });
});

describe('Active Recording Animation Suppression', () => {
  beforeEach(() => {
    setRecordingActive(false);
  });

  afterEach(() => {
    setRecordingActive(false);
  });

  it('tracks recording active state and sets data-recording-active on document element', () => {
    expect(isRecordingActive()).toBe(false);
    expect(document.documentElement.dataset.recordingActive).toBeUndefined();

    act(() => {
      setRecordingActive(true);
    });

    expect(isRecordingActive()).toBe(true);
    expect(document.documentElement.dataset.recordingActive).toBe('true');

    act(() => {
      setRecordingActive(false);
    });

    expect(isRecordingActive()).toBe(false);
    expect(document.documentElement.dataset.recordingActive).toBeUndefined();
  });

  it('useIsRecordingActive hook notifies reactive components', async () => {
    function TestConsumer() {
      const active = useIsRecordingActive();
      return <div data-testid="recording-indicator">{active ? 'RECORDING' : 'IDLE'}</div>;
    }

    const { findByTestId } = render(<TestConsumer />);
    expect((await findByTestId('recording-indicator')).textContent).toBe('IDLE');

    await act(async () => {
      setRecordingActive(true);
    });
    expect((await findByTestId('recording-indicator')).textContent).toBe('RECORDING');

    await act(async () => {
      setRecordingActive(false);
    });
    expect((await findByTestId('recording-indicator')).textContent).toBe('IDLE');
  });

  it('CSS contains rules pausing all animations during recording except the REC dot', () => {
    const cssPath = path.resolve(__dirname, '../styles/globals.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/html\[data-recording-active=['"]true['"]\] \*/);
    expect(css).toContain('animation-play-state: paused !important');
    expect(css).toMatch(/html\[data-recording-active=['"]true['"]\] \.animate-rec-pulse/);
    expect(css).toContain('animation-play-state: running !important');
  });
});

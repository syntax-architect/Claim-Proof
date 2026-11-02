import { useState, useEffect } from 'react';
import type { Transition, Variants } from 'framer-motion';

/**
 * SABOOT Restrained Premium Motion Tokens
 * Principles:
 * - Durations: 160–280 ms
 * - Easing: ease-out cubic-bezier(0.16, 1, 0.3, 1)
 * - Animate ONLY transform and opacity; never animate layout properties
 * - Never animate during active recording except the REC dot
 */

export const DURATION = {
  fast: 0.16, // 160ms
  base: 0.2, // 200ms
  slow: 0.28 // 280ms
} as const;

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export const SPRING_MODAL = {
  type: 'spring',
  stiffness: 380,
  damping: 32
} as const;

export const TRANSITION_DEFAULT: Transition = {
  duration: DURATION.base,
  ease: EASE_OUT
};

export const TRANSITION_FAST: Transition = {
  duration: DURATION.fast,
  ease: EASE_OUT
};

export const TRANSITION_SLOW: Transition = {
  duration: DURATION.slow,
  ease: EASE_OUT
};

/** Shared Framer Motion Variants */

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: TRANSITION_DEFAULT
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: TRANSITION_FAST
  }
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: TRANSITION_DEFAULT
  },
  exit: {
    opacity: 0,
    transition: TRANSITION_FAST
  }
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: TRANSITION_DEFAULT
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: TRANSITION_FAST
  }
};

export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: SPRING_MODAL
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: TRANSITION_FAST
  }
};

export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: TRANSITION_DEFAULT
  },
  exit: {
    opacity: 0,
    transition: TRANSITION_FAST
  }
};

export const toastVariants: Variants = {
  hidden: { opacity: 0, x: 24, scale: 0.98 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: TRANSITION_DEFAULT
  },
  exit: {
    opacity: 0,
    x: 24,
    scale: 0.98,
    transition: TRANSITION_FAST
  }
};

/** Stagger container builder (40ms stagger, max 8 items) */
export const stagger = (gap = 0.04, delay = 0): Variants => ({
  hidden: {},
  visible: {
    transition: {
      staggerChildren: gap,
      delayChildren: delay
    }
  }
});

/** Recording active state tracker to suppress ambient UI animations */
let _recordingActive = false;
const _subscribers = new Set<(active: boolean) => void>();

export function setRecordingActive(active: boolean): void {
  _recordingActive = active;
  if (typeof document !== 'undefined') {
    if (active) {
      document.documentElement.dataset.recordingActive = 'true';
    } else {
      delete document.documentElement.dataset.recordingActive;
    }
  }
  _subscribers.forEach((cb) => cb(active));
}

export function isRecordingActive(): boolean {
  return _recordingActive;
}

export function useIsRecordingActive(): boolean {
  const [active, setActive] = useState(isRecordingActive);
  useEffect(() => {
    _subscribers.add(setActive);
    return () => {
      _subscribers.delete(setActive);
    };
  }, []);
  return active;
}

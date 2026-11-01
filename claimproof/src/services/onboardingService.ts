/* ClaimProof Suite — First-run onboarding state service.
 * Persists walkthrough progress, marketplace selections, vault status,
 * and scanner verification into IndexedDB (Dexie settings store).
 */

import { getSetting, setSetting } from '../db/schema';
import type { Marketplace } from '../types';
import { trackEvent } from './telemetry';

export interface OnboardingState {
  step: 1 | 2 | 3;
  marketplaces: Marketplace[];
  vaultConnected: boolean;
  scannerTested: boolean;
  lastScannedCode?: string;
  completed: boolean;
  skipped: boolean;
  updatedAt: number;
}

const ONBOARDING_KEY = 'onboarding_state';

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  step: 1,
  marketplaces: ['Meesho', 'Flipkart'],
  vaultConnected: false,
  scannerTested: false,
  completed: false,
  skipped: false,
  updatedAt: 0
};

export async function getOnboardingState(): Promise<OnboardingState> {
  try {
    const state = await getSetting<OnboardingState>(ONBOARDING_KEY, DEFAULT_ONBOARDING_STATE);
    return { ...DEFAULT_ONBOARDING_STATE, ...state };
  } catch {
    return DEFAULT_ONBOARDING_STATE;
  }
}

export async function saveOnboardingProgress(
  patch: Partial<OnboardingState>
): Promise<OnboardingState> {
  const current = await getOnboardingState();
  const next: OnboardingState = {
    ...current,
    ...patch,
    updatedAt: Date.now()
  };
  await setSetting(ONBOARDING_KEY, next);
  return next;
}

export async function completeOnboarding(): Promise<OnboardingState> {
  void trackEvent('onboarding_completed');
  return saveOnboardingProgress({ completed: true, skipped: false, step: 3 });
}

export async function skipOnboarding(): Promise<OnboardingState> {
  return saveOnboardingProgress({ skipped: true, completed: false });
}

export async function resetOnboarding(): Promise<OnboardingState> {
  return saveOnboardingProgress({
    step: 1,
    completed: false,
    skipped: false
  });
}

export function openOnboardingModal(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('cp-open-onboarding'));
  }
}

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../ui';
import { OnboardingModal } from './OnboardingModal';
import { getOnboardingState } from '../../services/onboardingService';
import { db } from '../../db/schema';

describe('OnboardingModal', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(async () => {
    // Clear onboarding settings in Dexie
    await db.settings.delete('onboarding_state');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
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
    await db.settings.delete('onboarding_state');
    vi.clearAllMocks();
  });

  async function renderModal(props: {
    open: boolean;
    onClose: () => void;
    navigate: (route: string) => void;
  }) {
    await act(async () => {
      root?.render(
        <ToastProvider>
          <OnboardingModal
            open={props.open}
            onClose={props.onClose}
            navigate={props.navigate as any}
          />
        </ToastProvider>
      );
    });
    // Allow initial async state resolution
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  }

  it('navigates through all 3 steps and finishes by opening Label Studio', async () => {
    const onClose = vi.fn();
    const navigate = vi.fn();

    await renderModal({ open: true, onClose, navigate });

    // ── STEP 1: Choose Marketplaces ───────────────────────────────────
    const step1 = container?.querySelector('[data-testid="onboarding-step-1"]');
    expect(step1).not.toBeNull();
    expect(step1?.textContent).toContain('Choose your marketplace(s)');
    expect(step1?.textContent).toContain('Meesho');
    expect(step1?.textContent).toContain('Flipkart');
    expect(step1?.textContent).toContain('Amazon India');

    // Toggle Amazon
    const amazonBtn = container?.querySelector(
      '[data-testid="marketplace-option-amazon"]'
    ) as HTMLButtonElement;
    expect(amazonBtn).not.toBeNull();
    await act(async () => {
      amazonBtn.click();
    });

    // Advance to Step 2
    const next1Btn = container?.querySelector(
      '[data-testid="onboarding-next-step-1"]'
    ) as HTMLButtonElement;
    expect(next1Btn).not.toBeNull();
    await act(async () => {
      next1Btn.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // ── STEP 2: Vault Folder & Storage Explanation ───────────────────
    const step2 = container?.querySelector('[data-testid="onboarding-step-2"]');
    expect(step2).not.toBeNull();
    expect(step2?.textContent).toContain('Pick your Evidence Vault folder');

    // Confirm explanation of where videos and collages are saved
    expect(step2?.textContent).toContain('<Vault_Root>');
    expect(step2?.textContent).toContain('{AWB}_Video.mp4');
    expect(step2?.textContent).toContain('{AWB}_Photo_Collage.jpg');
    expect(step2?.textContent).toContain('Offline & Private');

    // Advance to Step 3
    const next2Btn = container?.querySelector(
      '[data-testid="onboarding-next-step-2"]'
    ) as HTMLButtonElement;
    expect(next2Btn).not.toBeNull();
    await act(async () => {
      next2Btn.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // ── STEP 3: Test Camera & Barcode Scanner ────────────────────────
    const step3 = container?.querySelector('[data-testid="onboarding-step-3"]');
    expect(step3).not.toBeNull();
    expect(step3?.textContent).toContain('Test Camera & Scanner');
    expect(step3?.textContent).toContain('Scan any barcode now');

    // Simulate scanning a barcode
    const testScanBtn = container?.querySelector(
      '[data-testid="test-barcode-button"]'
    ) as HTMLButtonElement;
    expect(testScanBtn).not.toBeNull();

    await act(async () => {
      testScanBtn.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // Confirm barcode was verified
    expect(step3?.textContent).toContain('Barcode Verified!');
    expect(step3?.textContent).toContain('SAMPLE987654321');

    // End with button that opens Label Studio
    const finishBtn = container?.querySelector(
      '[data-testid="onboarding-finish-button"]'
    ) as HTMLButtonElement;
    expect(finishBtn).not.toBeNull();
    expect(finishBtn.textContent).toContain('Open Label Studio');

    await act(async () => {
      finishBtn.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // Verify completion
    expect(onClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('labels');

    // Confirm IndexedDB has completed: true
    const state = await getOnboardingState();
    expect(state.completed).toBe(true);
    expect(state.skipped).toBe(false);
  });

  it('supports the skip path and marks onboarding as skipped in IndexedDB', async () => {
    const onClose = vi.fn();
    const navigate = vi.fn();

    await renderModal({ open: true, onClose, navigate });

    // Step 1 is visible
    expect(container?.querySelector('[data-testid="onboarding-step-1"]')).not.toBeNull();

    // Click Skip button
    const skipBtn = container?.querySelector(
      '[data-testid="onboarding-skip-button"]'
    ) as HTMLButtonElement;
    expect(skipBtn).not.toBeNull();

    await act(async () => {
      skipBtn.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(onClose).toHaveBeenCalled();

    // Confirm IndexedDB recorded skip
    const state = await getOnboardingState();
    expect(state.skipped).toBe(true);
    expect(state.completed).toBe(false);
  });

  it('allows going back between steps', async () => {
    const onClose = vi.fn();
    const navigate = vi.fn();

    await renderModal({ open: true, onClose, navigate });

    // Move to step 2
    const next1Btn = container?.querySelector(
      '[data-testid="onboarding-next-step-1"]'
    ) as HTMLButtonElement;
    await act(async () => {
      next1Btn.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(container?.querySelector('[data-testid="onboarding-step-2"]')).not.toBeNull();

    // Click Back
    const backBtn = container?.querySelector(
      '[data-testid="onboarding-back-button"]'
    ) as HTMLButtonElement;
    expect(backBtn).not.toBeNull();
    await act(async () => {
      backBtn.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // Back on Step 1
    expect(container?.querySelector('[data-testid="onboarding-step-1"]')).not.toBeNull();
  });
});

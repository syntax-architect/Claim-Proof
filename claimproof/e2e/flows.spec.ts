import { test, expect } from '@playwright/test';
import {
  INVALID_TEST_LICENSE,
  mintTestLicense,
  simulateBarcodeScan,
  skipOnboardingIfOpen
} from './test-helpers';

test.describe('SABOOT Suite E2E Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
  });

  test('Flow 1: first-run onboarding then crop sample Meesho labels and download PDF', async ({
    page
  }) => {
    await page.goto('/');

    // 1. First-run onboarding modal must appear
    const onboarding = page.locator('[data-testid="onboarding-modal"]');
    await expect(onboarding).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Step 1 of 3: Marketplaces/i)).toBeVisible();

    // Step 1: Select marketplaces and advance
    await page.locator('[data-testid="onboarding-next-step-1"]').click();
    await expect(page.getByText(/Step 2 of 3: Evidence Vault/i)).toBeVisible({ timeout: 5000 });

    // Step 2: Advance to scanner check
    await page.locator('[data-testid="onboarding-next-step-2"]').click();
    await expect(page.getByText(/Step 3 of 3: Scanner Check/i)).toBeVisible({ timeout: 5000 });

    // Step 3: Finish and navigate to SmartLabel Studio
    await page.locator('[data-testid="onboarding-finish-button"]').click();
    await expect(onboarding).toBeHidden({ timeout: 5000 });

    // Verify SmartLabel Studio opened
    await expect(page.getByText('SmartLabel SKU+ Studio')).toBeVisible();

    // 2. Click "Try with sample labels" to parse sample Meesho PDF
    await page.locator('button', { hasText: 'Try with sample labels' }).click();

    // 3. Review stage appears with extracted sample labels
    await expect(page.getByText('Labels found')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('MSH-KRT-BLU-XL')).toBeVisible();
    await expect(page.getByText('5894372819')).toBeVisible();

    // 4. Trigger Crop & export and verify PDF download
    const downloadPromise = page.waitForEvent('download', { timeout: 20000 });
    await page.getByRole('button', { name: /Crop & export 3 labels/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);

    // 5. Done stage verifies memory persistence
    await expect(
      page.getByText(/3 Labels Cropped & Loaded into Memory!/i)
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Open the AWB Recorder/i })).toBeVisible();
  });

  test('Flow 2: hit the 40-label free limit and see the paywall', async ({ page }) => {
    await page.goto('/#labels');
    await skipOnboardingIfOpen(page);

    await expect(page.getByText('SmartLabel SKU+ Studio')).toBeVisible();

    // Parse sample labels first
    await page.locator('button', { hasText: 'Try with sample labels' }).click();
    await expect(page.getByText('Labels found')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('MSH-KRT-BLU-XL')).toBeVisible();

    // Seed the today's quota counter to 40 labels (the daily free limit)
    await page.evaluate(async () => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('saboot');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('usage_counters', 'readwrite');
          const store = tx.objectStore('usage_counters');
          const now = new Date();
          const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
          const dateStr = ist.toISOString().slice(0, 10);
          store.put({ date: dateStr, labelsCropped: 40, awbsRecorded: 0 });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });

    // Attempting to crop when at quota limit triggers the Paywall modal
    await page.getByRole('button', { name: /Crop & export 3 labels/i }).click();

    await expect(page.getByText('Unlock SABOOT Suite')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/Free plan allows 40 cropped labels per day/i)).toBeVisible();
  });

  test('Flow 3: scan a barcode (inject via keyboard HID simulation), record, save, and see it in Vault', async ({
    page
  }) => {
    await page.goto('/#recorder');
    await skipOnboardingIfOpen(page);

    await expect(page.getByText('SABOOT AWB Recorder')).toBeVisible();
    await expect(page.getByText('WAITING FOR SCAN')).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder(/Scan \/ type AWB then Enter/i)).toBeVisible({
      timeout: 10000
    });
    // Brief settle time to let fake camera device attach to canvas
    await page.waitForTimeout(500);

    // Simulate laser barcode gun scan via HID burst (<80ms keystroke gap ending with Enter)
    await simulateBarcodeScan(page, 'AWB9876543210');

    // Video recording starts automatically upon scan
    await expect(page.getByText(/REC 00:/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('AWB9876543210').first()).toBeVisible();

    // Allow recorder to record for 1.5 seconds
    await page.waitForTimeout(1600);

    // Stop and save evidence
    await page.getByRole('button', { name: /Stop & Save/i }).click({ force: true });
    await expect(page.getByText(/Saved via Downloads|SAVED to vault/i)).toBeVisible({
      timeout: 10000
    });
    // Brief settle time to let IndexedDB transaction finalize before page navigation
    await page.waitForTimeout(400);

    // Navigate to Vault and confirm recording appears
    await page.goto('/#vault');
    await expect(page.getByRole('heading', { name: 'Vault', exact: true })).toBeVisible();
    await expect(page.getByText('AWB9876543210').first()).toBeVisible({ timeout: 10000 });

    // Open recording details player
    await page.getByText('AWB9876543210').first().click();
    await expect(page.getByText(/AWB9876543210/i).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Dispatch Packing/i })).toBeVisible();
  });

  test('Flow 4: flag a return and see it in ClaimRadar', async ({ page }) => {
    // 1. Activate ClaimRadar license to unlock Return Unboxing Mode
    const token = await mintTestLicense('claimradar');
    await page.goto('/#pricing');
    await skipOnboardingIfOpen(page);

    await page.getByPlaceholder('eyJhbGciOiJFUzI1NiIs…').fill(token);
    await page.getByRole('button', { name: /Activate License/i }).click();
    await expect(page.getByText(/License activated/i)).toBeVisible({ timeout: 10000 });

    // 2. Navigate to Recorder and enable Return Unboxing Mode
    await page.goto('/#recorder');
    await expect(page.getByText('SABOOT AWB Recorder')).toBeVisible();

    const returnSwitch = page.getByRole('switch', { name: /Return Unboxing Mode/i });
    await returnSwitch.click();
    await expect(returnSwitch).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('WAITING FOR SCAN')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    // 3. Scan a return barcode via HID simulation
    await simulateBarcodeScan(page, 'RET8877665544');

    await expect(page.getByText(/REC 00:/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('RET8877665544').first()).toBeVisible();

    // 4. Flag the bad return
    await page.getByRole('button', { name: /Flag Bad Return/i }).click();

    // 5. Stop and Save
    await page.getByRole('button', { name: /Stop & Save/i }).click();

    // Reason picker modal appears
    await expect(page.getByText('What was wrong with this return?')).toBeVisible({
      timeout: 8000
    });
    await page.getByRole('button', { name: 'Damaged' }).click();

    await expect(page.getByText(/Saved via Downloads|SAVED to vault/i)).toBeVisible({
      timeout: 10000
    });

    // 6. Navigate to ClaimRadar and verify dispute appears in Pending Claims
    await page.goto('/#claims');
    await expect(page.getByText('ClaimRadar Pro')).toBeVisible();
    await expect(page.getByText('RET8877665544').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Damaged').first()).toBeVisible();
  });

  test('Flow 5: enter a valid and an invalid license key', async ({ page }) => {
    await page.goto('/#pricing');
    await skipOnboardingIfOpen(page);

    const input = page.getByPlaceholder('eyJhbGciOiJFUzI1NiIs…');
    const activateBtn = page.getByRole('button', { name: /Activate License/i });

    await input.scrollIntoViewIfNeeded();

    // 1. Enter an invalid license key
    await input.fill(INVALID_TEST_LICENSE);
    await activateBtn.click();
    await expect(page.getByText(/Activation failed/i)).toBeVisible({ timeout: 8000 });

    // 2. Enter a valid ES256 offline signed license key
    const validKey = await mintTestLicense('warehouse');
    await input.fill(validKey);
    await activateBtn.click();

    await expect(page.getByText(/License activated/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Warehouse 3-Table Pack').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Deactivate' })).toBeVisible();
  });

  test('Flow 6: visit #/nonsense and see the 404', async ({ page }) => {
    await page.goto('/#/nonsense');
    await skipOnboardingIfOpen(page);

    // 404 page elements
    await expect(page.getByText('404 NOT FOUND')).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();
    await expect(page.getByText(/nonsense/i)).toBeVisible();

    // Go to Overview recovery navigation
    await page.getByRole('button', { name: /Go to Overview/i }).click();
    await expect(page.getByText('Every parcel, proven.')).toBeVisible({ timeout: 8000 });
  });

  test('Flow 7: go offline and confirm the app still loads and works', async ({ page }) => {
    await page.goto('/#labels');
    await skipOnboardingIfOpen(page);

    await expect(page.getByText('SmartLabel SKU+ Studio')).toBeVisible({ timeout: 10000 });

    try {
      // Simulate going offline
      await page.context().setOffline(true);

      // 1. Navigate to Recorder offline via sidebar button
      await page.locator('aside button', { hasText: 'AWB Recorder' }).click();
      await expect(page.getByText('SABOOT AWB Recorder')).toBeVisible();

      // 2. Navigate to Vault offline
      await page.locator('aside button', { hasText: 'Vault' }).click();
      await expect(page.getByRole('heading', { name: 'Vault', exact: true })).toBeVisible();

      // 3. Navigate to Pricing offline
      await page.locator('aside button', { hasText: 'Pricing & License' }).click();
      await expect(page.getByRole('heading', { name: 'Seller Protection Plans' })).toBeVisible();

      // 4. Navigate back to SmartLabel Studio offline
      await page.locator('aside button', { hasText: 'SmartLabel Studio' }).click();
      await expect(page.getByText('SmartLabel SKU+ Studio')).toBeVisible();
    } finally {
      // Restore network
      await page.context().setOffline(false);
    }
  });
});


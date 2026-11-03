import { test, expect } from '@playwright/test';
import { mintTestLicense, skipOnboardingIfOpen } from './test-helpers';

test.describe('Claim Dispute Message Studio E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
  });

  test('Template-based dispute messages with live edit, preview highlights, character counter, and Hindi/English switch', async ({
    page
  }) => {
    // 1. Activate ClaimRadar license
    const token = await mintTestLicense('claimradar');

    await page.goto('/#pricing');
    await skipOnboardingIfOpen(page);

    const input = page.getByPlaceholder('eyJhbGciOiJFUzI1NiIs…');
    await input.scrollIntoViewIfNeeded();
    await input.fill(token);
    await page.getByRole('button', { name: /Activate License/i }).click();
    await expect(page.getByText(/License activated/i)).toBeVisible({ timeout: 10000 });

    // 2. Insert test claim via raw IndexedDB API
    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('saboot');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('claims', 'readwrite');
          const store = tx.objectStore('claims');
          store.add({
            awb: 'DISPUTE-TEST-AWB-99',
            orderId: 'ORD-TEST-99',
            marketplace: 'Meesho',
            courier: 'Delhivery',
            sku: 'SAREE-BANARASI-RED',
            qty: 1,
            flagReason: 'Wrong/Swapped item',
            notes: 'Customer returned old bedsheet instead of silk saree',
            returnScanAt: Date.now(),
            deadlineAt: Date.now() + 72 * 3600 * 1000,
            status: 'pending',
            disputeText: ''
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });

    // 3. Navigate to ClaimRadar
    await page.goto('/#claims');
    await expect(page.getByText('ClaimRadar Pro')).toBeVisible();

    // 4. Open Evidence Modal for the test claim
    const claimCard = page.locator('div', { hasText: 'DISPUTE-TEST-AWB-99' }).first();
    await expect(claimCard).toBeVisible({ timeout: 10000 });

    const prepareBtn = claimCard.getByRole('button', { name: /Prepare Claim Pack/i });
    await prepareBtn.click();

    // Modal opens
    await expect(page.getByText(/Claim evidence — DISPUTE-TEST-AWB-99/i)).toBeVisible({
      timeout: 8000
    });

    // 5. Verify Template Studio is present
    await expect(page.getByText(/CLAIM DISPUTE MESSAGE/i)).toBeVisible();
    await expect(page.getByTestId('char-counter')).toBeVisible();

    // 6. Test Preview Tab and Missing Fields Highlight
    await expect(page.getByTestId('dispute-preview')).toBeVisible();
    // Since dispatch clip was not recorded, dispatchDate will be highlighted as missing
    const missingBadge = page.locator('[data-testid="missing-field"]').first();
    await expect(missingBadge).toBeVisible();

    // 7. Test Language Toggle: Switch to Hindi
    const hindiBtn = page.getByRole('button', { name: /हिंदी/i });
    await hindiBtn.click();
    await expect(page.getByTestId('dispute-preview')).toContainText('प्रिय सेलर सपोर्ट टीम');

    // Switch back to English
    const englishBtn = page.getByRole('button', { name: /english/i });
    await englishBtn.click();
    await expect(page.getByTestId('dispute-preview')).toContainText('Dear Seller Support Team');

    // 8. Test Edit Tab, User Customization, and Live Character Counter
    await page.getByTestId('tab-edit').click();
    const textarea = page.getByTestId('dispute-textarea');
    await expect(textarea).toBeVisible();

    const customText = 'Factual dispute note for seller support with all proof attached.';
    await textarea.fill(customText);

    // Verify character counter updated dynamically
    const charCounter = page.getByTestId('char-counter');
    await expect(charCounter).toContainText(`${customText.length} characters`);

    // 9. Test Copy Button
    const copyBtn = page.getByRole('button', { name: /Copy/i }).first();
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();
  });
});

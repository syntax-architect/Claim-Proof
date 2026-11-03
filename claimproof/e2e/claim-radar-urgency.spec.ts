import { test, expect } from '@playwright/test';
import { skipOnboardingIfOpen, mintTestLicense } from './test-helpers';

test.describe('ClaimRadar Urgency Alert Banner E2E', () => {
  test('displays urgency alert banner at 24h and 6h marks across every page in app shell', async ({
    page
  }) => {
    // 1. Navigate to Overview page
    await page.goto('/#overview');
    await skipOnboardingIfOpen(page);

    // 2. Activate ClaimRadar Pro license
    const licenseToken = await mintTestLicense('claimradar');
    await page.evaluate(async (token) => {
      // @ts-expect-error dynamic import
      const { verifyAndActivateToken } = await import('/src/services/licenseService.ts');
      await verifyAndActivateToken(token);
    }, licenseToken);

    // 3. Clear existing claims and inject an urgent return claim with 5 hours left (<= 6h)
    const testAwb = `URGENT_E2E_${Date.now()}`;
    await page.evaluate(async (awb) => {
      // @ts-expect-error dynamic import
      const { db } = await import('/src/db/schema.ts');
      await db.claims.clear();

      const now = Date.now();
      // 5 hours remaining (inside the 6-hour critical window)
      const fiveHoursMs = 5 * 3_600_000;
      await db.claims.add({
        awb,
        orderId: `ORD_${awb}`,
        marketplace: 'Meesho',
        courier: 'Delhivery',
        sku: 'SKU_URGENT_SAREE',
        qty: 1,
        flagReason: 'Damaged',
        notes: 'Parcel arrived crushed with torn outer polybag.',
        status: 'pending',
        returnScanAt: now - 67 * 3_600_000,
        deadlineAt: now + fiveHoursMs
      });
    }, testAwb);

    // Reload to pick up seeded claims in IndexedDB
    await page.reload();
    await skipOnboardingIfOpen(page);

    const banner = page.locator('[data-testid="claim-urgency-banner"]');

    // 4. Assert banner is visible on the Overview page
    await expect(banner).toBeVisible({ timeout: 5000 });
    await expect(banner).toContainText('CRITICAL · < 6H');
    await expect(banner).toContainText(testAwb);
    await expect(banner).toContainText('Meesho dispute closes in');

    // 5. Navigate to Smart Labels page and verify banner remains visible
    await page.goto('/#labels');
    await expect(banner).toBeVisible({ timeout: 5000 });
    await expect(banner).toContainText(testAwb);

    // 6. Navigate to Pack & Unbox (Recorder) and verify banner remains visible
    await page.goto('/#recorder');
    await expect(banner).toBeVisible({ timeout: 5000 });
    await expect(banner).toContainText(testAwb);

    // 7. Navigate to Evidence Vault and verify banner remains visible
    await page.goto('/#vault');
    await expect(banner).toBeVisible({ timeout: 5000 });
    await expect(banner).toContainText(testAwb);

    // 8. Navigate to Settings and verify banner remains visible
    await page.goto('/#settings');
    await expect(banner).toBeVisible({ timeout: 5000 });
    await expect(banner).toContainText(testAwb);

    // 9. Navigate to ClaimRadar
    await page.goto('/#claims');
    await expect(banner).toBeVisible({ timeout: 5000 });
    await expect(banner).toContainText(testAwb);

    // 10. Click "Prepare Claim" on banner and verify it routes to claims
    const prepareBtn = banner.getByRole('button', { name: /Prepare Claim/i });
    await prepareBtn.click();
    expect(page.url()).toMatch(/claims/);

    // 11. Now test 24-hour warning window (e.g. 18 hours left)
    const warnAwb = `WARN_24H_${Date.now()}`;
    await page.evaluate(async (awb) => {
      // @ts-expect-error dynamic import
      const { db } = await import('/src/db/schema.ts');
      await db.claims.clear();

      const now = Date.now();
      // 18 hours remaining (inside the 24h warning window, > 6h)
      const eighteenHoursMs = 18 * 3_600_000;
      await db.claims.add({
        awb,
        orderId: `ORD_${awb}`,
        marketplace: 'Flipkart',
        courier: 'Shadowfax',
        sku: 'SKU_FLIPKART_ITEM',
        qty: 1,
        flagReason: 'Wrong/Swapped item',
        notes: 'Wrong item returned by buyer.',
        status: 'pending',
        returnScanAt: now - 318 * 3_600_000,
        deadlineAt: now + eighteenHoursMs
      });
    }, warnAwb);

    await page.reload();
    await skipOnboardingIfOpen(page);
    await expect(banner).toBeVisible({ timeout: 5000 });
    await expect(banner).toContainText('DEADLINE · < 24H');
    await expect(banner).toContainText(warnAwb);
    await expect(banner).toContainText('Flipkart dispute closes in');
  });
});

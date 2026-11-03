import { test, expect } from '@playwright/test';
import { skipOnboardingIfOpen, mintTestLicense } from './test-helpers';

test.describe('1-Click Claim Kit Generator E2E', () => {
  test('generates complete dispute kit from synthetic recording and updates claim status', async ({
    page
  }) => {
    // 1. Navigate to ClaimRadar
    await page.goto('/#claims');
    await skipOnboardingIfOpen(page);

    // 2. Activate ClaimRadar Pro license
    const licenseToken = await mintTestLicense('claimradar');
    await page.evaluate(async (token) => {
      // @ts-expect-error dynamic import
      const { verifyAndActivateToken } = await import('/src/services/licenseService.ts');
      await verifyAndActivateToken(token);
    }, licenseToken);

    // 3. Seed synthetic dispatch recording, claim, and media cache into IndexedDB
    const testAwb = `KIT_E2E_${Date.now()}`;
    await page.evaluate(async (awb) => {
      // @ts-expect-error dynamic import
      const { db } = await import('/src/db/schema.ts');

      const recId = await db.recordings.add({
        awb,
        orderId: `ORD_${awb}`,
        sku: 'SKU_COTTON_SHIRT',
        size: 'L',
        qty: 1,
        courier: 'Delhivery',
        marketplace: 'Meesho',
        type: 'dispatch',
        startedAt: Date.now() - 3600000,
        endedAt: Date.now() - 3570000,
        durationSec: 30,
        videoMime: 'video/mp4',
        videoBytes: 1024 * 50,
        photoBytes: 1024 * 5,
        photoCollage: true,
        vaultPath: `2026-11-03/Dispatch/${awb}`,
        demo: true,
        flagged: false
      });

      // Cache a synthetic video blob
      const videoBlob = new Blob(['SYNTHETIC_VIDEO_DATA_FOR_E2E'], { type: 'video/mp4' });
      await db.media_cache.put({
        id: recId,
        video: videoBlob,
        savedAt: Date.now()
      });

      // Add a claim item
      await db.claims.add({
        awb,
        orderId: `ORD_${awb}`,
        marketplace: 'Meesho',
        courier: 'Delhivery',
        sku: 'SKU_COTTON_SHIRT',
        qty: 1,
        flagReason: 'Wrong/Swapped item',
        notes: 'Customer returned dummy packet',
        returnScanAt: Date.now() - 60000,
        deadlineAt: Date.now() + 72 * 3600 * 1000,
        status: 'pending',
        disputeText: ''
      });
    }, testAwb);

    // Reload page to pick up seeded claims
    await page.reload();
    await skipOnboardingIfOpen(page);

    // 4. Verify claim card appears in ClaimRadar dashboard
    await expect(page.getByText(testAwb, { exact: true })).toBeVisible({ timeout: 10000 });

    // 5. Click "1-Click Kit" button on the claim row
    const kitButton = page.getByRole('button', { name: /1-Click Kit/i }).first();
    await expect(kitButton).toBeVisible();
    await kitButton.click();

    // 6. Verify Claim Kit Modal opens
    await expect(page.getByText(/Create 1-Click Claim Kit/i)).toBeVisible();
    await expect(page.getByText(/Video format:/i)).toBeVisible();

    // Select ZIP download destination
    const zipRadio = page.locator('input[value="zip"]');
    await zipRadio.check();

    // 7. Click "Create Claim Kit"
    const createBtn = page.getByRole('button', { name: /Create Claim Kit/i });
    await createBtn.click();

    // 8. Expect progress or success notification
    await expect(
      page.getByText(/Claim Kit complete!|Claim Kit successfully created!/i).first()
    ).toBeVisible({ timeout: 15000 });

    // 9. Verify that claim in IndexedDB was updated to 'prepared'
    const statusInDb = await page.evaluate(async (awb) => {
      // @ts-expect-error dynamic import
      const { db } = await import('/src/db/schema.ts');
      const row = await db.claims.where('awb').equals(awb).first();
      return { status: row?.status, kitTimestamp: row?.claimKitGeneratedAt };
    }, testAwb);

    expect(statusInDb.status).toBe('prepared');
    expect(statusInDb.kitTimestamp).toBeGreaterThan(0);
  });
});

import { test, expect } from '@playwright/test';
import { skipOnboardingIfOpen, mintTestLicense } from './test-helpers';

test.describe('Return Unboxing Guided Workflow & Checklist E2E', () => {
  test('records continuous unboxing, requires condition tag, and saves checklist results to IndexedDB', async ({
    page
  }) => {
    // Navigate to recorder station
    await page.goto('/#recorder');
    await skipOnboardingIfOpen(page);

    // 0. Activate ClaimRadar Pro license for Return Unboxing capability
    const licenseToken = await mintTestLicense('claimradar');
    await page.evaluate(async (token) => {
      // @ts-expect-error dynamic import
      const { verifyAndActivateToken } = await import('/src/services/licenseService.ts');
      await verifyAndActivateToken(token);
    }, licenseToken);

    // 1. Activate Return Unboxing Mode
    const returnToggle = page.locator('label', { hasText: 'Return Unboxing Mode' });
    await returnToggle.waitFor({ state: 'visible', timeout: 5000 });
    await returnToggle.click();

    // Verify indicator badge
    await expect(page.getByText('RETURN UNBOXING MODE —', { exact: false })).toBeVisible();

    // 2. Scan / Enter AWB
    const testAwb = `RET_${Date.now()}`;
    const scanInput = page.locator('input[data-scansink="true"]');
    await scanInput.fill(testAwb);
    await scanInput.press('Enter');

    // 3. Verify recording starts and checklist overlay appears
    await expect(page.getByText('REC 00:', { exact: false })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Universal Return Unboxing|Meesho Return Unboxing/i)).toBeVisible();
    await expect(page.getByText(/Continuous Video Rule:/i)).toBeVisible();
    await expect(page.getByText(/Show sealed parcel & AWB/i)).toBeVisible();

    // 4. Verify pause blocking / continuous video rule
    // Try to click Stop & Save without selecting a condition
    const stopSaveBtn = page.getByRole('button', { name: /Stop & Save/i });
    await stopSaveBtn.click();

    // Condition required warning must appear and recording continues
    await expect(
      page.getByText(/Select one package condition tag below before saving/i)
    ).toBeVisible();
    await expect(page.getByText('REC 00:', { exact: false })).toBeVisible();

    // 5. Tick checklist steps
    const step1Btn = page.getByRole('button', { name: /Show sealed parcel & AWB/i });
    await step1Btn.click();
    await expect(step1Btn).toHaveAttribute('aria-pressed', 'true');

    // Tick step using keyboard hotkey '2'
    await page.keyboard.press('2');
    const step2Btn = page.getByRole('button', { name: /Show all 6 sides/i });
    await expect(step2Btn).toHaveAttribute('aria-pressed', 'true');

    // 6. Select condition tag
    const damagedBtn = page.getByRole('button', { name: /Damaged Product/i });
    await damagedBtn.click();
    await expect(damagedBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByText(/Select one package condition tag below before saving/i)
    ).toBeHidden();

    // 7. Stop and Save
    await stopSaveBtn.click();

    // Wait for save completion (returns to scan sink idle state)
    await expect(page.getByText('Saving Evidence…')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('RETURN UNBOXING SCAN', { exact: false })).toBeVisible({
      timeout: 15000
    });

    // 8. Assert database records in IndexedDB
    const dbData = await page.evaluate(async (awb) => {
      // @ts-expect-error accessing window.indexedDB via Dexie
      const dbModule = await import('/src/db/schema.ts');
      const db = dbModule.db;

      const returnVideo = await db.returnVideos.where('awb').equals(awb).first();
      const checklistItems = await db.checklistResults.where('awb').equals(awb).toArray();
      const claim = await db.claims.where('awb').equals(awb).first();
      const recording = await db.recordings.where('awb').equals(awb).first();

      return {
        returnVideo,
        checklistItems,
        claim,
        recording
      };
    }, testAwb);

    expect(dbData.returnVideo).toBeDefined();
    expect(dbData.returnVideo?.awb).toBe(testAwb);
    expect(dbData.returnVideo?.condition).toBe('damaged');
    expect(dbData.returnVideo?.partial).toBe(false);
    expect(dbData.returnVideo?.checklistCompletedCount).toBeGreaterThanOrEqual(2);

    expect(dbData.checklistItems.length).toBeGreaterThan(0);
    const tickedStep1 = dbData.checklistItems.find((s: { stepId: string }) => s.stepId === 'show_label');
    expect(tickedStep1?.completed).toBe(true);

    // Claim automatically created for damaged return
    expect(dbData.claim).toBeDefined();
    expect(dbData.claim?.flagReason).toBe('Damaged');

    // General recordings table also has the return recording
    expect(dbData.recording).toBeDefined();
    expect(dbData.recording?.type).toBe('return');
  });
});

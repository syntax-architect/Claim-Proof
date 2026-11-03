import { test, expect } from '@playwright/test';
import { skipOnboardingIfOpen, mintTestLicense, simulateBarcodeScan } from './test-helpers';

test.describe('Global Unified Evidence Search & Barcode Scanner E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
  });

  test('Ctrl+K opens search dialog and searches by typed AWB displaying unified packing & claim proof', async ({
    page
  }) => {
    await page.goto('/#vault');
    await skipOnboardingIfOpen(page);
    await mintTestLicense(page, 'claimradar');

    // Seed test recording & claim into Dexie
    await page.evaluate(async () => {
      const db = (window as any).__db || (await import('../src/db/schema')).db;
      await db.recordings.add({
        awb: 'AWB9988776655',
        orderId: 'ORD-TEST-1001',
        sku: 'KURTI-CHIKANKARI-L',
        size: 'L',
        qty: 1,
        courier: 'Delhivery',
        marketplace: 'Meesho',
        type: 'dispatch',
        startedAt: Date.now() - 3600000,
        endedAt: Date.now() - 3600000 + 35000,
        durationSec: 35,
        videoMime: 'video/webm',
        videoBytes: 1800000,
        photoBytes: 250000,
        photoCollage: true,
        vaultPath: '2026-10-27/Dispatch/AWB9988776655',
        demo: false,
        flagged: false
      });

      await db.claims.add({
        awb: 'AWB9988776655',
        orderId: 'ORD-TEST-1001',
        marketplace: 'Meesho',
        courier: 'Delhivery',
        sku: 'KURTI-CHIKANKARI-L',
        qty: 1,
        flagReason: 'Damaged',
        notes: 'Outer polybag torn during transit',
        returnScanAt: Date.now() - 1800000,
        deadlineAt: Date.now() + 72 * 3600 * 1000,
        status: 'pending'
      });
    });

    // Press Ctrl+K
    await page.keyboard.press('Control+k');

    const searchDialog = page.getByRole('dialog', { name: 'Global Evidence Search' });
    await expect(searchDialog).toBeVisible();

    const searchInput = page.getByPlaceholder(/Scan barcode or type AWB/i);
    await searchInput.fill('AWB9988776655');

    // Assert unified dossier card appears inside search dialog with AWB, packing video, and dispute claim
    await expect(searchDialog.getByText('AWB9988776655')).toBeVisible();
    await expect(searchDialog.getByText('KURTI-CHIKANKARI-L')).toBeVisible();
    await expect(searchDialog.getByText('Packing Video (Dispatch)')).toBeVisible();
    await expect(searchDialog.getByText('Dispute: PENDING')).toBeVisible();
    await expect(searchDialog.getByText('Damaged')).toBeVisible();

    // Close on Escape
    await page.keyboard.press('Escape');
    await expect(searchDialog).not.toBeVisible();
  });

  test('Reacts to physical barcode gun laser scan bursts anywhere on the page', async ({
    page
  }) => {
    await page.goto('/#overview');
    await skipOnboardingIfOpen(page);
    await page.waitForTimeout(300);

    // Seed parcel into Dexie
    await page.evaluate(async () => {
      const db = (window as any).__db || (await import('../src/db/schema')).db;
      await db.recordings.add({
        awb: 'SCANNER-GUN-AWB-42',
        orderId: 'ORD-GUN-42',
        sku: 'RUNNING-SHOES-BLUE-9',
        size: '9',
        qty: 1,
        courier: 'Shadowfax',
        marketplace: 'Flipkart',
        type: 'dispatch',
        startedAt: Date.now(),
        endedAt: Date.now() + 25000,
        durationSec: 25,
        videoMime: 'video/webm',
        videoBytes: 1200000,
        photoBytes: 0,
        photoCollage: false,
        vaultPath: '2026-10-27/Dispatch/SCANNER-GUN-AWB-42',
        demo: false,
        flagged: false
      });
    });

    // Simulate USB barcode gun rapid keystroke stream (<30ms gap) ending in Enter
    await simulateBarcodeScan(page, 'SCANNER-GUN-AWB-42');

    // Verify search modal auto-opened with scanned code pre-filled
    const searchDialog = page.getByRole('dialog', { name: 'Global Evidence Search' });
    await expect(searchDialog).toBeVisible();
    await expect(page.getByText('SCANNER-GUN-AWB-42')).toBeVisible();
    await expect(page.getByText('RUNNING-SHOES-BLUE-9')).toBeVisible();
  });

  test('Displays missing video & missing disk file actionable next steps', async ({ page }) => {
    await page.goto('/#vault');
    await skipOnboardingIfOpen(page);

    // Seed missing disk file recording & return-only recording
    await page.evaluate(async () => {
      const db = (window as any).__db || (await import('../src/db/schema')).db;
      // Missing file (file not on disk or vault disconnected)
      await db.recordings.add({
        awb: 'AWB-MOVED-FILE-99',
        orderId: 'ORD-MOVED-99',
        sku: 'WATCH-DIGITAL',
        size: 'Free',
        qty: 1,
        courier: 'Ekart',
        marketplace: 'Flipkart',
        type: 'dispatch',
        startedAt: Date.now() - 7200000,
        endedAt: Date.now() - 7200000 + 30000,
        durationSec: 30,
        videoMime: 'video/webm',
        videoBytes: 1500000,
        photoBytes: 0,
        photoCollage: false,
        vaultPath: '2026-10-27/Dispatch/AWB-MOVED-FILE-99',
        demo: false,
        flagged: false
      });

      // Return only (no dispatch video recorded)
      await db.recordings.add({
        awb: 'AWB-RETURN-ONLY-55',
        orderId: 'ORD-RET-55',
        sku: 'JEANS-DENIM-32',
        size: '32',
        qty: 1,
        courier: 'Valmo',
        marketplace: 'Meesho',
        type: 'return',
        startedAt: Date.now() - 3600000,
        endedAt: Date.now() - 3600000 + 40000,
        durationSec: 40,
        videoMime: 'video/webm',
        videoBytes: 2000000,
        photoBytes: 0,
        photoCollage: false,
        vaultPath: '2026-10-28/Return/AWB-RETURN-ONLY-55',
        demo: false,
        flagged: true
      });
    });

    // Open search modal via top bar button
    await page.getByTitle(/Search evidence & claims/i).click();

    const searchInput = page.getByPlaceholder(/Scan barcode or type AWB/i);

    // 1. Search for moved file
    await searchInput.fill('AWB-MOVED-FILE-99');
    await expect(page.getByText('Video file not found on disk')).toBeVisible();
    await expect(page.getByRole('button', { name: /Relink Vault Folder/i })).toBeVisible();

    // 2. Search for return-only parcel
    await searchInput.fill('AWB-RETURN-ONLY-55');
    await expect(page.getByText('No packing video was recorded for this AWB.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Open Packing Station/i })).toBeVisible();
  });

  test('Paginates large result sets with previous/next controls', async ({ page }) => {
    await page.goto('/#vault');
    await skipOnboardingIfOpen(page);

    // Seed 15 items with matching SKU
    await page.evaluate(async () => {
      const db = (window as any).__db || (await import('../src/db/schema')).db;
      const batch = [];
      for (let i = 1; i <= 15; i++) {
        batch.push({
          sourceFile: 'batch.pdf',
          page: i,
          marketplace: 'Meesho',
          awb: `AWB-PAGINATE-${String(i).padStart(3, '0')}`,
          orderId: `ORD-PAGE-${i}`,
          courier: 'Delhivery',
          sku: 'BATCH-SEARCH-SKU',
          size: 'M',
          color: 'Red',
          qty: 1,
          invoiceTotal: 299,
          contentBox: { x: 0, y: 0, w: 288, h: 432 },
          batchId: 'batch-pag',
          createdAt: Date.now() - (20 - i) * 60000
        });
      }
      await db.orders.bulkAdd(batch);
    });

    await page.keyboard.press('Control+k');
    const searchInput = page.getByPlaceholder(/Scan barcode or type AWB/i);
    await searchInput.fill('BATCH-SEARCH-SKU');

    // Page 1 should show 10 items
    await expect(page.getByText('Page 1 of 2 (15 total)')).toBeVisible();
    const prevBtn = page.getByRole('button', { name: /Previous/i });
    const nextBtn = page.getByRole('button', { name: /Next/i });

    await expect(prevBtn).toBeDisabled();
    await expect(nextBtn).toBeEnabled();

    // Navigate to Page 2
    await nextBtn.click();
    await expect(page.getByText('Page 2 of 2 (15 total)')).toBeVisible();
    await expect(prevBtn).toBeEnabled();
    await expect(nextBtn).toBeDisabled();
  });
});

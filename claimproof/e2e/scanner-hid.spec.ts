import { test, expect } from '@playwright/test';
import { skipOnboardingIfOpen, mintTestLicense } from './test-helpers';

test.describe('Keyboard-Wedge HID Scanner & Scanner Test Workbench', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
  });

  test('Scanner Test Workbench loads and reacts to fast USB barcode wedge burst (Enter)', async ({
    page
  }) => {
    await page.goto('/#scanner-test');
    await skipOnboardingIfOpen(page);

    // Verify workbench header
    await expect(page.getByRole('heading', { name: 'Scanner Test Workbench' })).toBeVisible();

    // Verify initial listener active status
    await expect(page.getByText('Scanner Gun Listener Active')).toBeVisible();

    // Dispatch rapid synthetic keystroke burst ending with Enter (<30ms gap)
    await page.evaluate(() => {
      const barcode = 'AWB123456789';
      for (const char of barcode) {
        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: char,
            bubbles: true,
            cancelable: true
          })
        );
      }
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true
        })
      );
    });

    // Verify big visual confirmation displays the parsed barcode
    await expect(page.getByText('Good Scan Confirmed')).toBeVisible();
    await expect(page.getByText('AWB123456789')).toBeVisible();
  });

  test('Scanner Test Workbench supports Tab terminator suffix', async ({ page }) => {
    await page.goto('/#scanner-test');
    await skipOnboardingIfOpen(page);

    // Dispatch rapid burst ending with Tab
    await page.evaluate(() => {
      const barcode = 'FLIPKART987';
      for (const char of barcode) {
        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: char,
            bubbles: true,
            cancelable: true
          })
        );
      }
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Tab',
          bubbles: true,
          cancelable: true
        })
      );
    });

    await expect(page.getByText('Good Scan Confirmed')).toBeVisible();
    await expect(page.getByText('FLIPKART987')).toBeVisible();
  });

  test('Slow manual typing in sandbox input does not trigger false barcode scan', async ({ page }) => {
    await page.goto('/#scanner-test');
    await skipOnboardingIfOpen(page);

    const input = page.getByPlaceholder('Click here and either type manually or pull scanner trigger...');
    await expect(input).toBeVisible();
    await input.click();

    // Type with slow 150ms delay between keys
    await input.pressSequentially('manualtext', { delay: 150 });
    await input.press('Enter');

    // Should remain in waiting / idle state or not show "manualtext" as a confirmed scan
    await expect(page.getByText('Good Scan Confirmed')).not.toBeVisible();
  });

  test('AWB Recorder captures fast barcode wedge scan directly into recording workflow', async ({
    page
  }) => {
    await page.goto('/#recorder');
    await skipOnboardingIfOpen(page);

    // Dispatch fast barcode gun scan
    await page.evaluate(() => {
      const barcode = 'MEESHO777888';
      for (const char of barcode) {
        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: char,
            bubbles: true,
            cancelable: true
          })
        );
      }
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true
        })
      );
    });

    // Recording HUD should activate with scanned AWB
    await expect(page.getByText('MEESHO777888')).toBeVisible({ timeout: 5000 });
  });
});

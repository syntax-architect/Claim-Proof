import { test, expect } from '@playwright/test';
import { skipOnboardingIfOpen, mintTestLicense } from './test-helpers';

test.describe('Keyboard-Only Full Daily Loop & Focus Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
  });

  test('focus rings: verify :focus-visible and focus outlines exist on interactive elements', async ({
    page,
  }) => {
    await page.goto('/#overview');
    await skipOnboardingIfOpen(page);

    // Tab through elements and check that focused element has outline or focus ring styling
    await page.keyboard.press('Tab');
    const hasFocusRing = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return false;
      const style = window.getComputedStyle(el);
      const outline = style.outlineStyle !== 'none' && parseInt(style.outlineWidth, 10) > 0;
      const boxShadow = style.boxShadow && style.boxShadow !== 'none';
      return Boolean(outline || boxShadow);
    });

    expect(hasFocusRing).toBe(true);
  });

  test('Escape closes Command Palette and returns focus to the trigger button', async ({
    page,
  }) => {
    await page.goto('/#overview');
    await skipOnboardingIfOpen(page);

    // Find and focus the "Commands" trigger button in the TopBar
    const trigger = page.locator('header button[title^="Command menu"]');
    await trigger.focus();
    await expect(trigger).toBeFocused();

    // Open via Enter key
    await page.keyboard.press('Enter');
    const paletteDialog = page.getByRole('dialog', { name: 'Command palette' });
    await expect(paletteDialog).toBeVisible({ timeout: 5000 });

    // Verify search input inside modal is focused
    const searchInput = page.getByPlaceholder('Search commands…');
    await expect(searchInput).toBeFocused();

    // Press Escape to close modal
    await page.keyboard.press('Escape');
    await expect(paletteDialog).not.toBeVisible();

    // Verify focus returned to the trigger button
    await expect(trigger).toBeFocused();
  });

  test('Escape closes Paywall Modal and returns focus to the trigger button', async ({
    page,
  }) => {
    await page.goto('/#claims');
    await skipOnboardingIfOpen(page);

    // Locate the "Unlock ClaimRadar Pro" trigger button
    const trigger = page.getByRole('button', { name: /Unlock ClaimRadar Pro/i });
    await trigger.focus();
    await expect(trigger).toBeFocused();

    // Open Paywall via keyboard Enter
    await page.keyboard.press('Enter');

    const paywallDialog = page.getByRole('dialog', { name: /Unlock SABOOT/i });
    await expect(paywallDialog).toBeVisible({ timeout: 5000 });

    // Press Escape to close modal
    await page.keyboard.press('Escape');
    await expect(paywallDialog).not.toBeVisible();

    // Verify focus returned to the trigger
    await expect(trigger).toBeFocused();
  });

  test('Escape closes Onboarding Modal and returns focus to trigger', async ({ page }) => {
    await page.goto('/#overview');

    // Trigger onboarding modal explicitly
    const openBtn = page.locator('header button').first();
    await openBtn.focus();

    await page.evaluate(() => {
      window.dispatchEvent(new Event('cp-open-onboarding'));
    });

    const onboardingModal = page.getByTestId('onboarding-modal');
    await expect(onboardingModal).toBeVisible({ timeout: 5000 });

    // Press Escape to dismiss onboarding modal
    await page.keyboard.press('Escape');
    await expect(onboardingModal).not.toBeVisible();

    // Verify focus returned
    await expect(openBtn).toBeFocused();
  });

  test('keyboard-only full daily loop: label import, crop, navigation, and modal dismissal', async ({
    page,
  }) => {
    // 1. Start at Overview
    await page.goto('/#overview');
    await skipOnboardingIfOpen(page);

    // 2. Open Command Palette with Ctrl+K
    await page.keyboard.press('Control+KeyK');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await expect(palette).toBeVisible({ timeout: 5000 });
    const searchInput = page.getByPlaceholder('Search commands…');
    await expect(searchInput).toBeFocused();

    // 3. Type "SmartLabel" and press Enter to navigate to SmartLabel Studio
    await page.keyboard.type('SmartLabel');
    await page.keyboard.press('Enter');
    await expect(palette).not.toBeVisible();
    await expect(page.getByText('SmartLabel SKU+ Studio')).toBeVisible({ timeout: 8000 });

    // 4. Keyboard trigger sample labels
    const sampleBtn = page.locator('button', { hasText: 'Try with sample labels' });
    await sampleBtn.focus();
    await expect(sampleBtn).toBeFocused();
    await page.keyboard.press('Enter');

    // 5. Verify sample labels parsed
    await expect(page.getByText('Labels found')).toBeVisible({ timeout: 10000 });

    // 6. Focus and press Enter on "Crop & export" button
    const cropBtn = page.locator('button', { hasText: /Crop & export 3 labels/i });
    await cropBtn.focus();
    await expect(cropBtn).toBeFocused();

    const downloadPromise = page.waitForEvent('download');
    await page.keyboard.press('Enter');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.pdf');

    // 7. Use Command Palette to navigate to Vault
    await page.keyboard.press('Control+KeyK');
    await expect(palette).toBeVisible({ timeout: 5000 });
    await expect(searchInput).toBeFocused();
    await page.keyboard.type('vault');
    await page.keyboard.press('Enter');
    await expect(palette).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Vault', exact: true })).toBeVisible({
      timeout: 8000,
    });

    // 8. Open Command Palette, navigate to Pricing
    await page.keyboard.press('Control+KeyK');
    await expect(palette).toBeVisible({ timeout: 5000 });
    await expect(searchInput).toBeFocused();
    await page.keyboard.type('pricing');
    await page.keyboard.press('Enter');
    await expect(palette).not.toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Seller Protection Plans' })
    ).toBeVisible({ timeout: 8000 });

    // 9. Tab to license key input and verify focus
    const tokenInput = page.getByPlaceholder('eyJhbGciOiJFUzI1NiIs…');
    await tokenInput.focus();
    await expect(tokenInput).toBeFocused();

    // 10. Activate license via keyboard
    const validKey = await mintTestLicense('claimradar');
    await page.keyboard.type(validKey);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.getByText(/License activated/i)).toBeVisible({ timeout: 10000 });
  });
});

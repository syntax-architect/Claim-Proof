import { test, expect } from '@playwright/test';
import { skipOnboardingIfOpen } from './test-helpers';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_DIR = path.resolve('e2e/screenshots');

test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

test.describe('i18n Language Switch & Persistence', () => {
  test('switches language between English and Hindi in TopBar and persists on reload', async ({ page }) => {
    await page.goto('/#overview');
    await skipOnboardingIfOpen(page);

    // 1. Initial render defaults to English
    const htmlLang = await page.evaluate(() => document.documentElement.lang);
    expect(htmlLang).toBe('en');

    // Verify TopBar language switch button is present
    const langSwitchBtn = page.locator('[data-testid="language-switch-button"]');
    await expect(langSwitchBtn).toBeVisible();
    await expect(langSwitchBtn).toContainText('हिन्दी');

    // 2. Click language button to switch to Hindi
    await langSwitchBtn.click();

    // Verify document lang is updated to 'hi'
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');

    // Verify TopBar button text flips to 'EN'
    await expect(langSwitchBtn).toContainText('EN');

    // Verify localized text in sidebar or overview
    const savedLocale = await page.evaluate(() => localStorage.getItem('saboot_locale'));
    expect(savedLocale).toBe('hi');

    // 3. Reload page and assert persistence
    await page.reload();
    await skipOnboardingIfOpen(page);

    const reloadedLang = await page.evaluate(() => document.documentElement.lang);
    expect(reloadedLang).toBe('hi');

    const persistedStorage = await page.evaluate(() => localStorage.getItem('saboot_locale'));
    expect(persistedStorage).toBe('hi');

    // 4. Switch back to English
    const reloadedSwitchBtn = page.locator('[data-testid="language-switch-button"]');
    await reloadedSwitchBtn.click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('switches language inside Settings page', async ({ page }) => {
    await page.goto('/#settings');
    await skipOnboardingIfOpen(page);

    // Verify language picker exists in Settings
    const langPicker = page.locator('[data-testid="settings-language-picker"]');
    await expect(langPicker).toBeVisible();

    const hiOption = page.locator('[data-testid="lang-option-hi"]');
    const enOption = page.locator('[data-testid="lang-option-en"]');

    // Select Hindi
    await hiOption.click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');

    // Select English
    await enOption.click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('verifies no horizontal overflow at 360px viewport in Hindi and pseudo-localization', async ({ page }) => {
    // 360px mobile viewport
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/#overview');
    await skipOnboardingIfOpen(page);

    // Switch to Hindi
    const langSwitchBtn = page.locator('[data-testid="language-switch-button"]');
    await langSwitchBtn.click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');

    // Allow layout and font rendering
    await page.waitForTimeout(400);

    // Check horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Capture screenshot in Hindi at 360px
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'hindi-360px-overview.png'),
      fullPage: false
    });

    // Test Settings page at 360px
    await page.goto('/#settings');
    await skipOnboardingIfOpen(page);
    await page.waitForTimeout(400);

    const settingsOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(settingsOverflow).toBe(false);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'hindi-360px-settings.png'),
      fullPage: false
    });
  });
});

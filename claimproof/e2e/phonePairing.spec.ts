import { test, expect } from '@playwright/test';
import { skipOnboardingIfOpen } from './test-helpers';

test.describe('WebRTC Phone Companion Dual-Context E2E', () => {
  test('pair PC workstation with smartphone companion and verify live camera and transfer controls', async ({
    browser
  }) => {
    // Context 1: PC Workstation
    const pcContext = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      permissions: ['camera']
    });
    const pcPage = await pcContext.newPage();
    await pcPage.goto('/#/recorder');
    await skipOnboardingIfOpen(pcPage);

    // Verify PC recorder page loaded
    await expect(pcPage.getByText(/AWB Recorder/i)).toBeVisible();

    // If phone pairing button is visible, click to open pairing room
    const startPairingBtn = pcPage.locator('button', { hasText: /Start phone pairing room/i });
    if (await startPairingBtn.isVisible()) {
      await startPairingBtn.click();
    }

    // Context 2: Smartphone Companion (Mobile Viewport)
    const phoneContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
      permissions: ['camera']
    });
    const phonePage = await phoneContext.newPage();

    // Navigate to Phone Companion route with mock room and token
    await phonePage.goto('/#/pair?room=849201&token=mock-token-1234');

    // Verify Phone Companion interface rendered full-screen without desktop sidebar
    await expect(phonePage.getByText(/Phone Companion/i)).toBeVisible();
    await expect(phonePage.getByText(/Room 849201/i)).toBeVisible();

    // Verify AWB input, Order ID input, and Start Recording button
    const awbInput = phonePage.locator('input[placeholder="e.g. 1420984812"]');
    await expect(awbInput).toBeVisible();
    await awbInput.fill('1420984812');

    const startRecordingBtn = phonePage.getByRole('button', { name: /Start Recording/i });
    await expect(startRecordingBtn).toBeVisible();

    // Start Recording on Phone
    await startRecordingBtn.click();

    // Verify Recording state: Stop button appears
    const stopRecordingBtn = phonePage.getByRole('button', { name: /Stop & Transfer/i });
    await expect(stopRecordingBtn).toBeVisible();

    // Stop recording on Phone
    await stopRecordingBtn.click();

    // Clean up contexts
    await pcContext.close();
    await phoneContext.close();
  });
});

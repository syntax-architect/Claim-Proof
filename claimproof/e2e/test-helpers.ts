import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';

interface DevKeys {
  priv: JsonWebKey;
  pub: JsonWebKey;
}

function loadDevKeys(): DevKeys {
  const rootPath = resolve(process.cwd(), 'scripts', '.license-dev-keys.json');
  const claimproofPath = resolve(process.cwd(), 'claimproof', 'scripts', '.license-dev-keys.json');
  const targetPath = existsSync(claimproofPath) ? claimproofPath : rootPath;
  return JSON.parse(readFileSync(targetPath, 'utf8')) as DevKeys;
}

function b64url(bytes: Uint8Array | string): string {
  const bin = typeof bytes === 'string' ? bytes : Buffer.from(bytes).toString('binary');
  return Buffer.from(bin, 'binary')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Mint a genuine offline ES256 license key for Playwright E2E testing.
 */
export async function mintTestLicense(plan = 'claimradar', days = 365): Promise<string> {
  const devKeys = loadDevKeys();
  const header = { alg: 'ES256', typ: 'JWT', kid: 'cp-dev-1' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'https://saboot.in',
    sub: 'cust_playwright_e2e',
    cid: 'cust_playwright_e2e',
    plan,
    seats: 1,
    iat: now,
    exp: now + days * 86400,
    jti: `cp_e2e_${Date.now()}`
  };

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    devKeys.priv,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${b64url(new Uint8Array(sig))}`;
}

export const INVALID_TEST_LICENSE =
  'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJwbGFuIjoiY2xhaW1yYWRhciIsInN1YiI6InRlc3QifQ.invalidsignaturethatwillfailverification1234567890';

/**
 * Helper to skip the onboarding modal if present.
 */
export async function skipOnboardingIfOpen(page: Page): Promise<void> {
  const modal = page.locator('[data-testid="onboarding-modal"]');
  const skipBtn = page.locator('[data-testid="onboarding-bottom-skip-button"]');

  try {
    // If modal is visible or appears within 1200ms, click skip and wait for dismissal
    await modal.waitFor({ state: 'visible', timeout: 1200 });
    await skipBtn.click({ timeout: 2000 });
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
  } catch {
    /* Modal not present or already dismissed */
  }
}

/**
 * Simulates a USB / Bluetooth HID laser barcode scanner gun burst (<80ms gap + Enter).
 */
export async function simulateBarcodeScan(page: Page, code: string): Promise<void> {
  await page.evaluate((barcode) => {
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
  }, code);
}


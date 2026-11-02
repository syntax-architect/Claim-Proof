import { test, expect, type Page, type Request } from '@playwright/test';
import { skipOnboardingIfOpen } from './test-helpers';

/**
 * Permitted host patterns according to SABOOT Suite Offline Privacy Architecture:
 * 1. App's own origin (localhost / 127.0.0.1 on any port, or custom self domain)
 * 2. Licensing hosts: api.razorpay.com, checkout.razorpay.com, rzp.io, saboot.in
 * 3. Phone-pairing hosts: *.supabase.co (HTTPS / WSS)
 * 4. Internal protocols: data:, blob:, about:
 */
const ALLOWED_EXTERNAL_HOST_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/,
  /^wss:\/\/[a-z0-9-]+\.supabase\.co$/,
  /^https:\/\/api\.razorpay\.com$/,
  /^https:\/\/checkout\.razorpay\.com$/,
  /^https:\/\/rzp\.io$/,
  /^https:\/\/(.*\.)?saboot\.in$/,
];

function isRequestAllowed(req: Request, appOrigin: string): boolean {
  const urlString = req.url();

  // Allow browser internal schemes
  if (
    urlString.startsWith('data:') ||
    urlString.startsWith('blob:') ||
    urlString.startsWith('about:') ||
    urlString.startsWith('chrome-extension:')
  ) {
    return true;
  }

  try {
    const url = new URL(urlString);

    // Allow same origin as the application
    if (url.origin === appOrigin) {
      return true;
    }

    // Allow localhost / loopback addresses on any port
    if (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]'
    ) {
      return true;
    }

    // Check against allowed licensing and phone-pairing hosts
    return ALLOWED_EXTERNAL_HOST_PATTERNS.some((pattern) =>
      pattern.test(url.origin)
    );
  } catch {
    return false;
  }
}

/**
 * Attaches a network listener that tracks every request and records any unauthorized host violations.
 */
function trackNetworkRequests(page: Page, appOrigin: string) {
  const allRequests: string[] = [];
  const unauthorizedRequests: { url: string; method: string; resourceType: string }[] = [];

  page.on('request', (req) => {
    const url = req.url();
    allRequests.push(url);

    if (!isRequestAllowed(req, appOrigin)) {
      unauthorizedRequests.push({
        url,
        method: req.method(),
        resourceType: req.resourceType(),
      });
    }
  });

  return { allRequests, unauthorizedRequests };
}

test.describe('Network Privacy & Domain Isolation Guarantee', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
  });

  test('SPA main app routes make ZERO unauthorized outbound requests and NO calls to Google Fonts', async ({
    page,
    baseURL,
  }) => {
    const appOrigin = new URL(baseURL || 'http://localhost:5173').origin;
    const tracker = trackNetworkRequests(page, appOrigin);

    // 1. Visit root app and dismiss onboarding
    await page.goto('/');
    await skipOnboardingIfOpen(page);

    // 2. Navigate through all major routes
    const routes = [
      '/#/overview',
      '/#/labels',
      '/#/recorder',
      '/#/claims',
      '/#/pricing',
      '/#/settings',
      '/#/vault',
    ];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForTimeout(300);
    }

    // Assert no forbidden Google Fonts requests were made
    const googleFontRequests = tracker.allRequests.filter(
      (u) => u.includes('fonts.googleapis.com') || u.includes('fonts.gstatic.com')
    );
    expect(
      googleFontRequests,
      `Detected unauthorized Google Fonts requests: ${JSON.stringify(googleFontRequests)}`
    ).toHaveLength(0);

    // Assert that self-hosted font files (.woff2) are loaded from own origin
    const localFontRequests = tracker.allRequests.filter(
      (u) =>
        u.includes('.woff2') ||
        u.includes('/assets/inter') ||
        u.includes('/assets/fraunces') ||
        u.includes('/assets/jetbrains-mono')
    );
    expect(
      localFontRequests.length,
      'Expected at least one local self-hosted .woff2 font file request from own origin'
    ).toBeGreaterThan(0);

    for (const fontUrl of localFontRequests) {
      expect(
        fontUrl.startsWith(appOrigin) ||
          fontUrl.startsWith('http://localhost') ||
          fontUrl.startsWith('http://127.0.0.1'),
        `Font must be served locally from own origin, got: ${fontUrl}`
      ).toBe(true);
    }

    // Assert ZERO unauthorized requests
    expect(
      tracker.unauthorizedRequests,
      `Network isolation violated! Unauthorized outbound requests detected: ${JSON.stringify(
        tracker.unauthorizedRequests,
        null,
        2
      )}`
    ).toHaveLength(0);
  });

  test('Public landing page (landing.html) makes ZERO unauthorized outbound requests', async ({
    page,
    baseURL,
  }) => {
    const appOrigin = new URL(baseURL || 'http://localhost:5173').origin;
    const tracker = trackNetworkRequests(page, appOrigin);

    await page.goto('/landing.html');
    await page.waitForLoadState('domcontentloaded');

    // Verify no Google Fonts
    const googleFontRequests = tracker.allRequests.filter(
      (u) => u.includes('fonts.googleapis.com') || u.includes('fonts.gstatic.com')
    );
    expect(googleFontRequests).toHaveLength(0);

    // Assert ZERO unauthorized requests
    expect(
      tracker.unauthorizedRequests,
      `Unauthorized outbound requests on landing.html: ${JSON.stringify(
        tracker.unauthorizedRequests,
        null,
        2
      )}`
    ).toHaveLength(0);
  });

  test('Public 404 page (404.html) makes ZERO unauthorized outbound requests', async ({
    page,
    baseURL,
  }) => {
    const appOrigin = new URL(baseURL || 'http://localhost:5173').origin;
    const tracker = trackNetworkRequests(page, appOrigin);

    await page.goto('/404.html');
    await page.waitForLoadState('domcontentloaded');

    // Verify no Google Fonts
    const googleFontRequests = tracker.allRequests.filter(
      (u) => u.includes('fonts.googleapis.com') || u.includes('fonts.gstatic.com')
    );
    expect(googleFontRequests).toHaveLength(0);

    // Assert ZERO unauthorized requests
    expect(
      tracker.unauthorizedRequests,
      `Unauthorized outbound requests on 404.html: ${JSON.stringify(
        tracker.unauthorizedRequests,
        null,
        2
      )}`
    ).toHaveLength(0);
  });

  test('Privacy detector actively catches and fails on any attempt to request unauthorized domains', async ({
    page,
    baseURL,
  }) => {
    const appOrigin = new URL(baseURL || 'http://localhost:5173').origin;
    const tracker = trackNetworkRequests(page, appOrigin);

    await page.goto('/');
    await skipOnboardingIfOpen(page);

    // Clear tracker before deliberate test injection
    tracker.unauthorizedRequests.length = 0;

    // Deliberately attempt an unauthorized outbound fetch in page context
    await page.evaluate(async () => {
      try {
        await fetch('https://unauthorized-telemetry-cdn.example.com/track', {
          mode: 'no-cors',
        });
      } catch {
        /* Expected to fail or be blocked by CSP */
      }
    });

    // Verify our network privacy tracker captured this unauthorized domain
    expect(tracker.unauthorizedRequests.length).toBeGreaterThan(0);
    expect(tracker.unauthorizedRequests[0].url).toContain('unauthorized-telemetry-cdn.example.com');
  });
});

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { skipOnboardingIfOpen } from './test-helpers';
import * as fs from 'fs';
import * as path from 'path';

const PAGES = [
  { name: 'overview', hash: '/#overview' },
  { name: 'labels', hash: '/#labels' },
  { name: 'recorder', hash: '/#recorder' },
  { name: 'claims', hash: '/#claims' },
  { name: 'vault', hash: '/#vault' },
  { name: 'pricing', hash: '/#pricing' },
  { name: 'settings', hash: '/#settings' },
  { name: '404', hash: '/#nonsense' },
] as const;

const VIEWPORTS = [
  { name: 'desktop', width: 1366, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

const THEMES = ['dark', 'light'] as const;

const SCREENSHOT_DIR = path.resolve('e2e/screenshots');

test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

test.describe('A11y, Contrast & Screenshot Tests', () => {
  for (const pageInfo of PAGES) {
    for (const theme of THEMES) {
      for (const vp of VIEWPORTS) {
        test(`Page ${pageInfo.name} - ${theme} - ${vp.name} (${vp.width}x${vp.height})`, async ({
          page,
        }) => {
          page.on('console', (msg) => console.log(`[BROWSER LOG] ${msg.type()}: ${msg.text()}`));
          page.on('pageerror', (err) => console.error(`[PAGE ERROR] ${err.message}`));
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.goto(pageInfo.hash);
          await skipOnboardingIfOpen(page);

          // Apply theme explicitly to documentElement
          await page.evaluate((t) => {
            document.documentElement.classList.remove('light', 'dark');
            document.documentElement.classList.add(t);
            localStorage.setItem('saboot_theme', t);
          }, theme);

          // Wait a tick for transitions and layout
          await page.waitForTimeout(350);

          // 1. Capture screenshot
          const screenshotPath = path.join(
            SCREENSHOT_DIR,
            `${pageInfo.name}-${theme}-${vp.width}x${vp.height}.png`
          );
          await page.screenshot({ path: screenshotPath, fullPage: true });
          expect(fs.existsSync(screenshotPath)).toBe(true);

          // 2. Run axe-core accessibility audit
          const axeResults = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze();

          const violations = axeResults.violations.filter(
            (v) => v.impact === 'serious' || v.impact === 'critical'
          );

          if (violations.length > 0) {
            console.error(
              `Axe violations on ${pageInfo.name} (${theme}, ${vp.width}x${vp.height}):`,
              JSON.stringify(
                violations.map((v) => ({
                  id: v.id,
                  impact: v.impact,
                  description: v.description,
                  nodes: v.nodes.map((n) => ({
                    html: n.html,
                    failureSummary: n.failureSummary,
                  })),
                })),
                null,
                2
              )
            );
          }

          expect(
            violations,
            `Expected no serious or critical axe violations on ${pageInfo.name} in ${theme} mode`
          ).toHaveLength(0);
        });
      }
    }
  }
});


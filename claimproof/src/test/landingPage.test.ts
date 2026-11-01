import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PLANS } from '../config/plans';

describe('Static Landing Page & SEO Assets Verification', () => {
  const publicDir = join(process.cwd(), 'public');
  const landingHtmlPath = join(publicDir, 'landing.html');
  const sitemapPath = join(publicDir, 'sitemap.xml');
  const robotsPath = join(publicDir, 'robots.txt');
  const ogPngPath = join(publicDir, 'og-image.png');
  const ogSvgPath = join(publicDir, 'og-image.svg');
  const demoSvgPath = join(publicDir, 'demo-preview.svg');

  it('ensures all required static files exist in public/', () => {
    expect(existsSync(landingHtmlPath)).toBe(true);
    expect(existsSync(sitemapPath)).toBe(true);
    expect(existsSync(robotsPath)).toBe(true);
    expect(existsSync(ogPngPath)).toBe(true);
    expect(existsSync(ogSvgPath)).toBe(true);
    expect(existsSync(demoSvgPath)).toBe(true);
  });

  describe('robots.txt & sitemap.xml', () => {
    it('validates robots.txt structure and sitemap declaration', () => {
      const robots = readFileSync(robotsPath, 'utf-8');
      expect(robots).toContain('User-agent: *');
      expect(robots).toContain('Allow: /');
      expect(robots).toContain('Sitemap: https://claimproof.in/sitemap.xml');
    });

    it('validates sitemap.xml URLs', () => {
      const sitemap = readFileSync(sitemapPath, 'utf-8');
      expect(sitemap).toContain('<urlset');
      expect(sitemap).toContain('https://claimproof.in/');
      expect(sitemap).toContain('https://claimproof.in/landing.html');
    });
  });

  describe('landing.html requirements', () => {
    const html = readFileSync(landingHtmlPath, 'utf-8');

    it('contains comprehensive meta tags and Open Graph tags', () => {
      expect(html).toContain('<title>ClaimProof —');
      expect(html).toContain('<meta name="description"');
      expect(html).toContain('<meta name="viewport"');
      expect(html).toContain('<link rel="canonical" href="https://claimproof.in/landing.html"');

      // Open Graph
      expect(html).toContain('<meta property="og:type" content="website"');
      expect(html).toContain('<meta property="og:title"');
      expect(html).toContain('<meta property="og:description"');
      expect(html).toContain('<meta property="og:image" content="https://claimproof.in/og-image.png"');

      // Twitter Card
      expect(html).toContain('<meta name="twitter:card" content="summary_large_image"');
      expect(html).toContain('<meta name="twitter:image" content="https://claimproof.in/og-image.png"');
    });

    it('contains the exact one-sentence promise', () => {
      expect(html).toContain(
        'ClaimProof pairs daily thermal shipping label printing with uncut barcode-verified packing and unboxing video evidence—saving Indian marketplace sellers from return fraud without cloud fees or data uploads.'
      );
    });

    it('contains the 30-second demo GIF placeholder with burnt-in forensic banner', () => {
      expect(html).toContain('See It In Action In 30 Seconds');
      expect(html).toContain('/demo-preview.svg');
      expect(html).toContain('30-second workflow demo');
      expect(html).toContain('Local Hard Drive (Chromium File System Access)');
    });

    it('details the 3 steps of the workflow (SmartLabel, VideoRecorder, ClaimRadar)', () => {
      expect(html).toContain('Three Steps From Label To Irrefutable Proof');
      // Step 1
      expect(html).toContain('Batch Drop &amp; Vector Crop Labels');
      expect(html).toContain('4×6 inch thermal labels');
      // Step 2
      expect(html).toContain('Hands-Free Barcode Video Recording');
      expect(html).toContain('Burnt-in forensic banner with live IST microsecond timestamps');
      // Step 3
      expect(html).toContain('Track Deadlines &amp; File Claims');
      expect(html).toContain('Side-by-side evidence matcher');
    });

    it('renders the Free vs Paid comparison with exact values from src/config/plans.ts', () => {
      // Free plan
      expect(html).toContain('Free Forever');
      expect(html).toContain('40 label crops');
      expect(html).toContain('10 AWB videos');

      // Paid plans from PLANS config
      for (const plan of PLANS) {
        expect(html).toContain(plan.name);
        expect(html).toContain(`₹${plan.annualPrice.toLocaleString('en-IN')}`);
      }

      // Feature table
      expect(html).toContain('Daily Label Cropping Limit');
      expect(html).toContain('Daily AWB Video Recording');
      expect(html).toContain('Forensic Timestamp Watermark');
      expect(html).toContain('Automated 4-Photo Collage');
    });

    it('contains clear FAQ answers for data upload, PC changes, and refunds', () => {
      // FAQ 1: Is my data uploaded?
      expect(html).toContain('Is my data uploaded anywhere?');
      expect(html).toContain('ClaimProof is strictly local-first');
      expect(html).toContain('Zero customer data, tracking numbers, or video bytes are ever uploaded');

      // FAQ 2: What if I change PC?
      expect(html).toContain('What if I change PC or format my workstation?');
      expect(html).toContain('ClaimProof includes soft device binding. You are never locked out.');
      expect(html).toContain('Move license to this device');

      // FAQ 3: Refund policy
      expect(html).toContain('What is the refund policy?');
      expect(html).toContain('within 7 days of purchase for a prompt refund');
    });

    it('provides prominent "Try free" call-to-action buttons', () => {
      const tryFreeMatches = html.match(/Try Free Forever/g);
      expect(tryFreeMatches).not.toBeNull();
      expect(tryFreeMatches!.length).toBeGreaterThanOrEqual(2);
      expect(html).toContain('href="/#labels"');
    });

    it('strictly avoids fake testimonials, invented stats, and unverified approval rates', () => {
      // No fake customer names or reviews
      expect(html).not.toMatch(/Ramesh [A-Z]/i);
      expect(html).not.toMatch(/Pooja [A-Z]/i);
      expect(html).not.toMatch(/★★★★★/);

      // No invented approval percentage stats
      expect(html).not.toMatch(/9[0-9]% claim (approval|win|success) rate/i);
      expect(html).not.toMatch(/guaranteed (approval|claim|payout)/i);

      // Marketplace deadlines are explicitly marked with needs verification
      expect(html).toContain('<em>[needs verification]</em>');
    });
  });
});

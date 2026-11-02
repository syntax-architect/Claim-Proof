import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PLANS } from '../../claimproof/src/config/plans';

describe('SABOOT Marketing Site Verification', () => {
  const siteDir = join(process.cwd());
  const distDir = join(siteDir, 'dist');

  it('ensures dist/ exists and contains core build outputs', () => {
    expect(existsSync(distDir)).toBe(true);
    expect(existsSync(join(distDir, 'index.html'))).toBe(true);
    expect(existsSync(join(distDir, '404.html'))).toBe(true);
    expect(existsSync(join(distDir, 'robots.txt'))).toBe(true);
    expect(existsSync(join(distDir, 'sitemap.xml'))).toBe(true);
    expect(existsSync(join(distDir, '_headers'))).toBe(true);
    expect(existsSync(join(distDir, '_routes.json'))).toBe(true);
  });

  const requiredPages = [
    { name: 'Home', file: 'index.html', path: '/' },
    { name: 'Features', file: 'features/index.html', path: '/features' },
    { name: 'Pricing', file: 'pricing/index.html', path: '/pricing' },
    { name: 'Guides Index', file: 'guides/index.html', path: '/guides' },
    { name: 'Guide: Meesho', file: 'guides/meesho-safe-claim-guide/index.html', path: '/guides/meesho-safe-claim-guide' },
    { name: 'Guide: Flipkart', file: 'guides/flipkart-spf-claim-guide/index.html', path: '/guides/flipkart-spf-claim-guide' },
    { name: 'Guide: Thermal', file: 'guides/thermal-printer-setup-guide/index.html', path: '/guides/thermal-printer-setup-guide' },
    { name: 'FAQ', file: 'faq/index.html', path: '/faq' },
    { name: 'About', file: 'about/index.html', path: '/about' },
    { name: 'Contact', file: 'contact/index.html', path: '/contact' },
    { name: 'Privacy', file: 'privacy/index.html', path: '/privacy' },
    { name: 'Terms', file: 'terms/index.html', path: '/terms' },
    { name: 'Refund', file: 'refund/index.html', path: '/refund' },
    { name: '404', file: '404.html', path: '/404' }
  ];

  describe('Route Completeness & Semantic HTML', () => {
    it.each(requiredPages)('$name ($file) renders with exactly one h1 and required landmarks', ({ file }) => {
      const filePath = join(distDir, file);
      expect(existsSync(filePath)).toBe(true);
      const html = readFileSync(filePath, 'utf-8');

      // Exactly one <h1>
      const h1Matches = html.match(/<h1[^>]*>/gi);
      expect(h1Matches).not.toBeNull();
      expect(h1Matches?.length).toBe(1);

      // Semantic Landmarks
      expect(html).toContain('<header');
      expect(html).toContain('<nav');
      expect(html).toContain('<main');
      expect(html).toContain('<footer');
    });
  });

  describe('SEO, Canonical URLs, and Hreflang', () => {
    it.each(requiredPages.filter(p => p.name !== '404'))('$name has canonical and hreflang en-IN and hi-IN tags', ({ file, path }) => {
      const html = readFileSync(join(distDir, file), 'utf-8');

      const expectedCanonical = path === '/' ? 'https://saboot.in' : `https://saboot.in${path}`;
      expect(html).toContain(`<link rel="canonical" href="${expectedCanonical}">`);
      expect(html).toContain(`<link rel="alternate" hreflang="en-IN" href="${expectedCanonical}">`);
      expect(html).toContain(`<link rel="alternate" hreflang="hi-IN" href="${expectedCanonical}">`);
      expect(html).toContain(`<link rel="alternate" hreflang="x-default" href="${expectedCanonical}">`);
    });

    it('ensures each page has unique title and description', () => {
      const titles = new Set<string>();
      const descriptions = new Set<string>();

      for (const { file } of requiredPages) {
        const html = readFileSync(join(distDir, file), 'utf-8');

        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        expect(titleMatch).not.toBeNull();
        const title = titleMatch![1];
        expect(title.length).toBeGreaterThan(10);
        expect(titles.has(title)).toBe(false);
        titles.add(title);

        const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
        expect(descMatch).not.toBeNull();
        const desc = descMatch![1];
        expect(desc.length).toBeGreaterThan(20);
        expect(descriptions.has(desc)).toBe(false);
        descriptions.add(desc);
      }
    });

    it('verifies Open Graph and Twitter card tags across pages', () => {
      const html = readFileSync(join(distDir, 'index.html'), 'utf-8');
      expect(html).toContain('<meta property="og:title"');
      expect(html).toContain('<meta property="og:description"');
      expect(html).toContain('<meta property="og:image"');
      expect(html).toContain('<meta property="og:url" content="https://saboot.in">');
      expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
      expect(html).toContain('<meta name="twitter:image"');
    });
  });

  describe('JSON-LD Structured Data', () => {
    it('contains Organization and SoftwareApplication schemas on all pages', () => {
      const html = readFileSync(join(distDir, 'index.html'), 'utf-8');
      expect(html).toContain('"@type":"Organization"');
      expect(html).toContain('"name":"SABOOT"');
      expect(html).toContain('"@type":"SoftwareApplication"');
      expect(html).toContain('"name":"SABOOT Suite"');
    });

    it('contains FAQPage schema on the FAQ page', () => {
      const html = readFileSync(join(distDir, 'faq/index.html'), 'utf-8');
      expect(html).toContain('"@type":"FAQPage"');
      expect(html).toContain('"@type":"Question"');
      expect(html).toContain('"acceptedAnswer"');
    });

    it('contains Article schema on guide article templates', () => {
      const html = readFileSync(join(distDir, 'guides/meesho-safe-claim-guide/index.html'), 'utf-8');
      expect(html).toContain('"@type":"Article"');
      expect(html).toContain('"headline"');
      expect(html).toContain('"datePublished"');
    });
  });

  describe('Pricing Data Fidelity', () => {
    it('matches prices from src/config/plans.ts in the pricing page', () => {
      const html = readFileSync(join(distDir, 'pricing/index.html'), 'utf-8');

      for (const plan of PLANS) {
        expect(html).toContain(plan.name);
        expect(html).toContain(`₹${plan.annualPrice}`);
        expect(html).toContain(`₹${plan.monthlyPrice}`);
        expect(html).toContain(`₹${plan.dailyAnnualCost}/day`);
      }
    });
  });

  describe('Image Optimization & Zero Layout Shift', () => {
    it('verifies AVIF and WebP images exist with explicit width and height', () => {
      const imagesDir = join(distDir, 'images');
      expect(existsSync(imagesDir)).toBe(true);

      const files = readdirSync(imagesDir);
      const avifFiles = files.filter(f => f.endsWith('.avif'));
      const webpFiles = files.filter(f => f.endsWith('.webp'));

      expect(avifFiles.length).toBeGreaterThanOrEqual(3);
      expect(webpFiles.length).toBeGreaterThanOrEqual(3);

      const html = readFileSync(join(distDir, 'index.html'), 'utf-8');
      const imgTags = html.match(/<img[^>]+>/g) || [];
      expect(imgTags.length).toBeGreaterThan(0);

      for (const img of imgTags) {
        expect(img).toMatch(/width="\d+"/);
        expect(img).toMatch(/height="\d+"/);
      }
    });
  });

  describe('Cloudflare Pages Configuration & Robots/Sitemap', () => {
    it('verifies Cloudflare Pages _headers has security and cache policies', () => {
      const headers = readFileSync(join(distDir, '_headers'), 'utf-8');
      expect(headers).toContain('X-Frame-Options: DENY');
      expect(headers).toContain('X-Content-Type-Options: nosniff');
      expect(headers).toContain('Content-Security-Policy:');
      expect(headers).toContain('Cache-Control:');
    });

    it('verifies robots.txt references sitemap.xml', () => {
      const robots = readFileSync(join(distDir, 'robots.txt'), 'utf-8');
      expect(robots).toContain('User-agent: *');
      expect(robots).toContain('Allow: /');
      expect(robots).toContain('Sitemap:');
    });

    it('verifies sitemap-0.xml or sitemap-index.xml lists all static pages', () => {
      const sitemap0Path = join(distDir, 'sitemap-0.xml');
      const sitemap = readFileSync(sitemap0Path, 'utf-8');
      expect(sitemap).toContain('https://saboot.in/');
      expect(sitemap).toContain('https://saboot.in/features');
      expect(sitemap).toContain('https://saboot.in/pricing');
      expect(sitemap).toContain('https://saboot.in/guides');
      expect(sitemap).toContain('https://saboot.in/faq');
      expect(sitemap).toContain('https://saboot.in/about');
      expect(sitemap).toContain('https://saboot.in/contact');
      expect(sitemap).toContain('https://saboot.in/privacy');
      expect(sitemap).toContain('https://saboot.in/terms');
      expect(sitemap).toContain('https://saboot.in/refund');
    });
  });

  describe('Copy Safety & Compliance', () => {
    it('verifies placeholder copy is marked [TODO real copy]', () => {
      const meeshoGuide = readFileSync(join(distDir, 'guides/meesho-safe-claim-guide/index.html'), 'utf-8');
      expect(meeshoGuide).toContain('[TODO real copy]');

      const flipkartGuide = readFileSync(join(distDir, 'guides/flipkart-spf-claim-guide/index.html'), 'utf-8');
      expect(flipkartGuide).toContain('[TODO real copy]');

      const aboutHtml = readFileSync(join(distDir, 'about/index.html'), 'utf-8');
      expect(aboutHtml).toContain('[TODO real copy');
    });
  });
});

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../..');

// Discover build directories
const siteDistDir = fs.existsSync(path.resolve(workspaceRoot, 'site/dist'))
  ? path.resolve(workspaceRoot, 'site/dist')
  : null;

const appDistDir = fs.existsSync(path.resolve(__dirname, '../dist'))
  ? path.resolve(__dirname, '../dist')
  : fs.existsSync(path.resolve(workspaceRoot, 'claimproof/dist'))
    ? path.resolve(workspaceRoot, 'claimproof/dist')
    : null;

if (!siteDistDir && !appDistDir) {
  console.error('[audit] Error: Neither site/dist nor claimproof/dist exists.');
  console.error('Please run "npm run build" or "npm --prefix site run build" before auditing.');
  process.exit(1);
}

// Known SPA route names
const KNOWN_SPA_ROUTES = new Set([
  'overview',
  'labels',
  'recorder',
  'claims',
  'vault',
  'pricing',
  'settings',
  'privacy',
  'terms',
  'refund',
  'support',
  'not-found',
  '404'
]);

// Static MIME mapping
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

function createStaticServer(distDir, isSpa = false) {
  return http.createServer((req, res) => {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      let reqPath = decodeURIComponent(parsedUrl.pathname);

      if (reqPath === '/' || !reqPath) {
        reqPath = '/index.html';
      }

      let filePath = path.join(distDir, reqPath);

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        const asHtml = `${filePath}.html`;
        const asIndex = path.join(filePath, 'index.html');
        if (fs.existsSync(asHtml) && fs.statSync(asHtml).isFile()) {
          filePath = asHtml;
        } else if (fs.existsSync(asIndex) && fs.statSync(asIndex).isFile()) {
          filePath = asIndex;
        } else if (isSpa) {
          filePath = path.join(distDir, 'index.html');
        } else {
          filePath = path.join(distDir, '404.html');
        }
      }

      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      const content = fs.readFileSync(filePath);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': content.length,
        'Cache-Control': 'no-cache'
      });
      res.end(content);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Server Error: ${err.message}`);
    }
  });
}

function extractWords(text) {
  if (!text) return 0;
  const clean = text.replace(/[\r\n\t]+/g, ' ').trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter((w) => w.length > 0).length;
}

async function auditPagesForServer(serverInfo, browser, failures) {
  const { baseUrl, distDir, isSpa, pages } = serverInfo;
  const results = [];

  for (const pageInfo of pages) {
    const pageUrl = `${baseUrl}${pageInfo.path}`;
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 15000 });
      if (pageInfo.type === 'spa') {
        await page.waitForTimeout(300);
      }

      const data = await page.evaluate(() => {
        const title = document.title || '';
        const descEl = document.querySelector('meta[name="description"]');
        const description = descEl ? descEl.getAttribute('content') || '' : '';
        const canonicalEl = document.querySelector('link[rel="canonical"]');
        const canonical = canonicalEl ? canonicalEl.getAttribute('href') || '' : '';

        const h1Els = Array.from(document.querySelectorAll('h1'));
        const h1Texts = h1Els
          .map((h) => (h.innerText || h.textContent || '').trim())
          .filter(Boolean);

        const imgEls = Array.from(document.querySelectorAll('img'));
        const images = imgEls.map((img) => ({
          src: img.getAttribute('src') || '',
          alt: img.getAttribute('alt')
        }));

        const linkEls = Array.from(document.querySelectorAll('a[href]'));
        const links = linkEls.map((a) => a.getAttribute('href') || '');

        const clone = document.body.cloneNode(true);
        const scripts = clone.querySelectorAll('script, style, noscript, svg');
        scripts.forEach((s) => s.remove());
        const bodyText = clone.innerText || clone.textContent || '';

        return {
          title,
          description,
          canonical,
          h1Count: h1Texts.length,
          h1List: h1Texts,
          images,
          links,
          bodyText
        };
      });

      const wordCount = extractWords(data.bodyText);
      const isUnder300 = wordCount < 300;
      const pageFailures = [];

      // 1. Title Checks
      if (!data.title || !data.title.trim()) {
        pageFailures.push('Missing <title> tag on page');
      } else if (data.title.length > 60) {
        pageFailures.push(
          `Title exceeds 60 characters (${data.title.length} chars): "${data.title}"`
        );
      }

      // 2. Meta Description Checks
      if (!data.description || !data.description.trim()) {
        pageFailures.push('Missing <meta name="description"> tag on page');
      } else if (data.description.length > 160) {
        pageFailures.push(
          `Meta description exceeds 160 characters (${data.description.length} chars)`
        );
      }

      // 3. H1 Heading Checks
      if (data.h1Count === 0) {
        pageFailures.push('Missing <h1> heading tag on page');
      }

      // 4. Canonical Link Checks
      if (!data.canonical || !data.canonical.trim()) {
        pageFailures.push('Missing <link rel="canonical"> tag on page');
      }

      // 5. Image Alt Text Checks
      for (const img of data.images) {
        if (img.alt === null || img.alt === undefined) {
          pageFailures.push(`Image tag missing required alt attribute: "${img.src}"`);
        }
      }

      // 6. Broken Internal Links Checks
      for (const link of data.links) {
        if (
          !link ||
          link.startsWith('http://') ||
          link.startsWith('https://') ||
          link.startsWith('mailto:') ||
          link.startsWith('tel:') ||
          link.startsWith('javascript:')
        ) {
          continue; // External or non-HTTP links
        }

        if (link.startsWith('#')) {
          if (link.startsWith('#/')) {
            const routeKey = link.replace(/^#\/?/, '').split(/[?#]/)[0];
            if (routeKey && !KNOWN_SPA_ROUTES.has(routeKey)) {
              pageFailures.push(`Broken internal hash route: "${link}" (route not recognized)`);
            }
          } else {
            const anchorId = link.slice(1);
            if (anchorId) {
              const anchorExists = await page.evaluate(
                (id) => !!document.getElementById(id),
                anchorId
              );
              if (!anchorExists) {
                pageFailures.push(
                  `Broken in-page anchor link: "${link}" (id "${anchorId}" not found in DOM)`
                );
              }
            }
          }
        } else if (link.startsWith('/')) {
          if (link.startsWith('/#')) {
            const routeKey = link.replace(/^\/#\/?/, '').split(/[?#]/)[0];
            if (routeKey && !KNOWN_SPA_ROUTES.has(routeKey)) {
              pageFailures.push(`Broken internal hash route: "${link}" (route not recognized)`);
            }
          } else {
            // Check file presence on disk
            let cleanPath = link.split(/[?#]/)[0];
            if (cleanPath === '/') cleanPath = '/index.html';
            const directFile = path.join(distDir, cleanPath);
            const asHtml = path.join(distDir, `${cleanPath}.html`);
            const asIndex = path.join(distDir, cleanPath, 'index.html');

            const exists =
              fs.existsSync(directFile) || fs.existsSync(asHtml) || fs.existsSync(asIndex);
            if (!exists) {
              pageFailures.push(`Broken internal link: "${link}" not found in dist`);
            }
          }
        }
      }

      const item = {
        group: serverInfo.name,
        label: pageInfo.label,
        path: pageInfo.path,
        title: data.title,
        titleLen: data.title.length,
        descriptionLen: data.description.length,
        h1: data.h1List[0] || '(none)',
        canonical: data.canonical,
        wordCount,
        isUnder300,
        failures: pageFailures
      };

      results.push(item);
      if (pageFailures.length > 0) {
        failures.push({ label: `${serverInfo.name}: ${pageInfo.label}`, issues: pageFailures });
      }
    } catch (err) {
      failures.push({
        label: `${serverInfo.name}: ${pageInfo.label}`,
        issues: [`Navigation/Audit error: ${err.message}`]
      });
    } finally {
      await context.close();
    }
  }

  return results;
}

async function runAudit() {
  console.log('\n================================================================');
  console.log('   SABOOT CI Quality & SEO Audit Runner');
  console.log('================================================================\n');

  const servers = [];
  const allAuditResults = [];
  const failures = [];

  // 1. Setup Marketing Site Server (if site/dist exists)
  if (siteDistDir) {
    const siteServer = createStaticServer(siteDistDir, false);
    await new Promise((resolve) => siteServer.listen(0, '127.0.0.1', resolve));
    const sitePort = siteServer.address().port;
    const siteBaseUrl = `http://127.0.0.1:${sitePort}`;
    console.log(`[audit] Marketing Site server active at: ${siteBaseUrl}`);

    const sitePages = [
      { type: 'static', path: '/', label: 'Home Page (/)' },
      { type: 'static', path: '/features', label: 'Features (/features)' },
      { type: 'static', path: '/pricing', label: 'Pricing (/pricing)' },
      { type: 'static', path: '/guides', label: 'Guides Index (/guides)' },
      {
        type: 'static',
        path: '/guides/meesho-safe-claim-guide',
        label: 'Guide: Meesho SAFE'
      },
      {
        type: 'static',
        path: '/guides/flipkart-spf-claim-guide',
        label: 'Guide: Flipkart SPF'
      },
      {
        type: 'static',
        path: '/guides/thermal-printer-setup-guide',
        label: 'Guide: Thermal Printer'
      },
      { type: 'static', path: '/faq', label: 'FAQ (/faq)' },
      { type: 'static', path: '/about', label: 'About (/about)' },
      { type: 'static', path: '/contact', label: 'Contact (/contact)' },
      { type: 'static', path: '/privacy', label: 'Privacy Policy (/privacy)' },
      { type: 'static', path: '/terms', label: 'Terms of Service (/terms)' },
      { type: 'static', path: '/refund', label: 'Refund Policy (/refund)' },
      { type: 'static', path: '/404.html', label: '404 Fallback (/404.html)' }
    ];

    servers.push({
      name: 'Marketing Site',
      server: siteServer,
      baseUrl: siteBaseUrl,
      distDir: siteDistDir,
      isSpa: false,
      pages: sitePages
    });
  }

  // 2. Setup App & Landing Server (if claimproof/dist exists)
  if (appDistDir) {
    const appServer = createStaticServer(appDistDir, true);
    await new Promise((resolve) => appServer.listen(0, '127.0.0.1', resolve));
    const appPort = appServer.address().port;
    const appBaseUrl = `http://127.0.0.1:${appPort}`;
    console.log(`[audit] SABOOT App & Landing server active at: ${appBaseUrl}`);

    const appPages = [
      { type: 'static', path: '/landing.html', label: 'Landing Page (/landing.html)' },
      { type: 'static', path: '/404.html', label: 'Static 404 Fallback (/404.html)' },
      { type: 'spa', path: '/#/overview', label: 'SPA: Overview (/#/overview)' },
      { type: 'spa', path: '/#/labels', label: 'SPA: SmartLabel Studio (/#/labels)' },
      { type: 'spa', path: '/#/recorder', label: 'SPA: AWB Recorder (/#/recorder)' },
      { type: 'spa', path: '/#/claims', label: 'SPA: ClaimRadar (/#/claims)' },
      { type: 'spa', path: '/#/vault', label: 'SPA: Vault (/#/vault)' },
      { type: 'spa', path: '/#/pricing', label: 'SPA: Pricing & Plans (/#/pricing)' },
      { type: 'spa', path: '/#/settings', label: 'SPA: Settings (/#/settings)' },
      { type: 'spa', path: '/#/privacy', label: 'SPA: Privacy Policy (/#/privacy)' },
      { type: 'spa', path: '/#/terms', label: 'SPA: Terms of Service (/#/terms)' },
      { type: 'spa', path: '/#/refund', label: 'SPA: Refund Policy (/#/refund)' },
      { type: 'spa', path: '/#/support', label: 'SPA: Support & Help (/#/support)' },
      { type: 'spa', path: '/#/404', label: 'SPA: 404 Not Found (/#/404)' }
    ];

    servers.push({
      name: 'SABOOT App',
      server: appServer,
      baseUrl: appBaseUrl,
      distDir: appDistDir,
      isSpa: true,
      pages: appPages
    });
  }

  const browser = await chromium.launch({ headless: true });

  for (const s of servers) {
    console.log(`\n[audit] Auditing pages for: ${s.name}...`);
    const results = await auditPagesForServer(s, browser, failures);
    allAuditResults.push(...results);
  }

  await browser.close();

  // Run Lighthouse Performance & SEO Audits
  console.log('\n[audit] Running Lighthouse Performance & SEO Audits (≥ 90 threshold)...');
  let chrome;
  const lighthouseScores = [];

  try {
    chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu']
    });

    const targetAudits = [];
    if (siteDistDir) {
      const siteSrv = servers.find((s) => s.name === 'Marketing Site');
      if (siteSrv) {
        targetAudits.push({
          target: 'Marketing Site: Home (/)',
          url: `${siteSrv.baseUrl}/`,
          desktop: true
        });
        targetAudits.push({
          target: 'Marketing Site: Features (/features)',
          url: `${siteSrv.baseUrl}/features`,
          desktop: true
        });
      }
    }
    if (appDistDir) {
      const appSrv = servers.find((s) => s.name === 'SABOOT App');
      if (appSrv) {
        targetAudits.push({
          target: 'SABOOT: Landing Page (/landing.html)',
          url: `${appSrv.baseUrl}/landing.html`,
          desktop: false
        });
        targetAudits.push({
          target: 'SABOOT: App Shell (/)',
          url: `${appSrv.baseUrl}/`,
          desktop: true
        });
      }
    }

    for (const t of targetAudits) {
      const options = {
        port: chrome.port,
        output: 'json',
        onlyCategories: ['performance', 'seo'],
        logLevel: 'error'
      };

      if (t.desktop) {
        options.formFactor = 'desktop';
        options.screenEmulation = {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false
        };
        options.throttling = {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1
        };
      }

      const res = await lighthouse(t.url, options);
      const perf = Math.round(res.lhr.categories.performance.score * 100);
      const seo = Math.round(res.lhr.categories.seo.score * 100);

      lighthouseScores.push({ target: t.target, perf, seo });
      console.log(`[lighthouse] ${t.target}: Performance = ${perf}/100, SEO = ${seo}/100`);

      if (perf < 90) {
        failures.push({
          label: `Lighthouse: ${t.target}`,
          issues: [`Performance score ${perf} dropped below threshold (90)`]
        });
      }
      if (seo < 90) {
        failures.push({
          label: `Lighthouse: ${t.target}`,
          issues: [`SEO score ${seo} dropped below threshold (90)`]
        });
      }
    }
  } catch (err) {
    failures.push({
      label: 'Lighthouse Quality Runner',
      issues: [`Lighthouse execution failed: ${err.message}`]
    });
  } finally {
    if (chrome) await chrome.kill();
    servers.forEach((s) => s.server.close());
  }

  // Generate Reports
  const reportsDir = path.resolve(__dirname, '../reports');
  const rootReportsDir = path.resolve(workspaceRoot, 'reports');
  [reportsDir, rootReportsDir].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  const flaggedPages = allAuditResults.filter((r) => r.isUnder300);

  let mdReport = `# SABOOT Site SEO & Quality Audit Report\n\n`;
  mdReport += `Generated on: ${new Date().toISOString()}\n\n`;

  mdReport += `## 1. Lighthouse Quality Scores (Threshold: ≥ 90)\n\n`;
  mdReport += `| Target Audit | Performance Score | SEO Score | Threshold | Status |\n`;
  mdReport += `| :--- | :---: | :---: | :---: | :---: |\n`;
  for (const s of lighthouseScores) {
    const pass = s.perf >= 90 && s.seo >= 90;
    mdReport += `| ${s.target} | **${s.perf}** / 100 | **${s.seo}** / 100 | ≥ 90 | ${pass ? '✅ PASS' : '❌ FAIL'} |\n`;
  }

  mdReport += `\n## 2. Page Metadata & Content Audit (Title ≤ 60, Desc ≤ 160)\n\n`;
  mdReport += `| Target Suite | Page / Route | Title (≤ 60) | Meta Desc (≤ 160) | H1 | Canonical | Words | Status |\n`;
  mdReport += `| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

  for (const r of allAuditResults) {
    const titleStatus =
      r.titleLen > 0 && r.titleLen <= 60 ? `✓ (${r.titleLen})` : `✗ (${r.titleLen})`;
    const descStatus =
      r.descriptionLen > 0 && r.descriptionLen <= 160
        ? `✓ (${r.descriptionLen})`
        : `✗ (${r.descriptionLen})`;
    const h1Status = r.h1 !== '(none)' ? '✓' : '✗';
    const canonicalStatus = r.canonical ? '✓' : '✗';
    const wordStatus = r.isUnder300 ? `⚠️ **${r.wordCount}** (Flagged < 300)` : `${r.wordCount}`;
    const status = r.failures.length === 0 ? '✅ Pass' : '❌ Fail';

    mdReport += `| ${r.group} | \`${r.path}\` | ${titleStatus} | ${descStatus} | ${h1Status} | ${canonicalStatus} | ${wordStatus} | ${status} |\n`;
  }

  mdReport += `\n## 3. Pages Flagged Under 300 Words\n\n`;
  if (flaggedPages.length === 0) {
    mdReport += `No pages were under 300 words.\n\n`;
  } else {
    mdReport += `The following ${flaggedPages.length} pages contain fewer than 300 words (thin content / utility pages):\n\n`;
    for (const p of flaggedPages) {
      mdReport += `- **${p.group}: ${p.label}** (\`${p.path}\`): **${p.wordCount} words** (Flagged < 300 words)\n`;
    }
  }

  if (failures.length > 0) {
    mdReport += `\n## 4. Failures & Violations\n\n`;
    for (const f of failures) {
      mdReport += `### ❌ ${f.label}\n`;
      for (const issue of f.issues) {
        mdReport += `- ${issue}\n`;
      }
    }
  }

  // Save report to both claimproof/reports and root reports/
  fs.writeFileSync(path.join(reportsDir, 'seo-word-count-report.md'), mdReport, 'utf-8');
  fs.writeFileSync(path.join(rootReportsDir, 'seo-word-count-report.md'), mdReport, 'utf-8');
  console.log(`\n[audit] Written audit report to:\n  - ${path.join(reportsDir, 'seo-word-count-report.md')}\n  - ${path.join(rootReportsDir, 'seo-word-count-report.md')}`);

  // Summary Console Table
  console.log('\n--- AUDIT SUMMARY TABLE ---');
  console.table(
    allAuditResults.map((r) => ({
      Suite: r.group,
      Path: r.path,
      'Title (≤60)': `${r.titleLen} chars`,
      'Desc (≤160)': `${r.descriptionLen} chars`,
      H1: r.h1.slice(0, 25),
      Words: r.wordCount,
      Flagged: r.isUnder300 ? '< 300 words' : 'OK',
      Status: r.failures.length === 0 ? 'PASS' : 'FAIL'
    }))
  );

  if (failures.length > 0) {
    console.error('\n❌ AUDIT FAILED WITH VIOLATIONS:');
    for (const f of failures) {
      console.error(`\n[${f.label}]`);
      for (const issue of f.issues) {
        console.error(`  - ${issue}`);
      }
    }
    process.exit(1);
  } else {
    console.log(
      '\n✅ All SEO, metadata, broken link, and Lighthouse quality checks PASSED successfully!'
    );
    process.exit(0);
  }
}

runAudit().catch((err) => {
  console.error('[audit] Fatal error in audit runner:', err);
  process.exit(1);
});

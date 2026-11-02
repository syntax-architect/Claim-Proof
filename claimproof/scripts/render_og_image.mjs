import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function renderOgImage() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1
  });

  const svgPath = path.join(root, 'public', 'og-image.svg');
  const svgContent = fs.readFileSync(svgPath, 'utf8');

  // Load the svg in page
  await page.setContent(`<!DOCTYPE html><html><head><style>html,body{margin:0;padding:0;overflow:hidden;background:#0B0C0E;}</style></head><body>${svgContent}</body></html>`);

  const pngPath = path.join(root, 'public', 'og-image.png');
  await page.screenshot({ path: pngPath, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  console.log('Saved', pngPath);

  // Also copy to site/public if site directory exists
  const siteOgPng = path.resolve(root, '../site/public/og-image.png');
  if (fs.existsSync(path.dirname(siteOgPng))) {
    fs.copyFileSync(pngPath, siteOgPng);
    console.log('Copied to', siteOgPng);
  }

  await browser.close();
}

renderOgImage().catch((err) => {
  console.error(err);
  process.exit(1);
});

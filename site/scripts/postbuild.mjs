import { existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'dist');
const sitemapIndexPath = join(distDir, 'sitemap-index.xml');
const sitemap0Path = join(distDir, 'sitemap-0.xml');
const sitemapPath = join(distDir, 'sitemap.xml');

// If sitemap.xml doesn't exist, create it as a copy of sitemap-index.xml or sitemap-0.xml
if (!existsSync(sitemapPath)) {
  if (existsSync(sitemapIndexPath)) {
    copyFileSync(sitemapIndexPath, sitemapPath);
    console.log('[postbuild] Created dist/sitemap.xml from sitemap-index.xml');
  } else if (existsSync(sitemap0Path)) {
    copyFileSync(sitemap0Path, sitemapPath);
    console.log('[postbuild] Created dist/sitemap.xml from sitemap-0.xml');
  }
}

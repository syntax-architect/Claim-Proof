import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const appDir = join(import.meta.dirname, '..', '..');
const distDir = join(appDir, 'dist');

describe('Production build verification', () => {
  it('proves production builds contain no activateDemoPlan or un-gated demo license buttons', () => {
    execSync('npm run build', {
      cwd: appDir,
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'production' }
    });

    expect(existsSync(distDir)).toBe(true);

    const matches: string[] = [];

    function searchDir(dir: string) {
      const files = readdirSync(dir);
      for (const file of files) {
        const fullPath = join(dir, file);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          searchDir(fullPath);
        } else if (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.html')) {
          const content = readFileSync(fullPath, 'utf8');
          if (content.includes('activateDemoPlan')) {
            matches.push(`${file} contains activateDemoPlan`);
          }
          if (content.includes('Try without paying (demo license)')) {
            matches.push(`${file} contains "Try without paying (demo license)"`);
          }
        }
      }
    }

    searchDir(distDir);
    expect(matches).toEqual([]);
  }, 30000);

  it('proves service worker is versioned automatically at build time with pre-cached assets', () => {
    const swPath = join(distDir, 'sw.js');
    expect(existsSync(swPath)).toBe(true);

    const swContent = readFileSync(swPath, 'utf8');
    expect(swContent).not.toContain('__SW_VERSION__');
    expect(swContent).toMatch(/CACHE = 'saboot-v\d+'/);
    expect(swContent).toContain('/assets/index-');
    expect(swContent).toContain('SKIP_WAITING');
  });

  it('proves code-split chunk sizes do not exceed 500 kB limit', () => {
    const assetsDir = join(distDir, 'assets');
    expect(existsSync(assetsDir)).toBe(true);

    const files = readdirSync(assetsDir);
    for (const file of files) {
      if (file.endsWith('.js') && !file.includes('pdf.worker')) {
        const stats = statSync(join(assetsDir, file));
        const sizeKb = stats.size / 1024;
        expect(sizeKb).toBeLessThanOrEqual(500);
      }
    }
  });
});

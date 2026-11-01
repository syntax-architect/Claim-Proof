#!/usr/bin/env node
/* Verifies that production builds do not contain activateDemoPlan or demo license buttons.
 * Greps dist/ directory and exits with code 1 if any references are found. */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const distDir = join(process.cwd(), 'dist');

if (!existsSync(distDir)) {
  console.log('dist/ not found, building for production...');
  execSync('npm run build', { stdio: 'inherit' });
}

console.log('Auditing dist/ for forbidden demo license references...');

const forbiddenPatterns = [
  'activateDemoPlan',
  'Try without paying (demo license)'
];

const foundViolations = [];

function checkDirectory(dir) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      checkDirectory(fullPath);
    } else if (/\.(js|mjs|html|css)$/i.test(entry)) {
      const content = readFileSync(fullPath, 'utf8');
      for (const pattern of forbiddenPatterns) {
        if (content.includes(pattern)) {
          foundViolations.push({ file: fullPath, pattern });
        }
      }
    }
  }
}

checkDirectory(distDir);

if (foundViolations.length > 0) {
  console.error('FAILED: Found forbidden demo references in production build:');
  for (const v of foundViolations) {
    console.error(`  - Pattern "${v.pattern}" found in ${v.file}`);
  }
  process.exit(1);
}

console.log('PASSED: No activateDemoPlan or demo license references in dist/.');
process.exit(0);

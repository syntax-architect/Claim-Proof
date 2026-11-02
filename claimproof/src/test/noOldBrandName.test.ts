import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

describe('Old Product Name Absence Guard', () => {
  const OLD_PRODUCT_NAME = 'ClaimProof';
  const rootDir = process.cwd();
  const srcDir = existsSync(join(rootDir, 'src')) ? join(rootDir, 'src') : resolve(__dirname, '..');
  const publicDir = existsSync(join(rootDir, 'public'))
    ? join(rootDir, 'public')
    : resolve(__dirname, '../../public');

  function getFilesRecursively(dir: string): string[] {
    if (!existsSync(dir)) return [];
    const entries = readdirSync(dir);
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...getFilesRecursively(fullPath));
      } else if (stat.isFile()) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('ensures public/ has zero occurrences of the old product name (case-insensitive)', () => {
    const publicFiles = getFilesRecursively(publicDir);
    expect(publicFiles.length).toBeGreaterThan(0);

    const violations: { file: string; line: number; match: string }[] = [];

    for (const file of publicFiles) {
      if (/\.(png|ico|webp|jpg|jpeg|woff2?|ttf|eot)$/i.test(file)) continue;

      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((lineText, idx) => {
        if (/claimproof/i.test(lineText)) {
          violations.push({
            file: relative(publicDir, file),
            line: idx + 1,
            match: lineText.trim()
          });
        }
      });
    }

    expect(
      violations,
      `Found old product name references in public/:\n${JSON.stringify(violations, null, 2)}`
    ).toEqual([]);
  });

  it('ensures user-facing components, pages, and styles in src/ have zero occurrences of old product name', () => {
    const uiDirs = ['components', 'pages', 'styles', 'providers'].map((d) => join(srcDir, d));
    const uiFiles = uiDirs.flatMap((d) => getFilesRecursively(d));
    expect(uiFiles.length).toBeGreaterThan(0);

    const violations: { file: string; line: number; match: string }[] = [];

    for (const file of uiFiles) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((lineText, idx) => {
        if (/claimproof/i.test(lineText)) {
          violations.push({
            file: relative(srcDir, file),
            line: idx + 1,
            match: lineText.trim()
          });
        }
      });
    }

    expect(
      violations,
      `Found old product name references in UI/Components/Pages:\n${JSON.stringify(violations, null, 2)}`
    ).toEqual([]);
  });

  it('ensures the old product brand name "ClaimProof" does not appear anywhere in src/ except legacy migration files', () => {
    const allSrcFiles = getFilesRecursively(srcDir);
    expect(allSrcFiles.length).toBeGreaterThan(0);

    const ALLOWED_MIGRATION_FILES = new Set([
      'config/brand.ts',
      'db/schema.ts',
      'lib/upi.ts',
      'lib/upi.test.ts',
      'test/brandMigration.test.ts',
      'test/noOldBrandName.test.ts'
    ]);

    const violations: { file: string; line: number; match: string }[] = [];

    for (const file of allSrcFiles) {
      const relPath = relative(srcDir, file).replace(/\\/g, '/');
      if (ALLOWED_MIGRATION_FILES.has(relPath)) continue;

      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((lineText, idx) => {
        if (new RegExp(OLD_PRODUCT_NAME, 'i').test(lineText)) {
          violations.push({
            file: relPath,
            line: idx + 1,
            match: lineText.trim()
          });
        }
      });
    }

    expect(
      violations,
      `Found unexpected old product name in src/:\n${JSON.stringify(violations, null, 2)}`
    ).toEqual([]);
  });
});

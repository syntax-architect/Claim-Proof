import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

/**
 * Scans src/ and public/ for unprovable claims, invented outcome guarantees,
 * and banned buzzwords:
 * - guarantee (guaranteed, guarantees, guarantee)
 * - overturn (overturn, overturns, overturned, overturning)
 * - 100% (unprovable claims: 100% on-device, 100% private, 100% free, 100% refund, etc.)
 * - forensic (forensic, forensics)
 * - tamperproof (tamperproof, tamper-proof, tamper proof)
 * - win rate (win rate, win-rate)
 * - approval rate (approval rate, approval-rate)
 */
describe('Unprovable Claims & Banned Words Guard', () => {
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

  const BINARY_EXTENSIONS = /\.(png|ico|webp|jpg|jpeg|woff2?|ttf|eot|mp4|webm|zip|gz|pdf)$/i;

  interface Violation {
    file: string;
    line: number;
    term: string;
    text: string;
  }

  // Exact banned patterns for absolute terms that must NEVER appear in copy, code, comments, or UI
  const STRICT_BANNED_RULES: { name: string; pattern: RegExp }[] = [
    { name: 'guarantee', pattern: /\bguarantee(s|d)?\b/i },
    { name: 'overturn', pattern: /\boverturn(s|ed|ing)?\b/i },
    { name: 'forensic', pattern: /\bforensic(s)?\b/i },
    { name: 'tamperproof', pattern: /\btamper[- ]?proof\b/i },
    { name: 'win rate', pattern: /\bwin[- ]rate\b/i },
    { name: 'approval rate', pattern: /\bapproval[- ]rate\b/i }
  ];

  // For 100%, match claims/promises (e.g. 100% local, 100% private, 100% offline, 100% free, 100% refund, 100% on-device)
  // while allowing standard CSS/SVG layout dimensions (width: 100%, height: 100%, size-adjust: 100%, stop offset="100%", @keyframes 100%)
  const CLAIM_100_PERCENT = /\b100\s*%\s*(?:local|offline|private|free|refund|on-device|guaranteed|transparent|pure|cotton|awb|serverless|payout|approval|claim|[a-zA-Z]+)/i;

  it('ensures src/ has ZERO occurrences of banned words and unprovable claims', () => {
    const srcFiles = getFilesRecursively(srcDir);
    expect(srcFiles.length).toBeGreaterThan(0);

    const violations: Violation[] = [];
    const currentTestFileName = 'unprovableClaims.test.ts';

    for (const file of srcFiles) {
      if (file.endsWith(currentTestFileName)) continue;
      if (BINARY_EXTENSIONS.test(file)) continue;

      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((lineText, idx) => {
        // Check strict banned terms
        for (const rule of STRICT_BANNED_RULES) {
          if (rule.pattern.test(lineText)) {
            violations.push({
              file: relative(srcDir, file),
              line: idx + 1,
              term: rule.name,
              text: lineText.trim()
            });
          }
        }

        // Check 100% unprovable claims
        if (CLAIM_100_PERCENT.test(lineText)) {
          violations.push({
            file: relative(srcDir, file),
            line: idx + 1,
            term: '100% unprovable claim',
            text: lineText.trim()
          });
        }
      });
    }

    expect(
      violations,
      `Found banned words or unprovable claims in src/:\n${JSON.stringify(violations, null, 2)}`
    ).toEqual([]);
  });

  it('ensures public/ has ZERO occurrences of banned words and unprovable claims', () => {
    const publicFiles = getFilesRecursively(publicDir);
    expect(publicFiles.length).toBeGreaterThan(0);

    const violations: Violation[] = [];

    for (const file of publicFiles) {
      if (BINARY_EXTENSIONS.test(file)) continue;

      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((lineText, idx) => {
        // Check strict banned terms
        for (const rule of STRICT_BANNED_RULES) {
          if (rule.pattern.test(lineText)) {
            violations.push({
              file: relative(publicDir, file),
              line: idx + 1,
              term: rule.name,
              text: lineText.trim()
            });
          }
        }

        // Check 100% unprovable claims
        if (CLAIM_100_PERCENT.test(lineText)) {
          violations.push({
            file: relative(publicDir, file),
            line: idx + 1,
            term: '100% unprovable claim',
            text: lineText.trim()
          });
        }
      });
    }

    expect(
      violations,
      `Found banned words or unprovable claims in public/:\n${JSON.stringify(violations, null, 2)}`
    ).toEqual([]);
  });
});

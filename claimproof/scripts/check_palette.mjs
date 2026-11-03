#!/usr/bin/env node
/**
 * Palette Audit Guard — ClaimProof / SABOOT Suite
 *
 * Verifies that the entire codebase adheres strictly to the Obsidian & Champagne
 * palette. Disallows deprecated Tailwind color utilities (blue, sky, cyan, emerald, etc.)
 * and unapproved raw hex/rgb/rgba/hsl values.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = fs.existsSync(path.resolve(__dirname, '../src'))
  ? path.resolve(__dirname, '..')
  : path.resolve(__dirname, '../claimproof');

// Approved Hex Colors in the Obsidian & Champagne Palette
const APPROVED_HEXES = new Set(
  [
    // Dark Theme Surfaces & Base
    '#0B0C0E', '#121316', '#181A1F', '#22252B',
    // Dark Theme Text
    '#F2EFE8', '#A9A59B', '#8F8B82',
    // Dark Theme Accents (Champagne / Gold)
    '#D4B483', '#E3C896', '#C9A45C', '#B8923F', '#14110A',
    // Dark Theme Status Text
    '#6CC29A', '#E39A4F', '#E88A82', '#9DB1C6',

    // Light Theme Surfaces & Base
    '#FAF8F4', '#FFFFFF', '#FFF', '#F3F0EA', '#E8E3DA',
    // Light Theme Text
    '#15130F', '#55504A', '#6B655D',
    // Light Theme Accents
    '#9A7428', '#7A5A1B', '#5F4512',
    // Light Theme Status Text
    '#2F7A55', '#9A5A12', '#B3382F', '#476178',

    // Fixed Status Fills (Dots, Bars, Badges)
    '#C9812F', '#D9534A', '#4FA37A', '#7F96AD'
  ].map((h) => h.toUpperCase())
);

// Scan targets relative to rootDir
const TARGET_DIRS = ['src', 'public', 'extension'];
const TARGET_FILES = ['index.html'];

// Disallowed Tailwind color utility names
const DISALLOWED_TAILWIND_REGEX =
  /\b(bg|text|border|ring|fill|stroke|from|to|via)-(blue|sky|cyan|indigo|violet|purple|fuchsia|pink|rose|emerald|green|teal|lime|yellow|orange)(?:-[0-9]{2,3})?(?:\/[0-9]+)?\b/i;

// Binary & generated extensions to ignore
const IGNORED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.ico', '.woff', '.woff2',
  '.ttf', '.eot', '.pdf', '.avif', '.mp4', '.zip'
]);

function isIgnored(filePath) {
  const rel = path.relative(rootDir, filePath).replace(/\\/g, '/');
  if (
    rel.includes('node_modules/') ||
    rel.includes('dist/') ||
    rel.includes('dist-extension/') ||
    rel.includes('coverage/') ||
    rel.includes('test-results/') ||
    rel.includes('playwright-report/') ||
    rel.includes('tests/fixtures/')
  ) {
    return true;
  }
  const ext = path.extname(filePath).toLowerCase();
  return IGNORED_EXTENSIONS.has(ext);
}

function collectFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    if (isIgnored(fullPath)) continue;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(collectFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

const allFiles = [
  ...TARGET_FILES.map((f) => path.join(rootDir, f)).filter((f) => fs.existsSync(f)),
  ...TARGET_DIRS.flatMap((d) => collectFiles(path.join(rootDir, d)))
];

const violations = [];

for (const file of allFiles) {
  const relPath = path.relative(rootDir, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    // 1. Tailwind utilities check
    const twMatch = trimmed.match(DISALLOWED_TAILWIND_REGEX);
    if (twMatch) {
      violations.push({
        file: relPath,
        line: lineNum,
        type: 'tailwind',
        matched: twMatch[0],
        snippet: trimmed
      });
    }

    // 2. Hex color check
    const hexMatches = line.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    for (const hex of hexMatches) {
      if (hex.length === 4 || hex.length === 7 || hex.length === 9) {
        const upper = hex.toUpperCase();
        if (!APPROVED_HEXES.has(upper)) {
          // Allow #FFFFFF in .qr-plate or QR generation
          if ((upper === '#FFFFFF' || upper === '#FFF') && trimmed.includes('qr-plate')) {
            continue;
          }
          violations.push({
            file: relPath,
            line: lineNum,
            type: 'hex',
            matched: hex,
            snippet: trimmed
          });
        }
      }
    }

    // 3. rgb/rgba/hsl check
    const colorFnMatches = line.match(/\b(?:rgba?|hsla?)\([^)]+\)/gi) || [];
    for (const colorFn of colorFnMatches) {
      // Allowlist rgb(0,0,0) in sample PDF generator or test fixtures
      if (/rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)/i.test(colorFn) && (
        relPath.includes('pdfLabelProcessor') ||
        relPath.includes('SmartLabelWorkbench') ||
        relPath.includes('make_sample_labels') ||
        relPath.includes('.test.')
      )) {
        continue;
      }
      // Allowlist pdf-lib vector drawing in pdfLabelProcessor / test fixtures
      if (relPath.includes('pdfLabelProcessor') || relPath.includes('claimSummaryPdf') || relPath.includes('.test.')) {
        if (/rgb\(\s*[0-9.]+\s*,\s*[0-9.]+\s*,\s*[0-9.]+\s*\)/i.test(colorFn)) {
          continue;
        }
      }
      // Allowlist standard neutral/glass alpha overlays:
      // rgba(0, 0, 0, ...), rgba(255, 255, 255, ...), or palette rgba definitions
      if (/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*[0-9.]+\s*\)/i.test(colorFn)) continue;
      if (/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*[0-9.]+\s*\)/i.test(colorFn)) continue;
      // Allowlist recording danger pulse (red border)
      if (/rgba\(\s*239\s*,\s*68\s*,\s*68\s*,\s*[^)]+\)/i.test(colorFn)) continue;
      if (/rgba\(\s*217\s*,\s*83\s*,\s*74\s*,\s*[^)]+\)/i.test(colorFn)) continue;
      // Allowlist palette alpha tokens:
      // Champagne/Gold accents: rgba(212, 180, 131, ...), rgba(201, 164, 92, ...), rgba(154, 116, 40, ...)
      if (/rgba\(\s*212\s*,\s*180\s*,\s*131\s*,\s*[^)]+\)/i.test(colorFn)) continue;
      if (/rgba\(\s*201\s*,\s*164\s*,\s*92\s*,\s*[^)]+\)/i.test(colorFn)) continue;
      if (/rgba\(\s*154\s*,\s*116\s*,\s*40\s*,\s*[^)]+\)/i.test(colorFn)) continue;
      // Surfaces / Lines: rgba(232, 226, 212, ...), rgba(21, 19, 15, ...), rgba(18, 19, 22, ...)
      if (/rgba\(\s*232\s*,\s*226\s*,\s*212\s*,\s*[^)]+\)/i.test(colorFn)) continue;
      if (/rgba\(\s*21\s*,\s*19\s*,\s*15\s*,\s*[^)]+\)/i.test(colorFn)) continue;
      if (/rgba\(\s*18\s*,\s*19\s*,\s*22\s*,\s*[^)]+\)/i.test(colorFn)) continue;
      // Hero ambient glows: rgba(157, 177, 198, ...), rgba(71, 97, 120, ...)
      if (/rgba\(\s*157\s*,\s*177\s*,\s*198\s*,\s*[^)]+\)/i.test(colorFn)) continue;
      if (/rgba\(\s*71\s*,\s*97\s*,\s*120\s*,\s*[^)]+\)/i.test(colorFn)) continue;
      // Status fills with alpha:
      if (/rgba\(\s*227\s*,\s*154\s*,\s*79\s*,\s*[^)]+\)/i.test(colorFn)) continue;
      if (/rgba\(\s*79\s*,\s*163\s*,\s*122\s*,\s*[^)]+\)/i.test(colorFn)) continue;
      if (/rgba\(\s*108\s*,\s*194\s*,\s*154\s*,\s*[^)]+\)/i.test(colorFn)) continue;
      if (/rgba\(\s*127\s*,\s*150\s*,\s*173\s*,\s*[^)]+\)/i.test(colorFn)) continue;

      violations.push({
        file: relPath,
        line: lineNum,
        type: 'function',
        matched: colorFn,
        snippet: trimmed
      });
    }
  });
}

if (violations.length > 0) {
  console.error(`\n❌ Palette Audit Failed! Found ${violations.length} violation(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} [${v.type}: ${v.matched}]`);
    console.error(`    ${v.snippet}\n`);
  }
  process.exit(1);
} else {
  console.log(`\n✅ Palette Audit Passed: All scanned files strictly adhere to the Obsidian & Champagne palette (${allFiles.length} files scanned).\n`);
  process.exit(0);
}

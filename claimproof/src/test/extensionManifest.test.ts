import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const MANIFEST_PATH = join(ROOT_DIR, 'extension', 'manifest.json');
const BACKGROUND_PATH = join(ROOT_DIR, 'extension', 'background.js');
const ZIP_PATH = join(ROOT_DIR, 'dist-extension', 'saboot-extension.zip');

const BANNED_BRANDS = [
  /\bmeesho\b/i,
  /\bflipkart\b/i,
  /\bamazon\b/i,
  /\bmyntra\b/i,
  /\bajio\b/i,
  /\bsnapdeal\b/i
];

describe('Chrome Extension MV3 Specification & Build Verification', () => {
  it('has a valid Manifest V3 manifest.json with minimal permissions and zero host permissions', () => {
    expect(existsSync(MANIFEST_PATH)).toBe(true);
    const content = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));

    // 1. Must be MV3
    expect(content.manifest_version).toBe(3);

    // 2. Name must not contain marketplace brand names and must adhere to 45-character limit
    expect(content.name.length).toBeLessThanOrEqual(45);
    for (const banned of BANNED_BRANDS) {
      expect(banned.test(content.name)).toBe(false);
      if (content.short_name) {
        expect(banned.test(content.short_name)).toBe(false);
      }
    }

    // 3. Zero host permissions
    if (content.host_permissions) {
      expect(content.host_permissions).toEqual([]);
    }

    // 4. Minimal permissions (camera must NOT be declared in manifest)
    const permissions = content.permissions || [];
    expect(permissions).not.toContain('camera');
    expect(permissions).not.toContain('<all_urls>');
    expect(permissions).not.toContain('webRequest');
    expect(permissions).not.toContain('cookies');

    // 5. Background service worker registered
    expect(content.background).toBeDefined();
    expect(content.background.service_worker).toBe('background.js');

    // 6. Action configured
    expect(content.action).toBeDefined();
    expect(content.action.default_title).toBeDefined();
  });

  it('background.js handles chrome.action.onClicked to open app in a tab', () => {
    expect(existsSync(BACKGROUND_PATH)).toBe(true);
    const bgContent = readFileSync(BACKGROUND_PATH, 'utf8');

    expect(bgContent).toContain('chrome.action.onClicked.addListener');
    expect(bgContent).toContain('chrome.runtime.getURL');
    expect(bgContent).toContain('index.html');
  });

  it('build_extension script produces valid Chrome Web Store ZIP package', () => {
    // Run build script
    execSync('node scripts/build_extension.mjs', { cwd: ROOT_DIR, stdio: 'pipe' });

    expect(existsSync(ZIP_PATH)).toBe(true);
    const zipBytes = readFileSync(ZIP_PATH);
    expect(zipBytes.length).toBeGreaterThan(10000);

    // Verify PKZIP magic bytes 0x50 0x4B 0x03 0x04 ('PK\x03\x04')
    expect(zipBytes[0]).toBe(0x50);
    expect(zipBytes[1]).toBe(0x4b);
    expect(zipBytes[2]).toBe(0x03);
    expect(zipBytes[3]).toBe(0x04);
  }, 60000);
});

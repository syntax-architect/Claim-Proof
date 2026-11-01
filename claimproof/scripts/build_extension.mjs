#!/usr/bin/env node
/* ClaimProof Suite — Chrome Extension (MV3) Build & Packager Script.
 * Prepares and packages an MV3 extension zip ready for upload to the Chrome Web Store.
 *
 * Rules:
 * 1. Opens app in a tab via background.js chrome.action.onClicked.
 * 2. Zero host permissions (host_permissions is empty/absent).
 * 3. Minimal permissions (no camera permission in manifest; requested at runtime via Web API).
 * 4. Zero marketplace brand names in extension name/short_name.
 */

import { execSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');
const EXT_SRC_DIR = join(ROOT_DIR, 'extension');
const DIST_WEB_DIR = join(ROOT_DIR, 'dist');
const STAGING_DIR = join(ROOT_DIR, 'dist-extension');
const OUTPUT_ZIP = join(STAGING_DIR, 'claimproof-extension.zip');

const BANNED_BRAND_PATTERNS = [
  /\bmeesho\b/i,
  /\bflipkart\b/i,
  /\bamazon\b/i,
  /\bmyntra\b/i,
  /\bajio\b/i,
  /\bsnapdeal\b/i
];

console.log('🚀 [ClaimProof] Building Chrome Web Store MV3 Extension...');

// 1. Ensure Vite production build exists
if (!existsSync(DIST_WEB_DIR) || !existsSync(join(DIST_WEB_DIR, 'index.html'))) {
  console.log('📦 Running web production build first...');
  execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });
}

// 2. Validate extension/manifest.json
const manifestPath = join(EXT_SRC_DIR, 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error('❌ Missing extension/manifest.json at:', manifestPath);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

// Check MV3
if (manifest.manifest_version !== 3) {
  console.error(`❌ manifest_version must be 3, found: ${manifest.manifest_version}`);
  process.exit(1);
}

// Check brand names in name & short_name
for (const pattern of BANNED_BRAND_PATTERNS) {
  if (pattern.test(manifest.name)) {
    console.error(`❌ Extension name contains marketplace brand name: "${manifest.name}"`);
    process.exit(1);
  }
  if (manifest.short_name && pattern.test(manifest.short_name)) {
    console.error(`❌ Extension short_name contains marketplace brand name: "${manifest.short_name}"`);
    process.exit(1);
  }
}

// Check host_permissions (MUST be empty or omitted)
if (manifest.host_permissions && manifest.host_permissions.length > 0) {
  console.error('❌ host_permissions must be empty or absent. Found:', manifest.host_permissions);
  process.exit(1);
}

// Check permissions (camera must NOT be present; requested at runtime)
if (Array.isArray(manifest.permissions)) {
  if (manifest.permissions.includes('camera')) {
    console.error('❌ "camera" permission must not be declared in manifest (it is requested at runtime).');
    process.exit(1);
  }
  if (manifest.permissions.includes('<all_urls>') || manifest.permissions.includes('*://*/*')) {
    console.error('❌ Broad host wildcards not allowed in permissions.');
    process.exit(1);
  }
}

console.log('✅ Extension Manifest V3 validated successfully.');
console.log(`   Name: "${manifest.name}"`);
console.log(`   Short Name: "${manifest.short_name || manifest.name}"`);
console.log(`   Version: ${manifest.version}`);
console.log(`   Permissions: [${(manifest.permissions || []).join(', ')}]`);
console.log(`   Host Permissions: none`);

// 3. Prepare clean staging directory
if (existsSync(STAGING_DIR)) {
  rmSync(STAGING_DIR, { recursive: true, force: true });
}
mkdirSync(STAGING_DIR, { recursive: true });

const packageDir = join(STAGING_DIR, 'unpacked');
mkdirSync(packageDir, { recursive: true });

// 4. Copy build artifacts into unpacked package
// Copy HTML
cpSync(join(DIST_WEB_DIR, 'index.html'), join(packageDir, 'index.html'));

// Copy Assets (JS/CSS chunks)
if (existsSync(join(DIST_WEB_DIR, 'assets'))) {
  cpSync(join(DIST_WEB_DIR, 'assets'), join(packageDir, 'assets'), { recursive: true });
}

// Copy Icons
const iconsSrcDir = join(ROOT_DIR, 'public', 'icons');
const iconsDestDir = join(packageDir, 'icons');
mkdirSync(iconsDestDir, { recursive: true });
if (existsSync(iconsSrcDir)) {
  cpSync(iconsSrcDir, iconsDestDir, { recursive: true });
}

// Copy Extension specific files
cpSync(manifestPath, join(packageDir, 'manifest.json'));
cpSync(join(EXT_SRC_DIR, 'background.js'), join(packageDir, 'background.js'));

// Favicon if present
const faviconSrc = join(ROOT_DIR, 'public', 'favicon.svg');
if (existsSync(faviconSrc)) {
  cpSync(faviconSrc, join(packageDir, 'favicon.svg'));
}

console.log('✅ Staged unpacked extension files in:', packageDir);

// 5. Build ZIP archive for Chrome Web Store upload (Pure Node PKZIP)
function collectFiles(dir) {
  const results = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      results.push(...collectFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

const allFiles = collectFiles(packageDir);
const zipEntries = allFiles.map((file) => {
  const relPath = relative(packageDir, file).replace(/\\/g, '/');
  const data = readFileSync(file);
  return { name: relPath, data };
});

function writeZip(entries, outPath) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = zlib.crc32(data);
    const compressed = zlib.deflateRawSync(data);

    // Local Header (30 bytes + name)
    const lh = Buffer.alloc(30 + nameBuf.length);
    lh.writeUInt32LE(0x04034b50, 0); // Local header signature
    lh.writeUInt16LE(20, 4);         // Version needed: 2.0
    lh.writeUInt16LE(0, 6);          // General purpose bit flag
    lh.writeUInt16LE(8, 8);          // Compression method: Deflate
    lh.writeUInt16LE(0, 10);         // Last mod file time
    lh.writeUInt16LE(0, 12);         // Last mod file date
    lh.writeUInt32LE(crc, 14);       // CRC-32
    lh.writeUInt32LE(compressed.length, 18); // Compressed size
    lh.writeUInt32LE(data.length, 22);       // Uncompressed size
    lh.writeUInt16LE(nameBuf.length, 26);    // Filename length
    lh.writeUInt16LE(0, 28);                 // Extra field length
    nameBuf.copy(lh, 30);

    localHeaders.push(lh, compressed);

    // Central Directory Header (46 bytes + name)
    const ch = Buffer.alloc(46 + nameBuf.length);
    ch.writeUInt32LE(0x02014b50, 0); // Central directory signature
    ch.writeUInt16LE(20, 4);         // Version made by
    ch.writeUInt16LE(20, 6);         // Version needed
    ch.writeUInt16LE(0, 8);          // Flags
    ch.writeUInt16LE(8, 10);         // Compression: Deflate
    ch.writeUInt16LE(0, 12);         // Mod time
    ch.writeUInt16LE(0, 14);         // Mod date
    ch.writeUInt32LE(crc, 16);       // CRC-32
    ch.writeUInt32LE(compressed.length, 20); // Compressed size
    ch.writeUInt32LE(data.length, 24);       // Uncompressed size
    ch.writeUInt16LE(nameBuf.length, 28);    // Filename length
    ch.writeUInt16LE(0, 30);                 // Extra field length
    ch.writeUInt16LE(0, 32);                 // Comment length
    ch.writeUInt16LE(0, 34);                 // Disk number
    ch.writeUInt16LE(0, 36);                 // Internal file attributes
    ch.writeUInt32LE(0, 38);                 // External file attributes
    ch.writeUInt32LE(offset, 42);            // Relative offset of local header
    nameBuf.copy(ch, 46);

    centralHeaders.push(ch);
    offset += lh.length + compressed.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const ch of centralHeaders) centralDirSize += ch.length;

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);       // EOCD signature
  eocd.writeUInt16LE(0, 4);                // Disk number
  eocd.writeUInt16LE(0, 6);                // Start disk number
  eocd.writeUInt16LE(entries.length, 8);    // Entries on disk
  eocd.writeUInt16LE(entries.length, 10);   // Total entries
  eocd.writeUInt32LE(centralDirSize, 12);   // Central directory size
  eocd.writeUInt32LE(centralDirOffset, 16); // Central directory offset
  eocd.writeUInt16LE(0, 20);               // Comment length

  const zipBuffer = Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
  writeFileSync(outPath, zipBuffer);
  return zipBuffer.length;
}

const zipBytes = writeZip(zipEntries, OUTPUT_ZIP);
const zipKb = (zipBytes / 1024).toFixed(1);

console.log(`📦 Created Chrome Web Store ZIP: ${OUTPUT_ZIP} (${zipKb} kB, ${zipEntries.length} files)`);
console.log('🎉 Extension build complete! Ready for Chrome Web Store submission.');


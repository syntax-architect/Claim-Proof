import fs from 'fs';
import path from 'path';

const ALLOWLIST_HEXES = new Set([
  // Dark Palette
  '#0B0C0E', '#121316', '#181A1F', '#22252B', '#F2EFE8',
  '#A9A59B', '#8F8B82', '#D4B483', '#E3C896', '#C9A45C',
  '#B8923F', '#14110A', '#6CC29A', '#E39A4F', '#E88A82',
  '#9DB1C6',
  // Light Palette
  '#FAF8F4', '#FFFFFF', '#FFF', '#F3F0EA', '#E8E3DA',
  '#15130F', '#55504A', '#6B655D', '#9A7428', '#7A5A1B',
  '#5F4512', '#2F7A55', '#9A5A12', '#B3382F', '#476178',
  // Fixed Status Fills
  '#C9812F', '#D9534A', '#4FA37A', '#7F96AD'
].map(h => h.toUpperCase()));

const dirs = ['claimproof/src', 'claimproof/public', 'claimproof/extension'];
const files = ['claimproof/index.html'];

function walk(dir) {
  let res = [];
  if (!fs.existsSync(dir)) return res;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== 'node_modules' && f !== 'dist' && f !== '.git' && f !== 'fixtures') {
        res = res.concat(walk(p));
      }
    } else {
      res.push(p);
    }
  }
  return res;
}

const allFiles = files.concat(...dirs.map(walk));
const nonAllowed = [];

for (const f of allFiles) {
  if (/\.(png|jpg|jpeg|webp|ico|woff2?|ttf|eot|pdf|avif)$/i.test(f)) continue;
  // Ignore generated/minified build outputs or fixtures if any
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, idx) => {
    // Check hexes
    const hexMatches = l.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    for (const h of hexMatches) {
      if (h.length === 4 || h.length === 7 || h.length === 9) {
        if (!ALLOWLIST_HEXES.has(h.toUpperCase())) {
          nonAllowed.push({ file: f, line: idx + 1, type: 'hex', val: h, lineText: l.trim() });
        }
      }
    }
  });
}

console.log('Total non-allowed hex findings:', nonAllowed.length);
nonAllowed.forEach(n => console.log(`${n.file}:${n.line} [${n.val}] -> ${n.lineText}`));

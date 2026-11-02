const fs = require('fs');
const path = require('path');

function update404(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');

  // Replace meta theme-color
  html = html.replace(
    '<meta name="theme-color" content="#0a0c12" />',
    '<meta name="theme-color" content="#0B0C0E" media="(prefers-color-scheme: dark)" />\n    <meta name="theme-color" content="#FAF8F4" media="(prefers-color-scheme: light)" />'
  );

  // Replace :root block with full Obsidian & Champagne dark & light palette
  const oldRootMatch = /:root\s*\{[\s\S]*?--cp-warn:\s*#fbbf24;\s*\}/;
  const newRoot = `:root {
        --cp-bg: #0B0C0E;
        --cp-surface: #121316;
        --cp-surface-2: #181A1F;
        --cp-surface-3: #22252B;
        --cp-line: rgba(232, 226, 212, 0.10);
        --cp-linestrong: rgba(232, 226, 212, 0.20);
        --cp-text: #F2EFE8;
        --cp-text-2: #A9A59B;
        --cp-text-3: #8F8B82;
        --cp-accent: #D4B483;
        --cp-accent-text: #E3C896;
        --cp-accentsolid: #C9A45C;
        --cp-accent-strong: #B8923F;
        --cp-accentsoft: rgba(212, 180, 131, 0.12);
        --cp-on-accent: #14110A;
        --cp-successtext: #6CC29A;
        --cp-warn-text: #E39A4F;
        --cp-danger-text: #E88A82;
        --cp-infotext: #9DB1C6;
        --cp-glass: rgba(18, 19, 22, 0.88);
        --cp-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
        --cp-hero-1: rgba(201, 164, 92, 0.07);
        --cp-hero2: rgba(157, 177, 198, 0.04);

        --cp-line-bright: var(--cp-linestrong);
        --cp-text-muted: var(--cp-text-2);
        --cp-text-subtle: var(--cp-text-3);
        --cp-accent-hover: var(--cp-accent-strong);
        --cp-warn: var(--cp-warn-text);
      }
      @media (prefers-color-scheme: light) {
        :root {
          --cp-bg: #FAF8F4;
          --cp-surface: #FFFFFF;
          --cp-surface-2: #F3F0EA;
          --cp-surface-3: #E8E3DA;
          --cp-line: rgba(21, 19, 15, 0.09);
          --cp-linestrong: rgba(21, 19, 15, 0.18);
          --cp-text: #15130F;
          --cp-text-2: #55504A;
          --cp-text-3: #6B655D;
          --cp-accent: #9A7428;
          --cp-accent-text: #7A5A1B;
          --cp-accentsolid: #7A5A1B;
          --cp-accent-strong: #5F4512;
          --cp-accentsoft: rgba(154, 116, 40, 0.10);
          --cp-on-accent: #FFFFFF;
          --cp-successtext: #2F7A55;
          --cp-warn-text: #9A5A12;
          --cp-danger-text: #B3382F;
          --cp-infotext: #476178;
          --cp-glass: rgba(255, 255, 255, 0.92);
          --cp-shadow: 0 0 0 1px rgba(21, 19, 15, 0.03), 0 1px 2px rgba(21, 19, 15, 0.04), 0 8px 24px -10px rgba(21, 19, 15, 0.10);
          --cp-hero-1: rgba(154, 116, 40, 0.07);
          --cp-hero2: rgba(71, 97, 120, 0.04);
        }
      }`;

  html = html.replace(oldRootMatch, newRoot);

  // Body background overlay
  html = html.replace(/rgba\(59,\s*130,\s*246,\s*0\.08\)/g, 'var(--cp-hero-1)');
  html = html.replace(/rgba\(148,\s*163,\s*184,\s*0\.08\)/g, 'var(--cp-line)');

  // Card
  html = html.replace('background: rgba(16, 19, 27, 0.88);', 'background: var(--cp-glass);');
  html = html.replace('box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);', 'box-shadow: var(--cp-shadow);');

  // Logo text
  html = html.replace(/color:\s*#ffffff;/g, 'color: var(--cp-text);');
  html = html.replace(/color:\s*#fff;/g, 'color: var(--cp-text);');
  html = html.replace(/color:\s*#60a5fa;/g, 'color: var(--cp-accent);');

  // Icon box & badge
  html = html.replace('background: rgba(251, 191, 36, 0.1);', 'background: var(--cp-accentsoft);');
  html = html.replace('border: 1px solid rgba(251, 191, 36, 0.25);', 'border: 1px solid var(--cp-linestrong);');
  html = html.replace('color: #fde68a;', 'color: var(--cp-warn-text);');
  html = html.replace('background: rgba(251, 191, 36, 0.12);', 'background: var(--cp-accentsoft);');
  html = html.replace('border: 1px solid rgba(251, 191, 36, 0.3);', 'border: 1px solid var(--cp-linestrong);');

  // path-box
  html = html.replace('background: rgba(23, 27, 38, 0.75);', 'background: var(--cp-surface-2);');
  html = html.replace('color: #cbd5e1;', 'color: var(--cp-text-2);');

  // Buttons
  html = html.replace('background: var(--cp-accent);\n        color: var(--cp-text);', 'background: var(--cp-accentsolid);\n        color: var(--cp-on-accent);');
  html = html.replace('background: rgba(23, 27, 38, 0.8);', 'background: var(--cp-surface-2);');
  html = html.replace('background: rgba(32, 38, 52, 0.8);', 'background: var(--cp-surface-3);');

  // Support link
  html = html.replace('color: #93c5fd;', 'color: var(--cp-accent);');

  // SVG inside 404.html
  html = html.replace('fill="#10131B" stroke="#1B2432"', 'fill="var(--cp-surface)" stroke="var(--cp-surface-3)"');
  html = html.replace('stroke="#3B82F6"', 'stroke="var(--cp-accent)"');
  html = html.replace('stroke="#93C5FD"', 'stroke="var(--cp-accent-text)"');
  html = html.replace('fill="#FBBF24"', 'fill="var(--cp-accentsolid)"');

  fs.writeFileSync(filePath, html);
  console.log('Updated', filePath);
}

function updateLanding(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');

  // Replace meta theme-color
  html = html.replace(
    '<meta name="theme-color" content="#0a0c12" />',
    '<meta name="theme-color" content="#0B0C0E" media="(prefers-color-scheme: dark)" />\n    <meta name="theme-color" content="#FAF8F4" media="(prefers-color-scheme: light)" />'
  );

  // Replace :root block with full Obsidian & Champagne dark & light palette
  const oldRootMatch = /:root\s*\{[\s\S]*?--cp-success:\s*#22c55e;\s*\}/;
  const newRoot = `:root {
        --cp-bg: #0B0C0E;
        --cp-surface: #121316;
        --cp-surface-2: #181A1F;
        --cp-surface-3: #22252B;
        --cp-line: rgba(232, 226, 212, 0.10);
        --cp-linestrong: rgba(232, 226, 212, 0.20);
        --cp-text: #F2EFE8;
        --cp-text-2: #A9A59B;
        --cp-text-3: #8F8B82;
        --cp-accent: #D4B483;
        --cp-accent-text: #E3C896;
        --cp-accentsolid: #C9A45C;
        --cp-accent-strong: #B8923F;
        --cp-accentsoft: rgba(212, 180, 131, 0.12);
        --cp-on-accent: #14110A;
        --cp-successtext: #6CC29A;
        --cp-warn-text: #E39A4F;
        --cp-danger-text: #E88A82;
        --cp-infotext: #9DB1C6;
        --cp-glass: rgba(18, 19, 22, 0.88);
        --cp-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
        --cp-hero-1: rgba(201, 164, 92, 0.07);
        --cp-hero2: rgba(157, 177, 198, 0.04);

        /* Semantic compatibility mappings */
        --cp-surface-hover: var(--cp-surface-3);
        --cp-line-bright: var(--cp-linestrong);
        --cp-text-muted: var(--cp-text-2);
        --cp-text-subtle: var(--cp-text-3);
        --cp-accent-hover: var(--cp-accent-strong);
        --cp-accent-light: var(--cp-accent-text);
        --cp-warn: var(--cp-warn-text);
        --cp-danger: var(--cp-danger-text);
        --cp-success: var(--cp-successtext);
      }
      @media (prefers-color-scheme: light) {
        :root {
          --cp-bg: #FAF8F4;
          --cp-surface: #FFFFFF;
          --cp-surface-2: #F3F0EA;
          --cp-surface-3: #E8E3DA;
          --cp-line: rgba(21, 19, 15, 0.09);
          --cp-linestrong: rgba(21, 19, 15, 0.18);
          --cp-text: #15130F;
          --cp-text-2: #55504A;
          --cp-text-3: #6B655D;
          --cp-accent: #9A7428;
          --cp-accent-text: #7A5A1B;
          --cp-accentsolid: #7A5A1B;
          --cp-accent-strong: #5F4512;
          --cp-accentsoft: rgba(154, 116, 40, 0.10);
          --cp-on-accent: #FFFFFF;
          --cp-successtext: #2F7A55;
          --cp-warn-text: #9A5A12;
          --cp-danger-text: #B3382F;
          --cp-infotext: #476178;
          --cp-glass: rgba(255, 255, 255, 0.92);
          --cp-shadow: 0 0 0 1px rgba(21, 19, 15, 0.03), 0 1px 2px rgba(21, 19, 15, 0.04), 0 8px 24px -10px rgba(21, 19, 15, 0.10);
          --cp-hero-1: rgba(154, 116, 40, 0.07);
          --cp-hero2: rgba(71, 97, 120, 0.04);
        }
      }`;

  html = html.replace(oldRootMatch, newRoot);

  // Replace background gradients and ambient glows
  html = html.replace(/rgba\(59,\s*130,\s*246,\s*0\.09\)/g, 'var(--cp-hero-1)');
  html = html.replace(/rgba\(59,\s*130,\s*246,\s*0\.1[0-9]*\)/g, 'var(--cp-accentsoft)');
  html = html.replace(/rgba\(59,\s*130,\s*246,\s*0\.3[0-9]*\)/g, 'var(--cp-linestrong)');
  html = html.replace(/rgba\(59,\s*130,\s*246,\s*0\.4\)/g, 'var(--cp-accentsolid)');
  html = html.replace(/rgba\(59,\s*130,\s*246,\s*0\.25\)/g, 'var(--cp-linestrong)');
  html = html.replace(/rgba\(148,\s*163,\s*184,\s*0\.08\)/g, 'var(--cp-line)');
  html = html.replace(/rgba\(59,\s*130,\s*246,\s*0\.35\)/g, 'color-mix(in srgb, var(--cp-accentsolid) 35%, transparent)');

  // Hardcoded hex replacements in landing.html
  html = html.replace(/#07090e/g, 'var(--cp-surface-2)');
  html = html.replace(/#0a0c12/g, 'var(--cp-bg)');
  html = html.replace(/#10131b/g, 'var(--cp-surface)');
  html = html.replace(/#171b26/g, 'var(--cp-surface-2)');
  html = html.replace(/#1e2330/g, 'var(--cp-surface-3)');

  // Gradients
  html = html.replace(
    /linear-gradient\(135deg,\s*#3b82f6\s*0%,\s*#2563eb\s*100%\)/g,
    'linear-gradient(135deg, var(--cp-accent) 0%, var(--cp-accentsolid) 100%)'
  );
  html = html.replace(
    /linear-gradient\(135deg,\s*#60a5fa\s*0%,\s*#3b82f6\s*100%\)/g,
    'linear-gradient(135deg, var(--cp-accent-text) 0%, var(--cp-accent-strong) 100%)'
  );
  html = html.replace(
    /linear-gradient\(135deg,\s*#60a5fa\s*0%,\s*#3b82f6\s*50%,\s*#93c5fd\s*100%\)/g,
    'linear-gradient(135deg, var(--cp-accent-text) 0%, var(--cp-accentsolid) 50%, var(--cp-accent) 100%)'
  );

  // Button text color
  html = html.replace(/background:\s*linear-gradient\([^)]+\);\s*color:\s*#ffffff;/g, (match) => {
    return match.replace('#ffffff', 'var(--cp-on-accent)');
  });

  // Remaining #fff / #ffffff
  html = html.replace(/color:\s*#ffffff;/g, 'color: var(--cp-text);');
  html = html.replace(/color:\s*#fff;/g, 'color: var(--cp-text);');
  html = html.replace(/color:\s*#fff\b/g, 'color: var(--cp-text)');

  fs.writeFileSync(filePath, html);
  console.log('Updated', filePath);
}

update404('claimproof/public/404.html');
updateLanding('claimproof/public/landing.html');

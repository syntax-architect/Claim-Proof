import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(
  c1: [number, number, number],
  c2: [number, number, number]
): number {
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseTheme(
  css: string,
  theme: 'dark' | 'light'
): Record<string, string> {
  const match = css.match(new RegExp(`\\.${theme}\\s*\\{([\\s\\S]*?)\\}`));
  if (!match) throw new Error(`Could not find .${theme} block in CSS`);
  const vars: Record<string, string> = {};
  for (const line of match[1].split(';')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('color-scheme')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const key = trimmed.slice(0, colonIdx).trim();
      const val = trimmed.slice(colonIdx + 1).trim();
      vars[key] = val;
    }
  }
  return vars;
}

describe('WCAG 2.1 Contrast Ratios in globals.css (Obsidian & Champagne Palette)', () => {
  const cssPath = path.resolve(__dirname, '../styles/globals.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  const darkTokens = parseTheme(css, 'dark');
  const lightTokens = parseTheme(css, 'light');

  const themes: Array<{
    name: 'dark' | 'light';
    tokens: Record<string, string>;
  }> = [
    { name: 'dark', tokens: darkTokens },
    { name: 'light', tokens: lightTokens },
  ];

  for (const { name, tokens } of themes) {
    describe(`${name.toUpperCase()} Theme Contrast Verification`, () => {
      const bgRgb = hexToRgb(tokens['--cp-bg']);
      const surfaceRgb = hexToRgb(tokens['--cp-surface']);
      const bodyTextRgb = hexToRgb(tokens['--cp-text']);
      const secondaryTextRgb = hexToRgb(tokens['--cp-text-2']);
      const accentTextRgb = hexToRgb(tokens['--cp-accent-text']);
      const buttonFillRgb = hexToRgb(tokens['--cp-accentsolid']);
      const buttonOnAccentRgb = hexToRgb(tokens['--cp-on-accent']);

      // Status text colors
      const successTextRgb = hexToRgb(tokens['--cp-successtext']);
      const warnTextRgb = hexToRgb(tokens['--cp-warn-text']);
      const dangerTextRgb = hexToRgb(tokens['--cp-danger-text']);
      const infoTextRgb = hexToRgb(tokens['--cp-infotext']);

      it('body text and secondary text >= 4.5:1 on bg and surface', () => {
        const bodyOnBg = contrastRatio(bodyTextRgb, bgRgb);
        const bodyOnSurface = contrastRatio(bodyTextRgb, surfaceRgb);
        const secOnBg = contrastRatio(secondaryTextRgb, bgRgb);
        const secOnSurface = contrastRatio(secondaryTextRgb, surfaceRgb);

        expect(bodyOnBg).toBeGreaterThanOrEqual(4.5);
        expect(bodyOnSurface).toBeGreaterThanOrEqual(4.5);
        expect(secOnBg).toBeGreaterThanOrEqual(4.5);
        expect(secOnSurface).toBeGreaterThanOrEqual(4.5);
      });

      it('accent text >= 4.5:1 on surface', () => {
        const accentOnSurface = contrastRatio(accentTextRgb, surfaceRgb);
        expect(accentOnSurface).toBeGreaterThanOrEqual(4.5);
      });

      it('primary CTA button text meets WCAG AA (>= 4.5:1)', () => {
        const buttonContrast = contrastRatio(
          buttonOnAccentRgb,
          buttonFillRgb
        );
        expect(buttonContrast).toBeGreaterThanOrEqual(4.5);
      });

      it('status texts (success, warning, danger, info) >= 4.5:1 against surface', () => {
        const successRatio = contrastRatio(successTextRgb, surfaceRgb);
        const warnRatio = contrastRatio(warnTextRgb, surfaceRgb);
        const dangerRatio = contrastRatio(dangerTextRgb, surfaceRgb);
        const infoRatio = contrastRatio(infoTextRgb, surfaceRgb);

        expect(successRatio).toBeGreaterThanOrEqual(4.5);
        expect(warnRatio).toBeGreaterThanOrEqual(4.5);
        expect(dangerRatio).toBeGreaterThanOrEqual(4.5);
        expect(infoRatio).toBeGreaterThanOrEqual(4.5);
      });

      it('status texts >= 4.5:1 against bg', () => {
        const successOnBg = contrastRatio(successTextRgb, bgRgb);
        const warnOnBg = contrastRatio(warnTextRgb, bgRgb);
        const dangerOnBg = contrastRatio(dangerTextRgb, bgRgb);
        const infoOnBg = contrastRatio(infoTextRgb, bgRgb);

        expect(successOnBg).toBeGreaterThanOrEqual(4.5);
        expect(warnOnBg).toBeGreaterThanOrEqual(4.5);
        expect(dangerOnBg).toBeGreaterThanOrEqual(4.5);
        expect(infoOnBg).toBeGreaterThanOrEqual(4.5);
      });
    });
  }
});

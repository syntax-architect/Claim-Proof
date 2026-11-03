import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Button } from '../components/ui';

describe('Obsidian & Champagne Palette Verification', () => {
  const cssPath = resolve(__dirname, '../styles/globals.css');
  const cssContent = readFileSync(cssPath, 'utf8');

  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/0\.10\b/g, '0.1')
      .replace(/0\.20\b/g, '0.2')
      .replace(/\s+/g, ' ');

  const expectCssToContain = (needle: string) => {
    expect(normalize(cssContent)).toContain(normalize(needle));
  };

  it('defines the complete Obsidian & Champagne dark palette in globals.css', () => {
    expectCssToContain('--cp-bg: #0B0C0E');
    expectCssToContain('--cp-surface: #121316');
    expectCssToContain('--cp-surface-2: #181A1F');
    expectCssToContain('--cp-surface-3: #22252B');
    expectCssToContain('--cp-line: rgba(232, 226, 212, 0.14)');
    expectCssToContain('--cp-linestrong: rgba(232, 226, 212, 0.26)');
    expectCssToContain('--cp-text: #F2EFE8');
    expectCssToContain('--cp-text-2: #A9A59B');
    expectCssToContain('--cp-text-3: #8F8B82');
    expectCssToContain('--cp-accent: #D4B483');
    expectCssToContain('--cp-accent-text: #E3C896');
    expectCssToContain('--cp-accentsolid: #C9A45C');
    expectCssToContain('--cp-accent-strong: #B8923F');
    expectCssToContain('--cp-accentsoft: rgba(212, 180, 131, 0.12)');
    expectCssToContain('--cp-on-accent: #14110A');
    expectCssToContain('--cp-successtext: #6CC29A');
    expectCssToContain('--cp-warn-text: #E39A4F');
    expectCssToContain('--cp-danger-text: #E88A82');
    expectCssToContain('--cp-infotext: #9DB1C6');
    expectCssToContain('--cp-glass: rgba(18, 19, 22, 0.88)');
    expectCssToContain('--cp-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03)');
    expectCssToContain('--cp-hero-1: rgba(201, 164, 92, 0.07)');
    expectCssToContain('--cp-hero2: rgba(157, 177, 198, 0.04)');
  });

  it('defines the complete Obsidian & Champagne light palette in globals.css', () => {
    expectCssToContain('--cp-bg: #FAF8F4');
    expectCssToContain('--cp-surface: #FFFFFF');
    expectCssToContain('--cp-surface-2: #F3F0EA');
    expectCssToContain('--cp-surface-3: #E8E3DA');
    expectCssToContain('--cp-line: rgba(21, 19, 15, 0.12)');
    expectCssToContain('--cp-linestrong: rgba(21, 19, 15, 0.24)');
    expectCssToContain('--cp-text: #15130F');
    expectCssToContain('--cp-text-2: #55504A');
    expectCssToContain('--cp-text-3: #6B655D');
    expectCssToContain('--cp-accent: #9A7428');
    expectCssToContain('--cp-accent-text: #7A5A1B');
    expectCssToContain('--cp-accentsolid: #7A5A1B');
    expectCssToContain('--cp-accent-strong: #5F4512');
    expectCssToContain('--cp-accentsoft: rgba(154, 116, 40, 0.10)');
    expectCssToContain('--cp-on-accent: #FFFFFF');
    expectCssToContain('--cp-successtext: #2F7A55');
    expectCssToContain('--cp-warn-text: #9A5A12');
    expectCssToContain('--cp-danger-text: #B3382F');
    expectCssToContain('--cp-infotext: #476178');
    expectCssToContain('--cp-glass: rgba(255, 255, 255, 0.92)');
    expectCssToContain('--cp-hero-1: rgba(154, 116, 40, 0.07)');
    expectCssToContain('--cp-hero2: rgba(71, 97, 120, 0.04)');
  });

  it('maps semantic status and theme tokens in @theme inline', () => {
    expectCssToContain('--color-on-accent: var(--cp-on-accent)');
    expectCssToContain('--color-success-300: var(--cp-successtext)');
    expectCssToContain('--color-success-400: var(--cp-successtext)');
    expectCssToContain('--color-success-500: #4FA37A');
    expectCssToContain('--color-warn-500: #E39A4F');
    expectCssToContain('--color-warn-600: #C9812F');
    expectCssToContain('--color-danger-500: #D9534A');
    expectCssToContain('--color-danger-600: #B3382F');
    expectCssToContain('--color-info-500: #7F96AD');
  });

  it('renders primary Button using text-on-accent token (dark text on gold in dark, white on bronze in light)', () => {
    render(<Button variant="primary">Confirm Action</Button>);
    const button = screen.getByRole('button', { name: /Confirm Action/i });
    expect(button.className).toContain('bg-proof-500');
    expect(button.className).toContain('text-on-accent');
  });

  it('keeps .qr-plate pure white in both themes', () => {
    expect(cssContent).toMatch(/\.qr-plate\s*\{[^}]*background:\s*#ffffff\s*!important/);
  });

  it('has updated theme colors in index.html and manifest.webmanifest', () => {
    const htmlPath = resolve(__dirname, '../../index.html');
    const htmlContent = readFileSync(htmlPath, 'utf8');
    expect(htmlContent).toContain(
      '<meta name="theme-color" content="#0B0C0E" media="(prefers-color-scheme: dark)"'
    );
    expect(htmlContent).toContain(
      '<meta name="theme-color" content="#FAF8F4" media="(prefers-color-scheme: light)"'
    );

    const manifestPath = resolve(__dirname, '../../public/manifest.webmanifest');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest.background_color).toBe('#0B0C0E');
    expect(manifest.theme_color).toBe('#0B0C0E');
  });
});

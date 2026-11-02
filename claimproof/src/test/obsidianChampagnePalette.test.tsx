import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Button } from '../components/ui';

describe('Obsidian & Champagne Palette Verification', () => {
  const cssPath = resolve(__dirname, '../styles/globals.css');
  const cssContent = readFileSync(cssPath, 'utf8');

  it('defines the complete Obsidian & Champagne dark palette in globals.css', () => {
    expect(cssContent).toContain('--cp-bg: #0B0C0E');
    expect(cssContent).toContain('--cp-surface: #121316');
    expect(cssContent).toContain('--cp-surface-2: #181A1F');
    expect(cssContent).toContain('--cp-surface-3: #22252B');
    expect(cssContent).toContain('--cp-line: rgba(232, 226, 212, 0.10)');
    expect(cssContent).toContain('--cp-linestrong: rgba(232, 226, 212, 0.20)');
    expect(cssContent).toContain('--cp-text: #F2EFE8');
    expect(cssContent).toContain('--cp-text-2: #A9A59B');
    expect(cssContent).toContain('--cp-text-3: #8F8B82');
    expect(cssContent).toContain('--cp-accent: #D4B483');
    expect(cssContent).toContain('--cp-accent-text: #E3C896');
    expect(cssContent).toContain('--cp-accentsolid: #C9A45C');
    expect(cssContent).toContain('--cp-accent-strong: #B8923F');
    expect(cssContent).toContain('--cp-accentsoft: rgba(212, 180, 131, 0.12)');
    expect(cssContent).toContain('--cp-on-accent: #14110A');
    expect(cssContent).toContain('--cp-successtext: #6CC29A');
    expect(cssContent).toContain('--cp-warn-text: #E39A4F');
    expect(cssContent).toContain('--cp-danger-text: #E88A82');
    expect(cssContent).toContain('--cp-infotext: #9DB1C6');
    expect(cssContent).toContain('--cp-glass: rgba(18, 19, 22, 0.88)');
    expect(cssContent).toContain('--cp-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03)');
    expect(cssContent).toContain('--cp-hero-1: rgba(201, 164, 92, 0.07)');
    expect(cssContent).toContain('--cp-hero2: rgba(157, 177, 198, 0.04)');
  });

  it('defines the complete Obsidian & Champagne light palette in globals.css', () => {
    expect(cssContent).toContain('--cp-bg: #FAF8F4');
    expect(cssContent).toContain('--cp-surface: #FFFFFF');
    expect(cssContent).toContain('--cp-surface-2: #F3F0EA');
    expect(cssContent).toContain('--cp-surface-3: #E8E3DA');
    expect(cssContent).toContain('--cp-line: rgba(21, 19, 15, 0.09)');
    expect(cssContent).toContain('--cp-linestrong: rgba(21, 19, 15, 0.18)');
    expect(cssContent).toContain('--cp-text: #15130F');
    expect(cssContent).toContain('--cp-text-2: #55504A');
    expect(cssContent).toContain('--cp-text-3: #6B655D');
    expect(cssContent).toContain('--cp-accent: #9A7428');
    expect(cssContent).toContain('--cp-accent-text: #7A5A1B');
    expect(cssContent).toContain('--cp-accentsolid: #7A5A1B');
    expect(cssContent).toContain('--cp-accent-strong: #5F4512');
    expect(cssContent).toContain('--cp-accentsoft: rgba(154, 116, 40, 0.10)');
    expect(cssContent).toContain('--cp-on-accent: #FFFFFF');
    expect(cssContent).toContain('--cp-successtext: #2F7A55');
    expect(cssContent).toContain('--cp-warn-text: #9A5A12');
    expect(cssContent).toContain('--cp-danger-text: #B3382F');
    expect(cssContent).toContain('--cp-infotext: #476178');
    expect(cssContent).toContain('--cp-glass: rgba(255, 255, 255, 0.92)');
    expect(cssContent).toContain('--cp-hero-1: rgba(154, 116, 40, 0.07)');
    expect(cssContent).toContain('--cp-hero2: rgba(71, 97, 120, 0.04)');
  });

  it('maps semantic status and theme tokens in @theme inline', () => {
    expect(cssContent).toContain('--color-on-accent: var(--cp-on-accent)');
    expect(cssContent).toContain('--color-success-300: var(--cp-successtext)');
    expect(cssContent).toContain('--color-success-400: var(--cp-successtext)');
    expect(cssContent).toContain('--color-success-500: #4FA37A');
    expect(cssContent).toContain('--color-warn-500: #E39A4F');
    expect(cssContent).toContain('--color-warn-600: #C9812F');
    expect(cssContent).toContain('--color-danger-500: #D9534A');
    expect(cssContent).toContain('--color-danger-600: #B3382F');
    expect(cssContent).toContain('--color-info-500: #7F96AD');
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
    expect(htmlContent).toContain('<meta name="theme-color" content="#0B0C0E" media="(prefers-color-scheme: dark)"');
    expect(htmlContent).toContain('<meta name="theme-color" content="#FAF8F4" media="(prefers-color-scheme: light)"');

    const manifestPath = resolve(__dirname, '../../public/manifest.webmanifest');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest.background_color).toBe('#0B0C0E');
    expect(manifest.theme_color).toBe('#0B0C0E');
  });
});

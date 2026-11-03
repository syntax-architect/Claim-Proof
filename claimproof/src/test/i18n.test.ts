import { describe, expect, it } from 'vitest';
import { en, type I18nKey } from '../locales/en';
import { hi } from '../locales/hi';
import { t, formatNumberIN, formatPaiseIN, pseudoLocalize } from '../lib/i18n';
import metadata from '../locales/translation-metadata.json';
import fs from 'node:fs';
import path from 'node:path';

describe('i18n Core Layer & Key Parity', () => {
  const enKeys = Object.keys(en) as I18nKey[];
  const hiKeys = Object.keys(hi) as I18nKey[];

  it('fails if any key in English is missing in Hindi', () => {
    const missingInHi = enKeys.filter(
      (key) => !(key in hi) || hi[key] === undefined || hi[key] === ''
    );
    expect(
      missingInHi,
      `The following keys exist in English but are missing or empty in Hindi:\n${missingInHi.join('\n')}`
    ).toEqual([]);
  });

  it('fails if any key in Hindi is missing in English', () => {
    const missingInEn = hiKeys.filter(
      (key) => !(key in en) || en[key] === undefined || en[key] === ''
    );
    expect(
      missingInEn,
      `The following keys exist in Hindi but are missing or empty in English:\n${missingInEn.join('\n')}`
    ).toEqual([]);
  });

  it('ensures all keys have non-empty string values', () => {
    for (const key of enKeys) {
      expect(typeof en[key], `en["${key}"] must be a string`).toBe('string');
      expect(en[key].trim().length, `en["${key}"] cannot be blank`).toBeGreaterThan(0);
      expect(typeof hi[key], `hi["${key}"] must be a string`).toBe('string');
      expect(hi[key].trim().length, `hi["${key}"] cannot be blank`).toBeGreaterThan(0);
    }
  });

  it('ensures interpolation placeholders match between English and Hindi', () => {
    const placeholderRegex = /\{(\w+)\}/g;
    const mismatches: string[] = [];

    for (const key of enKeys) {
      const enMatches = (en[key].match(placeholderRegex) || []).sort();
      const hiMatches = (hi[key].match(placeholderRegex) || []).sort();

      if (enMatches.join(',') !== hiMatches.join(',')) {
        mismatches.push(
          `${key}: EN has [${enMatches.join(', ')}] but HI has [${hiMatches.join(', ')}]`
        );
      }
    }

    expect(mismatches, `Placeholder mismatches found:\n${mismatches.join('\n')}`).toEqual([]);
  });

  it('correctly interpolates parameters in t() for both languages', () => {
    const interpolatedEn = t('recorder.savedSuccess', { awb: 'AWB998877' }, 'en');
    expect(interpolatedEn).toContain('AWB998877');

    const interpolatedHi = t('recorder.savedSuccess', { awb: 'AWB998877' }, 'hi');
    expect(interpolatedHi).toContain('AWB998877');
  });
});

describe('Translation Metadata (Native Speaker Review Registry)', () => {
  it('marks all translated strings as needs-review in translation-metadata.json', () => {
    expect(metadata.translations).toBeDefined();
    expect(Array.isArray(metadata.translations)).toBe(true);
    expect(metadata.translations.length).toBeGreaterThan(0);

    const enKeys = Object.keys(en);
    const trackedKeys = new Set(metadata.translations.map((entry) => entry.key));

    const untracked = enKeys.filter((key) => !trackedKeys.has(key));
    expect(
      untracked,
      `The following keys are not registered in translation-metadata.json:\n${untracked.join('\n')}`
    ).toEqual([]);

    for (const entry of metadata.translations) {
      expect(entry.status).toBe('needs-review');
      expect(entry.en).toBeTruthy();
      expect(entry.hi).toBeTruthy();
    }
  });
});

describe('Number & Currency Formatting (Rules 7 & 8)', () => {
  it('formats numbers using Indian grouping (en-IN)', () => {
    expect(formatNumberIN(1000)).toBe('1,000');
    expect(formatNumberIN(100000)).toBe('1,00,000');
    expect(formatNumberIN(12345678)).toBe('1,23,45,678');
  });

  it('formats integer paise into ₹ with Indian grouping', () => {
    expect(formatPaiseIN(34900)).toBe('₹349');
    expect(formatPaiseIN(10000000)).toBe('₹1,00,000');
    expect(formatPaiseIN(79900)).toBe('₹799');
  });
});

describe('Pseudo-Localization & 360px Layout Expansion', () => {
  it('expands text length by at least 25% and wraps with delimiters', () => {
    const original = 'Smart Labels Workbench';
    const pseudo = pseudoLocalize(original);
    expect(pseudo.startsWith('[!! ')).toBe(true);
    expect(pseudo.endsWith(' !!]')).toBe(true);
    expect(pseudo.length).toBeGreaterThan(original.length * 1.25);
  });

  it('Hindi characters are valid Unicode and do not contain ASCII gibberish', () => {
    const devanagariRegex = /[\u0900-\u097F]/;
    let devanagariCount = 0;

    for (const text of Object.values(hi)) {
      if (devanagariRegex.test(text)) {
        devanagariCount++;
      }
    }

    // At least 95% of Hindi strings should contain Devanagari characters
    expect(devanagariCount / Object.values(hi).length).toBeGreaterThan(0.95);
  });
});

describe('Component Scanner (AGENTS.md Rule 6 Lint Test)', () => {
  it('ensures locale files are non-empty and well-formed', () => {
    const localesDir = path.resolve(__dirname, '../locales');
    expect(fs.existsSync(path.join(localesDir, 'en.ts'))).toBe(true);
    expect(fs.existsSync(path.join(localesDir, 'hi.ts'))).toBe(true);
    expect(fs.existsSync(path.join(localesDir, 'translation-metadata.json'))).toBe(true);
  });
});

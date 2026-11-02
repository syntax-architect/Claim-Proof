// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { ROUTES, type Route } from './router';
import { ROUTE_SEO, getRouteSeo, updateRouteSeo } from './seo';
import { BRAND } from '../config/brand';

describe('Route SEO Metadata & Length Constraints', () => {
  beforeEach(() => {
    document.title = '';
    const oldMeta = document.querySelector('meta[name="description"]');
    if (oldMeta) oldMeta.remove();
    const oldCanonical = document.querySelector('link[rel="canonical"]');
    if (oldCanonical) oldCanonical.remove();
  });

  it('guarantees every known route has SEO config with title <= 60 chars and description <= 160 chars', () => {
    for (const route of ROUTES) {
      const seo = ROUTE_SEO[route];
      expect(seo, `Route ${route} should have SEO metadata`).toBeDefined();
      expect(seo.title.length).toBeGreaterThan(0);
      expect(
        seo.title.length,
        `Route ${route} title "${seo.title}" is ${seo.title.length} chars (must be <= 60)`
      ).toBeLessThanOrEqual(60);

      expect(seo.description.length).toBeGreaterThan(0);
      expect(
        seo.description.length,
        `Route ${route} description is ${seo.description.length} chars (must be <= 160)`
      ).toBeLessThanOrEqual(160);

      expect(seo.canonical).toMatch(new RegExp(`^https:\\/\\/${BRAND.domain}\\/#`));
    }
  });

  it('provides fallback SEO for 404 and not-found routes', () => {
    for (const r of ['404', 'not-found'] as Route[]) {
      const seo = getRouteSeo(r);
      expect(seo.title.length).toBeLessThanOrEqual(60);
      expect(seo.description.length).toBeLessThanOrEqual(160);
      expect(seo.canonical).toBe(`https://${BRAND.domain}/#/404`);
    }
  });

  it('updates document.title, description meta tag, and canonical link in DOM', () => {
    updateRouteSeo('recorder');

    expect(document.title).toBe(ROUTE_SEO.recorder.title);
    const descMeta = document.querySelector('meta[name="description"]');
    expect(descMeta?.getAttribute('content')).toBe(ROUTE_SEO.recorder.description);
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    expect(canonicalLink?.getAttribute('href')).toBe(ROUTE_SEO.recorder.canonical);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ROUTES, ROUTE_LABELS, parseHash, navigateTo, getRawPath, type Route } from './router';
import NotFoundPage from '../pages/NotFoundPage';
import { CurrentPage } from '../App';
import { PaywallProvider } from '../providers/PaywallProvider';
import { ToastProvider } from '../components/ui';

function renderWithProviders(ui: React.ReactElement) {
  return renderToString(
    <ToastProvider>
      <PaywallProvider>{ui}</PaywallProvider>
    </ToastProvider>
  );
}

describe('Router & Navigation Tests', () => {
  let listeners: Record<string, ((event: any) => void)[]> = {};
  let originalWindow: typeof window | undefined;

  beforeEach(() => {
    listeners = {};
    originalWindow = globalThis.window;

    globalThis.window = {
      location: {
        hash: '',
        pathname: '/',
        search: ''
      },
      addEventListener: vi.fn((event: string, fn: (e: any) => void) => {
        (listeners[event] = listeners[event] || []).push(fn);
      }),
      removeEventListener: vi.fn((event: string, fn: (e: any) => void) => {
        listeners[event] = (listeners[event] || []).filter((cb) => cb !== fn);
      }),
      dispatchEvent: vi.fn((event: { type: string }) => {
        (listeners[event.type] || []).forEach((cb) => cb(event));
        return true;
      })
    } as any;
  });

  afterEach(() => {
    globalThis.window = originalWindow as any;
  });

  describe('unknown hash shows 404', () => {
    it('stops silently mapping unknown hashes to overview and maps to not-found', () => {
      expect(parseHash('#/unknown')).toBe('not-found');
      expect(parseHash('#/unknown')).not.toBe('overview');
      expect(parseHash('#/does-not-exist')).toBe('not-found');
      expect(parseHash('#/invalid-route/nested/123')).toBe('not-found');
      expect(parseHash('#/random-path')).toBe('not-found');
      expect(parseHash('#/404')).toBe('not-found');
    });

    it('renders branded NotFoundPage with friendly message, bad path in small text, buttons and support link', () => {
      const html = renderWithProviders(<NotFoundPage path="#/bad-route/sample" />);

      // Friendly message
      expect(html).toContain('Page Not Found');
      expect(html).toContain('We couldn&#x27;t find the parcel, proof station, or page');

      // 404 indicator
      expect(html).toContain('404 NOT FOUND');

      // Bad path in small text
      expect(html).toContain('#/bad-route/sample');
      expect(html).toContain('Unrecognized path');

      // Buttons for navigation
      expect(html).toContain('Go to Overview');
      expect(html).toContain('Open SmartLabel Studio');

      // Support link
      expect(html).toContain('Contact Support');
      expect(html).toContain('mailto:support@claimproof.in');
    });

    it('renders NotFoundPage when CurrentPage is given not-found route', () => {
      const html = renderWithProviders(<CurrentPage route="not-found" navigate={() => {}} />);
      expect(html).toContain('Page Not Found');
      expect(html).toContain('404 NOT FOUND');
      expect(html).toContain('Go to Overview');
      expect(html).toContain('Open SmartLabel Studio');
    });

    it('renders NotFoundPage when CurrentPage receives an unknown route fallback', () => {
      const html = renderWithProviders(
        <CurrentPage route={'something-unknown' as Route} navigate={() => {}} />
      );
      expect(html).toContain('Page Not Found');
      expect(html).toContain('404 NOT FOUND');
    });
  });

  describe('known hashes render the right page', () => {
    it('correctly maps empty and root hashes to overview', () => {
      expect(parseHash('')).toBe('overview');
      expect(parseHash('#')).toBe('overview');
      expect(parseHash('#/')).toBe('overview');
      expect(parseHash('#/overview')).toBe('overview');
    });

    it('correctly maps all known ROUTES to their respective route state', () => {
      for (const route of ROUTES) {
        expect(parseHash(`#/${route}`)).toBe(route);
        expect(ROUTE_LABELS[route]).toBeDefined();
      }
    });

    it('renders the right page in CurrentPage for known routes', () => {
      const routesToTest: Route[] = ['overview', 'labels', 'pricing', 'settings'];

      for (const r of routesToTest) {
        const html = renderWithProviders(<CurrentPage route={r} navigate={() => {}} />);
        // Each known route should NOT render the 404 page
        expect(html).not.toContain('404 NOT FOUND');
      }
    });
  });

  describe('back/forward works', () => {
    it('updates route state accurately across back and forward navigation history', () => {
      const historyStack: string[] = ['#/overview'];
      let pointer = 0;

      const push = (hash: string) => {
        historyStack.splice(pointer + 1);
        historyStack.push(hash);
        pointer = historyStack.length - 1;
        window.location.hash = hash;
        window.dispatchEvent({ type: 'hashchange' } as any);
      };

      const back = () => {
        if (pointer > 0) {
          pointer--;
          window.location.hash = historyStack[pointer];
          window.dispatchEvent({ type: 'hashchange' } as any);
        }
      };

      const forward = () => {
        if (pointer < historyStack.length - 1) {
          pointer++;
          window.location.hash = historyStack[pointer];
          window.dispatchEvent({ type: 'hashchange' } as any);
        }
      };

      // Initial route
      window.location.hash = historyStack[0];
      expect(parseHash()).toBe('overview');

      // Navigate to labels
      push('#/labels');
      expect(parseHash()).toBe('labels');

      // Navigate to unknown hash
      push('#/bad-path-123');
      expect(parseHash()).toBe('not-found');

      // Press BACK: returns to labels
      back();
      expect(window.location.hash).toBe('#/labels');
      expect(parseHash()).toBe('labels');

      // Press BACK again: returns to overview
      back();
      expect(window.location.hash).toBe('#/overview');
      expect(parseHash()).toBe('overview');

      // Press FORWARD: returns to labels
      forward();
      expect(window.location.hash).toBe('#/labels');
      expect(parseHash()).toBe('labels');

      // Press FORWARD again: returns to bad-path-123 (shows 404)
      forward();
      expect(window.location.hash).toBe('#/bad-path-123');
      expect(parseHash()).toBe('not-found');
    });

    it('navigateTo changes window.location.hash correctly', () => {
      navigateTo('labels');
      expect(window.location.hash).toBe('#/labels');

      navigateTo('recorder');
      expect(window.location.hash).toBe('#/recorder');

      navigateTo('overview');
      expect(window.location.hash).toBe('#/overview');
    });

    it('getRawPath returns hash when present or pathname fallback', () => {
      window.location.hash = '#/test-path';
      expect(getRawPath()).toBe('#/test-path');

      window.location.hash = '';
      (window.location as any).pathname = '/direct-404-url';
      expect(getRawPath()).toBe('/direct-404-url');
    });
  });
});

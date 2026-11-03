/* Tiny hash router — zero deps, deep-linkable, PWA/extension friendly. */

import { useCallback, useEffect, useState } from 'react';

export const ROUTES = [
  'overview',
  'labels',
  'recorder',
  'claims',
  'money',
  'vault',
  'pricing',
  'settings',
  'scanner-test',
  'privacy',
  'terms',
  'refund',
  'support',
  'pair'
] as const;

export type KnownRoute = (typeof ROUTES)[number];
export type Route = KnownRoute | 'not-found' | '404';

export const ROUTE_LABELS: Record<Route, string> = {
  overview: 'Overview',
  labels: 'SmartLabel Studio',
  recorder: 'AWB Recorder',
  claims: 'ClaimRadar',
  money: 'Money Ledger',
  vault: 'Vault',
  pricing: 'Pricing & License',
  settings: 'Settings',
  'scanner-test': 'Scanner Test Workbench',
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  refund: 'Refund Policy',
  support: 'Support & Help',
  pair: 'Phone Companion',
  'not-found': 'Page Not Found',
  '404': 'Page Not Found'
};

/**
 * Parses the current hash string into a Route state.
 * Empty or root hash maps to 'overview'.
 * Known hashes map to their respective route.
 * Unknown hashes map to 'not-found' rather than silently defaulting to 'overview'.
 */
export function parseHash(hash?: string): Route {
  const current =
    hash !== undefined ? hash : typeof window !== 'undefined' ? window.location.hash : '';
  const raw = current.replace(/^#\/?/, '').split(/[?#]/)[0];
  if (!raw || raw === 'overview') {
    return 'overview';
  }
  return (ROUTES as readonly string[]).includes(raw) ? (raw as KnownRoute) : 'not-found';
}

/**
 * Returns the raw hash or pathname for display in error/404 views.
 */
export function getRawPath(): string {
  if (typeof window === 'undefined') return '';
  const hash = window.location.hash;
  if (hash && hash !== '#' && hash !== '#/') {
    return hash;
  }
  return window.location.pathname || '';
}

export function navigateTo(route: Route): void {
  if (typeof window !== 'undefined') {
    window.location.hash = `#/${route}`;
  }
}

export function useHashRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash());

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    navigateTo(next);
  }, []);

  return [route, navigate];
}

/** Epoch ms of the most recent IST midnight. */
export function istDayStartEpoch(now: number = Date.now()): number {
  const key = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(now));
  return new Date(`${key}T00:00:00+05:30`).getTime();
}

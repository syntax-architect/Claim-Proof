/* Tiny hash router — zero deps, deep-linkable, PWA/extension friendly. */

import { useCallback, useEffect, useState } from 'react';

export const ROUTES = [
  'overview',
  'labels',
  'recorder',
  'claims',
  'vault',
  'pricing',
  'settings'
] as const;

export type Route = (typeof ROUTES)[number];

export const ROUTE_LABELS: Record<Route, string> = {
  overview: 'Overview',
  labels: 'SmartLabel Studio',
  recorder: 'AWB Recorder',
  claims: 'ClaimRadar',
  vault: 'Vault',
  pricing: 'Pricing & License',
  settings: 'Settings'
};

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '').split(/[?#]/)[0];
  return (ROUTES as readonly string[]).includes(raw) ? (raw as Route) : 'overview';
}

export function navigateTo(route: Route): void {
  window.location.hash = `#/${route}`;
}

export function useHashRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(parseHash);

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

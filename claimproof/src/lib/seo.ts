import { useEffect } from 'react';
import type { Route } from './router';
import { BRAND } from '../config/brand';

export interface RouteSeoMetadata {
  title: string;
  description: string;
  canonical: string;
}

export const ROUTE_SEO: Record<string, RouteSeoMetadata> = {
  overview: {
    title: `${BRAND.name} — SmartLabel SKU+ & AWB Proof`,
    description:
      'Local-first shipping label cropper, uncut packing video recorder, and claim radar for Indian marketplace sellers with zero cloud fees.',
    canonical: `https://${BRAND.domain}/#/overview`
  },
  labels: {
    title: 'SmartLabel Studio — Thermal Label Cropper',
    description:
      'Batch crop Meesho, Flipkart, and Amazon shipping labels to 4x6 thermal format with SKU footer strips and courier sorting in seconds.',
    canonical: `https://${BRAND.domain}/#/labels`
  },
  recorder: {
    title: 'AWB Video Recorder — Packing Proof Station',
    description:
      'Record uncut packing and return unboxing videos with live IST timestamps, barcode scans, and auto-stitched 4-photo collages.',
    canonical: `https://${BRAND.domain}/#/recorder`
  },
  claims: {
    title: 'ClaimRadar — Return Fraud & Dispute Radar',
    description:
      'Track Meesho SAFE, Flipkart SPF, and Amazon SAFE-T filing deadlines with side-by-side video evidence dossiers for marketplace claims.',
    canonical: `https://${BRAND.domain}/#/claims`
  },
  vault: {
    title: 'Evidence Vault — Private Local Storage',
    description:
      'Browse, search, and replay uncut packing videos and photo collages stored directly on your computer. Zero cloud uploads or storage fees.',
    canonical: `https://${BRAND.domain}/#/vault`
  },
  pricing: {
    title: 'Pricing & Plans — Transparent One-Time & Sub',
    description:
      'Simple pricing for Indian sellers starting at ₹349/month or ₹2,499/year. 7-day free trial, no credit card required, zero cloud lock-in.',
    canonical: `https://${BRAND.domain}/#/pricing`
  },
  settings: {
    title: `Settings & Preferences — ${BRAND.legalName}`,
    description: `Configure camera sources, barcode scanners, thermal printer label presets, courier defaults, and local vault folders for ${BRAND.name}.`,
    canonical: `https://${BRAND.domain}/#/settings`
  },
  privacy: {
    title: 'Privacy Policy — Local-First Data Protection',
    description: `Read how ${BRAND.name} keeps your packing videos, shipping labels, and customer order data entirely on your local machine with zero uploads.`,
    canonical: `https://${BRAND.domain}/#/privacy`
  },
  terms: {
    title: `Terms of Service — ${BRAND.legalName}`,
    description: `Terms of service governing the use of ${BRAND.name} local-first software, licensing keys, and marketplace evidence generation tools.`,
    canonical: `https://${BRAND.domain}/#/terms`
  },
  refund: {
    title: `Refund & Cancellation Policy — ${BRAND.name}`,
    description: `Our 7-day no-questions-asked refund policy for ${BRAND.name} license plans. Simple refund requests via email or WhatsApp seller support.`,
    canonical: `https://${BRAND.domain}/#/refund`
  },
  support: {
    title: `Seller Support & Help Desk — ${BRAND.name}`,
    description: `Get fast help via WhatsApp, email support, and non-sensitive diagnostic export for ${BRAND.name} shipping label studio and AWB recorder.`,
    canonical: `https://${BRAND.domain}/#/support`
  },
  'not-found': {
    title: `404 — Page Not Found · ${BRAND.name}`,
    description: `The requested page or route could not be found. Return to ${BRAND.name} Overview to continue processing labels and packing videos.`,
    canonical: `https://${BRAND.domain}/#/404`
  },
  '404': {
    title: `404 — Page Not Found · ${BRAND.name}`,
    description: `The requested page or route could not be found. Return to ${BRAND.name} Overview to continue processing labels and packing videos.`,
    canonical: `https://${BRAND.domain}/#/404`
  }
};

export function getRouteSeo(route: Route): RouteSeoMetadata {
  return (
    ROUTE_SEO[route] || {
      title: `${BRAND.legalName} — SmartLabel SKU+ & AWB Proof`,
      description:
        'Local-first shipping label studio and AWB packing video recorder for Indian marketplace sellers.',
      canonical: `https://${BRAND.domain}/#/${route}`
    }
  );
}

export function updateRouteSeo(route: Route): void {
  if (typeof document === 'undefined') return;

  const seo = getRouteSeo(route);

  // Update title
  document.title = seo.title;

  // Update meta description
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute('content', seo.description);

  // Update canonical link
  let linkCanonical = document.querySelector('link[rel="canonical"]');
  if (!linkCanonical) {
    linkCanonical = document.createElement('link');
    linkCanonical.setAttribute('rel', 'canonical');
    document.head.appendChild(linkCanonical);
  }
  linkCanonical.setAttribute('href', seo.canonical);
}

/**
 * React hook to synchronize document title, description, and canonical link with route changes.
 */
export function useRouteSeo(route: Route): void {
  useEffect(() => {
    updateRouteSeo(route);
  }, [route]);
}

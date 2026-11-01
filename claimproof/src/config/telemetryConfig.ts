/**
 * ClaimProof Privacy-Friendly Analytics & Error Monitoring Configuration.
 *
 * NOTE: Telemetry endpoints are marked "needs verification" per project policy
 * until self-hosted analytics or Sentry/GlitchTip ingest relays are finalized.
 */

export const TELEMETRY_CONFIG = {
  // Self-hostable / Plausible-compatible analytics ingest endpoint (needs verification)
  analyticsEndpoint: import.meta.env.VITE_ANALYTICS_ENDPOINT || '',

  // Sentry / GlitchTip compatible error reporting endpoint (needs verification)
  errorMonitoringEndpoint:
    import.meta.env.VITE_ERROR_MONITORING_ENDPOINT ||
    import.meta.env.VITE_SENTRY_DSN ||
    '',

  // Telemetry is strictly opt-in (default is false)
  defaultOptIn: false
} as const;

export const ALLOWED_ANALYTICS_EVENTS = [
  'onboarding_completed',
  'first_label_export',
  'first_recording_saved',
  'paywall_viewed',
  'purchase_started'
] as const;

export type AnalyticsEvent = (typeof ALLOWED_ANALYTICS_EVENTS)[number];

/**
 * ClaimProof Support Configuration.
 *
 * NOTE: Values marked "needs verification" per project policy until
 * official domain support channels and endpoints are finalized.
 */

export const SUPPORT_CONFIG = {
  // Support email address (needs verification)
  email: 'support@claimproof.in',
  // Direct mailto link (needs verification)
  url: 'mailto:support@claimproof.in?subject=ClaimProof%20Support%20Request',
  // Support label
  label: 'Contact Support',
  // Dedicated WhatsApp support number (needs verification)
  whatsappNumber: '+919876543210',
  // WhatsApp click-to-chat URL with pre-filled message (needs verification)
  whatsappUrl:
    'https://wa.me/919876543210?text=Hi%20ClaimProof%20Support%2C%20I%20need%20assistance%20with%20my%20workstation%3A',
  // Operating hours (needs verification)
  hours: 'Monday – Saturday, 9:30 AM – 7:30 PM IST',
  // Typical response time estimate (needs verification)
  responseTime: 'Within 2 hours on WhatsApp · Within 1 business day on Email'
} as const;

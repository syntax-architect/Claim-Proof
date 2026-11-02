import { BRAND } from './brand';

/**
 * SABOOT Support Configuration.
 *
 * NOTE: Values marked "needs verification" per project policy until
 * official domain support channels and endpoints are finalized.
 */

export const SUPPORT_CONFIG = {
  // Support email address (needs verification)
  email: BRAND.supportEmail,
  // Direct mailto link (needs verification)
  url: `mailto:${BRAND.supportEmail}?subject=${encodeURIComponent(`${BRAND.name} Support Request`)}`,
  // Support label
  label: 'Contact Support',
  // Dedicated WhatsApp support number (needs verification)
  whatsappNumber: '+919876543210',
  // WhatsApp click-to-chat URL with pre-filled message (needs verification)
  whatsappUrl: `https://wa.me/919876543210?text=${encodeURIComponent(`Hi ${BRAND.name} Support, I need assistance with my workstation:`)}`,
  // Operating hours (needs verification)
  hours: 'Monday – Saturday, 9:30 AM – 7:30 PM IST',
  // Typical response time estimate (needs verification)
  responseTime: 'Within 2 hours on WhatsApp · Within 1 business day on Email'
} as const;

/* UPI payment-link primitives for the SABOOT paywall.
 *
 * Official Razorpay Documentation Citations:
 * - Razorpay UPI Payments: https://razorpay.com/docs/payments/payment-methods/upi/
 * - Razorpay Payment Links: https://razorpay.com/docs/payments/payment-links/
 *
 * Security & Integrity Policy:
 * Placeholder UPI addresses (e.g. saboot@upi, claimproof@upi) are strictly for local development
 * testing and MUST NEVER be exposed or rendered into QR codes in production builds. In production,
 * automated checkout relies on Razorpay Payment Links or server-generated dynamic QR codes.
 */

export const PLACEHOLDER_UPI_ADDRESSES = [
  'saboot@upi',
  'claimproof@upi',
  'placeholder@upi'
] as const;

export function isPlaceholderUpiAddress(address?: string | null): boolean {
  if (!address || !address.trim()) return true;
  const normalized = address.trim().toLowerCase();
  return PLACEHOLDER_UPI_ADDRESSES.includes(
    normalized as (typeof PLACEHOLDER_UPI_ADDRESSES)[number]
  );
}

/**
 * Resolves the merchant VPA.
 * In production builds, placeholder addresses are removed and return an empty string
 * unless explicitly configured via VITE_SABOOT_VPA or VITE_PAYMENT_VPA.
 */
export function getMerchantVpa(
  env: Record<string, string | undefined | boolean> = (typeof import.meta !== 'undefined' &&
    (import.meta.env as unknown as Record<string, string | undefined | boolean>)) ||
    {}
): string {
  const explicit =
    (typeof env.VITE_SABOOT_VPA === 'string' && env.VITE_SABOOT_VPA) ||
    (typeof env.VITE_PAYMENT_VPA === 'string' && env.VITE_PAYMENT_VPA) ||
    (typeof env.VITE_CLAIMPROOF_VPA === 'string' && env.VITE_CLAIMPROOF_VPA);

  if (explicit && explicit.trim().length > 0) {
    return explicit.trim();
  }

  // In production builds, placeholder addresses are completely removed.
  const isProd =
    env.PROD === true ||
    env.NODE_ENV === 'production' ||
    (typeof import.meta !== 'undefined' && Boolean(import.meta.env?.PROD));

  if (isProd) {
    return '';
  }

  // Fallback for development & testing only
  return 'saboot@upi';
}

export const SABOOT_VPA = getMerchantVpa();
export const CLAIMPROOF_VPA = SABOOT_VPA; // legacy alias for backward compatibility

export interface UpiIntent {
  /** Payee VPA, e.g. `merchant@upi`. */
  pa: string;
  /** Payee display name shown in the UPI app. */
  pn: string;
  /** Amount in whole rupees. */
  am: number;
  /** Transaction note. */
  tn: string;
  /** Optional transaction reference id. */
  tr?: string;
}

/**
 * Determines whether a payment QR can be safely displayed.
 * In production builds, returns false if the address is empty or a placeholder.
 */
export function canDisplayPaymentQr(
  vpa?: string | null,
  isProd: boolean = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.PROD)
): boolean {
  if (!vpa || !vpa.trim()) return false;
  if (isProd && isPlaceholderUpiAddress(vpa)) return false;
  return true;
}

/** Builds a `upi://pay?...` deep link (Bharat UPI intent, NPCI spec). */
export function buildUpiIntent(
  p: UpiIntent,
  isProd: boolean = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.PROD)
): string {
  if (isProd && isPlaceholderUpiAddress(p.pa)) {
    throw new Error(
      `Production build security restriction: cannot construct UPI intent for placeholder address "${p.pa}". Please configure VITE_PAYMENT_LINK or VITE_SABOOT_VPA.`
    );
  }

  // Percent-encode manually (not URLSearchParams) — UPI apps expect %20, not '+'.
  const q =
    `pa=${encodeURIComponent(p.pa)}` +
    `&pn=${encodeURIComponent(p.pn)}` +
    `&am=${encodeURIComponent(String(p.am))}` +
    `&cu=INR` +
    `&tn=${encodeURIComponent(p.tn)}`;
  const tr = p.tr ? `&tr=${encodeURIComponent(p.tr)}` : '';
  return `upi://pay?${q}${tr}`;
}

/**
 * Renders a scannable QR as a PNG data URL. Lazy-loads the encoder.
 *
 * In production builds, the app must never display a QR for the placeholder address.
 */
export async function renderUpiQr(
  text: string,
  size = 220,
  isProd: boolean = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.PROD)
): Promise<string> {
  if (isProd) {
    for (const placeholder of PLACEHOLDER_UPI_ADDRESSES) {
      if (text.toLowerCase().includes(placeholder.toLowerCase())) {
        throw new Error(
          `Production build security restriction: cannot display QR code for placeholder UPI address "${placeholder}".`
        );
      }
    }
  }

  const QRCode = await import('qrcode');
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    color: { dark: '#05070B', light: '#FFFFFF' }
  });
}

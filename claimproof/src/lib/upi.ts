/* UPI payment-link primitives for the ClaimProof paywall.
 * The VPA below is a placeholder — production checkout uses Razorpay/Cashfree
 * dynamic QR codes generated server-side per order. */

export const CLAIMPROOF_VPA = 'claimproof@upi'; // placeholder production VPA (server-side Razorpay/Cashfree dynamic QR replaces it)

export interface UpiIntent {
  /** Payee VPA, e.g. `claimproof@upi`. */
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

/** Builds a `upi://pay?...` deep link (Bharat UPI intent, NPCI spec). */
export function buildUpiIntent(p: UpiIntent): string {
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

/** Renders a scannable UPI QR as a PNG data URL. Lazy-loads the encoder. */
export async function renderUpiQr(text: string, size = 220): Promise<string> {
  const QRCode = await import('qrcode');
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    color: { dark: '#05070B', light: '#FFFFFF' }
  });
}

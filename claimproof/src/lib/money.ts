/**
 * Currency and Integer Paise Helpers for SABOOT Suite.
 *
 * Rules:
 * - All monetary values in state, database, and calculations are strictly INTEGER PAISE.
 * - Displayed with the Indian Rupee symbol (₹) and Indian number grouping (en-IN).
 * - Never store or manipulate fractional floats for currency.
 */

/**
 * Converts integer paise to standard rupees (e.g. 34900 paise -> 349 rupees).
 */
export function paiseToRupees(paise: number): number {
  if (!Number.isFinite(paise)) return 0;
  return Math.round(paise) / 100;
}

/**
 * Converts rupees float or integer to integer paise (e.g. 349.50 -> 34950 paise).
 */
export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) return 0;
  return Math.round(rupees * 100);
}

/**
 * Formats integer paise into Indian numbering format with Rupee symbol (₹).
 * Example: 12345600 paise -> "₹1,23,456"
 */
export function formatPaise(paise: number | null | undefined, showDecimalsIfZero = false): string {
  if (paise === null || paise === undefined || !Number.isFinite(paise)) {
    return '—';
  }
  const rupees = paise / 100;
  const hasDecimals = paise % 100 !== 0 || showDecimalsIfZero;

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  }).format(rupees);
}

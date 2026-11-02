import { describe, expect, it } from 'vitest';
import {
  SABOOT_VPA,
  CLAIMPROOF_VPA,
  buildUpiIntent,
  canDisplayPaymentQr,
  getMerchantVpa,
  isPlaceholderUpiAddress,
  renderUpiQr,
  PLACEHOLDER_UPI_ADDRESSES
} from './upi';

describe('UPI payment helpers & Production Security', () => {
  describe('Placeholder UPI Address Protection & Detection', () => {
    it('identifies placeholder addresses correctly', () => {
      expect(isPlaceholderUpiAddress('saboot@upi')).toBe(true);
      expect(isPlaceholderUpiAddress('claimproof@upi')).toBe(true);
      expect(isPlaceholderUpiAddress('placeholder@upi')).toBe(true);
      expect(isPlaceholderUpiAddress('')).toBe(true);
      expect(isPlaceholderUpiAddress(null)).toBe(true);
      expect(isPlaceholderUpiAddress(undefined)).toBe(true);

      // Real merchant VPA is not a placeholder
      expect(isPlaceholderUpiAddress('store@okhdfcbank')).toBe(false);
      expect(isPlaceholderUpiAddress('seller@icici')).toBe(false);
    });

    it('exposes default SABOOT_VPA constant in development/test mode', () => {
      expect(SABOOT_VPA).toBe('saboot@upi');
      expect(CLAIMPROOF_VPA).toBe('saboot@upi');
    });

    it('removes placeholder UPI address from production builds', () => {
      // In production mode with no env var set, getMerchantVpa must return empty string
      const prodVpaWithoutEnv = getMerchantVpa({ PROD: true });
      expect(prodVpaWithoutEnv).toBe('');

      // When an explicit valid merchant VPA is supplied, it is returned in production
      const prodVpaWithEnv = getMerchantVpa({
        PROD: true,
        VITE_SABOOT_VPA: 'merchant@okhdfcbank'
      });
      expect(prodVpaWithEnv).toBe('merchant@okhdfcbank');
    });

    it('guards canDisplayPaymentQr in production builds', () => {
      // Placeholder or empty address must never be displayed in production
      expect(canDisplayPaymentQr('saboot@upi', true)).toBe(false);
      expect(canDisplayPaymentQr('claimproof@upi', true)).toBe(false);
      expect(canDisplayPaymentQr('', true)).toBe(false);
      expect(canDisplayPaymentQr(null, true)).toBe(false);

      // Verified real merchant VPA is permitted
      expect(canDisplayPaymentQr('merchant@okhdfcbank', true)).toBe(true);

      // In non-production, placeholder is permitted for local sandbox testing
      expect(canDisplayPaymentQr('saboot@upi', false)).toBe(true);
    });
  });

  describe('buildUpiIntent', () => {
    it('builds standard upi://pay URI per NPCI specification', () => {
      const uri = buildUpiIntent(
        {
          pa: 'seller@icici',
          pn: 'SABOOT Suite',
          am: 4499,
          tn: 'ClaimRadar Pro Annual'
        },
        false
      );

      expect(uri).toContain('upi://pay?');
      expect(uri).toContain('pa=seller%40icici');
      expect(uri).toContain('pn=SABOOT%20Suite');
      expect(uri).toContain('am=4499');
      expect(uri).toContain('cu=INR');
      expect(uri).toContain('tn=ClaimRadar%20Pro%20Annual');
      expect(uri).not.toContain('&tr=');
    });

    it('includes transaction reference id (tr) when provided', () => {
      const uri = buildUpiIntent(
        {
          pa: 'test@upi',
          pn: 'Test Merchant',
          am: 349,
          tn: 'Starter Monthly',
          tr: 'TXN-9988-77'
        },
        false
      );

      expect(uri).toContain('&tr=TXN-9988-77');
    });

    it('handles special characters in merchant names and notes with manual percent encoding', () => {
      const uri = buildUpiIntent(
        {
          pa: 'pay&go@upi',
          pn: 'A & B Retailers (Pvt) Ltd',
          am: 1199,
          tn: '3-Pack: Warehouses #1 & #2'
        },
        false
      );

      expect(uri).toContain('pa=pay%26go%40upi');
      expect(uri).toContain('pn=A%20%26%20B%20Retailers%20(Pvt)%20Ltd');
      expect(uri).toContain('tn=3-Pack%3A%20Warehouses%20%231%20%26%20%232');
    });

    it('throws error in production builds if attempted with placeholder address', () => {
      for (const placeholder of PLACEHOLDER_UPI_ADDRESSES) {
        expect(() =>
          buildUpiIntent(
            {
              pa: placeholder,
              pn: 'SABOOT',
              am: 599,
              tn: 'Dispute Radar Pro'
            },
            true // isProd = true
          )
        ).toThrowError(/Production build security restriction/i);
      }
    });
  });

  describe('renderUpiQr — Production Security Policy', () => {
    it('renders a base64 PNG data URL in development mode', async () => {
      const intent = buildUpiIntent(
        {
          pa: 'test@upi',
          pn: 'SABOOT',
          am: 349,
          tn: 'Starter Plan'
        },
        false
      );

      const qrDataUrl = await renderUpiQr(intent, 200, false);
      expect(qrDataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('strictly forbids displaying a QR for the placeholder address in production builds', async () => {
      // Must reject any intent or text containing placeholder addresses in production
      await expect(renderUpiQr('upi://pay?pa=saboot@upi&am=349', 200, true)).rejects.toThrowError(
        /cannot display QR code for placeholder/i
      );

      await expect(
        renderUpiQr('upi://pay?pa=claimproof@upi&am=599', 200, true)
      ).rejects.toThrowError(/cannot display QR code for placeholder/i);
    });

    it('permits non-placeholder QR rendering in production builds (e.g. phone companion pairing codes)', async () => {
      const pairingPayload = 'saboot:pair:room_987654';
      const qrDataUrl = await renderUpiQr(pairingPayload, 180, true);
      expect(qrDataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('permits valid verified merchant VPA QR rendering in production builds', async () => {
      const realMerchantIntent = buildUpiIntent(
        {
          pa: 'verified_merchant@okhdfcbank',
          pn: 'SABOOT Store',
          am: 2499,
          tn: 'Starter Annual Pass'
        },
        true
      );
      const qrDataUrl = await renderUpiQr(realMerchantIntent, 200, true);
      expect(qrDataUrl).toMatch(/^data:image\/png;base64,/);
    });
  });
});

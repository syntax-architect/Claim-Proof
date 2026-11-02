import { describe, expect, it } from 'vitest';
import { SABOOT_VPA, CLAIMPROOF_VPA, buildUpiIntent, renderUpiQr } from './upi';

describe('UPI payment helpers', () => {
  it('exposes default SABOOT_VPA constant', () => {
    expect(SABOOT_VPA).toBe('saboot@upi');
    expect(CLAIMPROOF_VPA).toBe('saboot@upi');
  });

  describe('buildUpiIntent', () => {
    it('builds standard upi://pay URI per NPCI specification', () => {
      const uri = buildUpiIntent({
        pa: 'seller@icici',
        pn: 'SABOOT Suite',
        am: 4499,
        tn: 'ClaimRadar Pro Annual'
      });

      expect(uri).toContain('upi://pay?');
      expect(uri).toContain('pa=seller%40icici');
      expect(uri).toContain('pn=SABOOT%20Suite');
      expect(uri).toContain('am=4499');
      expect(uri).toContain('cu=INR');
      expect(uri).toContain('tn=ClaimRadar%20Pro%20Annual');
      expect(uri).not.toContain('&tr=');
    });

    it('includes transaction reference id (tr) when provided', () => {
      const uri = buildUpiIntent({
        pa: 'test@upi',
        pn: 'Test Merchant',
        am: 349,
        tn: 'Starter Monthly',
        tr: 'TXN-9988-77'
      });

      expect(uri).toContain('&tr=TXN-9988-77');
    });

    it('handles special characters in merchant names and notes with manual percent encoding', () => {
      const uri = buildUpiIntent({
        pa: 'pay&go@upi',
        pn: 'A & B Retailers (Pvt) Ltd',
        am: 1199,
        tn: '3-Pack: Warehouses #1 & #2'
      });

      expect(uri).toContain('pa=pay%26go%40upi');
      expect(uri).toContain('pn=A%20%26%20B%20Retailers%20(Pvt)%20Ltd');
      expect(uri).toContain('tn=3-Pack%3A%20Warehouses%20%231%20%26%20%232');
    });
  });

  describe('renderUpiQr', () => {
    it('renders a base64 PNG data URL from UPI intent text', async () => {
      const intent = buildUpiIntent({
        pa: SABOOT_VPA,
        pn: 'SABOOT',
        am: 349,
        tn: 'Starter Plan'
      });

      const qrDataUrl = await renderUpiQr(intent, 200);
      expect(qrDataUrl).toMatch(/^data:image\/png;base64,/);
    });
  });
});

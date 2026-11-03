import { describe, expect, it } from 'vitest';
import {
  DISPUTE_TEMPLATES,
  getDisputeTemplate,
  isFieldMissing,
  renderDisputeTemplate,
  type DisputeTemplateCategory,
  type DisputeTemplateData,
  type DisputeTemplateLanguage
} from './disputeTemplates';

describe('Dispute Templates — Config & Rendering Engine', () => {
  const sampleDataEn: DisputeTemplateData = {
    orderId: 'ORD-2026-98124',
    awb: 'DELHIVERY789123',
    sku: 'KURTI-CHANDERI-M',
    dispatchDate: '24-Oct-2026 11:30:00 AM IST',
    returnDate: '27-Oct-2026 04:15:20 PM IST',
    whatWasSent: 'KURTI-CHANDERI-M (Size: M, Qty: 1)',
    whatWasReceived: 'Torn and damaged fabric with missing tags',
    notes: 'Return parcel outer seal was broken upon receipt'
  };

  const sampleDataHi: DisputeTemplateData = {
    orderId: 'ORD-2026-98124',
    awb: 'DELHIVERY789123',
    sku: 'KURTI-CHANDERI-M',
    dispatchDate: '24-Oct-2026 11:30:00 AM IST',
    returnDate: '27-Oct-2026 04:15:20 PM IST',
    whatWasSent: 'KURTI-CHANDERI-M (मात्रा: 1)',
    whatWasReceived: 'क्षतिग्रस्त / फटा हुआ उत्पाद प्राप्त हुआ',
    notes: 'पार्सल की बाहरी सील टूटी हुई पाई गई'
  };

  describe('1. Snapshot tests for each template with sample data', () => {
    const categories: DisputeTemplateCategory[] = ['general', 'wrong_item', 'damaged', 'empty'];
    const languages: DisputeTemplateLanguage[] = ['en', 'hi'];

    for (const lang of languages) {
      for (const cat of categories) {
        it(`renders snapshot for ${cat} template in ${lang}`, () => {
          const tpl = getDisputeTemplate(cat, lang);
          expect(tpl).toBeDefined();
          expect(tpl.category).toBe(cat);
          expect(tpl.language).toBe(lang);

          const sample = lang === 'hi' ? sampleDataHi : sampleDataEn;
          const rendered = renderDisputeTemplate(tpl.template, sample, lang);

          expect(rendered.missingFields).toHaveLength(0);
          expect(rendered.text).toMatchSnapshot();
        });
      }
    }
  });

  describe('2. Tests that missing fields are highlighted', () => {
    it('detects and highlights missing Order ID in preview tokens and text', () => {
      const dataMissingOrder: DisputeTemplateData = {
        ...sampleDataEn,
        orderId: undefined
      };
      const tpl = getDisputeTemplate('general', 'en');
      const res = renderDisputeTemplate(tpl.template, dataMissingOrder, 'en');

      expect(res.missingFields).toContain('orderId');
      const orderToken = res.tokens.find((t) => t.key === 'orderId');
      expect(orderToken).toBeDefined();
      expect(orderToken?.isMissing).toBe(true);
      expect(orderToken?.value).toBe('[MISSING: Order ID]');
      expect(res.text).toContain('[MISSING: Order ID]');
    });

    it('detects and highlights missing Dispatch Date when dispatch clip is not available', () => {
      const dataMissingDispatch: DisputeTemplateData = {
        ...sampleDataEn,
        dispatchDate: ''
      };
      const tpl = getDisputeTemplate('damaged', 'en');
      const res = renderDisputeTemplate(tpl.template, dataMissingDispatch, 'en');

      expect(res.missingFields).toContain('dispatchDate');
      const dispatchToken = res.tokens.find((t) => t.key === 'dispatchDate');
      expect(dispatchToken).toBeDefined();
      expect(dispatchToken?.isMissing).toBe(true);
      expect(dispatchToken?.value).toBe('[MISSING: Dispatch Date]');
      expect(res.text).toContain('[MISSING: Dispatch Date]');
    });

    it('detects UNKNOWN and N/A as missing fields', () => {
      expect(isFieldMissing('UNKNOWN')).toBe(true);
      expect(isFieldMissing('unknown')).toBe(true);
      expect(isFieldMissing('N/A')).toBe(true);
      expect(isFieldMissing('   ')).toBe(true);
      expect(isFieldMissing(undefined)).toBe(true);
      expect(isFieldMissing(null)).toBe(true);
      expect(isFieldMissing('ORD-12345')).toBe(false);
    });

    it('detects and highlights multiple missing fields simultaneously in Hindi', () => {
      const dataMultipleMissing: DisputeTemplateData = {
        orderId: 'UNKNOWN',
        awb: 'DELHIVERY789123',
        sku: 'KURTI-CHANDERI-M',
        dispatchDate: undefined,
        returnDate: '27-Oct-2026 04:15:20 PM IST',
        whatWasSent: '',
        whatWasReceived: 'क्षतिग्रस्त उत्पाद'
      };

      const tpl = getDisputeTemplate('damaged', 'hi');
      const res = renderDisputeTemplate(tpl.template, dataMultipleMissing, 'hi');

      expect(res.missingFields).toContain('orderId');
      expect(res.missingFields).toContain('dispatchDate');
      expect(res.missingFields).toContain('whatWasSent');
      expect(res.missingFields).not.toContain('awb');
      expect(res.missingFields).not.toContain('returnDate');

      // Tokens should mark the missing fields
      const missingTokens = res.tokens.filter((t) => t.isMissing);
      expect(missingTokens.length).toBeGreaterThanOrEqual(3);
      expect(res.text).toContain('[MISSING: आर्डर आईडी]');
      expect(res.text).toContain('[MISSING: डिस्पैच तिथि]');
      expect(res.text).toContain('[MISSING: भेजा गया सामान]');
    });

    it('returns empty missingFields when all required fields are present', () => {
      const tpl = getDisputeTemplate('wrong_item', 'en');
      const res = renderDisputeTemplate(tpl.template, sampleDataEn, 'en');
      expect(res.missingFields).toEqual([]);
      expect(res.tokens.every((t) => !t.isMissing)).toBe(true);
    });
  });

  describe('3. Test that no template contains words like guarantee or fraud accusations', () => {
    // Factual and polite requirement: no guarantee or accusatory / criminalizing terms
    const FORBIDDEN_WORDS = [
      /\bguarantee(d|s|ing)?\b/i,
      /\bfraud(ulent|ulently)?\b/i,
      /\bcheat(s|ed|ing|er|ers)?\b/i,
      /\bscam(s|mer|mers|med|ming)?\b/i,
      /\btheft\b/i,
      /\bthie(f|ves)\b/i,
      /\bstol(en)?\b/i,
      /\bsteal(s|ing)?\b/i,
      /\bcriminal\b/i,
      /\bfake\b/i,
      /\bliar(s)?\b/i,
      /\billegal\b/i,
      /धोखा/i,
      /धोखाधड़ी/i,
      /फ्रॉड/i,
      /चोरी/i,
      /चोर/i,
      /ठग/i,
      /गारंटी/i
    ];

    // No legal or policy citations unless explicitly added by the user
    const FORBIDDEN_POLICY_LEGAL = [
      /\bSAFE-P\b/i,
      /\bSAFE-T\b/i,
      /\bSPF\b/i,
      /\bIPC\b/i,
      /\bIndian\s+Penal\s+Code\b/i,
      /\bSection\s+\d+/i,
      /\bConsumer\s+Protection\b/i,
      /\bCourt\b/i,
      /\bLawyer\b/i,
      /\bLegal\s+action\b/i,
      /\bLegal\s+notice\b/i,
      /\bArbitration\b/i
    ];

    it('ensures no template in DISPUTE_TEMPLATES contains guarantee or fraud accusations', () => {
      for (const tpl of DISPUTE_TEMPLATES) {
        for (const pattern of FORBIDDEN_WORDS) {
          const match = tpl.template.match(pattern);
          expect(
            match,
            `Template ${tpl.id} contains forbidden accusatory or guarantee word matching: ${pattern}`
          ).toBeNull();
        }
      }
    });

    it('ensures no template in DISPUTE_TEMPLATES contains legal or policy citations', () => {
      for (const tpl of DISPUTE_TEMPLATES) {
        for (const pattern of FORBIDDEN_POLICY_LEGAL) {
          const match = tpl.template.match(pattern);
          expect(
            match,
            `Template ${tpl.id} contains unapproved legal or policy citation matching: ${pattern}`
          ).toBeNull();
        }
      }
    });

    it('ensures all templates maintain a polite and factual salutation and sign-off', () => {
      for (const tpl of DISPUTE_TEMPLATES) {
        if (tpl.language === 'en') {
          expect(tpl.template).toContain('Dear Seller Support Team,');
          expect(tpl.template).toMatch(/Sincerely|Thank you/i);
        } else {
          expect(tpl.template).toContain('प्रिय सेलर सपोर्ट टीम,');
          expect(tpl.template).toMatch(/धन्यवाद|सादर/);
        }
      }
    });
  });
});

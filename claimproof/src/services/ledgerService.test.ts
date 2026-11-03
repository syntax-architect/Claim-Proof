import { describe, expect, it } from 'vitest';
import {
  computeLedgerTotals,
  computePlanRoi,
  createAuditEntry,
  exportClaimsToCSV,
  formatClaimStatus,
  normalizeClaimStatus,
  parseClaimsFromCSV,
  validateRupeeAmount,
  MAX_CLAIM_AMOUNT_RUPEES
} from './ledgerService';
import type { ClaimItem } from '../types';

describe('ledgerService — Pure Logic & Calculations', () => {
  describe('Status Normalization & Formatting', () => {
    it('normalizes legacy and variant statuses correctly', () => {
      expect(normalizeClaimStatus('not_filed')).toBe('not_filed');
      expect(normalizeClaimStatus('pending')).toBe('not_filed');
      expect(normalizeClaimStatus('prepared')).toBe('not_filed');
      expect(normalizeClaimStatus('not filed')).toBe('not_filed');
      expect(normalizeClaimStatus('filed')).toBe('filed');
      expect(normalizeClaimStatus('submitted')).toBe('filed');
      expect(normalizeClaimStatus('sent')).toBe('filed');
      expect(normalizeClaimStatus('won')).toBe('won');
      expect(normalizeClaimStatus('partly_won')).toBe('partly_won');
      expect(normalizeClaimStatus('partly won')).toBe('partly_won');
      expect(normalizeClaimStatus('partially_won')).toBe('partly_won');
      expect(normalizeClaimStatus('lost')).toBe('lost');
      expect(normalizeClaimStatus('')).toBe('not_filed');
      expect(normalizeClaimStatus(undefined)).toBe('not_filed');
    });

    it('formats claim status labels for UI display', () => {
      expect(formatClaimStatus('not_filed')).toBe('Not filed');
      expect(formatClaimStatus('pending')).toBe('Not filed');
      expect(formatClaimStatus('filed')).toBe('Filed');
      expect(formatClaimStatus('won')).toBe('Won');
      expect(formatClaimStatus('partly_won')).toBe('Partly won');
      expect(formatClaimStatus('lost')).toBe('Lost');
    });
  });

  describe('Rupee Amount Validation', () => {
    it('accepts valid numbers and converts to integer paise', () => {
      expect(validateRupeeAmount(499)).toEqual({ valid: true, paise: 49900 });
      expect(validateRupeeAmount('499')).toEqual({ valid: true, paise: 49900 });
      expect(validateRupeeAmount('1,234.50')).toEqual({ valid: true, paise: 123450 });
      expect(validateRupeeAmount(0)).toEqual({ valid: true, paise: 0 });
      expect(validateRupeeAmount('')).toEqual({ valid: true, paise: 0 });
      expect(validateRupeeAmount(null)).toEqual({ valid: true, paise: 0 });
    });

    it('rejects negative rupee amounts with actionable message', () => {
      const res = validateRupeeAmount(-100, 'Claim amount');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('cannot be negative');
      expect(res.error).toContain('0 or a positive rupee amount');
    });

    it('rejects huge amounts exceeding ceiling with actionable message', () => {
      const res = validateRupeeAmount(MAX_CLAIM_AMOUNT_RUPEES + 1, 'Claim amount');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('cannot exceed ₹1,00,00,000');
    });

    it('rejects non-numeric inputs', () => {
      const res = validateRupeeAmount('abc', 'Dispute amount');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('must be a valid number');
    });
  });

  describe('Ledger Totals & Metrics Calculation', () => {
    it('handles empty claims ledger cleanly with all zeros and null percentages', () => {
      const totals = computeLedgerTotals([]);
      expect(totals.totalCount).toBe(0);
      expect(totals.totalClaimedPaise).toBe(0);
      expect(totals.totalRecoveredPaise).toBe(0);
      expect(totals.resolvedCount).toBe(0);
      expect(totals.hasEnoughDataForPercentage).toBe(false);
      expect(totals.winRatePercent).toBeNull();
      expect(totals.recoveryRatePercent).toBeNull();
      expect(totals.claimsFiled.count).toBe(0);
      expect(totals.claimsWon.count).toBe(0);
      expect(totals.claimsPartlyWon.count).toBe(0);
      expect(totals.claimsLost.count).toBe(0);
      expect(totals.claimsPending.count).toBe(0);
    });

    it('strictly suppresses percentages when resolved claims < 10', () => {
      // 9 resolved claims (5 won, 4 lost)
      const claims: ClaimItem[] = [];
      for (let i = 0; i < 5; i++) {
        claims.push({
          awb: `AWB_WON_${i}`,
          orderId: `ORD_${i}`,
          marketplace: 'Meesho',
          courier: 'Delhivery',
          sku: 'SKU1',
          qty: 1,
          flagReason: 'Damaged',
          notes: '',
          returnScanAt: Date.now(),
          deadlineAt: Date.now() + 72 * 3600 * 1000,
          status: 'won',
          amountClaimedPaise: 50000,
          amountRecoveredPaise: 50000
        });
      }
      for (let i = 0; i < 4; i++) {
        claims.push({
          awb: `AWB_LOST_${i}`,
          orderId: `ORD_${i}`,
          marketplace: 'Flipkart',
          courier: 'Ekart',
          sku: 'SKU2',
          qty: 1,
          flagReason: 'Wrong/Swapped item',
          notes: '',
          returnScanAt: Date.now(),
          deadlineAt: Date.now() + 336 * 3600 * 1000,
          status: 'lost',
          amountClaimedPaise: 40000,
          amountRecoveredPaise: 0
        });
      }

      const totals = computeLedgerTotals(claims);
      expect(totals.resolvedCount).toBe(9);
      expect(totals.hasEnoughDataForPercentage).toBe(false);
      expect(totals.winRatePercent).toBeNull();
      expect(totals.recoveryRatePercent).toBeNull();
      expect(totals.claimsWon.count).toBe(5);
      expect(totals.claimsLost.count).toBe(4);
      expect(totals.totalRecoveredPaise).toBe(250000); // 5 * ₹500 = ₹2,500
    });

    it('unlocks and calculates accurate percentages at exactly 10 resolved claims', () => {
      // 7 won, 1 partly won, 2 lost = 10 resolved
      const claims: ClaimItem[] = [];
      for (let i = 0; i < 7; i++) {
        claims.push({
          awb: `AWB_WON_${i}`,
          orderId: `ORD_${i}`,
          marketplace: 'Meesho',
          courier: 'Delhivery',
          sku: 'SKU1',
          qty: 1,
          flagReason: 'Damaged',
          notes: '',
          returnScanAt: Date.now(),
          deadlineAt: Date.now() + 72 * 3600 * 1000,
          status: 'won',
          amountClaimedPaise: 100000, // ₹1,000
          amountRecoveredPaise: 100000 // ₹1,000
        });
      }
      claims.push({
        awb: 'AWB_PARTLY_1',
        orderId: 'ORD_P',
        marketplace: 'Amazon',
        courier: 'Delhivery',
        sku: 'SKU3',
        qty: 1,
        flagReason: 'Missing item',
        notes: '',
        returnScanAt: Date.now(),
        deadlineAt: Date.now() + 720 * 3600 * 1000,
        status: 'partly_won',
        amountClaimedPaise: 100000, // ₹1,000
        amountRecoveredPaise: 40000 // ₹400
      });
      for (let i = 0; i < 2; i++) {
        claims.push({
          awb: `AWB_LOST_${i}`,
          orderId: `ORD_${i}`,
          marketplace: 'Flipkart',
          courier: 'Ekart',
          sku: 'SKU2',
          qty: 1,
          flagReason: 'Empty package',
          notes: '',
          returnScanAt: Date.now(),
          deadlineAt: Date.now() + 336 * 3600 * 1000,
          status: 'lost',
          amountClaimedPaise: 100000, // ₹1,000
          amountRecoveredPaise: 0
        });
      }

      const totals = computeLedgerTotals(claims);
      expect(totals.resolvedCount).toBe(10);
      expect(totals.hasEnoughDataForPercentage).toBe(true);

      // Favorable outcomes = 7 won + 1 partly won = 8 out of 10 = 80.0%
      expect(totals.winRatePercent).toBe(80.0);

      // Total claimed across 10 claims = 10 * ₹1,000 = ₹10,000 (1000000 paise)
      // Total recovered = 7 * ₹1,000 + ₹400 = ₹7,400 (740000 paise)
      // Recovery rate = 7400 / 10000 = 74.0%
      expect(totals.totalRecoveredPaise).toBe(740000);
      expect(totals.recoveryRatePercent).toBe(74.0);
    });

    it('correctly categorizes pending, filed, won, partly won, and lost with rupee totals', () => {
      const claims: ClaimItem[] = [
        {
          awb: 'AWB_PENDING_1',
          orderId: 'ORD_1',
          marketplace: 'Meesho',
          courier: 'Delhivery',
          sku: 'SKU1',
          qty: 1,
          flagReason: 'Damaged',
          notes: '',
          returnScanAt: Date.now(),
          deadlineAt: Date.now() + 72 * 3600 * 1000,
          status: 'not_filed',
          amountClaimedPaise: 30000 // ₹300
        },
        {
          awb: 'AWB_FILED_1',
          orderId: 'ORD_2',
          marketplace: 'Flipkart',
          courier: 'Ekart',
          sku: 'SKU2',
          qty: 1,
          flagReason: 'Damaged',
          notes: '',
          returnScanAt: Date.now(),
          deadlineAt: Date.now() + 336 * 3600 * 1000,
          status: 'filed',
          amountClaimedPaise: 70000 // ₹700
        },
        {
          awb: 'AWB_WON_1',
          orderId: 'ORD_3',
          marketplace: 'Amazon',
          courier: 'Delhivery',
          sku: 'SKU3',
          qty: 1,
          flagReason: 'Used/Worn',
          notes: '',
          returnScanAt: Date.now(),
          deadlineAt: Date.now() + 720 * 3600 * 1000,
          status: 'won',
          amountClaimedPaise: 150000, // ₹1,500
          amountRecoveredPaise: 150000
        },
        {
          awb: 'AWB_PARTLY_1',
          orderId: 'ORD_4',
          marketplace: 'AJIO',
          courier: 'Delhivery',
          sku: 'SKU4',
          qty: 1,
          flagReason: 'Missing item',
          notes: '',
          returnScanAt: Date.now(),
          deadlineAt: Date.now() + 72 * 3600 * 1000,
          status: 'partly_won',
          amountClaimedPaise: 100000, // ₹1,000
          amountRecoveredPaise: 60000 // ₹600
        },
        {
          awb: 'AWB_LOST_1',
          orderId: 'ORD_5',
          marketplace: 'Meesho',
          courier: 'Valmo',
          sku: 'SKU5',
          qty: 1,
          flagReason: 'Empty package',
          notes: '',
          returnScanAt: Date.now(),
          deadlineAt: Date.now() + 72 * 3600 * 1000,
          status: 'lost',
          amountClaimedPaise: 50000, // ₹500
          amountRecoveredPaise: 0
        }
      ];

      const totals = computeLedgerTotals(claims);
      expect(totals.totalCount).toBe(5);
      expect(totals.claimsPending.count).toBe(1);
      expect(totals.claimsPending.claimedPaise).toBe(30000);
      expect(totals.claimsFiled.count).toBe(1);
      expect(totals.claimsFiled.claimedPaise).toBe(70000);
      expect(totals.claimsWon.count).toBe(1);
      expect(totals.claimsWon.recoveredPaise).toBe(150000);
      expect(totals.claimsPartlyWon.count).toBe(1);
      expect(totals.claimsPartlyWon.recoveredPaise).toBe(60000);
      expect(totals.claimsLost.count).toBe(1);
      expect(totals.claimsLost.claimedPaise).toBe(50000);
      expect(totals.totalRecoveredPaise).toBe(210000); // ₹1,500 + ₹600 = ₹2,100
      expect(totals.totalClaimedPaise).toBe(400000); // 300 + 700 + 1500 + 1000 + 500 = ₹4,000
    });
  });

  describe('Plan ROI Breakeven Meter', () => {
    it('returns null (hidden) when plan cost is not provided or zero', () => {
      expect(computePlanRoi(100000, null)).toBeNull();
      expect(computePlanRoi(100000, undefined)).toBeNull();
      expect(computePlanRoi(100000, 0)).toBeNull();
      expect(computePlanRoi(100000, -100)).toBeNull();
    });

    it('computes metrics when under breakeven', () => {
      // Recovered ₹2,000 vs ₹4,499 annual plan cost
      const res = computePlanRoi(200000, 449900);
      expect(res).not.toBeNull();
      expect(res?.paidForItself).toBe(false);
      expect(res?.ratioPercent).toBe(44.5);
      expect(res?.remainingPaise).toBe(249900);
      expect(res?.netGainPaise).toBe(-249900);
    });

    it('computes metrics when plan has paid for itself (breakeven reached)', () => {
      // Exactly breakeven: ₹4,499 recovered vs ₹4,499 cost
      const res1 = computePlanRoi(449900, 449900);
      expect(res1?.paidForItself).toBe(true);
      expect(res1?.ratioPercent).toBe(100.0);
      expect(res1?.netGainPaise).toBe(0);
      expect(res1?.remainingPaise).toBe(0);

      // Over breakeven: ₹10,000 recovered vs ₹4,499 cost
      const res2 = computePlanRoi(1000000, 449900);
      expect(res2?.paidForItself).toBe(true);
      expect(res2?.ratioPercent).toBe(222.3);
      expect(res2?.netGainPaise).toBe(550100); // +₹5,501 net gain
      expect(res2?.remainingPaise).toBe(0);
    });
  });

  describe('Audit Trail Creation', () => {
    it('creates structured audit entries capturing previous and new values', () => {
      const fromClaim: ClaimItem = {
        awb: 'AWB_AUDIT_1',
        orderId: 'ORD_1',
        marketplace: 'Meesho',
        courier: 'Delhivery',
        sku: 'KURTI',
        qty: 1,
        flagReason: 'Damaged',
        notes: 'Original note',
        returnScanAt: 1000000,
        deadlineAt: 1000000 + 72 * 3600 * 1000,
        status: 'filed',
        amountClaimedPaise: 50000,
        amountRecoveredPaise: 0
      };

      const audit = createAuditEntry({
        fromClaim,
        toClaim: {
          status: 'won',
          amountRecoveredPaise: 50000,
          notes: 'Payout approved by Meesho SAFE'
        },
        reason: 'Received seller panel credit',
        source: 'user_edit'
      });

      expect(audit.fromStatus).toBe('filed');
      expect(audit.toStatus).toBe('won');
      expect(audit.fromClaimedPaise).toBe(50000);
      expect(audit.toClaimedPaise).toBe(50000);
      expect(audit.fromRecoveredPaise).toBe(0);
      expect(audit.toRecoveredPaise).toBe(50000);
      expect(audit.reason).toBe('Received seller panel credit');
      expect(audit.source).toBe('user_edit');
      expect(audit.changedAt).toContain('IST');
    });
  });

  describe('CSV Export and Import Round-Trip', () => {
    it('exports claims to CSV and imports them back preserving all critical fields', () => {
      const originalClaims: ClaimItem[] = [
        {
          awb: 'AWB_CSV_1',
          orderId: 'ORD_CSV_1',
          marketplace: 'Meesho',
          courier: 'Delhivery',
          sku: 'SKU_SAREE_BLUE',
          qty: 2,
          flagReason: 'Damaged',
          notes: 'Torn packaging, stained garment',
          returnScanAt: 1700000000000,
          deadlineAt: 1700000000000 + 72 * 3600 * 1000,
          status: 'won',
          amountClaimedPaise: 85000, // ₹850
          amountRecoveredPaise: 85000, // ₹850
          filedAt: 1700000000000,
          resolvedAt: 1700010000000
        },
        {
          awb: 'AWB_CSV_2',
          orderId: 'ORD_CSV_2',
          marketplace: 'Flipkart',
          courier: 'Ekart',
          sku: 'SKU_JEANS_32',
          qty: 1,
          flagReason: 'Wrong/Swapped item',
          notes: 'Customer returned old worn pants',
          returnScanAt: 1700000000000,
          deadlineAt: 1700000000000 + 336 * 3600 * 1000,
          status: 'partly_won',
          amountClaimedPaise: 120000, // ₹1,200
          amountRecoveredPaise: 60000, // ₹600
          filedAt: 1700000000000,
          resolvedAt: 1700020000000
        },
        {
          awb: 'AWB_CSV_3',
          orderId: 'ORD_CSV_3',
          marketplace: 'Amazon',
          courier: 'Delhivery',
          sku: 'SKU_WATCH',
          qty: 1,
          flagReason: 'Empty package',
          notes: 'Box received completely empty',
          returnScanAt: 1700000000000,
          deadlineAt: 1700000000000 + 720 * 3600 * 1000,
          status: 'lost',
          amountClaimedPaise: 250000, // ₹2,500
          amountRecoveredPaise: 0,
          filedAt: 1700000000000,
          resolvedAt: 1700030000000
        }
      ];

      // 1. Export to CSV string
      const csvString = exportClaimsToCSV(originalClaims);
      expect(csvString).toContain(
        'AWB,Marketplace,Status,Amount Claimed (INR),Amount Recovered (INR)'
      );
      expect(csvString).toContain('AWB_CSV_1');
      expect(csvString).toContain('850.00');
      expect(csvString).toContain('AWB_CSV_2');
      expect(csvString).toContain('1200.00');
      expect(csvString).toContain('600.00');

      // 2. Import CSV string back
      const importResult = parseClaimsFromCSV(csvString);
      expect(importResult.errors).toHaveLength(0);
      expect(importResult.claims).toHaveLength(3);

      const [c1, c2, c3] = importResult.claims;

      // Assert row 1
      expect(c1.awb).toBe('AWB_CSV_1');
      expect(c1.marketplace).toBe('Meesho');
      expect(c1.status).toBe('won');
      expect(c1.amountClaimedPaise).toBe(85000);
      expect(c1.amountRecoveredPaise).toBe(85000);
      expect(c1.notes).toBe('Torn packaging, stained garment');
      expect(c1.auditTrail).toBeDefined();
      expect(c1.auditTrail?.[0].source).toBe('csv_import');

      // Assert row 2
      expect(c2.awb).toBe('AWB_CSV_2');
      expect(c2.marketplace).toBe('Flipkart');
      expect(c2.status).toBe('partly_won');
      expect(c2.amountClaimedPaise).toBe(120000);
      expect(c2.amountRecoveredPaise).toBe(60000);
      expect(c2.notes).toBe('Customer returned old worn pants');

      // Assert row 3
      expect(c3.awb).toBe('AWB_CSV_3');
      expect(c3.marketplace).toBe('Amazon');
      expect(c3.status).toBe('lost');
      expect(c3.amountClaimedPaise).toBe(250000);
      expect(c3.amountRecoveredPaise).toBe(0);
      expect(c3.notes).toBe('Box received completely empty');
    });

    it('rejects CSV with missing AWB header or corrupt data with actionable error', () => {
      const corruptCSV = 'Item,Price,Status\nShirt,500,Won';
      const res = parseClaimsFromCSV(corruptCSV);
      expect(res.claims).toHaveLength(0);
      expect(res.errors[0]).toContain('Missing required column "AWB"');
    });
  });
});

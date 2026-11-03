/**
 * Money & Claims Ledger Service for SABOOT Suite.
 *
 * Rules:
 * - Local-first, zero-cloud: all data stays in local IndexedDB.
 * - Integer paise: monetary values stored strictly in integer paise.
 * - No fake percentages: percentage metrics are only shown when at least 10 resolved
 *   claims exist, labeled explicitly as "your own results".
 * - Plain language errors with actionable next steps.
 * - IST-first timestamps.
 */

import { formatIST } from '../lib/dateUtils';
import { paiseToRupees, rupeesToPaise } from '../lib/money';
import type { ClaimAuditEntry, ClaimItem, ClaimStatus, Marketplace } from '../types';

export type CanonicalClaimStatus = 'not_filed' | 'filed' | 'won' | 'partly_won' | 'lost';

export const MAX_CLAIM_AMOUNT_RUPEES = 10_000_000; // ₹1,00,00,000 (1 Crore)
export const MAX_CLAIM_AMOUNT_PAISE = MAX_CLAIM_AMOUNT_RUPEES * 100;

/**
 * Normalizes legacy or variant status strings into standard canonical statuses.
 */
export function normalizeClaimStatus(status?: ClaimStatus | string): CanonicalClaimStatus {
  if (!status) return 'not_filed';
  const clean = status
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  switch (clean) {
    case 'won':
      return 'won';
    case 'partly_won':
    case 'partially_won':
    case 'partly':
      return 'partly_won';
    case 'lost':
      return 'lost';
    case 'filed':
    case 'submitted':
    case 'sent':
      return 'filed';
    case 'not_filed':
    case 'pending':
    case 'prepared':
    default:
      return 'not_filed';
  }
}

/**
 * Formats a claim status into a friendly user-facing label.
 */
export function formatClaimStatus(status?: ClaimStatus | string): string {
  const norm = normalizeClaimStatus(status);
  switch (norm) {
    case 'won':
      return 'Won';
    case 'partly_won':
      return 'Partly won';
    case 'lost':
      return 'Lost';
    case 'filed':
      return 'Filed';
    case 'not_filed':
      return 'Not filed';
  }
}

/**
 * Tone color mapping for status badges.
 */
export function claimStatusBadgeTone(
  status?: ClaimStatus | string
): 'neutral' | 'info' | 'proof' | 'warn' | 'danger' {
  const norm = normalizeClaimStatus(status);
  switch (norm) {
    case 'won':
      return 'proof';
    case 'partly_won':
      return 'warn';
    case 'lost':
      return 'danger';
    case 'filed':
      return 'info';
    case 'not_filed':
      return 'neutral';
  }
}

/**
 * Validates a rupee amount entered by the user.
 * Returns valid status, actionable error message, and computed integer paise.
 */
export function validateRupeeAmount(
  value: number | string | null | undefined,
  fieldName = 'Amount'
): { valid: boolean; error?: string; paise: number } {
  if (value === null || value === undefined || value === '') {
    return { valid: true, paise: 0 };
  }

  const num = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());

  if (isNaN(num)) {
    return {
      valid: false,
      error: `${fieldName} must be a valid number. Please enter a valid rupee amount (e.g. 499).`,
      paise: 0
    };
  }

  if (num < 0) {
    return {
      valid: false,
      error: `${fieldName} cannot be negative. Please enter 0 or a positive rupee amount.`,
      paise: 0
    };
  }

  if (num > MAX_CLAIM_AMOUNT_RUPEES) {
    return {
      valid: false,
      error: `${fieldName} cannot exceed ₹1,00,00,000. Please verify the amount and enter a realistic value.`,
      paise: 0
    };
  }

  return {
    valid: true,
    paise: rupeesToPaise(num)
  };
}

/**
 * Creates an audit log entry for changes made to a claim.
 */
export function createAuditEntry(params: {
  fromClaim?: ClaimItem;
  toClaim: Partial<ClaimItem>;
  reason?: string;
  source?: 'user_edit' | 'csv_import' | 'system';
}): ClaimAuditEntry {
  const now = Date.now();
  const fromClaim = params.fromClaim;
  const to = params.toClaim;

  return {
    timestamp: now,
    changedAt: formatIST(now),
    fromStatus: fromClaim?.status,
    toStatus: to.status ?? fromClaim?.status,
    fromClaimedPaise: fromClaim?.amountClaimedPaise,
    toClaimedPaise: to.amountClaimedPaise ?? fromClaim?.amountClaimedPaise,
    fromRecoveredPaise: fromClaim?.amountRecoveredPaise,
    toRecoveredPaise: to.amountRecoveredPaise ?? fromClaim?.amountRecoveredPaise,
    notes: to.notes ?? fromClaim?.notes,
    reason: params.reason || undefined,
    source: params.source ?? 'user_edit'
  };
}

export type LedgerDateFilter = 'all' | 'today' | 'last7' | 'last30' | 'thisMonth' | 'custom';

export interface LedgerTotals {
  totalCount: number;
  claimsFiled: { count: number; claimedPaise: number };
  claimsWon: { count: number; claimedPaise: number; recoveredPaise: number };
  claimsPartlyWon: { count: number; claimedPaise: number; recoveredPaise: number };
  claimsLost: { count: number; claimedPaise: number };
  claimsPending: { count: number; claimedPaise: number };
  totalRecoveredPaise: number;
  totalClaimedPaise: number;
  resolvedCount: number;
  /** True strictly when at least 10 resolved claims exist. */
  hasEnoughDataForPercentage: boolean;
  /** Dispute resolution percentage computed from user data (null if < 10 resolved claims). */
  winRatePercent: number | null;
  /** Recovery rate percentage computed from user data (null if < 10 resolved claims). */
  recoveryRatePercent: number | null;
}

/**
 * Filters claims based on the selected date range.
 * Uses IST boundaries for clean local day cuts.
 */
export function filterClaimsByDate(
  claims: ClaimItem[],
  filter: LedgerDateFilter,
  customRange?: { startMs: number; endMs: number },
  now: number = Date.now()
): ClaimItem[] {
  if (filter === 'all') return claims;

  // Compute IST start of today
  const istDateString = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(now));

  const todayStartMs = new Date(`${istDateString}T00:00:00+05:30`).getTime();
  const todayEndMs = todayStartMs + 24 * 3600 * 1000 - 1;

  let startThreshold = 0;
  let endThreshold = Infinity;

  switch (filter) {
    case 'today':
      startThreshold = todayStartMs;
      endThreshold = todayEndMs;
      break;
    case 'last7':
      startThreshold = todayStartMs - 6 * 24 * 3600 * 1000;
      endThreshold = now;
      break;
    case 'last30':
      startThreshold = todayStartMs - 29 * 24 * 3600 * 1000;
      endThreshold = now;
      break;
    case 'thisMonth': {
      const yearMonth = istDateString.slice(0, 7);
      startThreshold = new Date(`${yearMonth}-01T00:00:00+05:30`).getTime();
      endThreshold = now;
      break;
    }
    case 'custom':
      if (customRange) {
        startThreshold = customRange.startMs;
        endThreshold = customRange.endMs;
      }
      break;
  }

  return claims.filter((c) => {
    // Primary date of relevance: resolvedAt -> filedAt -> returnScanAt
    const claimDate = c.resolvedAt || c.filedAt || c.returnScanAt || 0;
    return claimDate >= startThreshold && claimDate <= endThreshold;
  });
}

/**
 * Computes counts and rupee totals from user claims data.
 * Adheres strictly to the rule:
 * No percentages are computed or returned unless at least 10 resolved claims exist.
 */
export function computeLedgerTotals(claims: ClaimItem[]): LedgerTotals {
  let totalClaimedPaise = 0;
  let totalRecoveredPaise = 0;

  const claimsFiled = { count: 0, claimedPaise: 0 };
  const claimsWon = { count: 0, claimedPaise: 0, recoveredPaise: 0 };
  const claimsPartlyWon = { count: 0, claimedPaise: 0, recoveredPaise: 0 };
  const claimsLost = { count: 0, claimedPaise: 0 };
  const claimsPending = { count: 0, claimedPaise: 0 };

  for (const claim of claims) {
    const claimed = Math.max(0, claim.amountClaimedPaise || 0);
    const recovered = Math.max(0, claim.amountRecoveredPaise || 0);
    const norm = normalizeClaimStatus(claim.status);

    totalClaimedPaise += claimed;

    switch (norm) {
      case 'won':
        claimsWon.count++;
        claimsWon.claimedPaise += claimed;
        claimsWon.recoveredPaise += recovered;
        totalRecoveredPaise += recovered;
        break;
      case 'partly_won':
        claimsPartlyWon.count++;
        claimsPartlyWon.claimedPaise += claimed;
        claimsPartlyWon.recoveredPaise += recovered;
        totalRecoveredPaise += recovered;
        break;
      case 'lost':
        claimsLost.count++;
        claimsLost.claimedPaise += claimed;
        break;
      case 'filed':
        claimsFiled.count++;
        claimsFiled.claimedPaise += claimed;
        break;
      case 'not_filed':
      default:
        claimsPending.count++;
        claimsPending.claimedPaise += claimed;
        break;
    }
  }

  const resolvedCount = claimsWon.count + claimsPartlyWon.count + claimsLost.count;
  const hasEnoughDataForPercentage = resolvedCount >= 10;

  let winRatePercent: number | null = null;
  let recoveryRatePercent: number | null = null;

  if (hasEnoughDataForPercentage && resolvedCount > 0) {
    // Both won and partly won count towards favorable outcome
    const favorableCount = claimsWon.count + claimsPartlyWon.count;
    winRatePercent = Number(((favorableCount / resolvedCount) * 100).toFixed(1));

    const resolvedClaimed =
      claimsWon.claimedPaise + claimsPartlyWon.claimedPaise + claimsLost.claimedPaise;
    if (resolvedClaimed > 0) {
      recoveryRatePercent = Number(((totalRecoveredPaise / resolvedClaimed) * 100).toFixed(1));
    } else {
      recoveryRatePercent = 0;
    }
  }

  return {
    totalCount: claims.length,
    claimsFiled,
    claimsWon,
    claimsPartlyWon,
    claimsLost,
    claimsPending,
    totalRecoveredPaise,
    totalClaimedPaise,
    resolvedCount,
    hasEnoughDataForPercentage,
    winRatePercent,
    recoveryRatePercent
  };
}

export interface PlanRoiResult {
  planCostPaise: number;
  totalRecoveredPaise: number;
  ratioPercent: number;
  paidForItself: boolean;
  netGainPaise: number;
  remainingPaise: number;
}

/**
 * Computes "Plan has paid for itself" metrics.
 * Hidden if user has entered no plan cost and no recoveries exist.
 */
export function computePlanRoi(
  totalRecoveredPaise: number,
  planCostPaise: number | null | undefined
): PlanRoiResult | null {
  if (planCostPaise === null || planCostPaise === undefined || planCostPaise <= 0) {
    return null;
  }

  const ratio = (totalRecoveredPaise / planCostPaise) * 100;
  const paidForItself = totalRecoveredPaise >= planCostPaise;
  const netGainPaise = totalRecoveredPaise - planCostPaise;
  const remainingPaise = Math.max(0, planCostPaise - totalRecoveredPaise);

  return {
    planCostPaise,
    totalRecoveredPaise,
    ratioPercent: Number(ratio.toFixed(1)),
    paidForItself,
    netGainPaise,
    remainingPaise
  };
}

/**
 * Escapes a string field for standard RFC 4180 CSV export.
 */
function escapeCSVField(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return '';
  const s = String(str);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Exports claims ledger to CSV string with headers.
 */
export function exportClaimsToCSV(claims: ClaimItem[]): string {
  const headers = [
    'AWB',
    'Marketplace',
    'Status',
    'Amount Claimed (INR)',
    'Amount Recovered (INR)',
    'Filed Date (IST)',
    'Resolved Date (IST)',
    'Order ID',
    'SKU',
    'Quantity',
    'Courier',
    'Flag Reason',
    'Notes'
  ];

  const rows = claims.map((c) => {
    const claimedRupees = paiseToRupees(c.amountClaimedPaise || 0).toFixed(2);
    const recoveredRupees = paiseToRupees(c.amountRecoveredPaise || 0).toFixed(2);
    const filedDate = c.filedAt ? formatIST(c.filedAt) : '';
    const resolvedDate = c.resolvedAt ? formatIST(c.resolvedAt) : '';

    return [
      escapeCSVField(c.awb),
      escapeCSVField(c.marketplace),
      escapeCSVField(formatClaimStatus(c.status)),
      escapeCSVField(claimedRupees),
      escapeCSVField(recoveredRupees),
      escapeCSVField(filedDate),
      escapeCSVField(resolvedDate),
      escapeCSVField(c.orderId || ''),
      escapeCSVField(c.sku || ''),
      escapeCSVField(c.qty ?? 1),
      escapeCSVField(c.courier || ''),
      escapeCSVField(c.flagReason || ''),
      escapeCSVField(c.notes || '')
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Parses CSV text lines handling quoted fields with commas and line breaks.
 */
function parseCSVRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // skip next quote
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') i++;
        currentRow.push(currentField.trim());
        if (currentRow.some((f) => f.length > 0)) rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some((f) => f.length > 0)) rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) rows.push(currentRow);
  }

  return rows;
}

export interface CSVImportResult {
  claims: Partial<ClaimItem>[];
  errors: string[];
  totalRows: number;
}

/**
 * Imports and validates claims from CSV string.
 */
export function parseClaimsFromCSV(csvText: string): CSVImportResult {
  const rows = parseCSVRows(csvText);
  const errors: string[] = [];
  const claims: Partial<ClaimItem>[] = [];

  if (rows.length === 0) {
    errors.push('The CSV file is empty. Please select a valid CSV ledger with headers.');
    return { claims, errors, totalRows: 0 };
  }

  const rawHeaders = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const headerMap: Record<string, number> = {};

  rawHeaders.forEach((h, index) => {
    if (h.includes('awb') || h.includes('tracking')) headerMap['awb'] = index;
    else if (h.includes('marketplace') || h.includes('platform')) headerMap['marketplace'] = index;
    else if (h.includes('status')) headerMap['status'] = index;
    else if (h.includes('claimed') || h.includes('claimamount')) headerMap['claimed'] = index;
    else if (h.includes('recovered') || h.includes('recoveredamount'))
      headerMap['recovered'] = index;
    else if (h.includes('filed')) headerMap['filedAt'] = index;
    else if (h.includes('resolved')) headerMap['resolvedAt'] = index;
    else if (h.includes('order')) headerMap['orderId'] = index;
    else if (h.includes('sku')) headerMap['sku'] = index;
    else if (h.includes('notes') || h.includes('comment')) headerMap['notes'] = index;
  });

  if (headerMap['awb'] === undefined) {
    errors.push('Missing required column "AWB" in CSV header. Please include an AWB column.');
    return { claims, errors, totalRows: rows.length - 1 };
  }

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const awbRaw = row[headerMap['awb']] || '';
    const awb = awbRaw.trim().toUpperCase();

    if (!awb) {
      errors.push(`Row ${rowIndex + 1}: Missing AWB number. Row was skipped.`);
      continue;
    }

    const marketplace = (
      headerMap['marketplace'] !== undefined ? row[headerMap['marketplace']] || 'Meesho' : 'Meesho'
    ) as Marketplace;
    const statusRaw = headerMap['status'] !== undefined ? row[headerMap['status']] || '' : '';
    const status = normalizeClaimStatus(statusRaw);

    const claimedRaw = headerMap['claimed'] !== undefined ? row[headerMap['claimed']] : '0';
    const recoveredRaw = headerMap['recovered'] !== undefined ? row[headerMap['recovered']] : '0';

    const valClaimed = validateRupeeAmount(claimedRaw, `Row ${rowIndex + 1} claimed amount`);
    if (!valClaimed.valid) {
      errors.push(valClaimed.error!);
      continue;
    }

    const valRecovered = validateRupeeAmount(recoveredRaw, `Row ${rowIndex + 1} recovered amount`);
    if (!valRecovered.valid) {
      errors.push(valRecovered.error!);
      continue;
    }

    const notes = headerMap['notes'] !== undefined ? row[headerMap['notes']] || '' : '';
    const orderId = headerMap['orderId'] !== undefined ? row[headerMap['orderId']] || '' : '';
    const sku = headerMap['sku'] !== undefined ? row[headerMap['sku']] || '' : '';

    const now = Date.now();
    const auditEntry: ClaimAuditEntry = {
      timestamp: now,
      changedAt: formatIST(now),
      fromStatus: undefined,
      toStatus: status,
      fromClaimedPaise: undefined,
      toClaimedPaise: valClaimed.paise,
      fromRecoveredPaise: undefined,
      toRecoveredPaise: valRecovered.paise,
      notes: notes || undefined,
      reason: 'CSV Ledger Import',
      source: 'csv_import'
    };

    claims.push({
      awb,
      marketplace,
      status,
      amountClaimedPaise: valClaimed.paise,
      amountRecoveredPaise: valRecovered.paise,
      orderId,
      sku,
      notes,
      auditTrail: [auditEntry]
    });
  }

  return {
    claims,
    errors,
    totalRows: rows.length - 1
  };
}

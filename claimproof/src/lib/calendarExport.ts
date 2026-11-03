/* RFC 5545 iCalendar (.ics) export engine for ClaimRadar dispute deadlines.
 * Generates downloadable calendar reminders with 24-hour and 6-hour alarm triggers.
 * Zero external dependencies; all timestamps formatted in UTC with IST references in descriptions.
 */

import { formatIST } from './dateUtils';
import { downloadBlob } from './utils';
import type { ClaimItem } from '../types';

function toIcsUtc(ms: number): string {
  const d = new Date(ms);
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function sanitizeAwb(awb: string): string {
  return awb.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Generates an RFC 5545 iCalendar content string for an active return claim deadline.
 */
export function generateClaimIcs(claim: ClaimItem): string {
  const nowUtc = toIcsUtc(Date.now());
  const startUtc = toIcsUtc(claim.deadlineAt);
  // 30 minute event block at deadline
  const endUtc = toIcsUtc(claim.deadlineAt + 30 * 60 * 1000);
  const safeAwb = sanitizeAwb(claim.awb);
  const istDeadline = formatIST(claim.deadlineAt);

  const summary = `File ${claim.marketplace} Dispute Claim — AWB ${claim.awb}`;
  const description = [
    `Marketplace dispute filing deadline for parcel ${claim.awb}.`,
    `Marketplace: ${claim.marketplace}`,
    `Order ID: ${claim.orderId || 'N/A'}`,
    `SKU: ${claim.sku} (Qty: ${claim.qty})`,
    `Reason: ${claim.flagReason}`,
    `Filing Deadline (IST): ${istDeadline}`,
    '',
    'Exported locally from SABOOT Suite. All data remains on this device.'
  ].join('\\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SABOOT Suite//ClaimRadar Pro//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:saboot-claim-${safeAwb}-${claim.deadlineAt}@saboot.local`,
    `DTSTAMP:${nowUtc}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    'STATUS:CONFIRMED',
    // 24-hour warning alarm
    'BEGIN:VALARM',
    'TRIGGER:-PT24H',
    'ACTION:DISPLAY',
    `DESCRIPTION:24 hours remaining to file ${claim.marketplace} claim for AWB ${claim.awb}`,
    'END:VALARM',
    // 6-hour urgent alarm
    'BEGIN:VALARM',
    'TRIGGER:-PT6H',
    'ACTION:DISPLAY',
    `DESCRIPTION:URGENT: 6 hours remaining to file ${claim.marketplace} claim for AWB ${claim.awb}!`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

/**
 * Triggers a browser download of the .ics calendar file for the given claim.
 */
export function downloadClaimIcs(claim: ClaimItem): void {
  const content = generateClaimIcs(claim);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const filename = `${sanitizeAwb(claim.awb)}_Dispute_Deadline.ics`;
  downloadBlob(blob, filename);
}

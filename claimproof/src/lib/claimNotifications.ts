/* Optional browser notification manager for ClaimRadar dispute deadlines.
 * Requests notification permissions with an explicit, plain-language explanation.
 * Sends local reminders at 24 hours and 6 hours before dispute windows close.
 */

import { formatISTShort } from './dateUtils';
import type { ClaimItem } from '../types';

const NOTIFICATIONS_STORAGE_KEY = 'saboot_claim_notifications_enabled';
const NOTIFIED_24H_STORAGE_KEY = 'saboot_notified_24h_claims';
const NOTIFIED_6H_STORAGE_KEY = 'saboot_notified_6h_claims';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export function isClaimNotificationsEnabled(): boolean {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  try {
    return localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setClaimNotificationsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('cp-notifications-toggled', { detail: { enabled } }));
  } catch {
    // ignore in restricted storage environments
  }
}

/**
 * Requests browser notification permission after the user has reviewed
 * the plain-language explanation.
 */
export async function requestClaimNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    throw new Error('Browser notifications are not supported on this device.');
  }

  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    setClaimNotificationsEnabled(true);
  } else {
    setClaimNotificationsEnabled(false);
  }
  return permission;
}

function getNotifiedSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function recordNotified(key: string, id: string): void {
  try {
    const set = getNotifiedSet(key);
    set.add(id);
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

/**
 * Checks active claims and fires browser notifications when a claim enters
 * the 24h warning or 6h critical window.
 */
export function checkAndSendClaimNotifications(claims: ClaimItem[]): void {
  if (!isClaimNotificationsEnabled()) return;

  const notified24h = getNotifiedSet(NOTIFIED_24H_STORAGE_KEY);
  const notified6h = getNotifiedSet(NOTIFIED_6H_STORAGE_KEY);
  const now = Date.now();

  for (const claim of claims) {
    if (claim.status !== 'pending' && claim.status !== 'prepared') continue;
    if (claim.id === undefined) continue;

    const msLeft = claim.deadlineAt - now;
    const claimKey = `${claim.id}_${claim.deadlineAt}`;

    // 6-hour critical window
    if (msLeft > 0 && msLeft <= 6 * 3_600_000) {
      if (!notified6h.has(claimKey)) {
        try {
          new Notification(`URGENT: 6h Left — ${claim.marketplace} Claim (${claim.awb})`, {
            body: `Dispute deadline expires in less than 6 hours at ${formatISTShort(claim.deadlineAt)} IST. Submit your video evidence now.`,
            icon: '/favicon.ico',
            tag: `claim-6h-${claimKey}`
          });
          recordNotified(NOTIFIED_6H_STORAGE_KEY, claimKey);
        } catch {
          // notification construct error
        }
      }
    }
    // 24-hour warning window
    else if (msLeft > 6 * 3_600_000 && msLeft <= 24 * 3_600_000) {
      if (!notified24h.has(claimKey)) {
        try {
          new Notification(`Dispute Deadline Reminder: 24h Left for ${claim.awb}`, {
            body: `${claim.marketplace} claim window closes in 24 hours at ${formatISTShort(claim.deadlineAt)} IST. Prepare your claim kit.`,
            icon: '/favicon.ico',
            tag: `claim-24h-${claimKey}`
          });
          recordNotified(NOTIFIED_24H_STORAGE_KEY, claimKey);
        } catch {
          // notification construct error
        }
      }
    }
  }
}

/* IST-first date helpers. Every timestamp shown to the seller is IST. */

const IST = 'Asia/Kolkata';

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: IST,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
});

function istParts(d: Date = new Date()): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of partsFmt.formatToParts(d)) map[p.type] = p.value;
  if (map.hour === '24') map.hour = '00';
  return map;
}

/** `2026-10-31` in IST. */
export function istDateKey(d: Date = new Date()): string {
  const p = istParts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/** `31-Oct-2026 16:35:12 IST` — the forensic-bar timestamp format. */
export function formatIST(ms: number): string {
  const p = istParts(new Date(ms));
  const month = new Intl.DateTimeFormat('en-GB', { timeZone: IST, month: 'short' })
    .format(new Date(ms));
  const h12 = String(Number(p.hour) % 12 === 0 ? 12 : Number(p.hour) % 12).padStart(2, '0');
  const ampm = Number(p.hour) < 12 ? 'AM' : 'PM';
  return `${p.day}-${month}-${p.year} ${h12}:${p.minute}:${p.second} ${ampm} IST`;
}

/** `31 Oct, 4:35 PM`. */
export function formatISTShort(ms: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(new Date(ms));
}

/** `31-Oct`. */
export function ddMmm(ms: number): string {
  const p = istParts(new Date(ms));
  const month = new Intl.DateTimeFormat('en-GB', { timeZone: IST, month: 'short' }).format(
    new Date(ms)
  );
  return `${p.day}-${month}`;
}

export function msUntil(deadline: number): number {
  return deadline - Date.now();
}

/** `47h 12m 09s` / `12m 03s` / `Expired`. */
export function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return 'Expired';
  const totalSec = Math.floor(msLeft / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export type DeadlineTone = 'ok' | 'warn' | 'urgent' | 'expired';

export function deadlineTone(msLeft: number): DeadlineTone {
  if (msLeft <= 0) return 'expired';
  if (msLeft <= 8 * 3_600_000) return 'urgent';
  if (msLeft <= 24 * 3_600_000) return 'warn';
  return 'ok';
}

export function greeting(d: Date = new Date()): string {
  const p = istParts(d);
  const h = Number(p.hour);
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

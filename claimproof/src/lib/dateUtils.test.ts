import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ddMmm,
  deadlineTone,
  formatCountdown,
  formatIST,
  formatISTShort,
  greeting,
  istDateKey,
  msUntil
} from './dateUtils';

describe('dateUtils — IST-first date and time helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('istDateKey', () => {
    it('formats IST date key YYYY-MM-DD from given date or current time', () => {
      // 2026-10-31 23:30:00 IST = 18:00:00 UTC
      const date1 = new Date('2026-10-31T18:00:00Z');
      expect(istDateKey(date1)).toBe('2026-10-31');

      // 2026-11-01 00:30:00 IST = 2026-10-31 19:00:00 UTC
      const date2 = new Date('2026-10-31T19:00:00Z');
      expect(istDateKey(date2)).toBe('2026-11-01');

      // Default argument uses current time
      vi.setSystemTime(date2);
      expect(istDateKey()).toBe('2026-11-01');
    });
  });

  describe('formatIST (forensic overlay format)', () => {
    it('formats timestamp into DD-MMM-YYYY HH:mm:ss a IST', () => {
      // 2026-10-31 16:35:12 IST = 2026-10-31 11:05:12 UTC
      const ms = new Date('2026-10-31T11:05:12Z').getTime();
      const str = formatIST(ms);
      expect(str).toContain('31-Oct-2026 04:35:12 PM IST');
    });

    it('formats midnight and noon correctly in 12-hour format', () => {
      // Midnight IST: 2026-11-01 00:00:00 IST = 2026-10-31 18:30:00 UTC
      const midnight = new Date('2026-10-31T18:30:00Z').getTime();
      expect(formatIST(midnight)).toContain('12:00:00 AM IST');

      // Noon IST: 2026-11-01 12:00:00 IST = 2026-11-01 06:30:00 UTC
      const noon = new Date('2026-11-01T06:30:00Z').getTime();
      expect(formatIST(noon)).toContain('12:00:00 PM IST');
    });
  });

  describe('formatISTShort', () => {
    it('formats short IST timestamp with day, month, time and AM/PM', () => {
      const ms = new Date('2026-10-31T11:05:00Z').getTime();
      const str = formatISTShort(ms);
      expect(str).toMatch(/31 Oct.*4:35\s*pm/i);
    });
  });

  describe('ddMmm', () => {
    it('formats day-month string in IST', () => {
      const ms = new Date('2026-10-31T18:00:00Z').getTime();
      expect(ddMmm(ms)).toBe('31-Oct');

      const nextDayMs = new Date('2026-10-31T19:00:00Z').getTime();
      expect(ddMmm(nextDayMs)).toBe('01-Nov');
    });
  });

  describe('msUntil', () => {
    it('computes remaining milliseconds from Date.now() to deadline', () => {
      vi.setSystemTime(10000);
      expect(msUntil(25000)).toBe(15000);
      expect(msUntil(5000)).toBe(-5000);
    });
  });

  describe('formatCountdown', () => {
    it('returns "Expired" for zero or negative milliseconds', () => {
      expect(formatCountdown(0)).toBe('Expired');
      expect(formatCountdown(-1)).toBe('Expired');
      expect(formatCountdown(-100000)).toBe('Expired');
    });

    it('formats remaining hours, minutes, and seconds', () => {
      const hoursMs = (2 * 3600 + 15 * 60 + 9) * 1000;
      expect(formatCountdown(hoursMs)).toBe('2h 15m 09s');

      const minutesMs = (4 * 60 + 3) * 1000;
      expect(formatCountdown(minutesMs)).toBe('4m 03s');

      const secondsOnly = 45 * 1000;
      expect(formatCountdown(secondsOnly)).toBe('0m 45s');
    });
  });

  describe('deadlineTone', () => {
    it('returns expired when msLeft <= 0', () => {
      expect(deadlineTone(0)).toBe('expired');
      expect(deadlineTone(-100)).toBe('expired');
    });

    it('returns urgent when msLeft <= 8 hours', () => {
      expect(deadlineTone(8 * 3600 * 1000)).toBe('urgent');
      expect(deadlineTone(3600 * 1000)).toBe('urgent');
    });

    it('returns warn when msLeft <= 24 hours', () => {
      expect(deadlineTone(24 * 3600 * 1000)).toBe('warn');
      expect(deadlineTone(9 * 3600 * 1000)).toBe('warn');
    });

    it('returns ok when msLeft > 24 hours', () => {
      expect(deadlineTone(25 * 3600 * 1000)).toBe('ok');
      expect(deadlineTone(72 * 3600 * 1000)).toBe('ok');
    });
  });

  describe('greeting', () => {
    it('gives contextual IST greetings according to the hour of day', () => {
      // 03:00 IST -> Midnight oil
      const night = new Date('2026-10-31T21:30:00Z');
      expect(greeting(night)).toBe('Burning the midnight oil');

      // 09:00 IST -> Good morning
      const morning = new Date('2026-11-01T03:30:00Z');
      expect(greeting(morning)).toBe('Good morning');

      // 14:00 IST -> Good afternoon
      const afternoon = new Date('2026-11-01T08:30:00Z');
      expect(greeting(afternoon)).toBe('Good afternoon');

      // 19:00 IST -> Good evening
      const evening = new Date('2026-11-01T13:30:00Z');
      expect(greeting(evening)).toBe('Good evening');

      // Default uses current time
      vi.setSystemTime(morning);
      expect(greeting()).toBe('Good morning');
    });
  });
});

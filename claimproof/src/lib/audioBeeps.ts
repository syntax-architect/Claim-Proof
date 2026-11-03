/* Web Audio beeps — zero external audio assets, works fully offline.
 * Distinct acoustic signatures so a packer never has to look at the screen. */

let ctx: AudioContext | null = null;

/* User-facing mute (Settings / command palette) — persisted. */
let muted = (() => {
  try {
    return localStorage.getItem('cp_beeps_muted') === '1';
  } catch {
    return false;
  }
})();

export function setBeepsMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem('cp_beeps_muted', m ? '1' : '0');
  } catch {
    /* private mode */
  }
}

export function isBeepsMuted(): boolean {
  return muted;
}

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  at: number,
  dur: number,
  type: OscillatorType = 'square',
  vol = 0.16,
  endFreq?: number
): void {
  const c = ac();
  if (!c) return;
  if (muted) return;
  try {
    const t0 = c.currentTime + at;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch {
    /* audio is best-effort */
  }
}

/** Rising two-tone — a recording has STARTED for the scanned AWB. */
export function playStartBeep(): void {
  tone(880, 0, 0.09);
  tone(1318.5, 0.1, 0.16);
}

/** Double chirp — clip SAVED to the vault. */
export function playSavedBeep(): void {
  tone(1174.7, 0, 0.07);
  tone(1174.7, 0.13, 0.11);
}

/** Single soft sine — barcode detected / UI confirm. */
export function playScanBeep(): void {
  tone(1046.5, 0, 0.07, 'sine', 0.2);
}

/** Crisp high sine tone — valid barcode scan confirmation. */
export function playGoodScanBeep(): void {
  tone(1046.5, 0, 0.07, 'sine', 0.22);
}

/** Distinct descending sawtooth buzz — invalid or rejected barcode scan. */
export function playInvalidScanBeep(): void {
  tone(280, 0, 0.18, 'sawtooth', 0.18, 140);
}

/** Low sawtooth growl — error / quota reached. */
export function playErrorBeep(): void {
  tone(196, 0, 0.32, 'sawtooth', 0.14, 130.8);
}

/** Alarm triplet — bad return FLAGGED (F2). */
export function playFlagBeep(): void {
  tone(987.77, 0, 0.09);
  tone(783.99, 0.12, 0.09);
  tone(987.77, 0.24, 0.16);
}

/** Tiny triangle blip — photo frame captured. */
export function playShutterTick(): void {
  tone(1568, 0, 0.035, 'triangle', 0.11);
}

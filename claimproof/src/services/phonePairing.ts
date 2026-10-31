/* Phone-as-Scanner Companion — pairs a smartphone camera scanner to the PC
 * packing station over a Supabase Realtime broadcast channel keyed by a 6-digit
 * room code (shown as a QR). Zero custom server: the free Supabase tier carries it.
 *
 * Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to be set at build time.
 * The companion page (hosted PWA route /pair) scans barcodes and broadcasts
 * `{ event: 'scan', payload: { code } }` on channel `claimproof-room-<code>`. */

export function isPhonePairingConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return Boolean(url && key);
}

export function newRoomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function pairingQrPayload(code: string): string {
  return `https://app.claimproof.in/pair?room=${code}`;
}

export interface PhonePairingSession {
  code: string;
  dispose: () => void;
}

export async function startPhonePairing(onScan: (code: string) => void): Promise<PhonePairingSession> {
  if (!isPhonePairingConfigured()) {
    throw new Error(
      'Phone pairing is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then rebuild.'
    );
  }
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(
    import.meta.env.VITE_SUPABASE_URL as string,
    import.meta.env.VITE_SUPABASE_ANON_KEY as string
  );
  const code = newRoomCode();
  const channel = client.channel(`claimproof-room-${code}`, {
    config: { broadcast: { self: false } }
  });
  channel.on('broadcast', { event: 'scan' }, (message: { payload?: { code?: string } }) => {
    const scanned = message?.payload?.code;
    if (scanned) onScan(scanned);
  });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Pairing channel subscribe timed out.')),
      8000
    );
    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
  return {
    code,
    dispose: () => {
      void client.removeChannel(channel);
    }
  };
}

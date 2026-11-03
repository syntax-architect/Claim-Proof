import { BRAND } from '../config/brand';
import { assertNoMediaInSignaling } from './signalingPrivacy';

/* Phone Companion Service — pairs a smartphone camera & scanner to the PC
 * workstation over a Supabase Realtime signaling channel.
 *
 * Acceptance Criteria & AGENTS.md Rules:
 * - Rule 4 (Zero-Cloud): Signaling channel carries ONLY connection handshakes
 *   (token auth, SDP offer/answer, ICE candidates). NEVER media or video.
 * - Criterion 1: QR pairing with short-lived (2-minute) single-use token.
 * - Criterion 2: Live preview via WebRTC peer-to-peer.
 * - Edge Cases: Token expiry, single-use invalidation, two phones paired rejection.
 */

export const PAIRING_TOKEN_TTL_MS = 120_000; // 2 minutes (120 seconds)

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

export function getSupabaseConfig(): { url?: string; key?: string } {
  const url = (import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
    import.meta.env.SUPABASE_URL) as string | undefined;

  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    import.meta.env.SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.SUPABASE_ANON_KEY) as string | undefined;

  return { url, key };
}

export function isPhonePairingConfigured(): boolean {
  const { url, key } = getSupabaseConfig();
  return Boolean(url && key);
}

export function newRoomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function generatePairingToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  return Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
}

/**
 * Constructs the QR code URL payload deep-linking to the phone companion route.
 */
export function pairingQrPayload(code: string, token = ''): string {
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
  return `https://app.${BRAND.domain}/#pair?room=${encodeURIComponent(code)}${tokenParam}`;
}

export type PairingStatus = 'waiting' | 'paired' | 'expired' | 'disposed';

export interface PhonePairingSession {
  code: string;
  token: string;
  expiresAt: number;
  isExpired: () => boolean;
  getStatus: () => PairingStatus;
  getPairedDeviceId: () => string | null;
  sendSignal: (signal: unknown) => Promise<void>;
  dispose: () => void;
}

export interface StationPairingOptions {
  ttlMs?: number;
  onScan?: (code: string) => void;
  onPhoneConnected?: (info: { deviceId: string }) => void;
  onPhoneDisconnected?: () => void;
  onSignal?: (signal: unknown) => void;
}

/**
 * Initializes a pairing room on the PC workstation.
 * Generates a 2-minute single-use token and listens for phone authentication & WebRTC signaling.
 */
export async function startPhonePairing(
  onScanOrOptions: ((code: string) => void) | StationPairingOptions
): Promise<PhonePairingSession> {
  const options: StationPairingOptions =
    typeof onScanOrOptions === 'function' ? { onScan: onScanOrOptions } : onScanOrOptions;

  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    throw new Error(
      'Phone pairing is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_URL / KEY), then rebuild.'
    );
  }

  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, key);

  const code = newRoomCode();
  const token = generatePairingToken();
  const ttl = options.ttlMs ?? PAIRING_TOKEN_TTL_MS;
  const expiresAt = Date.now() + ttl;

  let status: PairingStatus = 'waiting';
  let pairedDeviceId: string | null = null;
  let tokenUsed = false;

  const channel = client.channel(`saboot-room-${code}`, {
    config: { broadcast: { self: false } }
  });

  // Guard all broadcasts through zero-media assertions
  async function safeBroadcast(event: string, payload: unknown) {
    assertNoMediaInSignaling(payload, `broadcast.${event}`);
    await channel.send({
      type: 'broadcast',
      event,
      payload
    });
  }

  // Handle incoming broadcasts from companion phones
  channel.on(
    'broadcast',
    { event: 'auth' },
    (msg: { payload?: { token?: string; deviceId?: string } }) => {
      if (status === 'disposed') return;

      const incomingToken = msg?.payload?.token;
      const incomingDeviceId = msg?.payload?.deviceId || 'phone-companion';

      // Edge Case 1: Token expired
      if (Date.now() > expiresAt) {
        status = 'expired';
        void safeBroadcast('auth_rejected', {
          reason: 'expired',
          message: 'Pairing token has expired (2-minute limit). Please scan a fresh QR code.'
        });
        return;
      }

      // Edge Case 2: Already paired with another phone
      if (status === 'paired' && pairedDeviceId && pairedDeviceId !== incomingDeviceId) {
        void safeBroadcast('auth_rejected', {
          reason: 'already_paired',
          message: 'Workstation is already paired with another device.'
        });
        return;
      }

      // Edge Case 3: Invalid token or already used token
      if (!incomingToken || incomingToken !== token || tokenUsed) {
        void safeBroadcast('auth_rejected', {
          reason: 'invalid_token',
          message: 'Invalid or already used pairing token.'
        });
        return;
      }

      // Auth succeeded! Mark single-use token consumed and room paired
      tokenUsed = true;
      status = 'paired';
      pairedDeviceId = incomingDeviceId;

      void safeBroadcast('auth_accepted', {
        stationId: 'pc-workstation'
      });

      options.onPhoneConnected?.({ deviceId: incomingDeviceId });
    }
  );

  // Handle scanned barcodes forwarded from phone
  channel.on('broadcast', { event: 'scan' }, (msg: { payload?: { code?: string } }) => {
    if (status !== 'paired') return;
    const scanned = msg?.payload?.code;
    if (scanned && options.onScan) {
      options.onScan(scanned);
    }
  });

  // Handle WebRTC signaling messages from phone
  channel.on('broadcast', { event: 'signal' }, (msg: { payload?: { data?: unknown } }) => {
    if (status !== 'paired') return;
    const signalData = msg?.payload?.data;
    if (signalData && options.onSignal) {
      assertNoMediaInSignaling(signalData, 'signaling.incoming');
      options.onSignal(signalData);
    }
  });

  // Handle companion disconnect
  channel.on('broadcast', { event: 'disconnect' }, (msg: { payload?: { deviceId?: string } }) => {
    if (msg?.payload?.deviceId === pairedDeviceId) {
      status = 'waiting';
      pairedDeviceId = null;
      options.onPhoneDisconnected?.();
    }
  });

  // Subscribe to channel
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Pairing channel subscribe timed out.')),
      8000
    );
    channel.subscribe((subStatus: string) => {
      if (subStatus === 'SUBSCRIBED') {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  return {
    code,
    token,
    expiresAt,
    isExpired: () => Date.now() > expiresAt,
    getStatus: () => status,
    getPairedDeviceId: () => pairedDeviceId,
    sendSignal: async (signal: unknown) => {
      if (status !== 'paired') {
        throw new Error('Cannot send signaling message: workstation is not paired with a phone.');
      }
      await safeBroadcast('signal', { data: signal });
    },
    dispose: () => {
      status = 'disposed';
      void client.removeChannel(channel);
    }
  };
}

export interface PhoneConnectionSession {
  sendScan: (code: string) => Promise<void>;
  sendSignal: (signal: unknown) => Promise<void>;
  dispose: () => void;
}

export interface PhoneConnectOptions {
  code: string;
  token: string;
  deviceId?: string;
  onSignal?: (signal: unknown) => void;
  onStationDisconnected?: () => void;
}

/**
 * Connects a companion phone to a PC workstation room using the 6-digit code and token.
 */
export async function connectPhoneToStation(
  options: PhoneConnectOptions
): Promise<PhoneConnectionSession> {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    throw new Error('Phone pairing is not configured. Supabase credentials missing.');
  }

  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, key);
  const deviceId =
    options.deviceId ||
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : `phone-${Date.now()}`);

  const channel = client.channel(`saboot-room-${options.code}`, {
    config: { broadcast: { self: false } }
  });

  async function safeBroadcast(event: string, payload: unknown) {
    assertNoMediaInSignaling(payload, `phone.broadcast.${event}`);
    await channel.send({
      type: 'broadcast',
      event,
      payload
    });
  }

  return new Promise<PhoneConnectionSession>((resolve, reject) => {
    let authSettled = false;

    const authTimeout = setTimeout(() => {
      if (!authSettled) {
        authSettled = true;
        void client.removeChannel(channel);
        reject(new Error('Workstation did not respond to pairing request.'));
      }
    }, 10_000);

    channel.on('broadcast', { event: 'auth_accepted' }, () => {
      if (authSettled) return;
      authSettled = true;
      clearTimeout(authTimeout);

      resolve({
        sendScan: async (code: string) => {
          await safeBroadcast('scan', { code });
        },
        sendSignal: async (signal: unknown) => {
          await safeBroadcast('signal', { data: signal });
        },
        dispose: () => {
          void safeBroadcast('disconnect', { deviceId });
          void client.removeChannel(channel);
        }
      });
    });

    channel.on(
      'broadcast',
      { event: 'auth_rejected' },
      (msg: { payload?: { reason?: string; message?: string } }) => {
        if (authSettled) return;
        authSettled = true;
        clearTimeout(authTimeout);
        void client.removeChannel(channel);
        const errMessage =
          msg?.payload?.message ||
          (msg?.payload?.reason === 'expired'
            ? 'Pairing QR expired (2-minute limit).'
            : msg?.payload?.reason === 'already_paired'
              ? 'Workstation is already paired with another device.'
              : 'Pairing rejected by workstation.');
        reject(new Error(errMessage));
      }
    );

    channel.on('broadcast', { event: 'signal' }, (msg: { payload?: { data?: unknown } }) => {
      const data = msg?.payload?.data;
      if (data && options.onSignal) {
        assertNoMediaInSignaling(data, 'phone.signaling.incoming');
        options.onSignal(data);
      }
    });

    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        // Send authentication attempt
        void safeBroadcast('auth', {
          token: options.token,
          deviceId
        });
      }
    });
  });
}

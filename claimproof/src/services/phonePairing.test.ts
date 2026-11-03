import { describe, it, expect, vi, beforeEach } from 'vitest';

type BroadcastHandler = (msg: { event: string; payload?: any }) => void;
const broadcastHandlers: Record<string, BroadcastHandler[]> = {};

const mockChannel = {
  on: vi.fn((type: string, filter: { event: string }, handler: BroadcastHandler) => {
    const event = filter.event;
    if (!broadcastHandlers[event]) broadcastHandlers[event] = [];
    broadcastHandlers[event].push(handler);
    return mockChannel;
  }),
  send: vi.fn(async (msg: { event: string; payload?: any }) => {
    // Echo message to subscribers if needed
    const handlers = broadcastHandlers[msg.event] || [];
    handlers.forEach((h) => h(msg));
    return { error: null };
  }),
  subscribe: vi.fn((cb: (status: string) => void) => {
    setTimeout(() => cb('SUBSCRIBED'), 5);
    return mockChannel;
  }),
  unsubscribe: vi.fn()
};

const mockClient = {
  channel: vi.fn(() => mockChannel),
  removeChannel: vi.fn()
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockClient)
}));

import {
  getSupabaseConfig,
  isPhonePairingConfigured,
  newRoomCode,
  generatePairingToken,
  pairingQrPayload,
  startPhonePairing,
  PAIRING_TOKEN_TTL_MS
} from './phonePairing';

describe('Phone Pairing Service — Token Lifecycle & Edge Cases', () => {
  beforeEach(() => {
    for (const key of Object.keys(broadcastHandlers)) {
      delete broadcastHandlers[key];
    }
    vi.clearAllMocks();
  });

  it('generates valid 6-digit room code and secure token', () => {
    const code = newRoomCode();
    expect(code).toMatch(/^\d{6}$/);
    expect(Number(code)).toBeGreaterThanOrEqual(100000);
    expect(Number(code)).toBeLessThanOrEqual(999999);

    const token = generatePairingToken();
    expect(token.length).toBeGreaterThanOrEqual(12);
  });

  it('generates valid pairing QR payload URL including room and token', () => {
    const code = '582910';
    const token = 'abcdef123456';
    const payload = pairingQrPayload(code, token);
    expect(payload).toBe('https://app.saboot.in/#pair?room=582910&token=abcdef123456');
  });

  it('detects Supabase configuration from environment', () => {
    const config = getSupabaseConfig();
    expect(config.url).toBeDefined();
    expect(config.url).toContain('supabase.co');
    expect(config.key).toBeDefined();
    expect(isPhonePairingConfigured()).toBe(true);
  });

  it('has a 2-minute (120,000ms) pairing token TTL', () => {
    expect(PAIRING_TOKEN_TTL_MS).toBe(120_000);
  });

  it('authenticates companion phone with valid token and forwards scans', async () => {
    const onScan = vi.fn();
    const onPhoneConnected = vi.fn();
    const session = await startPhonePairing({ onScan, onPhoneConnected });

    expect(session.code).toMatch(/^\d{6}$/);
    expect(session.getStatus()).toBe('waiting');
    expect(session.isExpired()).toBe(false);

    // Simulate incoming auth broadcast from companion phone with valid token
    const authHandlers = broadcastHandlers['auth'] || [];
    authHandlers.forEach((h) =>
      h({
        event: 'auth',
        payload: { token: session.token, deviceId: 'phone-pixel-7' }
      })
    );

    expect(session.getStatus()).toBe('paired');
    expect(session.getPairedDeviceId()).toBe('phone-pixel-7');
    expect(onPhoneConnected).toHaveBeenCalledWith({ deviceId: 'phone-pixel-7' });

    // Simulate barcode scan from phone
    const scanHandlers = broadcastHandlers['scan'] || [];
    scanHandlers.forEach((h) =>
      h({
        event: 'scan',
        payload: { code: 'AWB987654321IN' }
      })
    );
    expect(onScan).toHaveBeenCalledWith('AWB987654321IN');

    // Clean up session
    session.dispose();
    expect(session.getStatus()).toBe('disposed');
    expect(mockClient.removeChannel).toHaveBeenCalledWith(mockChannel);
  });

  it('rejects pairing when token has expired (2-minute limit)', async () => {
    // Pass 10ms TTL for testing expiry
    const session = await startPhonePairing({
      ttlMs: 10,
      onScan: vi.fn()
    });

    // Wait 20ms for token to expire
    await new Promise((r) => setTimeout(r, 20));
    expect(session.isExpired()).toBe(true);

    const authHandlers = broadcastHandlers['auth'] || [];
    authHandlers.forEach((h) =>
      h({
        event: 'auth',
        payload: { token: session.token, deviceId: 'phone-oneplus' }
      })
    );

    expect(session.getStatus()).toBe('expired');
    expect(mockChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'broadcast',
        event: 'auth_rejected',
        payload: expect.objectContaining({ reason: 'expired' })
      })
    );

    session.dispose();
  });

  it('rejects a second phone connection when workstation is already paired', async () => {
    const session = await startPhonePairing({ onScan: vi.fn() });

    const authHandlers = broadcastHandlers['auth'] || [];

    // First phone authenticates successfully
    authHandlers.forEach((h) =>
      h({
        event: 'auth',
        payload: { token: session.token, deviceId: 'first-phone' }
      })
    );
    expect(session.getStatus()).toBe('paired');
    expect(session.getPairedDeviceId()).toBe('first-phone');

    // Second phone tries to connect
    authHandlers.forEach((h) =>
      h({
        event: 'auth',
        payload: { token: session.token, deviceId: 'second-phone' }
      })
    );

    // Second phone must be rejected with already_paired
    expect(mockChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'broadcast',
        event: 'auth_rejected',
        payload: expect.objectContaining({ reason: 'already_paired' })
      })
    );

    // First phone remains paired
    expect(session.getPairedDeviceId()).toBe('first-phone');

    session.dispose();
  });

  it('rejects invalid or forged pairing tokens', async () => {
    const session = await startPhonePairing({ onScan: vi.fn() });

    const authHandlers = broadcastHandlers['auth'] || [];
    authHandlers.forEach((h) =>
      h({
        event: 'auth',
        payload: { token: 'wrong-forged-token', deviceId: 'intruder-phone' }
      })
    );

    expect(session.getStatus()).toBe('waiting');
    expect(mockChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'broadcast',
        event: 'auth_rejected',
        payload: expect.objectContaining({ reason: 'invalid_token' })
      })
    );

    session.dispose();
  });
});

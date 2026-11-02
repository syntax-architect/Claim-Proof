import { describe, it, expect, vi, beforeEach } from 'vitest';

let broadcastHandler: ((msg: { payload: { code: string } }) => void) | undefined;

const mockChannel = {
  on: vi.fn(
    (_type: string, _filter: unknown, handler: (msg: { payload: { code: string } }) => void) => {
      broadcastHandler = handler;
      return mockChannel;
    }
  ),
  subscribe: vi.fn((cb: (status: string) => void) => {
    setTimeout(() => cb('SUBSCRIBED'), 10);
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
  pairingQrPayload,
  startPhonePairing
} from './phonePairing';

describe('Phone Pairing Service & Supabase Realtime', () => {
  beforeEach(() => {
    broadcastHandler = undefined;
    vi.clearAllMocks();
  });

  it('generates valid 6-digit room code', () => {
    const code = newRoomCode();
    expect(code).toMatch(/^\d{6}$/);
    expect(Number(code)).toBeGreaterThanOrEqual(100000);
    expect(Number(code)).toBeLessThanOrEqual(999999);
  });

  it('generates valid pairing QR payload URL', () => {
    const code = '582910';
    const payload = pairingQrPayload(code);
    expect(payload).toBe('https://app.saboot.in/pair?room=582910');
  });

  it('detects Supabase configuration from environment', () => {
    const config = getSupabaseConfig();
    expect(config.url).toBeDefined();
    expect(config.url).toContain('supabase.co');
    expect(config.key).toBeDefined();
    expect(isPhonePairingConfigured()).toBe(true);
  });

  it('initializes Supabase Realtime channel and subscribes to scan events with mock client', async () => {
    const onScan = vi.fn();
    const session = await startPhonePairing(onScan);

    expect(session.code).toMatch(/^\d{6}$/);
    expect(typeof session.dispose).toBe('function');

    // Simulate incoming scan broadcast from paired phone
    if (broadcastHandler) {
      broadcastHandler({ payload: { code: 'AWB987654321IN' } });
      expect(onScan).toHaveBeenCalledWith('AWB987654321IN');
    }

    // Clean up session
    session.dispose();
    expect(mockClient.removeChannel).toHaveBeenCalledWith(mockChannel);
  });
});

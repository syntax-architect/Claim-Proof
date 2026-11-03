import { describe, it, expect, vi } from 'vitest';
import {
  computeSha256,
  sendVideoOverDataChannel,
  setupDataChannelReceiver,
  type MinimalDataChannel,
  type TransferMetadata
} from './dataChannelTransfer';

/**
 * Creates an in-memory paired mock RTCDataChannel loopback.
 */
function createMockDataChannelPair() {
  type Listener = (ev: { data: string }) => void;
  const channelAListeners: Listener[] = [];
  const channelBListeners: Listener[] = [];

  const channelA: MinimalDataChannel = {
    readyState: 'open',
    send: (data: string) => {
      // Deliver asynchronously to Channel B
      setTimeout(() => {
        channelBListeners.forEach((l) => l({ data }));
      }, 0);
    },
    addEventListener: (_type: string, listener: Listener) => {
      channelAListeners.push(listener);
    },
    removeEventListener: (_type: string, listener: Listener) => {
      const idx = channelAListeners.indexOf(listener);
      if (idx >= 0) channelAListeners.splice(idx, 1);
    }
  };

  const channelB: MinimalDataChannel = {
    readyState: 'open',
    send: (data: string) => {
      // Deliver asynchronously to Channel A
      setTimeout(() => {
        channelAListeners.forEach((l) => l({ data }));
      }, 0);
    },
    addEventListener: (_type: string, listener: Listener) => {
      channelBListeners.push(listener);
    },
    removeEventListener: (_type: string, listener: Listener) => {
      const idx = channelBListeners.indexOf(listener);
      if (idx >= 0) channelBListeners.splice(idx, 1);
    }
  };

  return { phoneChannel: channelA, pcChannel: channelB };
}

describe('WebRTC DataChannel Chunked & Checksummed File Transfer', () => {
  const dummyMetadata: TransferMetadata = {
    awb: 'AWB987654321',
    orderId: 'ORD-12345',
    sku: 'SKU-RED-L',
    qty: 1,
    mode: 'dispatch',
    startedAt: 1730000000000
  };

  it('computes consistent hexadecimal SHA-256 digests', async () => {
    const data = new TextEncoder().encode('SABOOT proof video payload test');
    const hash1 = await computeSha256(data);
    const hash2 = await computeSha256(new Blob([data]));
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    expect(hash1).toBe(hash2);
  });

  it('transfers video file across mocked data channel and receives verified ACK', async () => {
    const { phoneChannel, pcChannel } = createMockDataChannelPair();

    // 150 KB test data -> should be 3 chunks with 64 KB chunkSize
    const testBytes = new Uint8Array(150 * 1024);
    for (let i = 0; i < testBytes.length; i++) {
      testBytes[i] = i % 256;
    }
    const testBlob = new Blob([testBytes], { type: 'video/mp4' });
    const expectedSha256 = await computeSha256(testBytes);

    let pcReceivedBlob: Blob | null = null;
    let pcReceivedMetadata: TransferMetadata | null = null;
    const onProgress = vi.fn();

    // Set up PC receiver
    const cleanupReceiver = setupDataChannelReceiver(pcChannel, {
      onProgress,
      onVerified: (res) => {
        pcReceivedBlob = res.videoBlob;
        pcReceivedMetadata = res.metadata;
      }
    });

    // Send from Phone
    const sendResult = await sendVideoOverDataChannel(phoneChannel, testBlob, dummyMetadata, {
      chunkSize: 64 * 1024
    });

    expect(sendResult.verified).toBe(true);
    expect(sendResult.sha256).toBe(expectedSha256);
    expect(pcReceivedBlob).not.toBeNull();
    expect(pcReceivedMetadata).toEqual(dummyMetadata);

    const receivedBytes = new Uint8Array(await pcReceivedBlob!.arrayBuffer());
    expect(receivedBytes.length).toBe(testBytes.length);
    expect(await computeSha256(receivedBytes)).toBe(expectedSha256);

    cleanupReceiver();
  });

  it('detects corrupted chunk, requests retry, and completes successfully after retry', async () => {
    const { phoneChannel, pcChannel } = createMockDataChannelPair();

    // Intercept phoneChannel.send to corrupt the 2nd chunk on its first transmission
    let hasCorruptedSecondChunk = false;
    const realPhoneSend = phoneChannel.send;
    phoneChannel.send = (data: string) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'transfer_chunk' && parsed.index === 1 && !hasCorruptedSecondChunk) {
          hasCorruptedSecondChunk = true;
          // Corrupt the base64 data so chunk SHA256 mismatches
          parsed.data = btoa('corrupted chunk bytes content!');
          realPhoneSend(JSON.stringify(parsed));
          return;
        }
      } catch {
        // Ignore
      }
      realPhoneSend(data);
    };

    const testBytes = new Uint8Array(140 * 1024);
    for (let i = 0; i < testBytes.length; i++) {
      testBytes[i] = (i * 3) % 256;
    }
    const testBlob = new Blob([testBytes], { type: 'video/mp4' });
    const expectedSha256 = await computeSha256(testBytes);

    const onChunkRetried = vi.fn();
    let pcReceivedBlob: Blob | null = null;

    const cleanup = setupDataChannelReceiver(pcChannel, {
      onVerified: (res) => {
        pcReceivedBlob = res.videoBlob;
      }
    });

    const sendResult = await sendVideoOverDataChannel(phoneChannel, testBlob, dummyMetadata, {
      chunkSize: 64 * 1024,
      onChunkRetried
    });

    expect(hasCorruptedSecondChunk).toBe(true);
    expect(onChunkRetried).toHaveBeenCalledWith(1);
    expect(sendResult.verified).toBe(true);
    expect(sendResult.sha256).toBe(expectedSha256);

    const receivedBytes = new Uint8Array(await pcReceivedBlob!.arrayBuffer());
    expect(receivedBytes.length).toBe(testBytes.length);
    expect(await computeSha256(receivedBytes)).toBe(expectedSha256);

    cleanup();
  });

  it('rejects and keeps phone file when overall checksum fails', async () => {
    const { phoneChannel, pcChannel } = createMockDataChannelPair();

    const testBytes = new Uint8Array(60 * 1024);
    const testBlob = new Blob([testBytes], { type: 'video/mp4' });

    // Set up PC receiver that intentionally tampers or mismatches
    const cleanup = setupDataChannelReceiver(pcChannel, {
      onVerified: vi.fn(),
      onError: vi.fn()
    });

    // Intercept PC channel to send transfer_failed on transfer_end
    const realPcSend = pcChannel.send;
    pcChannel.send = (data: string) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'ack_verified') {
          // Send bad ACK
          realPcSend(
            JSON.stringify({
              type: 'transfer_failed',
              id: parsed.id,
              reason: 'checksum_mismatch'
            })
          );
          return;
        }
      } catch {
        // Ignore
      }
      realPcSend(data);
    };

    // The phone's sendVideoOverDataChannel must reject so the phone DOES NOT delete the file!
    await expect(
      sendVideoOverDataChannel(phoneChannel, testBlob, dummyMetadata, {
        timeoutMs: 5000
      })
    ).rejects.toThrow(/Transfer rejected by recipient: checksum_mismatch/);

    cleanup();
  });
});

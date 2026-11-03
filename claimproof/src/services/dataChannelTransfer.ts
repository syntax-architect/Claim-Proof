/**
 * SABOOT Suite — WebRTC DataChannel Chunked & Checksummed File Transfer.
 *
 * Acceptance Criteria & AGENTS.md Rules:
 * - Rule 4 (Local-First): Videos transfer directly peer-to-peer over WebRTC RTCDataChannel.
 * - Rule 11 (Never Delete User Videos): The phone only deletes local video recordings
 *   AFTER the PC confirms the SHA-256 checksum with an explicit ACK ('ack_verified').
 * - Criterion 3: Checksummed chunks, per-chunk verification, corruption detection,
 *   automatic retry, and retention on failure.
 */

export const CHUNK_SIZE = 64 * 1024; // 64 KB chunks

export interface TransferMetadata {
  awb: string;
  orderId: string;
  sku: string;
  qty: number;
  mode: 'dispatch' | 'return';
  startedAt: number;
}

export interface TransferStartMessage {
  type: 'transfer_start';
  id: string;
  metadata: TransferMetadata;
  mime: string;
  totalSize: number;
  chunkSize: number;
  totalChunks: number;
  sha256: string;
}

export interface TransferChunkMessage {
  type: 'transfer_chunk';
  id: string;
  index: number;
  chunkSha256: string;
  data: string; // base64 encoded chunk
}

export interface TransferEndMessage {
  type: 'transfer_end';
  id: string;
  sha256: string;
}

export interface AckVerifiedMessage {
  type: 'ack_verified';
  id: string;
  sha256: string;
}

export interface ChunkCorruptedMessage {
  type: 'chunk_corrupted';
  id: string;
  index: number;
  reason?: string;
}

export interface TransferFailedMessage {
  type: 'transfer_failed';
  id: string;
  reason: string;
}

export type TransferMessage =
  | TransferStartMessage
  | TransferChunkMessage
  | TransferEndMessage
  | AckVerifiedMessage
  | ChunkCorruptedMessage
  | TransferFailedMessage;

export interface MinimalDataChannel {
  readyState: string;
  send: (data: string) => void;
  addEventListener?: (type: string, listener: (ev: any) => void) => void;
  removeEventListener?: (type: string, listener: (ev: any) => void) => void;
  onmessage?: ((ev: any) => any) | null;
  onclose?: ((ev: any) => any) | null;
  onerror?: ((ev: any) => any) | null;
}

/**
 * Computes hexadecimal SHA-256 digest of a Blob or ArrayBuffer using browser SubtleCrypto.
 */
export async function computeSha256(data: Blob | ArrayBuffer | Uint8Array): Promise<string> {
  let buffer: ArrayBuffer;
  if (data instanceof Uint8Array) {
    buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
    buffer = await data.arrayBuffer();
  } else {
    buffer = data as ArrayBuffer;
  }

  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Converts an ArrayBuffer / Uint8Array to base64 with buffer acceleration. */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunkSize) as unknown as number[]
    );
  }
  return btoa(binary);
}

/** Converts a base64 string to Uint8Array. */
export function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export interface SendProgress {
  sentChunks: number;
  totalChunks: number;
  percent: number;
}

export interface SendOptions {
  onProgress?: (p: SendProgress) => void;
  onChunkRetried?: (index: number) => void;
  timeoutMs?: number;
  chunkSize?: number;
}

export interface SendResult {
  verified: boolean;
  sha256: string;
  id: string;
}

/**
 * Sends a video file over an RTCDataChannel in checksummed chunks.
 *
 * Resolves ONLY when PC sends an 'ack_verified' message matching the file SHA-256.
 * If transfer fails, the Promise rejects without deleting anything on the phone.
 */
export async function sendVideoOverDataChannel(
  channel: MinimalDataChannel,
  videoBlob: Blob,
  metadata: TransferMetadata,
  options: SendOptions = {}
): Promise<SendResult> {
  if (channel.readyState !== 'open') {
    throw new Error('RTCDataChannel is not open for transfer');
  }

  const chunkSize = options.chunkSize || CHUNK_SIZE;
  const arrayBuffer = await videoBlob.arrayBuffer();
  const totalSize = arrayBuffer.byteLength;
  const totalChunks = Math.max(1, Math.ceil(totalSize / chunkSize));
  const fullSha256 = await computeSha256(arrayBuffer);
  const transferId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Slice all chunks and precompute checksums
  const chunkData: { index: number; bytes: Uint8Array; chunkSha256: string }[] = [];
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, totalSize);
    const slice = new Uint8Array(arrayBuffer.slice(start, end));
    const sha = await computeSha256(slice);
    chunkData.push({ index: i, bytes: slice, chunkSha256: sha });
  }

  return new Promise<SendResult>((resolve, reject) => {
    let completed = false;
    let endMessageSent = false;
    const timeoutMs = options.timeoutMs ?? 45_000;

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Data channel transfer timed out after ${timeoutMs}ms without ACK.`));
    }, timeoutMs);

    function cleanup() {
      completed = true;
      clearTimeout(timeout);
      if (channel.removeEventListener) {
        channel.removeEventListener('message', handleMessage);
      }
    }

    async function sendChunk(index: number) {
      if (index < 0 || index >= chunkData.length) return;
      const c = chunkData[index];
      const msg: TransferChunkMessage = {
        type: 'transfer_chunk',
        id: transferId,
        index: c.index,
        chunkSha256: c.chunkSha256,
        data: uint8ArrayToBase64(c.bytes)
      };
      channel.send(JSON.stringify(msg));
    }

    async function handleMessage(event: { data: string }) {
      if (completed) return;
      try {
        const msg = JSON.parse(event.data) as TransferMessage;
        if (msg.id !== transferId) return;

        if (msg.type === 'ack_verified') {
          if (msg.sha256 === fullSha256) {
            cleanup();
            resolve({
              verified: true,
              sha256: fullSha256,
              id: transferId
            });
          } else {
            cleanup();
            reject(
              new Error(`Checksum mismatch in ACK: expected ${fullSha256}, got ${msg.sha256}`)
            );
          }
        } else if (msg.type === 'chunk_corrupted') {
          // Recipient reported chunk corrupted -> retry sending this specific chunk!
          options.onChunkRetried?.(msg.index);
          await sendChunk(msg.index);
          // If transfer_end was already sent, re-send transfer_end to trigger final check
          if (endMessageSent) {
            const endMsg: TransferEndMessage = {
              type: 'transfer_end',
              id: transferId,
              sha256: fullSha256
            };
            channel.send(JSON.stringify(endMsg));
          }
        } else if (msg.type === 'transfer_failed') {
          cleanup();
          reject(new Error(`Transfer rejected by recipient: ${msg.reason}`));
        }
      } catch {
        // Non-JSON or irrelevant message
      }
    }

    if (channel.addEventListener) {
      channel.addEventListener('message', handleMessage);
    } else {
      const prevOnMessage = channel.onmessage;
      channel.onmessage = (ev) => {
        prevOnMessage?.(ev);
        void handleMessage(ev);
      };
    }

    // Step 1: Send Transfer Header
    const startMsg: TransferStartMessage = {
      type: 'transfer_start',
      id: transferId,
      metadata,
      mime: videoBlob.type || 'video/mp4',
      totalSize,
      chunkSize,
      totalChunks,
      sha256: fullSha256
    };
    channel.send(JSON.stringify(startMsg));

    // Step 2: Stream all chunks
    (async () => {
      for (let i = 0; i < totalChunks; i++) {
        if (completed) return;
        await sendChunk(i);
        options.onProgress?.({
          sentChunks: i + 1,
          totalChunks,
          percent: Math.round(((i + 1) / totalChunks) * 100)
        });
      }

      // Step 3: Send Transfer End
      if (!completed) {
        endMessageSent = true;
        const endMsg: TransferEndMessage = {
          type: 'transfer_end',
          id: transferId,
          sha256: fullSha256
        };
        channel.send(JSON.stringify(endMsg));
      }
    })().catch((err) => {
      cleanup();
      reject(err);
    });
  });
}

export interface ReceiveProgress {
  receivedChunks: number;
  totalChunks: number;
  percent: number;
}

export interface ReceiverOptions {
  onProgress?: (p: ReceiveProgress) => void;
  onVerified: (result: {
    videoBlob: Blob;
    metadata: TransferMetadata;
    mime: string;
    sha256: string;
  }) => Promise<void> | void;
  onError?: (err: Error) => void;
}

/**
 * Sets up the PC receiver side on an RTCDataChannel.
 * Reassembles chunks, verifies per-chunk and overall SHA-256,
 * and replies with 'ack_verified' upon successful match.
 */
export function setupDataChannelReceiver(
  channel: MinimalDataChannel,
  options: ReceiverOptions
): () => void {
  interface ActiveTransfer {
    start: TransferStartMessage;
    chunks: Map<number, Uint8Array>;
    endReceived: boolean;
    finalizing: boolean;
  }

  let currentTransfer: ActiveTransfer | null = null;

  async function tryFinalize() {
    if (!currentTransfer || !currentTransfer.endReceived || currentTransfer.finalizing) {
      return;
    }

    const { start, chunks } = currentTransfer;

    // Check if any chunks are missing
    for (let i = 0; i < start.totalChunks; i++) {
      if (!chunks.has(i)) {
        // Request missing chunk
        channel.send(
          JSON.stringify({
            type: 'chunk_corrupted',
            id: start.id,
            index: i,
            reason: 'Missing chunk'
          } as ChunkCorruptedMessage)
        );
        return;
      }
    }

    currentTransfer.finalizing = true;

    // Reassemble full array
    const combined = new Uint8Array(start.totalSize);
    let offset = 0;
    for (let i = 0; i < start.totalChunks; i++) {
      const c = chunks.get(i)!;
      combined.set(c, offset);
      offset += c.byteLength;
    }

    // Verify overall SHA-256
    const computedSha = await computeSha256(combined);
    if (computedSha === start.sha256) {
      // Verification succeeded! Send ACK to phone
      const ack: AckVerifiedMessage = {
        type: 'ack_verified',
        id: start.id,
        sha256: computedSha
      };
      channel.send(JSON.stringify(ack));

      const blob = new Blob([combined], { type: start.mime });
      await options.onVerified({
        videoBlob: blob,
        metadata: start.metadata,
        mime: start.mime,
        sha256: computedSha
      });
      currentTransfer = null;
    } else {
      // Verification failed
      const failMsg: TransferFailedMessage = {
        type: 'transfer_failed',
        id: start.id,
        reason: `Complete file SHA-256 mismatch: calculated ${computedSha}, expected ${start.sha256}`
      };
      channel.send(JSON.stringify(failMsg));
      options.onError?.(new Error('Complete file SHA-256 verification failed'));
      currentTransfer = null;
    }
  }

  async function handleMessage(event: { data: string }) {
    let msg: TransferMessage;
    try {
      msg = JSON.parse(event.data) as TransferMessage;
    } catch {
      return;
    }

    if (msg.type === 'transfer_start') {
      currentTransfer = {
        start: msg,
        chunks: new Map(),
        endReceived: false,
        finalizing: false
      };
      return;
    }

    if (!currentTransfer || currentTransfer.start.id !== msg.id) {
      return;
    }

    if (msg.type === 'transfer_chunk') {
      const bytes = base64ToUint8Array(msg.data);
      const chunkSha = await computeSha256(bytes);

      if (chunkSha !== msg.chunkSha256) {
        // Chunk corruption detected! Request retry of this chunk
        const corruptedMsg: ChunkCorruptedMessage = {
          type: 'chunk_corrupted',
          id: msg.id,
          index: msg.index,
          reason: 'Per-chunk SHA-256 mismatch'
        };
        channel.send(JSON.stringify(corruptedMsg));
        return;
      }

      if (!currentTransfer) {
        return;
      }

      currentTransfer.chunks.set(msg.index, bytes);
      const received = currentTransfer.chunks.size;
      const total = currentTransfer.start.totalChunks;
      options.onProgress?.({
        receivedChunks: received,
        totalChunks: total,
        percent: Math.min(100, Math.round((received / total) * 100))
      });

      // If end was already received, try finalizing now that a chunk arrived
      if (currentTransfer.endReceived) {
        await tryFinalize();
      }
      return;
    }

    if (msg.type === 'transfer_end') {
      currentTransfer.endReceived = true;
      await tryFinalize();
    }
  }

  if (channel.addEventListener) {
    channel.addEventListener('message', handleMessage);
    return () => {
      channel.removeEventListener?.('message', handleMessage);
    };
  } else {
    const prevOnMessage = channel.onmessage;
    channel.onmessage = (ev) => {
      prevOnMessage?.(ev);
      void handleMessage(ev);
    };
    return () => {
      channel.onmessage = prevOnMessage;
    };
  }
}

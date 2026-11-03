import { describe, it, expect } from 'vitest';
import { assertNoMediaInSignaling, SignalingPrivacyViolationError } from './signalingPrivacy';

describe('Signaling Privacy & Zero-Media Guard', () => {
  it('allows standard WebRTC SDP offer, answer, and ICE candidate payloads', () => {
    const validOffer = {
      type: 'offer',
      sdp: 'v=0\r\no=- 42 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=sendrecv'
    };
    expect(() => assertNoMediaInSignaling(validOffer)).not.toThrow();

    const validAnswer = {
      type: 'answer',
      sdp: 'v=0\r\no=- 43 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=recvonly'
    };
    expect(() => assertNoMediaInSignaling(validAnswer)).not.toThrow();

    const validCandidate = {
      type: 'candidate',
      candidate: {
        candidate: 'candidate:842163049 1 udp 1677729535 192.168.1.100 54123 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0
      }
    };
    expect(() => assertNoMediaInSignaling(validCandidate)).not.toThrow();

    const validAuth = {
      event: 'auth',
      payload: {
        token: 'a1b2c3d4e5f60718',
        deviceId: 'device-test-123'
      }
    };
    expect(() => assertNoMediaInSignaling(validAuth)).not.toThrow();
  });

  it('rejects data URI video strings', () => {
    const videoPayload = {
      type: 'video_frame',
      data: 'data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAGlzb21tcDQyAAACAG1vb3YAAA=='
    };
    expect(() => assertNoMediaInSignaling(videoPayload)).toThrow(SignalingPrivacyViolationError);
  });

  it('rejects data URI image strings', () => {
    const imagePayload = {
      type: 'snapshot',
      url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP////////////////'
    };
    expect(() => assertNoMediaInSignaling(imagePayload)).toThrow(SignalingPrivacyViolationError);
  });

  it('rejects raw binary ArrayBuffers or Blobs', () => {
    const bufferPayload = {
      type: 'raw',
      buffer: new Uint8Array([1, 2, 3, 4]).buffer
    };
    expect(() => assertNoMediaInSignaling(bufferPayload)).toThrow(SignalingPrivacyViolationError);

    const blobPayload = {
      type: 'stream',
      item: new Blob(['hello'], { type: 'video/mp4' })
    };
    expect(() => assertNoMediaInSignaling(blobPayload)).toThrow(SignalingPrivacyViolationError);
  });

  it('rejects forbidden media property keys (video, frame, chunk, pixels, etc.)', () => {
    expect(() =>
      assertNoMediaInSignaling({
        type: 'test',
        video: 'dummy-content'
      })
    ).toThrow(/Forbidden media key "video"/);

    expect(() =>
      assertNoMediaInSignaling({
        nested: {
          frame: 'mock-frame-data'
        }
      })
    ).toThrow(/Forbidden media key "frame"/);

    expect(() =>
      assertNoMediaInSignaling({
        type: 'file',
        chunks: ['chunk1', 'chunk2']
      })
    ).toThrow(/Forbidden media key "chunks"/);
  });

  it('rejects abnormally large payload strings that could conceal media', () => {
    const oversizedPayload = {
      type: 'suspicious',
      data: 'a'.repeat(35000)
    };
    expect(() => assertNoMediaInSignaling(oversizedPayload)).toThrow(
      /Payload at payload.data is unexpectedly large/
    );
  });
});

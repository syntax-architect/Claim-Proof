import { useEffect, useRef, useState, useCallback } from 'react';
import { BRAND } from '../config/brand';
import { formatIST } from '../lib/dateUtils';
import { useI18n } from '../lib/i18n';
import {
  connectPhoneToStation,
  DEFAULT_ICE_SERVERS,
  type PhoneConnectionSession
} from '../services/phonePairing';
import {
  sendVideoOverDataChannel,
  type MinimalDataChannel,
  type SendProgress
} from '../services/dataChannelTransfer';
import { playStartBeep, playSavedBeep, playErrorBeep } from '../lib/audioBeeps';
import { downloadBlob } from '../lib/utils';
import {
  CheckCircle2,
  AlertTriangle,
  Download,
  Wifi,
  WifiOff,
  Video,
  Square,
  RefreshCw,
  Flashlight,
  SwitchCamera
} from 'lucide-react';
import { Badge, Button, StatusDot } from '../components/ui';

export interface PhoneCompanionProps {
  onBackToApp?: () => void;
}

export default function PhoneCompanionPage({ onBackToApp }: PhoneCompanionProps) {
  const { t } = useI18n();

  // Route URL params: room & token
  const [roomCode, setRoomCode] = useState<string>('');
  const [token, setToken] = useState<string>('');

  // Connection & WebRTC state
  const [connStatus, setConnStatus] = useState<
    'connecting' | 'connected' | 'auth_failed' | 'p2p_fallback' | 'disconnected'
  >('connecting');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Barcode & Recording metadata
  const [awb, setAwb] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');
  const [sku, setSku] = useState<string>('');
  const [qty] = useState<number>(1);
  const [mode, setMode] = useState<'dispatch' | 'return'>('dispatch');

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [transferProgress, setTransferProgress] = useState<SendProgress | null>(null);
  const [transferState, setTransferState] = useState<
    'idle' | 'transferring' | 'verified' | 'failed'
  >('idle');
  const [retainedBlob, setRetainedBlob] = useState<Blob | null>(null);

  // Hardware controls
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const sessionRef = useRef<PhoneConnectionSession | null>(null);
  const wakeLockRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number>(0);

  // Parse Room and Token from Hash URL
  useEffect(() => {
    try {
      const hash = window.location.hash || '';
      const queryIdx = hash.indexOf('?');
      const search = queryIdx >= 0 ? hash.slice(queryIdx) : window.location.search;
      const params = new URLSearchParams(search);
      const roomParam = params.get('room') || '';
      const tokenParam = params.get('token') || '';
      setRoomCode(roomParam);
      setToken(tokenParam);
    } catch {
      // Ignore
    }
  }, []);

  // Check battery & storage
  useEffect(() => {
    async function inspectDeviceHealth() {
      // Battery check
      if ('getBattery' in navigator) {
        try {
          const battery = await (navigator as any).getBattery();
          if (battery && battery.level < 0.15 && !battery.charging) {
            setWarningMessage(t('phone.batteryWarning'));
          }
        } catch {
          // Ignore
        }
      }

      // Storage check
      if (navigator.storage && navigator.storage.estimate) {
        try {
          const est = await navigator.storage.estimate();
          if (est.quota && est.usage && est.quota - est.usage < 100 * 1024 * 1024) {
            setWarningMessage(t('phone.storageWarning'));
          }
        } catch {
          // Ignore
        }
      }
    }

    void inspectDeviceHealth();
  }, [t]);

  // Request Camera Stream
  const initCamera = useCallback(async () => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Check torch capability
      const videoTrack = stream.getVideoTracks()[0];
      const caps = videoTrack.getCapabilities?.() as any;
      setHasTorch(Boolean(caps?.torch));

      // Replace track on peer connection if already open
      if (peerConnectionRef.current) {
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        if (videoSender) {
          void videoSender.replaceTrack(videoTrack);
        } else {
          peerConnectionRef.current.addTrack(videoTrack, stream);
        }
      }
    } catch {
      setErrorMessage(t('phone.cameraPermissionDenied'));
    }
  }, [facingMode, t]);

  useEffect(() => {
    void initCamera();
    return () => {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [initCamera]);

  // Toggle torch
  const toggleTorch = useCallback(async () => {
    if (!mediaStreamRef.current) return;
    const track = mediaStreamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await (track as any).applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {
      // Torch not supported on this device
    }
  }, [torchOn]);

  // Switch camera
  const switchCamera = useCallback(() => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }, []);

  // WebRTC P2P Connection Setup
  useEffect(() => {
    if (!roomCode || !token) {
      setConnStatus('auth_failed');
      setErrorMessage(t('phone.invalidToken'));
      return;
    }

    let isDisposed = false;

    async function establishP2P() {
      try {
        setConnStatus('connecting');

        const pc = new RTCPeerConnection({ iceServers: DEFAULT_ICE_SERVERS });
        peerConnectionRef.current = pc;

        // Create RTCDataChannel for chunked file transfer and live scans
        const dc = pc.createDataChannel('saboot-transfer');
        dataChannelRef.current = dc;

        // If local camera stream is already ready, add tracks to P2P
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => {
            pc.addTrack(track, mediaStreamRef.current!);
          });
        }

        // Connect over Supabase signaling with 2-minute token auth
        const session = await connectPhoneToStation({
          code: roomCode,
          token,
          onSignal: async (signal: any) => {
            if (isDisposed) return;
            if (signal.type === 'answer') {
              await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            } else if (signal.type === 'candidate' && signal.candidate) {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            }
          },
          onStationDisconnected: () => {
            if (!isDisposed) setConnStatus('disconnected');
          }
        });
        sessionRef.current = session;

        // ICE candidate exchange
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            void session.sendSignal({
              type: 'candidate',
              candidate: event.candidate
            });
          }
        };

        // ICE connection state monitor (detect symmetric NAT / no TURN server)
        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            setConnStatus('connected');
          } else if (pc.iceConnectionState === 'failed') {
            // Rule 12: Actionable plain-language fallback
            setConnStatus('p2p_fallback');
            setWarningMessage(t('phone.webrtcFailedNextStep'));
          } else if (pc.iceConnectionState === 'disconnected') {
            setConnStatus('disconnected');
          }
        };

        // Create and send SDP Offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await session.sendSignal({
          type: 'offer',
          sdp: offer
        });
      } catch (err: any) {
        if (isDisposed) return;
        setConnStatus('auth_failed');
        setErrorMessage(err?.message || t('phone.invalidToken'));
      }
    }

    void establishP2P();

    return () => {
      isDisposed = true;
      sessionRef.current?.dispose();
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
    };
  }, [roomCode, token, t]);

  // WakeLock management during recording
  const acquireWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch {
        // WakeLock request denied
      }
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      try {
        void wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch {
        // Ignore
      }
    }
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (!isRecording) {
      setElapsedSec(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - recordingStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  // Canvas Compositor with Burnt-in IST Timestamp Bar & Overlays
  const renderCompositorFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(renderCompositorFrame);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1280;
    const height = 720;
    const barHeight = 46;

    // Draw Video Frame (letterboxed/proportional)
    ctx.drawImage(video, 0, 0, width, height);

    // Draw Burnt-In Header Bar (same as PC recordingPipeline)
    ctx.fillStyle = isRecording ? '#000000' : 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, width, barHeight);

    // Red REC Badge
    if (isRecording) {
      const pulse = (Math.sin(Date.now() / 250) + 1) / 2;
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.roundRect(10, 8, 88, 30, 4);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px "JetBrains Mono", monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText('REC', 40, barHeight / 2 + 1);

      ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + pulse * 0.6})`;
      ctx.beginPath();
      ctx.arc(24, barHeight / 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Burnt-in IST Timestamp Bar text
    const modeLabel = mode === 'return' ? 'RETURN UNBOXING' : 'DISPATCH';
    const cleanAwb = awb || 'AWB-PENDING';
    const cleanOrder = orderId || 'ORDER-PENDING';
    const cleanSku = sku || 'SKU-GENERAL';
    const nowIst = formatIST(Date.now());

    const overlayText = isRecording
      ? `${BRAND.videoWatermarkHeader} [${modeLabel}] | AWB: ${cleanAwb} | ORDER: ${cleanOrder} | SKU: ${cleanSku} (Qty: ${qty}) | ${nowIst} | ${BRAND.domain}`
      : `${BRAND.domain} — PHONE COMPANION LIVE · ${nowIst}`;

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(overlayText, isRecording ? 110 : 20, barHeight / 2 + 1);

    animFrameRef.current = requestAnimationFrame(renderCompositorFrame);
  }, [isRecording, awb, orderId, sku, qty, mode]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(renderCompositorFrame);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [renderCompositorFrame]);

  // Start Recording locally at full quality
  const startRecording = useCallback(async () => {
    if (!canvasRef.current) return;

    try {
      recordedChunksRef.current = [];
      const canvasStream = canvasRef.current.captureStream(30);

      const mimeCandidates = [
        'video/mp4;codecs="avc1.42E01E"',
        'video/mp4',
        'video/webm;codecs=vp9',
        'video/webm'
      ];
      let selectedMime = 'video/webm';
      for (const m of mimeCandidates) {
        if (MediaRecorder.isTypeSupported(m)) {
          selectedMime = m;
          break;
        }
      }

      const recorder = new MediaRecorder(canvasStream, {
        mimeType: selectedMime,
        videoBitsPerSecond: 1_400_000 // 1.4 Mbps
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // 1s slice
      recordingStartRef.current = Date.now();
      setIsRecording(true);
      setTransferState('idle');
      setRetainedBlob(null);

      await acquireWakeLock();
      playStartBeep();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to start recording');
    }
  }, [acquireWakeLock]);

  // Stop Recording & Trigger Chunked Checksummed Transfer
  const stopRecording = useCallback(
    async (isInterruption = false) => {
      if (!mediaRecorderRef.current || !isRecording) return;

      setIsRecording(false);
      releaseWakeLock();

      const recorder = mediaRecorderRef.current;
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
      });

      const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType });
      setRetainedBlob(blob);

      if (isInterruption) {
        // When interrupted by call, preserve blob locally and do not auto-transfer yet
        return;
      }

      // Check if data channel is open for peer-to-peer transfer
      const dc = dataChannelRef.current as MinimalDataChannel | null;
      if (!dc || dc.readyState !== 'open') {
        // Fallback: WebRTC data channel not open -> retain file locally (Rule 11)
        setTransferState('failed');
        setWarningMessage(t('phone.webrtcFailedNextStep'));
        return;
      }

      // Begin chunked transfer over WebRTC RTCDataChannel
      try {
        setTransferState('transferring');
        setTransferProgress({ sentChunks: 0, totalChunks: 1, percent: 0 });

        const metadata = {
          awb: awb || 'AWB-UNKNOWN',
          orderId: orderId || 'ORD-UNKNOWN',
          sku: sku || 'SKU-UNKNOWN',
          qty: qty || 1,
          mode,
          startedAt: recordingStartRef.current
        };

        const result = await sendVideoOverDataChannel(dc, blob, metadata, {
          onProgress: (p) => setTransferProgress(p),
          onChunkRetried: () => {}
        });

        if (result.verified) {
          playSavedBeep();
          setTransferState('verified');
          // RULE 11: Phone is only allowed to clear local buffer AFTER PC confirmed verified ACK!
          setRetainedBlob(null);
        }
      } catch (err: any) {
        // Transfer failed -> Phone KEEPS the file (Rule 11)
        playErrorBeep();
        setTransferState('failed');
        setErrorMessage(err?.message || t('phone.transferFailed'));
      }
    },
    [isRecording, releaseWakeLock, awb, orderId, sku, qty, mode, t]
  );

  // Handle incoming phone call or app switch interruption
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && isRecording) {
        // Call interrupted recording! Stop and preserve video file
        playErrorBeep();
        void stopRecording(true);
        setWarningMessage(t('phone.callInterruption'));
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleVisibilityChange);
    };
  }, [isRecording, stopRecording, t]);

  // Manual Retry Transfer
  const retryTransfer = useCallback(async () => {
    if (!retainedBlob) return;
    const dc = dataChannelRef.current as MinimalDataChannel | null;
    if (!dc || dc.readyState !== 'open') {
      setErrorMessage(t('phone.webrtcFailed'));
      return;
    }

    try {
      setTransferState('transferring');
      setErrorMessage('');

      const metadata = {
        awb: awb || 'AWB-UNKNOWN',
        orderId: orderId || 'ORD-UNKNOWN',
        sku: sku || 'SKU-UNKNOWN',
        qty: qty || 1,
        mode,
        startedAt: recordingStartRef.current || Date.now()
      };

      const result = await sendVideoOverDataChannel(dc, retainedBlob, metadata, {
        onProgress: (p) => setTransferProgress(p)
      });

      if (result.verified) {
        playSavedBeep();
        setTransferState('verified');
        setRetainedBlob(null);
      }
    } catch (err: any) {
      playErrorBeep();
      setTransferState('failed');
      setErrorMessage(err?.message || t('phone.transferFailed'));
    }
  }, [retainedBlob, awb, orderId, sku, qty, mode, t]);

  // Fallback: Download file directly on the phone
  const downloadToPhone = useCallback(() => {
    if (!retainedBlob) return;
    const cleanAwb = (awb || 'EVIDENCE').replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `${cleanAwb}_Video.${retainedBlob.type.includes('mp4') ? 'mp4' : 'webm'}`;
    downloadBlob(retainedBlob, filename);
  }, [retainedBlob, awb]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      {/* Top Mobile Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-slate-900/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
            S
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-white">{t('phone.title')}</h1>
            <p className="text-[11px] text-slate-400">
              {roomCode ? `Room ${roomCode}` : t('phone.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {connStatus === 'connected' ? (
            <Badge tone="proof">
              <Wifi className="h-3 w-3 mr-1" />
              P2P Active
            </Badge>
          ) : connStatus === 'p2p_fallback' ? (
            <Badge tone="warn">
              <WifiOff className="h-3 w-3 mr-1" />
              Offline Save
            </Badge>
          ) : (
            <Badge tone="neutral">
              <StatusDot tone="warn" />
              {connStatus}
            </Badge>
          )}

          {onBackToApp && (
            <Button size="xs" variant="ghost" onClick={onBackToApp}>
              Exit
            </Button>
          )}
        </div>
      </header>

      {/* Warnings & Alerts Banner */}
      {warningMessage && (
        <div className="flex items-center gap-2 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{warningMessage}</span>
          <button
            onClick={() => setWarningMessage(null)}
            className="text-amber-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="flex items-center gap-2 bg-rose-500/10 border-b border-rose-500/20 px-4 py-2 text-xs text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} className="text-rose-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Main Viewport */}
      <main className="relative flex-1 flex flex-col items-center justify-between p-3 gap-3">
        {/* Camera Live Preview & Compositor Canvas */}
        <div className="relative w-full aspect-video max-w-xl rounded-xl overflow-hidden bg-black border border-white/10 shadow-2xl">
          {/* Native HTML5 video hidden element feeding the canvas */}
          <video ref={videoRef} playsInline muted className="hidden" />

          {/* Canvas compositor displaying 1280x720 output */}
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            className="w-full h-full object-contain"
          />

          {/* Camera hardware toggles overlay */}
          <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
            {hasTorch && (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                className={`p-2 rounded-full backdrop-blur-md border ${
                  torchOn
                    ? 'bg-amber-400 text-black border-amber-300'
                    : 'bg-black/40 text-white border-white/20'
                }`}
                title="Torch"
              >
                <Flashlight className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={switchCamera}
              className="p-2 rounded-full bg-black/40 text-white border border-white/20 backdrop-blur-md"
              title={t('phone.switchCamera')}
            >
              <SwitchCamera className="h-4 w-4" />
            </button>
          </div>

          {/* Recording Timer Badge */}
          {isRecording && (
            <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-md bg-black/70 px-2.5 py-1 text-xs font-mono font-bold text-white border border-white/15">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              {String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:
              {String(elapsedSec % 60).padStart(2, '0')}
            </div>
          )}
        </div>

        {/* Transfer Progress / Status Bar */}
        {transferState === 'transferring' && transferProgress && (
          <div className="w-full max-w-xl glass-soft p-3 rounded-lg space-y-2 border border-emerald-500/20">
            <div className="flex justify-between text-xs text-slate-300 font-mono">
              <span>{t('phone.transferring', { percent: transferProgress.percent })}</span>
              <span>
                {transferProgress.sentChunks} / {transferProgress.totalChunks} chunks
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-emerald-500 transition-all duration-150"
                style={{ width: `${transferProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Transfer Success Banner */}
        {transferState === 'verified' && (
          <div className="w-full max-w-xl p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-2 text-xs">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <span>{t('phone.transferSuccess')}</span>
          </div>
        )}

        {/* Retained File / Transfer Failed Fallback UI (Rule 11 & Rule 12) */}
        {retainedBlob && transferState === 'failed' && (
          <div className="w-full max-w-xl glass-soft p-4 rounded-xl border border-amber-500/30 space-y-3">
            <div className="flex items-start gap-2 text-amber-300 text-xs">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold text-white">{t('phone.transferFailed')}</p>
                <p className="text-slate-300 mt-1">
                  Evidence video is retained safely on your phone (Rule 11). You can retry or
                  download it directly.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                icon={RefreshCw}
                onClick={() => void retryTransfer()}
                className="flex-1"
              >
                {t('phone.retryTransfer')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={Download}
                onClick={downloadToPhone}
                className="flex-1"
              >
                {t('phone.downloadLocal')}
              </Button>
            </div>
          </div>
        )}

        {/* Parcel Metadata Input Strip */}
        <div className="w-full max-w-xl grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div>
            <label className="text-[11px] text-slate-400 font-medium">{t('phone.awb')}</label>
            <input
              type="text"
              value={awb}
              onChange={(e) => setAwb(e.target.value.toUpperCase())}
              placeholder="e.g. 1420984812"
              className="mt-1 w-full rounded border border-white/10 bg-slate-900 px-2 py-1.5 font-mono text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 font-medium">{t('phone.orderId')}</label>
            <input
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="e.g. ORD-8120"
              className="mt-1 w-full rounded border border-white/10 bg-slate-900 px-2 py-1.5 font-mono text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 font-medium">{t('phone.sku')}</label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="e.g. BLK-TEE-L"
              className="mt-1 w-full rounded border border-white/10 bg-slate-900 px-2 py-1.5 font-mono text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="text-[11px] text-slate-400 font-medium">Mode</div>
            <div className="mt-1 flex rounded border border-white/10 bg-slate-900 p-0.5">
              <button
                type="button"
                onClick={() => setMode('dispatch')}
                className={`flex-1 rounded py-1 text-[11px] font-medium transition ${
                  mode === 'dispatch'
                    ? 'bg-proof-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Dispatch
              </button>
              <button
                type="button"
                onClick={() => setMode('return')}
                className={`flex-1 rounded py-1 text-[11px] font-medium transition ${
                  mode === 'return' ? 'bg-warn-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Return
              </button>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="w-full max-w-xl flex items-center justify-center gap-4 py-2">
          {!isRecording ? (
            <Button
              variant="primary"
              size="lg"
              icon={Video}
              onClick={() => void startRecording()}
              className="w-full py-3 text-base shadow-lg shadow-emerald-900/30"
            >
              {t('phone.startRecording')}
            </Button>
          ) : (
            <Button
              variant="danger"
              size="lg"
              icon={Square}
              onClick={() => void stopRecording(false)}
              className="w-full py-3 text-base shadow-lg shadow-rose-900/40"
            >
              {t('phone.stopRecording')}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

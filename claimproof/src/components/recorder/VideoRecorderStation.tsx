import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Flag,
  Keyboard,
  Play,
  QrCode,
  ScanLine,
  Square,
  Usb,
  Video
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { db } from '../../db/schema';
import {
  playFlagBeep,
  playSavedBeep,
  playScanBeep,
  playStartBeep,
  playErrorBeep
} from '../../lib/audioBeeps';
import { startCameraScanner, type CameraScannerHandle, type ScannerStatus } from '../../lib/cameraScanner';
import { startHidListener } from '../../lib/hidScanner';
import { FREE_AWBS_PER_DAY, consumeRecordingQuota } from '../../lib/quota';
import { formatISTShort } from '../../lib/dateUtils';
import { vaultSubPath } from '../../lib/vaultPaths';
import { buildClaimFromFlag } from '../../lib/claimRules';
import { cn, formatBytes } from '../../lib/utils';
import { RecordingPipeline } from '../../services/recordingPipeline';
import { cacheRecordingMedia } from '../../services/mediaLibrary';
import { saveRecordingFiles } from '../../services/vaultWriter';
import {
  isPhonePairingConfigured,
  pairingQrPayload,
  startPhonePairing,
  type PhonePairingSession
} from '../../services/phonePairing';
import { planHasFeature, useLicense } from '../../services/licenseService';
import { usePaywall } from '../../providers/PaywallProvider';
import {
  Badge,
  Button,
  Card,
  Kbd,
  Modal,
  PageHeader,
  Toggle,
  useToast
} from '../ui';
import type { CourierPartner, FlagReason, Marketplace, RecordingMeta, RecordingType } from '../../types';

interface Parcel {
  awb: string;
  orderId: string;
  sku: string;
  size: string;
  qty: number;
  courier: CourierPartner;
  marketplace: Marketplace;
  matched: boolean;
}

const FLAG_REASONS: FlagReason[] = [
  'Damaged',
  'Used/Worn',
  'Wrong/Swapped item',
  'Missing item',
  'Empty package',
  'Other'
];

const HUD_STEPS = [
  { title: 'Show AWB Label', doneAfter: 5 },
  { title: 'Show Product Condition', doneAfter: 15 },
  { title: 'Seal Polybag on Camera', doneAfter: Number.POSITIVE_INFINITY }
];

type Stage = 'idle' | 'recording' | 'saving';

/* Colors inside the canvas stage overlays are intentionally literal (slate-50,
 * #94a3b8, #3a4a5e, bg-[#0b1017], bg-[#17202c], text-[#64748b], emerald/amber/
 * red-3xx, bg-black/15) — the video canvas is always dark regardless of theme. */

export function VideoRecorderStation({ className }: { className?: string }) {
  const toast = useToast();
  const { openPaywall } = usePaywall();
  const license = useLicense();

  const [stage, setStage] = useState<Stage>('idle');
  const [mode, setMode] = useState<'camera' | 'demo' | null>(null);
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null, null]);
  const [flagged, setFlagged] = useState(false);
  const [returnMode, setReturnMode] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [scanner, setScanner] = useState<{ status: ScannerStatus; detail?: string }>({ status: 'idle' });
  const [pairing, setPairing] = useState<{ code: string; qr: string | null } | null>(null);
  const [pairingBusy, setPairingBusy] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sinkRef = useRef<HTMLInputElement>(null);
  const pipelineRef = useRef<RecordingPipeline | null>(null);
  const scannerRef = useRef<CameraScannerHandle | null>(null);
  const pairingRef = useRef<PhonePairingSession | null>(null);

  /* Live state mirrors so window-level handlers never see stale closures. */
  const stageRef = useRef<Stage>('idle');
  const parcelRef = useRef<Parcel | null>(null);
  const flaggedRef = useRef(false);
  const returnModeRef = useRef(false);
  const reasonRef = useRef<FlagReason | null>(null);
  const licenseRef = useRef(license);
  const seqRef = useRef(0);
  licenseRef.current = license;
  stageRef.current = stage;
  returnModeRef.current = returnMode;

  const canCollage = planHasFeature(license.plan, 'collage');

  const recent = useLiveQuery(
    () => db.recordings.orderBy('startedAt').reverse().limit(6).toArray(),
    []
  );

  /* ── the state machine ─────────────────────────────────────────────── */

  const startRecordingFor = useCallback(async (code: string) => {
    const pipeline = pipelineRef.current;
    if (!pipeline || stageRef.current === 'saving') return;
    const quota = await consumeRecordingQuota();
    if (!quota.allowed) {
      playErrorBeep();
      toast.error(
        'Daily free recording limit reached',
        `${FREE_AWBS_PER_DAY} AWB videos per day on Free — go unlimited from ₹349/mo.`
      );
      openPaywall({ scope: 'recordings', reason: 'Free plan allows 10 recorded AWBs per day' });
      return;
    }
    const order = await db.orders.where('awb').equals(code).first();
    const nextParcel: Parcel = order
      ? {
          awb: order.awb,
          orderId: order.orderId,
          sku: order.sku,
          size: order.size,
          qty: order.qty,
          courier: order.courier,
          marketplace: order.marketplace,
          matched: true
        }
      : {
          awb: code,
          orderId: 'UNKNOWN',
          sku: 'UNKNOWN',
          size: '',
          qty: 1,
          courier: 'Unknown',
          marketplace: 'Unknown',
          matched: false
        };

    seqRef.current += 1;
    parcelRef.current = nextParcel;
    flaggedRef.current = false;
    reasonRef.current = null;
    setParcel(nextParcel);
    setPhotos([null, null, null, null]);
    setElapsed(0);
    setFlagged(false);
    playStartBeep();
    pipeline.startRecording(
      {
        awb: nextParcel.awb,
        orderId: nextParcel.orderId,
        sku: nextParcel.sku,
        qty: nextParcel.qty,
        courier: nextParcel.courier,
        type: returnModeRef.current ? 'return' : 'dispatch',
        freeTier: licenseRef.current.plan === 'free'
      },
      {
        onPhotoTaken: (index, dataUrl) =>
          setPhotos((prev) => prev.map((p, i) => (i === index ? dataUrl : p))),
        onElapsed: (sec) => setElapsed(sec)
      }
    );
    setStage('recording');
  }, [openPaywall, toast]);

  const stopAndPersist = useCallback(async () => {
    const pipeline = pipelineRef.current;
    if (!pipeline) return;
    const seq = ++seqRef.current;
    const savedParcel = parcelRef.current;
    const type: RecordingType = returnModeRef.current ? 'return' : 'dispatch';
    const wasFlagged = flaggedRef.current;
    const reason = reasonRef.current;
    setStage('saving');

    const result = await pipeline.stopRecording();
    if (!result) {
      if (seqRef.current === seq) {
        setStage('idle');
        setParcel(null);
      }
      return;
    }
    const p = savedParcel ?? {
      awb: 'UNKNOWN',
      orderId: 'UNKNOWN',
      sku: 'UNKNOWN',
      size: '',
      qty: 1,
      courier: 'Unknown' as CourierPartner,
      marketplace: 'Unknown' as Marketplace,
      matched: false
    };
    try {
      const startedAt = pipeline.recordingSince ?? Date.now() - result.durationSec * 1000;
      const id = await db.recordings.add({
        awb: p.awb,
        orderId: p.orderId,
        sku: p.sku,
        size: p.size,
        qty: p.qty,
        courier: p.courier,
        marketplace: p.marketplace,
        type,
        startedAt,
        endedAt: Date.now(),
        durationSec: result.durationSec,
        videoMime: result.videoMime,
        videoBytes: result.videoBlob.size,
        photoBytes: result.photoCollage?.size ?? 0,
        photoCollage: canCollage && result.photoCollage !== null,
        vaultPath: vaultSubPath(type, startedAt, p.awb),
        demo: pipeline.bound === 'demo',
        flagged: wasFlagged
      });
      await cacheRecordingMedia(id, result.videoBlob, canCollage ? result.photoCollage : null);
      const save = await saveRecordingFiles({
        awb: p.awb,
        type,
        startedAt,
        video: result.videoBlob,
        videoMime: result.videoMime,
        photo: canCollage ? result.photoCollage : null
      });
      await db.recordings.update(id, { vaultPath: save.vaultPath });

      if (wasFlagged && type === 'return') {
        await db.claims.add(
          buildClaimFromFlag({
            awb: p.awb,
            orderId: p.orderId,
            sku: p.sku,
            qty: p.qty,
            courier: p.courier,
            marketplace: p.marketplace,
            reason: reason ?? 'Damaged',
            recordingId: id,
            returnScanAt: Date.now()
          })
        );
      }

      playSavedBeep();
      toast.success(
        'SAVED to vault',
        `${p.awb} · ${save.mode === 'fs-api' ? save.vaultPath : 'Downloads folder'}${wasFlagged && type === 'return' ? ' · flagged → Pending Claims Queue' : ''}`
      );
    } catch (e) {
      console.error(e);
      toast.error('Save failed', e instanceof Error ? e.message : String(e));
    }
    if (seqRef.current === seq) {
      setStage('idle');
      setParcel(null);
      setPhotos([null, null, null, null]);
      setFlagged(false);
      sinkRef.current?.focus();
    }
  }, [canCollage, toast]);

  const requestStop = useCallback(() => {
    if (stageRef.current !== 'recording') return;
    if (flaggedRef.current && returnModeRef.current && !reasonRef.current) {
      setReasonOpen(true);
      return;
    }
    void stopAndPersist();
  }, [stopAndPersist]);

  const flagBadReturn = useCallback(() => {
    if (stageRef.current !== 'recording' || !returnModeRef.current) return;
    flaggedRef.current = true;
    setFlagged(true);
    playFlagBeep();
  }, []);

  const handleScan = useCallback(
    (raw: string) => {
      const code = raw.trim().toUpperCase();
      if (!code) return;
      if (stageRef.current === 'recording') {
        const currentAwb = parcelRef.current?.awb ?? '';
        if (code === currentAwb) {
          requestStop();
        } else {
          /* Chain: save the current clip and start the next one immediately. */
          playScanBeep();
          void stopAndPersist();
          void startRecordingFor(code);
        }
      } else if (stageRef.current === 'idle') {
        void startRecordingFor(code);
      }
    },
    [requestStop, startRecordingFor, stopAndPersist]
  );

  const handleScanRef = useRef(handleScan);
  handleScanRef.current = handleScan;
  const requestStopRef = useRef(requestStop);
  requestStopRef.current = requestStop;
  const flagRef = useRef(flagBadReturn);
  flagRef.current = flagBadReturn;

  /* ── wiring: pipeline, HID gun, camera scanner, keyboard ──────────── */

  useEffect(() => {
    let cancelled = false;
    const pipeline = new RecordingPipeline();
    pipelineRef.current = pipeline;
    const hid = startHidListener((code) => handleScanRef.current(code));

    void (async () => {
      await new Promise((r) => setTimeout(r, 60));
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || cancelled) return;
      const bound = await pipeline.bind(video, canvas);
      if (cancelled) return;
      setMode(bound);
      if (bound === 'camera') {
        scannerRef.current = await startCameraScanner(
          video,
          (code) => handleScanRef.current(code),
          { onStatus: (status, detail) => setScanner({ status, detail }) }
        );
      } else {
        setScanner({ status: 'idle', detail: 'demo scene (no webcam)' });
      }
    })();

    return () => {
      cancelled = true;
      hid.stop();
      scannerRef.current?.stop();
      void pipeline.release();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.code === 'Space' && stageRef.current === 'recording' && target?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        requestStopRef.current();
      }
      if (e.key === 'F2' && stageRef.current === 'recording' && returnModeRef.current) {
        e.preventDefault();
        flagRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(
    () => () => {
      pairingRef.current?.dispose();
    },
    []
  );

  async function startPairingRoom() {
    setPairingBusy(true);
    try {
      const session = await startPhonePairing((code) => handleScanRef.current(code));
      pairingRef.current = session;
      const { renderUpiQr } = await import('../../lib/upi');
      const qr = await renderUpiQr(pairingQrPayload(session.code), 180);
      setPairing({ code: session.code, qr });
      toast.success('Pairing room open', `Scan the QR with the phone companion — room ${session.code}`);
    } catch (e) {
      toast.error('Pairing failed', e instanceof Error ? e.message : String(e));
    } finally {
      setPairingBusy(false);
    }
  }

  const activeStep = elapsed < 5 ? 0 : elapsed < 15 ? 1 : 2;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div className={cn('space-y-5', className)}>
      <PageHeader
        icon={Video}
        kicker="MODULE B · THE PROOF ENGINE"
        title="ClaimProof AWB Recorder"
        subtitle="Scan → uncut video starts itself → scan the next parcel to chain instantly"
        actions={
          <div className="glass-soft flex items-center gap-3 px-3 py-2">
            <Toggle
              checked={returnMode}
              onChange={(next) => {
                if (next && !planHasFeature(license.plan, 'claimRadar')) {
                  openPaywall({ scope: 'claimRadar', plan: 'claimradar' });
                  return;
                }
                setReturnMode(next);
              }}
              label={<span className="text-xs">Return Unboxing Mode</span>}
            />
          </div>
        }
      />

      {mode === 'demo' && (
        <div className="glass-soft flex items-center gap-2 border-warn-500/40 px-4 py-2.5 text-xs text-warn-300">
          <CameraOff className="h-4 w-4" />
          DEMO CAMERA — synthetic scene (no webcam found). Every state below works exactly as on real hardware.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* ── Stage + controls ─────────────────────────────────────── */}
        <div className="space-y-4 xl:col-span-2">
          <div
            className={cn(
              'relative overflow-hidden rounded-2xl border-2 bg-ink-950 transition-all duration-300',
              stage === 'recording'
                ? 'border-danger-500/70 shadow-[0_12px_44px_-18px_rgba(239,68,68,0.55)]'
                : 'border-line'
            )}
          >
            <canvas ref={canvasRef} className="block aspect-video w-full" />
            <video ref={videoRef} className="hidden" playsInline muted />

            {/* Idle overlay */}
            {stage === 'idle' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="scanline absolute inset-x-6 h-px animate-scan-y rounded-full bg-proof-400/60 shadow-[0_0_12px_rgba(59,130,246,0.5)]" />
                <div className="absolute left-4 top-14 h-7 w-7 border-l-2 border-t-2 border-proof-400/60" />
                <div className="absolute right-4 top-14 h-7 w-7 border-r-2 border-t-2 border-proof-400/60" />
                <div className="absolute bottom-16 left-4 h-7 w-7 border-b-2 border-l-2 border-proof-400/60" />
                <div className="absolute bottom-16 right-4 h-7 w-7 border-b-2 border-r-2 border-proof-400/60" />
                <ScanLine className="h-9 w-9 animate-rec-pulse text-emerald-300" />
                <div className="mt-4 font-display text-xl font-bold tracking-[0.2em] text-slate-50">
                  WAITING FOR SCAN
                </div>
                <div className="mt-2 font-mono text-xs text-[#94a3b8]">
                  Scan an AWB barcode — or type it below and press <Kbd>Enter</Kbd>
                </div>
                {mode && (
                  <Badge tone={mode === 'camera' ? 'proof' : 'warn'} className="mt-4">
                    {mode === 'camera' ? 'LIVE CAMERA' : 'DEMO CAMERA'}
                  </Badge>
                )}
              </div>
            )}

            {/* Recording HUD */}
            {stage === 'recording' && (
              <>
                <div className="pointer-events-none absolute inset-0 bg-black/15" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
                <div className="pointer-events-auto mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-2xl border border-[#3a4a5e] bg-[#0b1017]/90 px-4 py-3 backdrop-blur">
                  {HUD_STEPS.map((step, i) => (
                    <div key={step.title} className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-bold',
                          i < activeStep
                            ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300'
                            : i === activeStep
                              ? 'animate-rec-pulse border-amber-400/70 bg-amber-500/20 text-amber-300'
                              : 'border-[#3a4a5e] bg-[#17202c] text-[#64748b]'
                        )}
                      >
                        {i < activeStep ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                      </span>
                      <span
                        className={cn(
                          'hidden truncate text-xs font-medium sm:block',
                          i === activeStep ? 'text-slate-50' : 'text-[#64748b]'
                        )}
                      >
                        {step.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              </>
            )}

            {flagged && stage === 'recording' && (
              <div className="absolute left-1/2 top-14 -translate-x-1/2 animate-rec-pulse rounded-lg border border-red-500/60 bg-red-500/25 px-4 py-2 font-display text-sm font-bold tracking-widest text-red-300 backdrop-blur">
                ⚑ FLAGGED: BAD RETURN — pick a reason on stop
              </div>
            )}
          </div>

          {/* Scan sink + controls */}
          {stage === 'recording' ? (
            <Card className="flex flex-wrap items-center gap-3 p-4">
              <div className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border border-danger-500/40 bg-danger-500/5 px-4">
                <span className="flex items-center gap-1.5 font-mono text-sm font-bold text-danger-400">
                  <span className="h-2.5 w-2.5 animate-rec-pulse rounded-full bg-danger-500" />
                  REC {mm}:{ss}
                </span>
                <span className="truncate font-mono text-sm font-semibold text-white">
                  {parcel?.awb}
                </span>
              </div>
              {returnMode && (
                <Button variant="danger" icon={Flag} onClick={flagBadReturn}>
                  Flag Bad Return <Kbd className="ml-1">F2</Kbd>
                </Button>
              )}
              <Button variant="primary" size="lg" icon={Square} onClick={requestStop}>
                Stop &amp; Save <Kbd className="ml-1">Space</Kbd>
              </Button>
              <div className="font-mono text-[11px] text-slate-500">
                scan next parcel → instant chain
              </div>
            </Card>
          ) : stage === 'saving' ? (
            <Card className="flex items-center gap-3 p-4 text-sm text-slate-300">
              <span className="h-2.5 w-2.5 animate-rec-pulse rounded-full bg-proof-400" />
              Writing evidence to the vault…
            </Card>
          ) : (
            <Card className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="glass-soft flex h-12 min-w-0 flex-1 items-center gap-3 px-4">
                  <ScanLine className="h-4 w-4 shrink-0 text-proof-400" />
                  <input
                    ref={sinkRef}
                    data-scanSink="true"
                    autoFocus
                    placeholder="Scan / type AWB then Enter"
                    className="min-w-0 flex-1 bg-transparent font-mono text-sm uppercase tracking-wider text-white placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-600 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const value = (e.target as HTMLInputElement).value;
                        if (value.trim()) {
                          handleScan(value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }}
                  />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Kbd>Enter</Kbd> confirms · <Kbd>Space</Kbd> stops · <Kbd>F2</Kbd> flags
                </div>
              </div>
            </Card>
          )}

          {/* Listener status */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="proof">
              <Usb className="h-3 w-3" /> USB Gun armed
            </Badge>
            <Badge tone={scanner.status === 'running' ? 'proof' : scanner.status === 'error' ? 'danger' : 'neutral'}>
              <Camera className="h-3 w-3" />
              {scanner.status === 'running'
                ? `Camera scanner · ${scanner.detail ?? 'active'}`
                : scanner.status === 'error'
                  ? `Camera scanner error — ${scanner.detail ?? ''}`
                  : (scanner.detail ?? 'Camera scanner idle')}
            </Badge>
            {isPhonePairingConfigured() ? (
              pairing ? (
                <Badge tone="info">
                  <QrCode className="h-3 w-3" /> Phone room {pairing.code} — open
                </Badge>
              ) : (
                <Button variant="ghost" size="xs" loading={pairingBusy} onClick={() => void startPairingRoom()}>
                  <QrCode className="h-3 w-3" /> Start phone pairing room
                </Button>
              )
            ) : (
              <Badge tone="outline">Phone — not configured</Badge>
            )}
          </div>

          {pairing?.qr && (
            <Card className="flex items-center gap-4 p-4">
              <img src={pairing.qr} alt={`Pairing room ${pairing.code}`} className="qr-plate h-28 w-28 rounded-lg p-1" />
              <div className="min-w-0">
                <div className="font-display text-sm font-bold text-white">Room {pairing.code}</div>
                <div className="mt-1 text-xs text-slate-400">
                  Open the phone companion, scan this QR — its camera scans land here instantly.
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="font-display text-base font-bold text-white">Current parcel</div>
              {parcel && !parcel.matched && <Badge tone="warn">not in memory</Badge>}
            </div>
            {parcel && stage !== 'idle' ? (
              <div className="mt-4 space-y-3">
                <div className="font-mono text-2xl font-bold tracking-wider text-white mono-tabular">
                  {parcel.awb}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone="proof">{parcel.sku}</Badge>
                  {parcel.size && <Badge tone="neutral">Size {parcel.size}</Badge>}
                  <Badge tone={parcel.qty > 1 ? 'warn' : 'neutral'}>Qty {parcel.qty}</Badge>
                  <Badge tone="info">{parcel.courier}</Badge>
                  <Badge tone="outline">{parcel.marketplace}</Badge>
                </div>
                <div className="font-mono text-[11px] text-slate-500">Order {parcel.orderId}</div>
                {!parcel.matched && (
                  <div className="rounded-lg border border-warn-500/30 bg-warn-500/8 p-2.5 text-[11px] text-warn-300">
                    AWB not found in label memory — recording anyway. Crop its label in SmartLabel
                    Studio to auto-match next time.
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-500">
                Scan a barcode and the matched Order ID, SKU, Size, Qty &amp; courier appear here
                instantly.
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="font-display text-base font-bold text-white">Photo evidence slots</div>
              {!canCollage && (
                <button
                  type="button"
                  onClick={() => openPaywall({ scope: 'collage' })}
                  className="text-[11px] font-semibold text-warn-300 underline-offset-2 hover:underline"
                >
                  🔒 ClaimRadar Pro
                </button>
              )}
            </div>
            <div className={cn('mt-3 grid grid-cols-4 gap-2', !canCollage && 'opacity-50')}>
              {photos.map((photo, i) => (
                <div
                  key={i}
                  className="relative aspect-square overflow-hidden rounded-lg border border-line bg-ink-950"
                >
                  {photo ? (
                    <motion.img
                      key={photo}
                      initial={{ scale: 0.85, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                      src={photo}
                      alt={`Evidence ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1 text-slate-600">
                      <span className="font-mono text-[9px]">
                        {['T+0.5s', 'T+3s', 'T+6s', 'T+9s'][i]}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              {canCollage
                ? '4 frames auto-captured mid-clip and stitched into a 2×2 collage.'
                : 'Auto 4-photo collage is a ClaimRadar Pro feature.'}
            </div>
          </Card>

          <Card className="p-5">
            <div className="font-display text-base font-bold text-white">Recent recordings</div>
            <div className="mt-3 space-y-2">
              {(recent?.length ?? 0) === 0 ? (
                <div className="text-sm text-slate-500">Nothing recorded yet.</div>
              ) : (
                recent?.map((r) => (
                  <div key={r.id} className="glass-soft flex items-center gap-2.5 p-2.5">
                    <Play className="h-3.5 w-3.5 shrink-0 text-info-400" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-xs font-semibold text-white">{r.awb}</div>
                      <div className="truncate text-[10px] text-slate-500">
                        {r.type === 'return' ? 'Return' : 'Dispatch'} · {r.durationSec}s ·{' '}
                        {formatBytes(r.videoBytes + r.photoBytes)}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-slate-600">
                      {formatISTShort(r.startedAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Flag reason picker */}
      <Modal
        open={reasonOpen}
        onClose={() => setReasonOpen(false)}
        title="What was wrong with this return?"
        subtitle="The clip is saved flagged — pick the dispute reason for ClaimRadar"
        icon={Flag}
        width="md"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FLAG_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => {
                reasonRef.current = reason;
                setReasonOpen(false);
                void stopAndPersist();
              }}
              className="glass-soft px-4 py-3 text-left text-sm font-medium text-slate-200 transition-all hover:border-danger-500/50 hover:bg-danger-500/10"
            >
              {reason}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <Keyboard className="h-3.5 w-3.5" /> Tip: press <Kbd>F2</Kbd> the moment you spot the damage
          — it marks the exact second in the clip.
        </div>
      </Modal>
    </div>
  );
}

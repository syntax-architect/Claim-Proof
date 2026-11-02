import { useCallback, useEffect, useRef, useState } from 'react';
import { BRAND } from '../../config/brand';
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
import { db, getSetting } from '../../db/schema';
import {
  playFlagBeep,
  playSavedBeep,
  playScanBeep,
  playStartBeep,
  playErrorBeep
} from '../../lib/audioBeeps';
import {
  startCameraScanner,
  type CameraScannerHandle,
  type ScannerStatus
} from '../../lib/cameraScanner';
import { startHidListener } from '../../lib/hidScanner';
import { FREE_AWBS_PER_DAY, consumeRecordingQuota } from '../../lib/quota';
import { formatISTShort } from '../../lib/dateUtils';
import { vaultSubPath } from '../../lib/vaultPaths';
import { buildClaimFromFlag } from '../../lib/claimRules';
import { cn, formatBytes } from '../../lib/utils';
import { RecordingPipeline, type CameraErrorType } from '../../services/recordingPipeline';
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
import { registerActiveRecording } from '../../services/recorderCrashGuard';
import { trackFirstRecordingSaved } from '../../services/telemetry';
import { RECORDER_CONFIG } from '../../config/recorderConfig';
import { setRecordingActive } from '../../lib/motion';
import {
  AnimatedCheckDraw,
  Badge,
  Button,
  Card,
  ErrorState,
  Kbd,
  Modal,
  PageHeader,
  Toggle,
  notifyToast,
  useToast
} from '../ui';
import type { CourierPartner, FlagReason, Marketplace, RecordingType } from '../../types';

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

interface CameraDiagnosticProps {
  errorType: CameraErrorType;
  onRetry: () => void;
}

function CameraDiagnostic({ errorType, onRetry }: CameraDiagnosticProps) {
  if (!errorType) return null;

  const configs: Record<
    NonNullable<CameraErrorType>,
    {
      title: string;
      message: string;
      retryLabel: string;
      steps: { label: string; text: string }[];
    }
  > = {
    permission_denied: {
      title: 'Camera Permission Denied',
      message: `Google Chrome or Windows is blocking camera access. ${BRAND.name} requires camera permissions to record live proof videos.`,
      retryLabel: 'Retry Camera Access',
      steps: [
        {
          label: 'Chrome address bar',
          text: 'Click the site settings icon (tune/sliders or lock icon) on the left side of the address bar.'
        },
        {
          label: 'Allow Camera',
          text: 'Find "Camera" in the permissions list and switch it from Block to Allow.'
        },
        {
          label: 'Windows Privacy settings',
          text: 'Press Win + I to open Windows Settings → Privacy & security → Camera. Make sure both "Camera access" and "Let desktop apps access your camera" are turned On.'
        },
        {
          label: 'Retry',
          text: 'Click "Retry Camera Access" below or press Ctrl + R to refresh.'
        }
      ]
    },
    not_found: {
      title: 'No Camera Detected',
      message: `Windows and Google Chrome cannot detect a connected webcam. ${BRAND.name} has loaded the synthetic demo scene so you can test all features.`,
      retryLabel: 'Retry Camera',
      steps: [
        {
          label: 'Check USB cable',
          text: 'Unplug and firmly replug your webcam directly into a USB port on your PC (avoid unpowered USB hubs).'
        },
        {
          label: 'Open privacy shutter',
          text: 'If using a laptop webcam, check for a physical slide cover over the camera lens and slide it open.'
        },
        {
          label: 'Check keyboard hotkey',
          text: 'Some keyboards have a camera hotkey (e.g. Fn + F6 or Fn + F10) to enable/disable the camera.'
        },
        {
          label: 'Verify in Windows Settings',
          text: 'Press Win + I to open Windows Settings → Bluetooth & devices → Cameras, and confirm Windows recognizes your webcam.'
        }
      ]
    },
    in_use: {
      title: 'Camera Is in Use by Another Application',
      message:
        'Another app or browser tab has locked your webcam. Windows allows only one application to stream video from a webcam at a time.',
      retryLabel: 'Retry Camera Access',
      steps: [
        {
          label: 'Close video apps',
          text: 'Check your taskbar and system tray for Zoom, Microsoft Teams, Google Meet, Skype, OBS Studio, WhatsApp, or the Windows Camera app, and close them.'
        },
        {
          label: 'Close other Chrome tabs',
          text: 'Check your other open browser tabs and close any that may be using the camera.'
        },
        {
          label: 'End background tasks',
          text: 'If the camera LED remains lit, press Ctrl + Shift + Esc to open Windows Task Manager, find background video apps, and end them.'
        },
        {
          label: 'Retry',
          text: 'Click "Retry Camera Access" once other video applications are closed.'
        }
      ]
    },
    device_unplugged: {
      title: 'Camera Was Disconnected',
      message:
        'The webcam USB cable was disconnected or the signal was lost. Any footage recorded before the disconnect was safely saved to your vault.',
      retryLabel: 'Reconnect Camera',
      steps: [
        {
          label: 'Inspect cable',
          text: 'Check if the camera USB cable was knocked or pulled loose from your computer.'
        },
        {
          label: 'Try a different USB port',
          text: 'Unplug the USB cable, wait 3 seconds, and firmly insert it into another USB 3.0 port directly on your PC.'
        },
        {
          label: 'Listen for Windows chime',
          text: 'Wait until you hear the Windows USB connection sound confirming the camera is re-detected.'
        },
        {
          label: 'Reconnect',
          text: 'Click "Reconnect Camera" below to restore your live camera feed.'
        }
      ]
    },
    unknown: {
      title: 'Camera Error',
      message: 'Could not initialize video feed from webcam. Switched to demo packing scene.',
      retryLabel: 'Retry Camera Access',
      steps: [
        {
          label: 'Check connections',
          text: 'Ensure your camera is plugged in and recognized in Windows Settings.'
        },
        {
          label: 'Restart browser',
          text: 'Close and reopen Google Chrome if the issue persists.'
        }
      ]
    }
  };

  const current = configs[errorType];
  if (!current) return null;

  return (
    <Card className="border-danger-500/35 bg-ink-950/90 p-5 shadow-lg">
      <ErrorState
        title={current.title}
        message={current.message}
        icon={CameraOff}
        onRetry={onRetry}
        retryLabel={current.retryLabel}
      >
        <div className="mt-4 rounded-xl border border-line bg-ink-900/80 p-4 text-left">
          <div className="text-xs font-semibold text-slate-200">
            Fix steps for Chrome on Windows:
          </div>
          <ol className="mt-2.5 space-y-2 text-xs text-slate-300">
            {current.steps.map((s, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-800 text-[10px] font-bold text-proof-300">
                  {idx + 1}
                </span>
                <span className="leading-relaxed">
                  <strong className="text-white">{s.label}:</strong> {s.text}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </ErrorState>
    </Card>
  );
}

export function VideoRecorderStation({ className }: { className?: string }) {
  const toast = useToast();
  const { openPaywall } = usePaywall();
  const license = useLicense();

  const [stage, setStage] = useState<Stage>('idle');
  const [mode, setMode] = useState<'camera' | 'demo' | null>(null);
  const [cameraError, setCameraError] = useState<CameraErrorType>(null);
  const [_cameraBlocked, setCameraBlocked] = useState(false);
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null, null]);
  const [flagged, setFlagged] = useState(false);
  const [returnMode, setReturnMode] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [scanner, setScanner] = useState<{ status: ScannerStatus; detail?: string }>({
    status: 'idle'
  });
  const [pairing, setPairing] = useState<{ code: string; qr: string | null } | null>(null);
  const [pairingBusy, setPairingBusy] = useState(false);
  const [scanFlash, setScanFlash] = useState(false);

  useEffect(() => {
    setRecordingActive(stage === 'recording');
    return () => setRecordingActive(false);
  }, [stage]);

  const [targetSizeMB, setTargetSizeMB] = useState(RECORDER_CONFIG.defaultTargetSizeMB);
  const [maxDurationSec, setMaxDurationSec] = useState(RECORDER_CONFIG.defaultMaxDurationSec);

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
  const unregisterCrashGuardRef = useRef<(() => void) | null>(null);
  const emergencySaveRef = useRef<((reason?: unknown) => Promise<void>) | null>(null);
  const stopAndPersistRef = useRef<(() => Promise<void>) | null>(null);
  const elapsedRef = useRef(0);
  licenseRef.current = license;
  stageRef.current = stage;
  returnModeRef.current = returnMode;
  elapsedRef.current = elapsed;

  const canCollage = planHasFeature(license.plan, 'collage');

  const recent = useLiveQuery(
    () => db.recordings.orderBy('startedAt').reverse().limit(6).toArray(),
    []
  );

  useEffect(() => {
    void getSetting('target_video_size_mb', RECORDER_CONFIG.defaultTargetSizeMB).then(
      setTargetSizeMB
    );
    void getSetting('max_recording_duration_sec', RECORDER_CONFIG.defaultMaxDurationSec).then(
      setMaxDurationSec
    );
    sinkRef.current?.focus();
  }, []);

  /* ── the state machine ─────────────────────────────────────────────── */

  const startRecordingFor = useCallback(
    async (code: string) => {
      const pipeline = pipelineRef.current;
      if (!pipeline || stageRef.current === 'saving') return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!pipeline.bound && video && canvas) {
        const bound = await pipeline.bind(video, canvas);
        setMode(bound);
      }
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
      elapsedRef.current = 0;
      setFlagged(false);
      playStartBeep();

      if (pipeline.isWebM) {
        toast.info(
          'Using WebM video format',
          'MP4 recording is not natively supported in this browser. Timestamped WebM video will be produced.'
        );
      }

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
          onElapsed: (sec) => {
            setElapsed(sec);
            elapsedRef.current = sec;
          },
          onMaxDurationReached: () => {
            playFlagBeep();
            toast.warn(
              'Maximum recording duration reached',
              `Recording reached the safeguard limit (${Math.floor(maxDurationSec / 60)} min). Video automatically stopped to prevent oversized files.`
            );
            void stopAndPersistRef.current?.();
          },
          onCameraDisconnected: () => {
            playErrorBeep();
            toast.error(
              'Camera disconnected mid-recording',
              'The camera was unplugged or lost signal. In-progress footage was safely preserved in the vault.'
            );
            void emergencySaveRef.current?.('camera_disconnected');
            setCameraError('device_unplugged');
            setMode('demo');
            setStage('idle');
            setParcel(null);
          }
        },
        { maxDurationSec }
      );
      if (unregisterCrashGuardRef.current) {
        unregisterCrashGuardRef.current();
      }
      unregisterCrashGuardRef.current = registerActiveRecording((r) => {
        if (emergencySaveRef.current) {
          void emergencySaveRef.current(r);
        }
      });
      setStage('recording');
    },
    [maxDurationSec, openPaywall, toast]
  );

  const emergencySave = useCallback(
    async (reasonForCrash?: unknown) => {
      const pipeline = pipelineRef.current;
      if (!pipeline || !pipeline.recording) return;

      if (unregisterCrashGuardRef.current) {
        unregisterCrashGuardRef.current();
        unregisterCrashGuardRef.current = null;
      }

      const savedParcel = parcelRef.current;
      const type: RecordingType = returnModeRef.current ? 'return' : 'dispatch';
      const wasFlagged = flaggedRef.current;
      const reason = reasonRef.current;

      try {
        const result = await pipeline.stopRecording();
        if (!result) return;

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
        void trackFirstRecordingSaved();

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

        if (save.errorReason === 'permission_revoked') {
          notifyToast({
            tone: 'warn',
            title: 'Vault permission revoked',
            message: 'Saved via Downloads fallback. Please reconnect your vault folder in Settings.'
          });
        } else if (save.errorReason === 'disk_full') {
          notifyToast({
            tone: 'error',
            title: 'Disk full or quota exceeded',
            message: 'Unable to write directly to disk. Saved via Downloads. Free up disk space.'
          });
        } else {
          notifyToast({
            tone: 'success',
            title: 'Emergency recording saved',
            message: `In-progress recording for ${p.awb} was safely preserved on your computer.`
          });
        }
      } catch (e) {
        console.error('[VideoRecorderStation] Emergency save failed:', e, reasonForCrash);
      }
    },
    [canCollage]
  );

  useEffect(() => {
    emergencySaveRef.current = emergencySave;
  }, [emergencySave]);

  const stopAndPersist = useCallback(async () => {
    if (unregisterCrashGuardRef.current) {
      unregisterCrashGuardRef.current();
      unregisterCrashGuardRef.current = null;
    }
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
      try {
        sessionStorage.setItem('cp_last_saved_id', String(id));
      } catch {
        /* storage may be restricted */
      }
      void trackFirstRecordingSaved();

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

      if (save.errorReason === 'permission_revoked') {
        toast.warn(
          'Vault permission revoked',
          'Vault folder permission was revoked. Saved via Downloads fallback. Reconnect your vault folder in Settings to resume direct disk saves.'
        );
      } else if (save.errorReason === 'disk_full') {
        toast.error(
          'Disk full or storage quota exceeded',
          'Direct disk save failed due to insufficient space. File was passed to Downloads. Please free up disk space.'
        );
      } else if (save.errorReason === 'vault_unavailable') {
        toast.info(
          'Saved via Downloads',
          `${p.awb} · Saved to Downloads. Connect a vault folder in Settings to save directly to disk.`
        );
      } else {
        playSavedBeep();
        toast.success(
          'SAVED to vault',
          `${p.awb} · ${save.mode === 'fs-api' ? save.vaultPath : 'Downloads folder'}${wasFlagged && type === 'return' ? ' · flagged → Pending Claims Queue' : ''}`
        );
      }
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

  useEffect(() => {
    stopAndPersistRef.current = stopAndPersist;
  }, [stopAndPersist]);

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
    async (raw: string) => {
      const code = raw.trim().toUpperCase();
      if (!code) return;
      setScanFlash(true);
      setTimeout(() => setScanFlash(false), 280);
      if (stageRef.current === 'recording') {
        const currentAwb = parcelRef.current?.awb ?? '';
        if (code === currentAwb) {
          const curElapsed = elapsedRef.current;
          if (curElapsed < RECORDER_CONFIG.duplicateBounceGuardSec) {
            toast.warn(
              'Duplicate scan ignored',
              `AWB ${code} is already being recorded (${curElapsed}s elapsed).`
            );
            return;
          }
          requestStop();
        } else {
          /* Chain: save the current clip and start the next one immediately. */
          playScanBeep();
          void stopAndPersist();
          void startRecordingFor(code);
        }
      } else if (stageRef.current === 'idle') {
        try {
          const priorCount = await db.recordings.where('awb').equals(code).count();
          if (priorCount > 0) {
            toast.warn(
              'Duplicate AWB detected',
              `AWB ${code} was already recorded ${priorCount} time${priorCount > 1 ? 's' : ''} previously. Starting additional proof recording.`
            );
          }
        } catch {
          /* best effort check */
        }
        void startRecordingFor(code);
      }
    },
    [requestStop, startRecordingFor, stopAndPersist, toast]
  );

  const handleScanRef = useRef(handleScan);
  handleScanRef.current = handleScan;
  const requestStopRef = useRef(requestStop);
  requestStopRef.current = requestStop;
  const flagRef = useRef(flagBadReturn);
  flagRef.current = flagBadReturn;

  const retryCamera = useCallback(async () => {
    const pipeline = pipelineRef.current;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!pipeline || !video || !canvas) return;
    toast.info('Requesting camera access...');
    const bound = await pipeline.bind(video, canvas);
    setMode(bound);
    const err = pipeline.cameraErrorType;
    setCameraError(err);
    if (bound === 'camera') {
      setCameraBlocked(false);
      setCameraError(null);
      toast.success('Camera connected', 'Live webcam stream initialized successfully.');
      scannerRef.current = await startCameraScanner(video, (code) => handleScanRef.current(code), {
        onStatus: (status, detail) => setScanner({ status, detail })
      });
    } else {
      if (err === 'permission_denied') {
        setCameraBlocked(true);
        toast.error(
          'Permission still denied',
          'Please enable camera access in your browser address bar.'
        );
      } else if (err === 'in_use') {
        toast.warn('Camera still in use', 'Please close other applications using your webcam.');
      } else if (err === 'not_found') {
        toast.warn(
          'No camera found',
          'Please connect a USB webcam or open your laptop privacy shutter.'
        );
      }
    }
  }, [toast]);

  /* ── wiring: pipeline, HID gun, camera scanner, keyboard, visibility ──────────── */

  useEffect(() => {
    let cancelled = false;
    const pipeline = new RecordingPipeline();
    pipelineRef.current = pipeline;
    const hid = startHidListener((code) => void handleScanRef.current(code));

    void (async () => {
      await new Promise((r) => setTimeout(r, 60));
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || cancelled) return;
      const bound = await pipeline.bind(video, canvas);
      if (cancelled) return;
      setMode(bound);
      const err = pipeline.cameraErrorType;
      setCameraError(err);
      if (bound === 'camera') {
        setCameraBlocked(false);
        setCameraError(null);
        scannerRef.current = await startCameraScanner(
          video,
          (code) => void handleScanRef.current(code),
          { onStatus: (status, detail) => setScanner({ status, detail }) }
        );
      } else {
        if (err === 'permission_denied') {
          setCameraBlocked(true);
          toast.error(
            'Camera permission denied',
            'Camera access was blocked by your browser. Please allow camera permissions in site settings or the address bar, then click Retry.'
          );
        } else if (err === 'not_found') {
          toast.warn(
            'No camera found',
            'No physical webcam detected. Switched to demo packing scene.'
          );
        } else if (err === 'in_use') {
          toast.warn(
            'Camera is in use',
            'Your webcam is currently being used by another application.'
          );
        }
        setScanner({ status: 'idle', detail: 'demo scene (no webcam)' });
      }
    })();

    return () => {
      cancelled = true;
      hid.stop();
      scannerRef.current?.stop();
      if (unregisterCrashGuardRef.current) {
        unregisterCrashGuardRef.current();
        unregisterCrashGuardRef.current = null;
      }
      if (pipeline.recording) {
        if (emergencySaveRef.current) {
          void emergencySaveRef.current('unmount while recording');
        }
      } else {
        void pipeline.release();
      }
    };
  }, [toast]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && stageRef.current === 'recording') {
        notifyToast({
          tone: 'warn',
          title: 'Tab is in background',
          message: `${BRAND.name} is backgrounded. Keep this tab visible to ensure full 24fps video recording.`
        });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    const onBeforeUnload = () => {
      if (pipelineRef.current?.recording) {
        if (emergencySaveRef.current) {
          void emergencySaveRef.current('beforeunload');
        }
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        e.code === 'Space' &&
        stageRef.current === 'recording' &&
        target?.tagName !== 'TEXTAREA'
      ) {
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
      const session = await startPhonePairing((code) => void handleScanRef.current(code));
      pairingRef.current = session;
      const { renderUpiQr } = await import('../../lib/upi');
      const qr = await renderUpiQr(pairingQrPayload(session.code), 180);
      setPairing({ code: session.code, qr });
      toast.success(
        'Pairing room open',
        `Scan the QR with the phone companion — room ${session.code}`
      );
    } catch (e) {
      toast.error('Pairing failed', e instanceof Error ? e.message : String(e));
    } finally {
      setPairingBusy(false);
    }
  }

  const activeStep = elapsed < 5 ? 0 : elapsed < 15 ? 1 : 2;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  const estimatedBytes = elapsed * RECORDER_CONFIG.bytesPerSecond;
  const estimatedMB = (estimatedBytes / (1024 * 1024)).toFixed(1);
  const isOverTarget = Number(estimatedMB) > targetSizeMB;

  const containerFormat = pipelineRef.current?.containerFormat ?? 'unknown';
  const isWebM = containerFormat === 'webm';

  return (
    <div className={cn('space-y-5', className)}>
      <PageHeader
        icon={Video}
        kicker="MODULE B · THE PROOF ENGINE"
        title={`${BRAND.name} AWB Recorder`}
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

      {cameraError && (
        <CameraDiagnostic errorType={cameraError} onRetry={() => void retryCamera()} />
      )}

      {mode === 'demo' && !cameraError && (
        <div className="glass-soft flex flex-wrap items-center justify-between gap-3 border-warn-500/40 bg-warn-500/10 px-4 py-2.5 text-xs text-warn-300">
          <div className="flex items-center gap-2">
            <CameraOff className="h-4 w-4 shrink-0" />
            <span>
              <strong>DEMO CAMERA:</strong> Synthetic scene running. Every state below works exactly
              as on real hardware.
            </span>
          </div>
          <Button variant="outline" size="xs" icon={Camera} onClick={() => void retryCamera()}>
            Connect Camera
          </Button>
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

            {/* Scan flash ring */}
            {scanFlash && (
              <motion.div
                initial={{ opacity: 0.85, scale: 0.98 }}
                animate={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="pointer-events-none absolute inset-0 z-30 rounded-2xl border-2 border-proof-400 shadow-[0_0_24px_rgba(201,164,92,0.6)]"
              />
            )}

            {/* Saving feedback overlay */}
            {stage === 'saving' && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                <AnimatedCheckDraw size={52} className="text-proof-400" />
                <div className="mt-4 font-display text-lg font-bold text-white">
                  Saving Evidence…
                </div>
                <div className="mt-1 font-mono text-xs text-slate-400">
                  Finalizing video &amp; photo collage
                </div>
              </div>
            )}

            {/* Idle overlay */}
            {stage === 'idle' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="scanline absolute inset-x-6 h-px animate-scan-y rounded-full bg-proof-400/60 shadow-[0_0_12px_color-mix(in_srgb,var(--cp-accentsolid)_50%,transparent)]" />
                <div className="absolute left-4 top-14 h-7 w-7 border-l-2 border-t-2 border-proof-400/60" />
                <div className="absolute right-4 top-14 h-7 w-7 border-r-2 border-t-2 border-proof-400/60" />
                <div className="absolute bottom-16 left-4 h-7 w-7 border-b-2 border-l-2 border-proof-400/60" />
                <div className="absolute bottom-16 right-4 h-7 w-7 border-b-2 border-r-2 border-proof-400/60" />
                <ScanLine className="h-9 w-9 animate-rec-pulse text-success-300" />
                <div className="mt-4 font-display text-xl font-bold tracking-[0.2em] text-slate-50">
                  WAITING FOR SCAN
                </div>
                <div className="mt-2 font-mono text-xs text-slate-400">
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
                  <div className="pointer-events-auto mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-2xl border border-line bg-ink-950/90 px-4 py-3 backdrop-blur">
                    {HUD_STEPS.map((step, i) => (
                      <div key={step.title} className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-bold',
                            i < activeStep
                              ? 'border-success-400/60 bg-success-500/20 text-success-300'
                              : i === activeStep
                                ? 'animate-rec-pulse border-warn-400/70 bg-warn-500/20 text-warn-300'
                                : 'border-line bg-ink-850 text-slate-400'
                          )}
                        >
                          {i < activeStep ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                        </span>
                        <span
                          className={cn(
                            'hidden truncate text-xs font-medium sm:block',
                            i === activeStep ? 'text-slate-50' : 'text-slate-400'
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
              <div className="absolute left-1/2 top-14 -translate-x-1/2 animate-rec-pulse rounded-lg border border-danger-500/60 bg-danger-500/25 px-4 py-2 font-display text-sm font-bold tracking-widest text-danger-300 backdrop-blur">
                ⚑ FLAGGED: BAD RETURN — pick a reason on stop
              </div>
            )}
          </div>

          {/* Scan sink + controls */}
          {stage === 'recording' ? (
            <Card className="flex flex-wrap items-center gap-3 p-4">
              <div className="flex h-11 min-w-0 flex-1 flex-wrap items-center gap-3 rounded-xl border border-danger-500/40 bg-danger-500/5 px-4">
                <span className="flex items-center gap-1.5 font-mono text-sm font-bold text-danger-400">
                  <span className="h-2.5 w-2.5 animate-rec-pulse rounded-full bg-danger-500" />
                  REC {mm}:{ss}
                </span>
                <span className="truncate font-mono text-sm font-semibold text-white">
                  {parcel?.awb}
                </span>
                <span
                  className={cn(
                    'font-mono text-xs',
                    isOverTarget ? 'text-warn-400 font-semibold' : 'text-slate-400'
                  )}
                >
                  ~{estimatedMB} MB / Target: &lt;{targetSizeMB} MB
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
                    data-scansink="true"
                    aria-label="Scan or type AWB barcode"
                    placeholder="Scan / type AWB then Enter"
                    className="min-w-0 flex-1 bg-transparent font-mono text-sm uppercase tracking-wider text-white placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-600 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const value = (e.target as HTMLInputElement).value;
                        if (value.trim()) {
                          void handleScan(value);
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

          {/* Listener status & format info */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="proof">
              <Usb className="h-3 w-3" /> USB Gun armed
            </Badge>
            <Badge
              tone={
                scanner.status === 'running'
                  ? 'proof'
                  : scanner.status === 'error'
                    ? 'danger'
                    : 'neutral'
              }
            >
              <Camera className="h-3 w-3" />
              {scanner.status === 'running'
                ? `Camera scanner · ${scanner.detail ?? 'active'}`
                : scanner.status === 'error'
                  ? `Camera scanner error — ${scanner.detail ?? ''}`
                  : (scanner.detail ?? 'Camera scanner idle')}
            </Badge>

            <Badge tone={isWebM ? 'warn' : 'proof'}>FORMAT: {containerFormat.toUpperCase()}</Badge>
            {isWebM && (
              <span className="text-[11px] text-warn-400/80">
                (WebM format used — browser has no native MP4 encoder)
              </span>
            )}

            {isPhonePairingConfigured() ? (
              pairing ? (
                <Badge tone="info">
                  <QrCode className="h-3 w-3" /> Phone room {pairing.code} — open
                </Badge>
              ) : (
                <Button
                  variant="ghost"
                  size="xs"
                  loading={pairingBusy}
                  onClick={() => void startPairingRoom()}
                >
                  <QrCode className="h-3 w-3" /> Start phone pairing room
                </Button>
              )
            ) : (
              <Badge tone="outline">Phone — not configured</Badge>
            )}
          </div>

          {pairing?.qr && (
            <Card className="flex items-center gap-4 p-4">
              <img
                src={pairing.qr}
                alt={`Pairing room ${pairing.code}`}
                className="qr-plate h-28 w-28 rounded-lg p-1"
              />
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
              <div className="font-display text-base font-bold text-white">
                Photo evidence slots
              </div>
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
            <div className={cn('mt-3 grid grid-cols-4 gap-2', !canCollage && 'opacity-70')}>
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
                    <div className="flex h-full flex-col items-center justify-center gap-1 text-slate-300">
                      <span className="font-mono text-[9px] font-medium text-slate-200">
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
                      <div className="truncate font-mono text-xs font-semibold text-white">
                        {r.awb}
                      </div>
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
          <Keyboard className="h-3.5 w-3.5" /> Tip: press <Kbd>F2</Kbd> the moment you spot the
          damage — it marks the exact second in the clip.
        </div>
      </Modal>
    </div>
  );
}

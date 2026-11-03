/**
 * Scanner Test Workbench for SABOOT Suite.
 *
 * Real-time diagnostic workbench for testing keyboard-wedge USB scanners,
 * Bluetooth barcode guns, and phone/webcam camera scanners.
 *
 * Features:
 * - Real-time keystroke inspector with inter-key gap timing (ms).
 * - Big visual confirmation for good scans (green) and invalid scans (red).
 * - Distinguishes high-speed scanner bursts from slow human typing.
 * - Live camera scanner preview with torch toggle and zoom control slider.
 * - Test buttons for acoustic good/invalid beeps.
 * - Inline configuration of prefix, suffix, minLength, debounce, and case handling.
 * - Scan history log formatted with Indian Standard Time (IST).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Flashlight,
  History,
  Keyboard,
  RotateCcw,
  ScanBarcode,
  Settings,
  Sliders,
  Volume2,
  Zap,
  ZoomIn
} from 'lucide-react';
import {
  DEFAULT_SCANNER_SETTINGS,
  getScannerSettings,
  saveScannerSettings,
  type CaseHandling,
  type ScannerSettings,
  type ScannerSuffix
} from '../config/scannerConfig';
import {
  startHidListener,
  SCANNER_DIAGNOSTIC_EVENT,
  type ScannerDiagnosticEvent,
  type ScannerStats
} from '../lib/hidScanner';
import {
  startCameraScanner,
  type CameraScannerHandle,
  type ScannerStatus
} from '../lib/cameraScanner';
import { playGoodScanBeep, playInvalidScanBeep } from '../lib/audioBeeps';
import { formatISTShort } from '../lib/dateUtils';
import { Badge, Button, Card, PageHeader, StatusDot, Toggle, useToast } from '../components/ui';
import type { Route } from '../lib/router';

interface ScanHistoryEntry {
  id: string;
  timeIST: string;
  raw: string;
  code: string;
  valid: boolean;
  error?: string;
  stats?: ScannerStats;
  source: 'usb-hid' | 'camera';
}

interface KeystrokePill {
  key: string;
  deltaMs: number;
  time: number;
}

export default function ScannerTestPage({ navigate }: { navigate: (r: Route) => void }) {
  const toast = useToast();

  // Settings state
  const [settings, setSettings] = useState<ScannerSettings>(() => getScannerSettings());
  const [savingSettings, setSavingSettings] = useState(false);

  // Live scan feedback state
  const [lastScanState, setLastScanState] = useState<{
    status: 'idle' | 'good' | 'invalid' | 'debounced';
    code: string;
    raw: string;
    error?: string;
    stats?: ScannerStats;
    timestamp: number;
  }>({
    status: 'idle',
    code: '',
    raw: '',
    timestamp: 0
  });

  // Keystroke inspector stream
  const [liveKeystrokes, setLiveKeystrokes] = useState<KeystrokePill[]>([]);
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);

  // Camera preview scanner state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<{ status: ScannerStatus; detail?: string }>({
    status: 'idle'
  });
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(
    null
  );
  const [zoomValue, setZoomValue] = useState(1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraHandleRef = useRef<CameraScannerHandle | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // Sandbox text field input
  const [sandboxInput, setSandboxInput] = useState('');

  // Handle settings update
  const updateSettings = async (partial: Partial<ScannerSettings>) => {
    setSavingSettings(true);
    try {
      const updated = await saveScannerSettings(partial);
      setSettings(updated);
      toast.success('Scanner settings saved', 'New barcode processing rules are now active.');
    } catch (e) {
      toast.error('Failed to save settings', e instanceof Error ? e.message : String(e));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetSettings = async () => {
    setSavingSettings(true);
    try {
      const reset = await saveScannerSettings(DEFAULT_SCANNER_SETTINGS);
      setSettings(reset);
      toast.info('Factory defaults restored', 'Scanner configuration reset to default settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Record a scan result into state & history
  const recordScanResult = useCallback(
    (entry: {
      raw: string;
      code: string;
      valid: boolean;
      error?: string;
      stats?: ScannerStats;
      source: 'usb-hid' | 'camera';
    }) => {
      const now = Date.now();
      const timeIST = formatISTShort(now);
      const newEntry: ScanHistoryEntry = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timeIST,
        raw: entry.raw,
        code: entry.code,
        valid: entry.valid,
        error: entry.error,
        stats: entry.stats,
        source: entry.source
      };

      setHistory((prev) => [newEntry, ...prev.slice(0, 49)]);

      setLastScanState({
        status: entry.valid ? 'good' : 'invalid',
        code: entry.code,
        raw: entry.raw,
        error: entry.error,
        stats: entry.stats,
        timestamp: Date.now()
      });
    },
    []
  );

  // Listen to diagnostic events and HID scanner
  useEffect(() => {
    const onDiagnostic = (e: Event) => {
      const custom = e as CustomEvent<ScannerDiagnosticEvent>;
      const d = custom.detail;
      if (!d) return;

      if (d.type === 'keystroke' && d.key) {
        setLiveKeystrokes((prev) => [
          ...prev.slice(-25),
          { key: d.key!, deltaMs: d.deltaMs ?? 0, time: Date.now() }
        ]);
      } else if (d.type === 'burst_complete' && d.result) {
        recordScanResult({
          raw: d.raw || d.code || '',
          code: d.code || '',
          valid: true,
          stats: d.stats,
          source: 'usb-hid'
        });
      } else if (d.type === 'invalid') {
        recordScanResult({
          raw: d.raw || '',
          code: d.code || '',
          valid: false,
          error: d.error || 'Invalid barcode',
          stats: d.stats,
          source: 'usb-hid'
        });
      } else if (d.type === 'debounced') {
        setLastScanState((prev) => ({
          ...prev,
          status: 'debounced',
          code: d.code || prev.code,
          raw: d.raw || prev.raw,
          stats: d.stats || prev.stats,
          timestamp: Date.now()
        }));
      }
    };

    window.addEventListener(SCANNER_DIAGNOSTIC_EVENT, onDiagnostic);

    // Active HID listener
    const hid = startHidListener(
      (_code, _result) => {
        // Handled via diagnostic event for rich metrics
      },
      {
        onInvalidScan: (_raw, _error) => {
          // Handled via diagnostic event
        }
      }
    );

    return () => {
      window.removeEventListener(SCANNER_DIAGNOSTIC_EVENT, onDiagnostic);
      hid.stop();
    };
  }, [recordScanResult]);

  // Camera start / stop toggle
  const toggleCamera = async () => {
    if (cameraActive) {
      if (cameraHandleRef.current) {
        cameraHandleRef.current.stop();
        cameraHandleRef.current = null;
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
      setCameraActive(false);
      setCameraStatus({ status: 'idle' });
      setTorchAvailable(false);
      setTorchOn(false);
      setZoomRange(null);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const handle = await startCameraScanner(
          videoRef.current,
          (code) => {
            recordScanResult({
              raw: code,
              code,
              valid: true,
              source: 'camera'
            });
          },
          {
            onStatus: (st, detail) => setCameraStatus({ status: st, detail }),
            onInvalidScan: (raw, err) => {
              recordScanResult({
                raw,
                code: raw,
                valid: false,
                error: err,
                source: 'camera'
              });
            }
          }
        );

        cameraHandleRef.current = handle;
        setTorchAvailable(handle.hasTorch);
        setTorchOn(handle.isTorchOn());
        const zRange = handle.getZoomRange();
        setZoomRange(zRange);
        if (zRange) setZoomValue(handle.getZoom());
        setCameraActive(true);
      }
    } catch (e) {
      toast.error(
        'Unable to access camera',
        e instanceof Error ? e.message : 'Please check camera permissions in browser settings.'
      );
    }
  };

  const handleTorchToggle = async () => {
    if (!cameraHandleRef.current || !torchAvailable) return;
    const next = !torchOn;
    const ok = await cameraHandleRef.current.setTorch(next);
    if (ok) setTorchOn(next);
  };

  const handleZoomChange = async (val: number) => {
    setZoomValue(val);
    if (cameraHandleRef.current && zoomRange) {
      await cameraHandleRef.current.setZoom(val);
    }
  };

  useEffect(() => {
    return () => {
      if (cameraHandleRef.current) cameraHandleRef.current.stop();
      if (cameraStreamRef.current) cameraStreamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Scanner Test Workbench"
        subtitle="Diagnose USB laser guns, Bluetooth keyboard wedges, and camera scanners with millisecond timing diagnostics."
        icon={ScanBarcode}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Settings}
              onClick={() => navigate('settings')}
            >
              Settings
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={ChevronRight}
              onClick={() => navigate('recorder')}
            >
              Go to Recorder
            </Button>
          </div>
        }
      />

      {/* ── Status Banner & Visual Confirmation ───────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card
            className={`transition-all duration-300 p-6 ${
              lastScanState.status === 'good'
                ? 'border-proof-500/60 bg-proof-950/40 shadow-lg shadow-proof-500/10'
                : lastScanState.status === 'invalid'
                  ? 'border-danger-500/60 bg-danger-950/30 shadow-lg shadow-danger-500/10'
                  : lastScanState.status === 'debounced'
                    ? 'border-warn-500/60 bg-warn-950/30 shadow-lg shadow-warn-500/10'
                    : 'border-slate-800 bg-ink-900/40'
            }`}
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {lastScanState.status === 'good' ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-proof-500/20 text-proof-400">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                  ) : lastScanState.status === 'invalid' ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-danger-500/20 text-danger-400">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                  ) : lastScanState.status === 'debounced' ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warn-500/20 text-warn-400">
                      <Clock className="h-5 w-5" />
                    </div>
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-slate-400">
                      <ScanBarcode className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {lastScanState.status === 'good'
                        ? 'Good Scan Confirmed'
                        : lastScanState.status === 'invalid'
                          ? 'Invalid Scan Detected'
                          : lastScanState.status === 'debounced'
                            ? 'Duplicate Scan Suppressed'
                            : 'Scanner Gun Listener Active'}
                    </div>
                    <div className="text-sm font-medium text-slate-300">
                      {lastScanState.status === 'good'
                        ? 'Valid barcode decoded and normalized'
                        : lastScanState.status === 'invalid'
                          ? lastScanState.error || 'Barcode rejected by validation criteria'
                          : lastScanState.status === 'debounced'
                            ? `Debounced duplicate within ${settings.debounceMs} ms window`
                            : 'Pull the trigger on your scanner gun or scan a barcode'}
                    </div>
                  </div>
                </div>

                {lastScanState.status !== 'idle' && (
                  <Badge
                    tone={
                      lastScanState.status === 'good'
                        ? 'proof'
                        : lastScanState.status === 'invalid'
                          ? 'danger'
                          : 'warn'
                    }
                  >
                    {lastScanState.status.toUpperCase()}
                  </Badge>
                )}
              </div>

              {/* Main Code Display */}
              <div className="rounded-xl border border-line bg-ink-950/80 p-4">
                <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Scanned Barcode (Cleaned)
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-4">
                  <div className="break-all font-mono text-2xl font-bold tracking-wider text-white">
                    {lastScanState.code || (
                      <span className="text-slate-600 font-sans text-lg font-normal">
                        Waiting for scan stream...
                      </span>
                    )}
                  </div>
                  {lastScanState.code && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(lastScanState.code);
                        toast.info('Copied to clipboard', lastScanState.code);
                      }}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1 shrink-0"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </button>
                  )}
                </div>

                {/* Sub-details: raw, length, terminator */}
                {lastScanState.raw && (
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-800/80 pt-3 text-xs sm:grid-cols-4">
                    <div>
                      <span className="text-slate-500">Raw Stream:</span>{' '}
                      <span className="font-mono text-slate-300 break-all">
                        {lastScanState.raw}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Length:</span>{' '}
                      <span className="font-mono text-slate-300">
                        {lastScanState.code.length} chars
                      </span>
                    </div>
                    {lastScanState.stats && (
                      <>
                        <div>
                          <span className="text-slate-500">Speed:</span>{' '}
                          <span className="font-mono text-slate-300">
                            {lastScanState.stats.avgIntervalMs} ms/key
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Terminator:</span>{' '}
                          <span className="font-mono text-slate-300">
                            {lastScanState.stats.terminator}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Audio Test & Quick Diagnostics */}
        <div className="flex flex-col gap-4">
          <Card className="p-5 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Volume2 className="h-4 w-4 text-proof-400" />
                Acoustic Confirmation Tones
              </div>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Distinct frequencies allow warehouse packers to verify scans without watching the
                screen.
              </p>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={CheckCircle2}
                onClick={() => playGoodScanBeep()}
                className="justify-start text-xs text-proof-300 hover:text-proof-200"
              >
                Test Good Scan Beep (1046 Hz Sine)
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={AlertTriangle}
                onClick={() => playInvalidScanBeep()}
                className="justify-start text-xs text-danger-300 hover:text-danger-200"
              >
                Test Invalid Scan Buzz (280 Hz Sawtooth)
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Keystroke Inspector & Burst Speed Metrics ─────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Keyboard className="h-4 w-4 text-proof-400" />
            <div>
              <div className="text-sm font-bold text-white">Live Keystroke Inspector</div>
              <div className="text-xs text-slate-400">
                Visualizes individual keystroke events and millisecond delta gaps in real time.
              </div>
            </div>
          </div>
          {liveKeystrokes.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              icon={RotateCcw}
              onClick={() => setLiveKeystrokes([])}
            >
              Clear Inspector
            </Button>
          )}
        </div>

        <div className="mt-4 min-h-[56px] rounded-xl border border-line bg-ink-950/80 p-3 flex flex-wrap items-center gap-1.5 overflow-x-auto">
          {liveKeystrokes.length === 0 ? (
            <div className="text-xs text-slate-600 italic">
              No keystrokes received yet. Scan a barcode with your scanner gun to inspect keystroke
              gaps.
            </div>
          ) : (
            liveKeystrokes.map((k, i) => (
              <span
                key={`${k.time}_${i}`}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-xs ${
                  k.deltaMs > settings.maxBurstIntervalMs
                    ? 'border border-warn-500/30 bg-warn-950/40 text-warn-300'
                    : 'border border-proof-500/30 bg-proof-950/40 text-proof-300'
                }`}
                title={`Key: ${k.key} · Gap: ${k.deltaMs} ms`}
              >
                <span className="font-bold">{k.key === ' ' ? '␣' : k.key}</span>
                <span className="text-[10px] text-slate-500">{k.deltaMs}ms</span>
              </span>
            ))
          )}
        </div>
      </Card>

      {/* ── Interactive Typing vs Scanner Sandbox ─────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center gap-2.5">
          <Zap className="h-4 w-4 text-proof-400" />
          <div>
            <div className="text-sm font-bold text-white">
              Typing Speed vs. Scanner Wedge Sandbox
            </div>
            <div className="text-xs text-slate-400">
              Type manually in the box below (slow human typing) vs scanning with your USB gun
              (high-speed burst).
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <input
              type="text"
              value={sandboxInput}
              onChange={(e) => setSandboxInput(e.target.value)}
              placeholder="Click here and either type manually or pull scanner trigger..."
              className="w-full rounded-lg border border-slate-700 bg-ink-950 px-4 py-2.5 font-mono text-sm text-white placeholder:text-slate-600 focus:border-proof-500 focus:outline-none"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSandboxInput('')}
            disabled={!sandboxInput}
          >
            Clear Input
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">
          <strong>How it works:</strong> USB guns type at &lt;{settings.maxBurstIntervalMs} ms per
          key. If you type with your hands, keystrokes arrive with &gt;100 ms gaps, so the app
          treats it as regular text and will not trigger false barcode events.
        </p>
      </Card>

      {/* ── Camera Scanner (Webcam & Phone Companion) ─────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Camera className="h-4 w-4 text-proof-400" />
            <div>
              <div className="text-sm font-bold text-white">Camera Barcode Scanner Preview</div>
              <div className="text-xs text-slate-400">
                Native BarcodeDetector with ZXing fallback, torch / flashlight toggle, and zoom
                control.
              </div>
            </div>
          </div>
          <Button
            variant={cameraActive ? 'secondary' : 'primary'}
            size="sm"
            icon={cameraActive ? RotateCcw : Camera}
            onClick={() => void toggleCamera()}
          >
            {cameraActive ? 'Stop Camera' : 'Start Camera Test'}
          </Button>
        </div>

        {cameraActive && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="relative mx-auto aspect-video max-w-lg overflow-hidden rounded-xl border border-line bg-black">
              <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />

              {/* Torch & Zoom Overlay Controls */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-lg bg-black/60 backdrop-blur px-3 py-2 text-xs text-white">
                <div className="flex items-center gap-2">
                  <StatusDot tone="proof" pulse />
                  <span>{cameraStatus.detail || 'Scanning video feed...'}</span>
                </div>

                <div className="flex items-center gap-2">
                  {torchAvailable && (
                    <Button
                      variant={torchOn ? 'primary' : 'secondary'}
                      size="sm"
                      icon={Flashlight}
                      onClick={() => void handleTorchToggle()}
                      className="h-7 px-2 text-xs"
                    >
                      {torchOn ? 'Torch On' : 'Torch Off'}
                    </Button>
                  )}

                  {zoomRange && (
                    <div className="flex items-center gap-1.5">
                      <ZoomIn className="h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="range"
                        min={zoomRange.min}
                        max={zoomRange.max}
                        step={zoomRange.step}
                        value={zoomValue}
                        onChange={(e) => void handleZoomChange(Number(e.target.value))}
                        className="h-1.5 w-16 cursor-pointer accent-proof-500"
                      />
                      <span className="font-mono text-[10px] text-slate-300">
                        {zoomValue.toFixed(1)}x
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ── Inline Settings Workbench ─────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Sliders className="h-4 w-4 text-proof-400" />
            <div>
              <div className="text-sm font-bold text-white">Scanner Configuration & Rules</div>
              <div className="text-xs text-slate-400">
                Prefix, suffix, minimum length, debounce suppression, and case normalization.
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={RotateCcw}
            onClick={() => void handleResetSettings()}
            loading={savingSettings}
          >
            Reset Defaults
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Suffix / Terminator */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="scanner-suffix-select" className="text-xs font-medium text-slate-300">
              Expected Suffix (Terminator)
            </label>
            <select
              id="scanner-suffix-select"
              value={settings.suffix}
              onChange={(e) => void updateSettings({ suffix: e.target.value as ScannerSuffix })}
              className="rounded-lg border border-slate-700 bg-ink-950 px-3 py-2 text-sm text-white focus:border-proof-500 focus:outline-none"
            >
              <option value="EnterOrTab">Enter or Tab (Universal Default)</option>
              <option value="Enter">Enter Only (CR/LF)</option>
              <option value="Tab">Tab Only</option>
              <option value="None">None (Timeout Burst)</option>
            </select>
            <span className="text-[11px] text-slate-500">
              Most USB barcode scanners send Enter or Tab after the barcode.
            </span>
          </div>

          {/* Minimum Length */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="scanner-min-length-input"
              className="text-xs font-medium text-slate-300"
            >
              Minimum Barcode Length
            </label>
            <input
              id="scanner-min-length-input"
              type="number"
              min={1}
              max={64}
              value={settings.minLength}
              onChange={(e) =>
                void updateSettings({ minLength: Math.max(1, parseInt(e.target.value) || 1) })
              }
              className="rounded-lg border border-slate-700 bg-ink-950 px-3 py-2 font-mono text-sm text-white focus:border-proof-500 focus:outline-none"
            />
            <span className="text-[11px] text-slate-500">
              Discards accidental short scans (default: 4 chars).
            </span>
          </div>

          {/* Debounce Duration */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="scanner-debounce-input" className="text-xs font-medium text-slate-300">
              Duplicate Debounce Guard (ms)
            </label>
            <input
              id="scanner-debounce-input"
              type="number"
              step={100}
              min={0}
              max={10000}
              value={settings.debounceMs}
              onChange={(e) =>
                void updateSettings({ debounceMs: Math.max(0, parseInt(e.target.value) || 0) })
              }
              className="rounded-lg border border-slate-700 bg-ink-950 px-3 py-2 font-mono text-sm text-white focus:border-proof-500 focus:outline-none"
            />
            <span className="text-[11px] text-slate-500">
              Suppresses duplicate reads of the exact same code (default: 1500 ms).
            </span>
          </div>

          {/* Prefix */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="scanner-prefix-input" className="text-xs font-medium text-slate-300">
              Required Prefix (Optional)
            </label>
            <input
              id="scanner-prefix-input"
              type="text"
              placeholder="e.g. PKG- or empty"
              value={settings.prefix}
              onChange={(e) => void updateSettings({ prefix: e.target.value })}
              className="rounded-lg border border-slate-700 bg-ink-950 px-3 py-2 font-mono text-sm text-white focus:border-proof-500 focus:outline-none"
            />
            <span className="text-[11px] text-slate-500">
              Strip an expected barcode prefix before matching AWB.
            </span>
          </div>

          {/* Case Handling */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="scanner-case-select" className="text-xs font-medium text-slate-300">
              Case Normalization
            </label>
            <select
              id="scanner-case-select"
              value={settings.caseHandling}
              onChange={(e) =>
                void updateSettings({ caseHandling: e.target.value as CaseHandling })
              }
              className="rounded-lg border border-slate-700 bg-ink-950 px-3 py-2 text-sm text-white focus:border-proof-500 focus:outline-none"
            >
              <option value="uppercase">UPPERCASE (Standard for AWBs)</option>
              <option value="lowercase">lowercase</option>
              <option value="preserve">Preserve Original Case</option>
            </select>
            <span className="text-[11px] text-slate-500">
              Indian marketplace AWBs are typically uppercase alphanumeric.
            </span>
          </div>

          {/* Burst Speed Limit */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="scanner-burst-gap-input" className="text-xs font-medium text-slate-300">
              Max Burst Gap (ms)
            </label>
            <input
              id="scanner-burst-gap-input"
              type="number"
              min={20}
              max={250}
              value={settings.maxBurstIntervalMs}
              onChange={(e) =>
                void updateSettings({
                  maxBurstIntervalMs: Math.max(20, parseInt(e.target.value) || 80)
                })
              }
              className="rounded-lg border border-slate-700 bg-ink-950 px-3 py-2 font-mono text-sm text-white focus:border-proof-500 focus:outline-none"
            />
            <span className="text-[11px] text-slate-500">
              Max ms between keys to qualify as a scanner burst (default: 80 ms).
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-6 border-t border-slate-800/80 pt-4">
          <div className="flex items-center gap-3">
            <Toggle
              checked={settings.stripNoise}
              onChange={(v) => void updateSettings({ stripNoise: v })}
            />
            <div className="text-xs text-slate-300">
              <span className="font-semibold">Strip AIM Symbology & Control Noise</span> (e.g.{' '}
              <code className="text-proof-400">]C1</code>, tabs, whitespace)
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Toggle
              checked={settings.beepOnScan}
              onChange={(v) => void updateSettings({ beepOnScan: v })}
            />
            <div className="text-xs text-slate-300">
              <span className="font-semibold">Acoustic Feedback</span> (Beeps on scan confirmation)
            </div>
          </div>
        </div>
      </Card>

      {/* ── Scan History Log ─────────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <History className="h-4 w-4 text-proof-400" />
            <div>
              <div className="text-sm font-bold text-white">Scan Session History</div>
              <div className="text-xs text-slate-400">
                Log of barcodes scanned during this workbench session with IST timestamps.
              </div>
            </div>
          </div>
          {history.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setHistory([])}>
              Clear History
            </Button>
          )}
        </div>

        <div className="mt-4 overflow-x-auto">
          {history.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-600">
              No scans recorded yet in this session.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-slate-500">
                  <th className="pb-2 font-medium">Time (IST)</th>
                  <th className="pb-2 font-medium">Source</th>
                  <th className="pb-2 font-medium">Parsed Barcode</th>
                  <th className="pb-2 font-medium">Raw Input</th>
                  <th className="pb-2 font-medium">Speed</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40">
                    <td className="py-2.5 text-slate-400 whitespace-nowrap">{item.timeIST}</td>
                    <td className="py-2.5">
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 uppercase">
                        {item.source}
                      </span>
                    </td>
                    <td className="py-2.5 font-bold text-white">{item.code}</td>
                    <td className="py-2.5 text-slate-500 max-w-[200px] truncate" title={item.raw}>
                      {item.raw}
                    </td>
                    <td className="py-2.5 text-slate-400">
                      {item.stats ? `${item.stats.avgIntervalMs}ms/k` : '—'}
                    </td>
                    <td className="py-2.5">
                      {item.valid ? (
                        <span className="inline-flex items-center gap-1 text-proof-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Valid
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-danger-400"
                          title={item.error}
                        >
                          <AlertTriangle className="h-3.5 w-3.5" /> Invalid
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import {
  Activity,
  Cable,
  Database,
  Download,
  FileText,
  FolderCheck,
  FolderOpen,
  HardDrive,
  Info,
  LifeBuoy,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Usb,
  Video,
  Volume2
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BRAND } from '../config/brand';
import { db, getSetting, setSetting } from '../db/schema';
import { connectVault, getVaultStatus } from '../services/vaultWriter';
import { isPhonePairingConfigured, pairingQrPayload } from '../services/phonePairing';
import { formatISTShort } from '../lib/dateUtils';
import { downloadBlob } from '../lib/utils';
import { Badge, Button, Card, PageHeader, StatusDot, Toggle, useToast } from '../components/ui';
import { isBeepsMuted, setBeepsMuted } from '../lib/audioBeeps';
import { isTelemetryEnabled, setTelemetryEnabled } from '../services/telemetry';
import { navigateTo } from '../lib/router';
import { RECORDER_CONFIG } from '../config/recorderConfig';

function Section({
  icon: Icon,
  title,
  sub,
  children
}: {
  icon: typeof HardDrive;
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-proof-500/25 bg-proof-500/12 text-proof-300">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="font-display text-base font-bold text-white">{title}</div>
          {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export default function SettingsPage() {
  const toast = useToast();
  const [connecting, setConnecting] = useState(false);
  const [sampleQr, setSampleQr] = useState<string | null>(null);
  const [beepsMuted, setBeepsMutedState] = useState(() => isBeepsMuted());
  const [telemetryEnabled, setTelemetryEnabledState] = useState(() => isTelemetryEnabled());
  const [targetSizeMB, setTargetSizeMB] = useState<number>(RECORDER_CONFIG.defaultTargetSizeMB);
  const [maxDurationSec, setMaxDurationSec] = useState<number>(
    RECORDER_CONFIG.defaultMaxDurationSec
  );

  useEffect(() => {
    const onTelemetryChanged = () => setTelemetryEnabledState(isTelemetryEnabled());
    window.addEventListener('cp-telemetry-changed', onTelemetryChanged);
    return () => window.removeEventListener('cp-telemetry-changed', onTelemetryChanged);
  }, []);

  useEffect(() => {
    void getSetting('target_video_size_mb', RECORDER_CONFIG.defaultTargetSizeMB).then(
      setTargetSizeMB
    );
    void getSetting('max_recording_duration_sec', RECORDER_CONFIG.defaultMaxDurationSec).then(
      setMaxDurationSec
    );
  }, []);

  const vaultStatus = useLiveQuery(() => getVaultStatus(), []);
  const paired = isPhonePairingConfigured();

  async function onConnectVault() {
    setConnecting(true);
    try {
      const mode = await connectVault();
      if (mode === 'fs-api') {
        toast.success('Vault connected', 'Videos & collages now write straight to disk.');
      } else {
        toast.info('Using Downloads fallback', 'This browser has no File System Access API.');
      }
    } catch {
      toast.warn('Vault connection cancelled');
    } finally {
      setConnecting(false);
    }
  }

  async function exportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      orders: await db.orders.toArray(),
      batches: await db.batches.toArray(),
      recordings: await db.recordings.toArray(),
      claims: await db.claims.toArray(),
      usage: await db.usage_counters.toArray()
    };
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      `${BRAND.shortName.toLowerCase()}_backup_${Date.now()}.json`
    );
    toast.success('Backup exported', 'All metadata (no media) as JSON.');
  }

  async function previewPairingQr() {
    const { renderUpiQr } = await import('../lib/upi');
    const qr = await renderUpiQr(pairingQrPayload('482913'), 160);
    setSampleQr(qr);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={HardDrive}
        kicker="WORKSTATION"
        title="Settings"
        subtitle="Vault, pairing, data & about — everything stays on this PC"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section
          icon={FolderOpen}
          title="Evidence vault"
          sub="Where {AWB}_Video.mp4 and photo collages are written"
        >
          <div className="glass-soft flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <StatusDot tone={vaultStatus === 'connected' ? 'proof' : 'warn'} />
                {vaultStatus === 'connected'
                  ? 'Connected — direct disk writes'
                  : vaultStatus === 'permission'
                    ? 'Needs permission re-grant'
                    : vaultStatus === 'downloads'
                      ? 'Downloads fallback active'
                      : 'Not set up yet'}
              </div>
              <Button
                variant={vaultStatus === 'connected' ? 'secondary' : 'primary'}
                size="sm"
                icon={FolderCheck}
                loading={connecting}
                onClick={() => void onConnectVault()}
              >
                {vaultStatus === 'connected' ? 'Reconnect' : 'Connect folder'}
              </Button>
            </div>
            <div className="rounded-lg border border-line bg-ink-950/70 p-3 font-mono text-[10px] leading-relaxed text-slate-500">
              {'<vault>\\<YYYY-MM-DD>\\<Dispatch|Return>\\<AWB>\\'}
              <br />
              {'{AWB}_Video.mp4 · {AWB}_Photo_Collage.jpg'}
            </div>
            <div className="text-[11px] text-slate-500">
              Pick your <span className="font-mono text-slate-400">{BRAND.defaultVaultFolder}</span>{' '}
              folder once — files then write directly to disk with zero uploads.
            </div>
          </div>
        </Section>

        <Section
          icon={Smartphone}
          title="Phone-as-scanner companion"
          sub="Pair a phone camera to scan barcodes at this packing table"
        >
          <div className="glass-soft flex flex-col gap-3 p-4">
            {paired ? (
              <>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <StatusDot tone="proof" pulse />
                  Supabase Realtime configured — open the Recorder to start a pairing room.
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={QrCode}
                  onClick={() => void previewPairingQr()}
                >
                  Preview pairing QR format
                </Button>
                {sampleQr && (
                  <div className="flex items-center gap-3">
                    <img
                      src={sampleQr}
                      alt="Sample pairing QR"
                      className="qr-plate h-24 w-24 rounded-lg p-1"
                    />
                    <div className="text-[11px] text-slate-500">
                      Sample — the Recorder generates a live 6-digit room code per session.
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <StatusDot tone="warn" />
                  Not configured
                </div>
                <div className="text-[11px] leading-relaxed text-slate-500">
                  Set <span className="font-mono text-slate-400">VITE_SUPABASE_URL</span> and{' '}
                  <span className="font-mono text-slate-400">VITE_SUPABASE_ANON_KEY</span> at build
                  time to enable 6-digit room-code pairing via Supabase Realtime broadcast. USB guns
                  and the webcam scanner work without it.
                </div>
              </>
            )}
            <div className="flex items-center gap-2 text-[11px] text-slate-600">
              <Usb className="h-3.5 w-3.5" /> USB / Bluetooth HID guns: plug &amp; play, no setup.
              <Cable className="h-3.5 w-3.5" />
            </div>
          </div>
        </Section>

        <Section icon={Volume2} title="Scanner sounds" sub="Beeps for scan · start · saved · flag">
          <Toggle
            checked={!beepsMuted}
            onChange={(next) => {
              setBeepsMuted(!next);
              setBeepsMutedState(!next);
            }}
            label="Enable audio feedback"
            hint="Loud, distinct beeps so packers never have to look at the screen"
          />
        </Section>

        <Section
          icon={Video}
          title="Recorder limits & preferences"
          sub="Target size and duration safeguard (user-configured packaging limits)"
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="setting-target-size"
                className="block text-xs font-semibold text-slate-300"
              >
                Target video size (MB)
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="setting-target-size"
                  type="number"
                  min="5"
                  max="200"
                  value={targetSizeMB}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value) || 25);
                    setTargetSizeMB(val);
                    void setSetting('target_video_size_mb', val);
                  }}
                  className="glass-soft h-9 w-28 px-3 font-mono text-sm text-white focus:outline-none"
                />
                <span className="text-xs text-slate-400">MB preferred target</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Packaging target size preference. No marketplace size limits are claimed.
              </div>
            </div>

            <div>
              <label
                htmlFor="setting-max-duration"
                className="block text-xs font-semibold text-slate-300"
              >
                Max recording duration safeguard
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="setting-max-duration"
                  type="number"
                  min="1"
                  max="30"
                  value={Math.round(maxDurationSec / 60)}
                  onChange={(e) => {
                    const mins = Math.max(1, Number(e.target.value) || 5);
                    const secs = mins * 60;
                    setMaxDurationSec(secs);
                    void setSetting('max_recording_duration_sec', secs);
                  }}
                  className="glass-soft h-9 w-28 px-3 font-mono text-sm text-white focus:outline-none"
                />
                <span className="text-xs text-slate-400">
                  minutes (auto-stops unattended recordings)
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Automatically stops and preserves recording if a parcel station is left open.
              </div>
            </div>
          </div>
        </Section>

        <Section
          icon={Database}
          title="Data & backups"
          sub="IndexedDB metadata — media stays on disk"
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={Download} onClick={() => void exportData()}>
              Export JSON backup
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={() => {
                if (
                  window.confirm(
                    `Wipe ALL ${BRAND.name} data on this PC (labels, recordings index, claims, license)? Media files on disk are kept.`
                  )
                ) {
                  void db.delete().then(() => window.location.reload());
                }
              }}
            >
              Wipe database
            </Button>
          </div>
          <div className="mt-3 text-[11px] text-slate-500">
            Wiping clears the label memory and claim queue — export a backup first.
          </div>
        </Section>

        <Section
          icon={Sparkles}
          title="Onboarding walkthrough"
          sub="First-run setup: marketplaces, vault, and barcode scanner test"
        >
          <div className="glass-soft flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-300">
                Configure your marketplaces, connect your vault folder, and verify your scanner gun
                or camera.
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={Sparkles}
                onClick={() => {
                  window.dispatchEvent(new Event('cp-open-onboarding'));
                }}
                data-testid="reopen-onboarding-button"
              >
                Restart onboarding
              </Button>
            </div>
          </div>
        </Section>

        <Section
          icon={Activity}
          title="Anonymous product analytics & error reporting"
          sub="Strictly opt-in. Zero personal data, zero AWBs, zero order IDs, zero SKUs"
        >
          <div className="space-y-4">
            <Toggle
              checked={telemetryEnabled}
              onChange={(enabled) => {
                setTelemetryEnabledState(enabled);
                void setTelemetryEnabled(enabled);
                toast.info(
                  enabled
                    ? 'Analytics & error reporting enabled'
                    : 'Analytics & error reporting disabled',
                  enabled
                    ? 'Only 5 milestone events and scrubbed error messages will be shared.'
                    : '100% private mode active. Zero telemetry is transmitted.'
                );
              }}
              label="Share anonymous milestone statistics & scrubbed error reports"
              hint={`Helps improve ${BRAND.name} reliability. Disabled by default.`}
            />

            <div className="rounded-lg border border-line bg-ink-950/70 p-3.5 text-xs space-y-2.5">
              <div className="font-semibold text-slate-300">
                What is collected (only when enabled):
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed">
                <li>
                  <strong className="text-slate-300">Only 5 milestone events:</strong> Onboarding
                  completed, first label export, first recording saved, paywall viewed, purchase
                  started.
                </li>
                <li>
                  <strong className="text-slate-300">Scrubbed error reports:</strong> Stack traces
                  with all tracking numbers (AWBs), order IDs, SKUs, and file paths completely
                  redacted.
                </li>
              </ul>

              <div className="font-semibold text-slate-300 pt-1">
                What is NEVER collected or uploaded:
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed">
                <li>No shipping labels, PDFs, or customer addresses.</li>
                <li>
                  No packing or unboxing videos or photos (files write strictly to your hard drive).
                </li>
                <li>No personal names, phone numbers, or email addresses.</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section
          icon={ShieldCheck}
          title="Legal & Support"
          sub="Privacy, terms, refunds & technical help — 100% transparent"
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Button
                variant="secondary"
                size="sm"
                icon={ShieldCheck}
                onClick={() => navigateTo('privacy')}
                className="justify-start"
              >
                Privacy Policy (Zero-Cloud)
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={FileText}
                onClick={() => navigateTo('terms')}
                className="justify-start"
              >
                Terms of Service
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={RotateCcw}
                onClick={() => navigateTo('refund')}
                className="justify-start"
              >
                Refund &amp; Cancellation
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={LifeBuoy}
                onClick={() => navigateTo('support')}
                className="justify-start"
              >
                Support &amp; Diagnostics
              </Button>
            </div>
            <div className="text-[11px] text-slate-500">
              Need urgent setup help or troubleshooting? Open Support for direct WhatsApp and
              zero-PII diagnostic reports.
            </div>
          </div>
        </Section>

        <Section icon={Info} title="About" sub={`${BRAND.legalName} v1.0.0`}>
          <div className="space-y-2 text-[11px] leading-relaxed text-slate-500">
            <div>
              Local-first PWA + Chrome Extension (Manifest V3) for Indian e-commerce sellers. PDF
              cropping via pdfjs + pdf-lib, barcode scanning via the native BarcodeDetector with a
              ZXing fallback, recording via canvas compositing + MediaRecorder at 1.2 Mbps.
            </div>
            <div>
              Install as an app:{' '}
              <span className="text-slate-400">Chrome → ⋮ → Install {BRAND.name}…</span> Works fully
              offline after the first load.
            </div>
            <div className="flex items-center gap-1.5">
              <StatusDot tone="proof" /> Storage: IndexedDB + File System Access ·{' '}
              {formatISTShort(Date.now())}
            </div>
            <Badge tone="proof">₹0 server cost</Badge>
          </div>
        </Section>
      </div>
    </div>
  );
}

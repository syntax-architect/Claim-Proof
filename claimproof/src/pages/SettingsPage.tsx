import { useEffect, useState, type ReactNode } from 'react';
import {
  Activity,
  Cable,
  Clock,
  Database,
  Download,
  ExternalLink,
  FileText,
  FolderCheck,
  FolderOpen,
  HardDrive,
  Info,
  Languages,
  LifeBuoy,
  QrCode,
  RotateCcw,
  ScanBarcode,
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
import { cn, downloadBlob } from '../lib/utils';
import { Badge, Button, Card, PageHeader, StatusDot, Toggle, useToast } from '../components/ui';
import { isBeepsMuted, setBeepsMuted } from '../lib/audioBeeps';
import { isTelemetryEnabled, setTelemetryEnabled } from '../services/telemetry';
import { useI18n } from '../lib/i18n';
import { recalculateClaimsForMarketplace } from '../services/claimEngine';
import { navigateTo } from '../lib/router';
import { RECORDER_CONFIG } from '../config/recorderConfig';
import {
  MARKETPLACE_CLAIM_WINDOWS,
  UNVERIFIED_LABEL,
  getCustomClaimWindows,
  saveCustomClaimWindowHours,
  resetSingleClaimWindow,
  resetCustomClaimWindows,
  isClaimWindowUnverified
} from '../config/claimWindows';
import {
  getScannerSettings,
  saveScannerSettings,
  type ScannerSettings,
  type ScannerSuffix,
  type CaseHandling
} from '../config/scannerConfig';
import type { Marketplace } from '../types';

const CLAIM_MARKETPLACES: Marketplace[] = [
  'Meesho',
  'Flipkart',
  'Amazon',
  'AJIO',
  'Snapdeal',
  'Myntra',
  'GlowRoad'
];

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
  const { lang, setLang, t, pseudoMode, setPseudoMode } = useI18n();
  const [connecting, setConnecting] = useState(false);
  const [sampleQr, setSampleQr] = useState<string | null>(null);
  const [beepsMuted, setBeepsMutedState] = useState(() => isBeepsMuted());
  const [telemetryEnabled, setTelemetryEnabledState] = useState(() => isTelemetryEnabled());
  const [targetSizeMB, setTargetSizeMB] = useState<number>(RECORDER_CONFIG.defaultTargetSizeMB);
  const [maxDurationSec, setMaxDurationSec] = useState<number>(
    RECORDER_CONFIG.defaultMaxDurationSec
  );
  const [customClaimWindows, setCustomClaimWindowsState] = useState<
    Partial<Record<Marketplace, number>>
  >(() => getCustomClaimWindows());
  const [scannerSettings, setScannerSettings] = useState<ScannerSettings>(() =>
    getScannerSettings()
  );

  useEffect(() => {
    const onTelemetryChanged = () => setTelemetryEnabledState(isTelemetryEnabled());
    window.addEventListener('cp-telemetry-changed', onTelemetryChanged);
    return () => window.removeEventListener('cp-telemetry-changed', onTelemetryChanged);
  }, []);

  useEffect(() => {
    const onClaimWindowsChanged = () => setCustomClaimWindowsState(getCustomClaimWindows());
    window.addEventListener('cp-claim-windows-changed', onClaimWindowsChanged);
    return () => window.removeEventListener('cp-claim-windows-changed', onClaimWindowsChanged);
  }, []);

  useEffect(() => {
    void getSetting('target_video_size_mb', RECORDER_CONFIG.defaultTargetSizeMB).then(
      setTargetSizeMB
    );
    void getSetting('max_recording_duration_sec', RECORDER_CONFIG.defaultMaxDurationSec).then(
      setMaxDurationSec
    );
  }, []);

  const handleClaimWindowChange = (m: Marketplace, valStr: string) => {
    const prevHours = customClaimWindows[m] ?? MARKETPLACE_CLAIM_WINDOWS[m]?.hours ?? 72;
    const val = Math.max(1, Math.min(2160, Number(valStr) || 1));
    saveCustomClaimWindowHours(m, val);
    setCustomClaimWindowsState((prev) => ({ ...prev, [m]: val }));
    void setSetting('claim_windows_hours', { ...getCustomClaimWindows(), [m]: val });
    void recalculateClaimsForMarketplace(m, val, prevHours);
    toast.success(
      'Claim window updated',
      `${MARKETPLACE_CLAIM_WINDOWS[m]?.displayName || m} set to ${val} hours. Existing claims recalculated.`
    );
  };

  const handleResetSingleWindow = (m: Marketplace) => {
    const prevHours = customClaimWindows[m] ?? MARKETPLACE_CLAIM_WINDOWS[m]?.hours ?? 72;
    resetSingleClaimWindow(m);
    setCustomClaimWindowsState((prev) => {
      const next = { ...prev };
      delete next[m];
      return next;
    });
    void setSetting('claim_windows_hours', getCustomClaimWindows());
    const defaultHours = MARKETPLACE_CLAIM_WINDOWS[m]?.hours ?? 72;
    void recalculateClaimsForMarketplace(m, defaultHours, prevHours);
    toast.info(
      'Claim window reset',
      `${MARKETPLACE_CLAIM_WINDOWS[m]?.displayName || m} restored to default. Existing claims recalculated.`
    );
  };

  const handleResetAllWindows = () => {
    resetCustomClaimWindows();
    setCustomClaimWindowsState({});
    void setSetting('claim_windows_hours', {});
    toast.info('All claim windows reset to defaults');
  };

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
          icon={Languages}
          title={t('settings.languageTitle')}
          sub={t('settings.languageSub')}
        >
          <div className="space-y-4">
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              data-testid="settings-language-picker"
            >
              <button
                type="button"
                onClick={() => {
                  setLang('en');
                  toast.success(t('common.saved'), 'Language set to English');
                }}
                className={cn(
                  'flex items-center justify-between rounded-xl border p-3.5 text-left transition-all',
                  lang === 'en'
                    ? 'border-proof-400 bg-proof-500/15 text-white shadow-[0_0_12px_rgba(201,164,92,0.15)]'
                    : 'border-line bg-ink-950/60 text-slate-400 hover:border-line-bright hover:text-slate-200'
                )}
                data-testid="lang-option-en"
              >
                <div>
                  <div className="font-semibold text-sm">English</div>
                  <div className="text-[11px] text-slate-400">Default interface language</div>
                </div>
                {lang === 'en' && <StatusDot tone="proof" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setLang('hi');
                  toast.success(t('common.saved'), 'भाषा हिन्दी में बदली गई');
                }}
                className={cn(
                  'flex items-center justify-between rounded-xl border p-3.5 text-left transition-all',
                  lang === 'hi'
                    ? 'border-proof-400 bg-proof-500/15 text-white shadow-[0_0_12px_rgba(201,164,92,0.15)]'
                    : 'border-line bg-ink-950/60 text-slate-400 hover:border-line-bright hover:text-slate-200'
                )}
                data-testid="lang-option-hi"
              >
                <div>
                  <div className="font-semibold text-sm">हिन्दी (Hindi)</div>
                  <div className="text-[11px] text-slate-400">भारतीय विक्रेताओं के लिए</div>
                </div>
                {lang === 'hi' && <StatusDot tone="proof" />}
              </button>
            </div>

            <div className="border-t border-line/60 pt-3">
              <Toggle
                checked={pseudoMode}
                onChange={(enabled) => {
                  setPseudoMode(enabled);
                  toast.info(
                    enabled ? 'Pseudo-localization enabled' : 'Pseudo-localization disabled',
                    'Strings are expanded with accented characters to verify 360px width bounds.'
                  );
                }}
                label="Pseudo-localization (Stress test 360px text overflow)"
                hint="Expands all labels with accented characters to catch clipping and layout breakage."
              />
            </div>
          </div>
        </Section>
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

        <Section
          icon={ScanBarcode}
          title="Barcode & USB Scanner"
          sub="Configure keyboard-wedge guns, suffix terminators, and duplicate debounce"
        >
          <div className="glass-soft flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-300">
                Supports rapid USB laser guns, Bluetooth wedges, and phone/webcam scanning.
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={ScanBarcode}
                onClick={() => navigateTo('scanner-test')}
              >
                Scanner Test Workbench
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2">
              <div>
                <label
                  htmlFor="settings-scanner-suffix"
                  className="text-[11px] font-medium text-slate-400"
                >
                  Suffix Terminator
                </label>
                <select
                  id="settings-scanner-suffix"
                  value={scannerSettings.suffix}
                  onChange={async (e) => {
                    const next = await saveScannerSettings({
                      suffix: e.target.value as ScannerSuffix
                    });
                    setScannerSettings(next);
                  }}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-ink-950 px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="EnterOrTab">Enter or Tab (Universal Default)</option>
                  <option value="Enter">Enter Only</option>
                  <option value="Tab">Tab Only</option>
                  <option value="None">None (Timeout Burst)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="settings-scanner-min-len"
                  className="text-[11px] font-medium text-slate-400"
                >
                  Min Barcode Length
                </label>
                <input
                  id="settings-scanner-min-len"
                  type="number"
                  min={1}
                  max={64}
                  value={scannerSettings.minLength}
                  onChange={async (e) => {
                    const next = await saveScannerSettings({
                      minLength: Math.max(1, parseInt(e.target.value) || 1)
                    });
                    setScannerSettings(next);
                  }}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-ink-950 px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="settings-scanner-debounce"
                  className="text-[11px] font-medium text-slate-400"
                >
                  Duplicate Debounce (ms)
                </label>
                <input
                  id="settings-scanner-debounce"
                  type="number"
                  step={100}
                  min={0}
                  max={10000}
                  value={scannerSettings.debounceMs}
                  onChange={async (e) => {
                    const next = await saveScannerSettings({
                      debounceMs: Math.max(0, parseInt(e.target.value) || 0)
                    });
                    setScannerSettings(next);
                  }}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-ink-950 px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="settings-scanner-case"
                  className="text-[11px] font-medium text-slate-400"
                >
                  Case Normalization
                </label>
                <select
                  id="settings-scanner-case"
                  value={scannerSettings.caseHandling}
                  onChange={async (e) => {
                    const next = await saveScannerSettings({
                      caseHandling: e.target.value as CaseHandling
                    });
                    setScannerSettings(next);
                  }}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-ink-950 px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="uppercase">UPPERCASE (Standard for AWBs)</option>
                  <option value="lowercase">lowercase</option>
                  <option value="preserve">Preserve Original Case</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80">
              <Toggle
                checked={scannerSettings.stripNoise}
                onChange={async (v) => {
                  const next = await saveScannerSettings({ stripNoise: v });
                  setScannerSettings(next);
                }}
                label="Strip AIM Symbology & Control Noise"
                hint="Cleans ]C1 headers, invisible control bytes, and whitespace"
              />
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
          icon={Clock}
          title="Marketplace claim filing windows"
          sub="Dispute deadline hours per marketplace. All default values require verification."
        >
          <div className="space-y-3">
            <div className="rounded-lg border border-line bg-ink-950/70 p-3 text-[11px] text-slate-400">
              Dispute filing windows for bad/damaged returns. Custom hours override defaults in
              ClaimRadar countdown timers immediately.
            </div>

            <div className="space-y-2.5">
              {CLAIM_MARKETPLACES.map((m) => {
                const config = MARKETPLACE_CLAIM_WINDOWS[m];
                const customHours = customClaimWindows[m];
                const currentHours = customHours ?? config.hours;
                const isCustom = customHours !== undefined && customHours !== config.hours;
                const unverified = isClaimWindowUnverified(m);

                return (
                  <div
                    key={m}
                    className="glass-soft flex flex-col gap-2 rounded-lg p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">
                          {config.displayName}
                        </span>
                        {unverified && (
                          <Badge tone="warn" className="text-[10px]">
                            {UNVERIFIED_LABEL}
                          </Badge>
                        )}
                        {isCustom && (
                          <Badge tone="proof" className="text-[10px]">
                            Custom
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        {config.sourceUrl ? (
                          <a
                            href={config.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-proof-300 hover:text-proof-200 hover:underline"
                          >
                            Official seller help <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span>No official link</span>
                        )}
                        <span>Default: {config.hours}h</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label
                        htmlFor={`setting-claim-window-${m.toLowerCase()}`}
                        className="sr-only"
                      >
                        {config.displayName} claim window hours
                      </label>
                      <input
                        id={`setting-claim-window-${m.toLowerCase()}`}
                        type="number"
                        min="1"
                        max="2160"
                        value={currentHours}
                        onChange={(e) => handleClaimWindowChange(m, e.target.value)}
                        className="glass-soft h-8 w-20 px-2 font-mono text-xs text-white focus:outline-none"
                        aria-label={`${config.displayName} claim window hours`}
                      />
                      <span className="font-mono text-xs text-slate-400">hours</span>
                      {isCustom && (
                        <Button
                          variant="ghost"
                          size="xs"
                          icon={RotateCcw}
                          onClick={() => handleResetSingleWindow(m)}
                          aria-label={`Reset ${config.displayName} to default`}
                          title="Reset to default"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-1">
              <Button variant="ghost" size="xs" icon={RotateCcw} onClick={handleResetAllWindows}>
                Reset all claim windows to default
              </Button>
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
                    : 'Private mode active. Zero telemetry is transmitted.'
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
          sub="Privacy, terms, refunds & technical help — strictly transparent"
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

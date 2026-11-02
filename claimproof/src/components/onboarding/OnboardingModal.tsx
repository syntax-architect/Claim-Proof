import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BRAND } from '../../config/brand';
import {
  ArrowLeft,
  ArrowRight,
  Barcode,
  Camera,
  Check,
  CheckCircle2,
  FolderCheck,
  FolderOpen,
  HardDrive,
  ScanLine,
  ShieldCheck,
  Sparkles,
  X
} from 'lucide-react';
import { playScanBeep } from '../../lib/audioBeeps';
import { startHidListener } from '../../lib/hidScanner';
import type { Route } from '../../lib/router';
import { cn } from '../../lib/utils';
import {
  completeOnboarding,
  getOnboardingState,
  saveOnboardingProgress,
  skipOnboarding
} from '../../services/onboardingService';
import { connectVault, getVaultStatus, type VaultStatus } from '../../services/vaultWriter';
import type { Marketplace } from '../../types';
import { Button, useToast } from '../ui';

interface MarketplaceOption {
  id: Marketplace;
  name: string;
  badge: string;
  description: string;
}

const MARKETPLACES: MarketplaceOption[] = [
  {
    id: 'Meesho',
    name: 'Meesho',
    badge: '72h window [needs verification]',
    description: 'Valmo & 3PL courier auto-crop with multi-qty badges'
  },
  {
    id: 'Flipkart',
    name: 'Flipkart',
    badge: 'SPF 14d window [needs verification]',
    description: 'Ekart barcode extraction & SPF dispute packaging'
  },
  {
    id: 'Amazon',
    name: 'Amazon India',
    badge: 'SAFE-T 30d [needs verification]',
    description: 'Easy Ship & ATS label cropping with SAFE-T evidence'
  },
  {
    id: 'Myntra',
    name: 'Myntra',
    badge: '72h window [needs verification]',
    description: 'High-speed apparel packing & customer return unboxing'
  },
  {
    id: 'AJIO',
    name: 'AJIO',
    badge: '72h window [needs verification]',
    description: 'B2C and JIT courier handover manifest generation'
  },
  {
    id: 'Snapdeal',
    name: 'Snapdeal',
    badge: '72h window [needs verification]',
    description: 'Courier grouping and dispute countdown radar'
  },
  {
    id: 'GlowRoad',
    name: 'GlowRoad',
    badge: 'Reseller channel [needs verification]',
    description: 'Dropshipper & reseller parcel video proof'
  }
];

export interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
  navigate: (route: Route) => void;
}

export function OnboardingModal({ open, onClose, navigate }: OnboardingModalProps) {
  const toast = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedMarketplaces, setSelectedMarketplaces] = useState<Marketplace[]>([
    'Meesho',
    'Flipkart'
  ]);
  const [vaultStatus, setVaultStatus] = useState<VaultStatus>('unset');
  const [connectingVault, setConnectingVault] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [testInput, setTestInput] = useState('');
  const triggerRef = useRef<HTMLElement | null>(null);

  // Load persisted progress on open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const state = await getOnboardingState();
      if (cancelled) return;
      if (state.completed) {
        setStep(1);
      } else if (state.step) {
        setStep(state.step);
      }
      if (state.marketplaces?.length) setSelectedMarketplaces(state.marketplaces);
      if (state.lastScannedCode) setScannedCode(state.lastScannedCode);
      const vs = await getVaultStatus();
      if (cancelled) return;
      setVaultStatus(vs);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Keep vault status fresh when on Step 2
  useEffect(() => {
    if (!open || step !== 2) return;
    void getVaultStatus().then(setVaultStatus);
  }, [open, step]);

  const handleBarcodeScanned = useCallback(
    (code: string) => {
      const trimmed = code.trim().toUpperCase();
      if (!trimmed) return;
      playScanBeep();
      setScannedCode(trimmed);
      void saveOnboardingProgress({
        scannerTested: true,
        lastScannedCode: trimmed
      });
      toast.success('Barcode scanned', `${trimmed} verified!`);
    },
    [toast]
  );

  const handleBarcodeScannedRef = useRef(handleBarcodeScanned);
  handleBarcodeScannedRef.current = handleBarcodeScanned;

  // Listen for HID laser barcode gun bursts when on Step 3
  useEffect(() => {
    if (!open || step !== 3) return;
    const hid = startHidListener((code) => {
      handleBarcodeScannedRef.current(code);
    });
    return () => hid.stop();
  }, [open, step]);

  const handleSkip = useCallback(async () => {
    await skipOnboarding();
    toast.info('Onboarding skipped', 'You can re-open this walkthrough anytime from Settings.');
    onClose();
  }, [onClose, toast]);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          void handleSkip();
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    } else if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [open, handleSkip]);

  if (!open) return null;

  const toggleMarketplace = (id: Marketplace) => {
    setSelectedMarketplaces((prev) => {
      const next = prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id];
      // ensure at least 1 marketplace selected
      const result = next.length > 0 ? next : [id];
      void saveOnboardingProgress({ marketplaces: result });
      return result;
    });
  };

  const handleConnectVault = async () => {
    setConnectingVault(true);
    try {
      const mode = await connectVault();
      const vs = await getVaultStatus();
      setVaultStatus(vs);
      void saveOnboardingProgress({ vaultConnected: vs === 'connected' });
      if (mode === 'fs-api') {
        toast.success('Vault connected', 'Videos & collages will write directly to disk.');
      } else {
        toast.info('Using Downloads fallback', 'Browser will save files via standard downloads.');
      }
    } catch {
      toast.warn('Vault connection cancelled');
    } finally {
      setConnectingVault(false);
    }
  };

  const handleNextFromStep1 = async () => {
    setStep(2);
    await saveOnboardingProgress({ step: 2, marketplaces: selectedMarketplaces });
  };

  const handleNextFromStep2 = async () => {
    setStep(3);
    await saveOnboardingProgress({ step: 3, vaultConnected: vaultStatus === 'connected' });
  };

  const handleFinishAndOpenLabels = async () => {
    await completeOnboarding();
    toast.success('Setup complete', `Welcome to ${BRAND.name}! SmartLabel Studio is ready.`);
    onClose();
    navigate('labels');
  };

  return (
    <div
      data-testid="onboarding-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <div className="glass border-line-bright relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-ink-950 shadow-2xl">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-proof-500/25 bg-proof-500/12 text-proof-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-sm font-bold text-white">
                {BRAND.name} Quickstart
              </div>
              <div className="text-[11px] text-slate-400">
                Step {step} of 3:{' '}
                {step === 1 ? 'Marketplaces' : step === 2 ? 'Evidence Vault' : 'Scanner Check'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSkip()}
              data-testid="onboarding-skip-button"
              className="text-xs font-medium text-slate-400 transition hover:text-white"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => void handleSkip()}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-ink-800 hover:text-white"
              aria-label="Close onboarding"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="grid grid-cols-3 gap-1 bg-ink-900 px-6 py-2">
          <div
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              step >= 1 ? 'bg-proof-500' : 'bg-ink-700'
            )}
          />
          <div
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              step >= 2 ? 'bg-proof-500' : 'bg-ink-700'
            )}
          />
          <div
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              step >= 3 ? 'bg-proof-500' : 'bg-ink-700'
            )}
          />
        </div>

        {/* Step Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ── STEP 1: MARKETPLACES ────────────────────────────────────── */}
          {step === 1 && (
            <div data-testid="onboarding-step-1" className="space-y-4">
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  Choose your marketplace(s)
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Select where you sell. {BRAND.name} tailors PDF label cropping, multi-quantity
                  guards, and return dispute rubrics to your stores.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {MARKETPLACES.map((m) => {
                  const active = selectedMarketplaces.includes(m.id);
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => toggleMarketplace(m.id)}
                      data-testid={`marketplace-option-${m.id.toLowerCase()}`}
                      className={cn(
                        'flex items-start gap-3 rounded-xl border p-3 text-left transition',
                        active
                          ? 'border-proof-500/50 bg-proof-500/10 text-white shadow-[0_0_15px_-4px_color-mix(in_srgb,var(--cp-accentsolid)_35%,transparent)]'
                          : 'border-line bg-ink-900/60 text-slate-300 hover:border-line-bright hover:bg-ink-900'
                      )}
                    >
                      <div
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs',
                          active
                            ? 'border-proof-400 bg-proof-500 text-on-accent'
                            : 'border-line bg-ink-950 text-transparent'
                        )}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-sm">{m.name}</span>
                          <span className="rounded bg-ink-950/80 px-1.5 py-0.5 font-mono text-[9px] text-proof-300">
                            {m.badge}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] leading-tight text-slate-400">
                          {m.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── STEP 2: VAULT SETUP & EXPLANATION ──────────────────────── */}
          {step === 2 && (
            <div data-testid="onboarding-step-2" className="space-y-4">
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  Pick your Evidence Vault folder
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  {BRAND.name} writes barcode-verified videos and 4-photo evidence collages directly
                  to your computer.
                </p>
              </div>

              {/* Explanatory callout */}
              <div className="rounded-xl border border-proof-500/30 bg-proof-500/10 p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-proof-300">
                  <ShieldCheck className="h-4 w-4" />
                  100% Offline &amp; Private — Where are files saved?
                </div>
                <div className="rounded-lg border border-line bg-ink-950/80 p-3 font-mono text-[11px] leading-relaxed text-slate-400">
                  <span className="text-proof-300">{'<Vault_Root>'}</span>
                  {'\\<YYYY-MM-DD>\\<Dispatch|Return>\\<AWB>\\'}
                  <br />
                  <span className="text-white">{'├── {AWB}_Video.mp4'}</span>
                  <br />
                  <span className="text-white">{'└── {AWB}_Photo_Collage.jpg'}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  Videos and labels are strictly kept on your machine. Nothing is ever uploaded to
                  cloud servers, giving you zero monthly hosting costs and total customer privacy.
                </p>
              </div>

              {/* Vault connection action */}
              <div className="glass-soft flex flex-col gap-3 rounded-xl border border-line-bright p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-slate-200">
                    <HardDrive className="h-4.5 w-4.5 text-proof-400" />
                    <span>
                      Status:{' '}
                      <strong className="text-white">
                        {vaultStatus === 'connected'
                          ? 'Connected to local folder'
                          : vaultStatus === 'downloads'
                            ? 'Downloads fallback active'
                            : 'Not selected yet'}
                      </strong>
                    </span>
                  </div>
                  <Button
                    variant={vaultStatus === 'connected' ? 'secondary' : 'primary'}
                    size="sm"
                    icon={FolderCheck}
                    loading={connectingVault}
                    onClick={() => void handleConnectVault()}
                    data-testid="connect-vault-button"
                  >
                    {vaultStatus === 'connected' ? 'Change folder' : 'Pick Vault folder'}
                  </Button>
                </div>
                <div className="text-[11px] text-slate-400">
                  {vaultStatus === 'connected'
                    ? 'Direct writes enabled via Chromium File System Access API.'
                    : 'Click "Pick Vault folder" to choose a folder on your disk, or proceed to use your browser Downloads folder.'}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: SCANNER & CAMERA TEST ─────────────────────────── */}
          {step === 3 && (
            <div data-testid="onboarding-step-3" className="space-y-4">
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  Test Camera &amp; Scanner
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Verify your USB/Bluetooth laser barcode gun or webcam scanner with a quick test.
                </p>
              </div>

              {/* Barcode Test Zone */}
              <div
                className={cn(
                  'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition',
                  scannedCode
                    ? 'border-proof-500/60 bg-proof-500/10'
                    : 'border-line-bright bg-ink-900/60'
                )}
              >
                {scannedCode ? (
                  <div className="space-y-2">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-proof-500/20 text-proof-400">
                      <CheckCircle2 className="h-7 w-7" />
                    </div>
                    <div className="font-display text-base font-bold text-white">
                      Barcode Verified!
                    </div>
                    <div className="font-mono text-sm font-semibold text-proof-300">
                      {scannedCode}
                    </div>
                    <div className="text-xs text-slate-300">
                      Scanner signal captured successfully. Hands-free parcel chaining is ready!
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink-800 text-slate-400">
                      <ScanLine className="h-6 w-6 animate-pulse text-proof-400" />
                    </div>
                    <div className="space-y-1">
                      <div className="font-semibold text-sm text-white">Scan any barcode now</div>
                      <div className="text-xs text-slate-400">
                        Pull the trigger on your barcode gun, hold a label to your camera, or test
                        manually below:
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Manual simulation / fallback entry */}
              <div className="glass-soft flex items-center gap-2 rounded-xl p-3">
                <Barcode className="h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && testInput.trim()) {
                      e.preventDefault();
                      handleBarcodeScanned(testInput);
                      setTestInput('');
                    }
                  }}
                  placeholder="Or enter barcode to test (e.g. MEESH987123)"
                  data-testid="test-barcode-input"
                  className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  data-testid="test-barcode-button"
                  onClick={() => {
                    const code = testInput.trim() || 'SAMPLE987654321';
                    handleBarcodeScanned(code);
                    setTestInput('');
                  }}
                >
                  Simulate scan
                </Button>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <Camera className="h-3.5 w-3.5 text-proof-400" />
                <span>
                  Webcam and USB laser scanners automatically chain recordings in &lt;100ms.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between border-t border-line bg-ink-900/60 px-6 py-4">
          <div>
            {step > 1 ? (
              <Button
                variant="ghost"
                size="sm"
                icon={ArrowLeft}
                onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
                data-testid="onboarding-back-button"
              >
                Back
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleSkip()}
                data-testid="onboarding-bottom-skip-button"
              >
                Skip onboarding
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step === 1 && (
              <Button
                variant="primary"
                size="sm"
                icon={ArrowRight}
                onClick={() => void handleNextFromStep1()}
                data-testid="onboarding-next-step-1"
              >
                Continue to Vault setup
              </Button>
            )}

            {step === 2 && (
              <Button
                variant="primary"
                size="sm"
                icon={ArrowRight}
                onClick={() => void handleNextFromStep2()}
                data-testid="onboarding-next-step-2"
              >
                Continue to Scanner test
              </Button>
            )}

            {step === 3 && (
              <Button
                variant="primary"
                size="sm"
                icon={FolderOpen}
                onClick={() => void handleFinishAndOpenLabels()}
                data-testid="onboarding-finish-button"
              >
                Open Label Studio
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

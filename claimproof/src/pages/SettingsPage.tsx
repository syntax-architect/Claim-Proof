import { useState, type ReactNode } from 'react';
import { Cable,
  Database,
  Download,
  FolderCheck,
  FolderOpen,
  HardDrive,
  Info,
  QrCode,
  Smartphone,
  Trash2,
  Usb,
  Volume2
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { connectVault, getVaultStatus } from '../services/vaultWriter';
import { isPhonePairingConfigured, pairingQrPayload } from '../services/phonePairing';
import { renderUpiQr } from '../lib/upi';
import { formatISTShort } from '../lib/dateUtils';
import { downloadBlob } from '../lib/utils';
import { Badge, Button, Card, PageHeader, StatusDot, Toggle, useToast } from '../components/ui';
import { isBeepsMuted, setBeepsMuted } from '../lib/audioBeeps';

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
      `claimproof_backup_${Date.now()}.json`
    );
    toast.success('Backup exported', 'All metadata (no media) as JSON.');
  }

  async function previewPairingQr() {
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
              Pick your <span className="font-mono text-slate-400">ClaimProof_Vault</span> folder once —
              files then write directly to disk with zero uploads.
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
                <Button variant="secondary" size="sm" icon={QrCode} onClick={() => void previewPairingQr()}>
                  Preview pairing QR format
                </Button>
                {sampleQr && (
                  <div className="flex items-center gap-3">
                    <img src={sampleQr} alt="Sample pairing QR" className="qr-plate h-24 w-24 rounded-lg p-1" />
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
          icon={Volume2}
          title="Scanner sounds"
          sub="Beeps for scan · start · saved · flag"
        >
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

        <Section icon={Database} title="Data & backups" sub="IndexedDB metadata — media stays on disk">
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
                    'Wipe ALL ClaimProof data on this PC (labels, recordings index, claims, license)? Media files on disk are kept.'
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

        <Section icon={Info} title="About" sub="ClaimProof Suite v1.0.0">
          <div className="space-y-2 text-[11px] leading-relaxed text-slate-500">
            <div>
              Local-first PWA + Chrome Extension (Manifest V3) for Indian e-commerce sellers. PDF
              cropping via pdfjs + pdf-lib, barcode scanning via the native BarcodeDetector with a
              ZXing fallback, recording via canvas compositing + MediaRecorder at 1.2 Mbps.
            </div>
            <div>
              Install as an app: <span className="text-slate-400">Chrome → ⋮ → Install ClaimProof…</span>{' '}
              Works fully offline after the first load.
            </div>
            <div className="flex items-center gap-1.5">
              <StatusDot tone="proof" /> Storage: IndexedDB + File System Access · {formatISTShort(Date.now())}
            </div>
            <Badge tone="proof">₹0 server cost</Badge>
          </div>
        </Section>
      </div>
    </div>
  );
}

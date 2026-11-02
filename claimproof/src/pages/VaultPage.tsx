import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownUp,
  BadgeIndianRupee,
  Database,
  Download,
  FileText,
  FolderArchive,
  Play,
  Search,
  Trash2,
  Undo2,
  Video,
  X
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { formatBytes, formatRupees, truncate } from '../lib/utils';
import { formatIST, formatISTShort } from '../lib/dateUtils';
import { recordingTypeLabel } from '../lib/claimRules';
import { photoCollageFileName, vaultSubPath, videoFileName } from '../lib/vaultPaths';
import { loadRecordingMedia } from '../services/mediaLibrary';
import {
  connectVault,
  getVaultStatus,
  revealAwbFolder,
  type VaultStatus
} from '../services/vaultWriter';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  PageHeader,
  Segmented,
  StatCard,
  Stagger,
  StaggerItem,
  useToast
} from '../components/ui';
import type { RecordingMeta, StoredOrder } from '../types';
import { cn } from '../lib/utils';

function RecordingPlayer({
  recording,
  onClose
}: {
  recording: RecordingMeta | null;
  onClose: () => void;
}) {
  const toast = useToast();

  const recId = recording?.id;

  const mediaState = useLiveQuery(
    () => (recId === undefined ? Promise.resolve(null) : loadRecordingMedia(recId)),
    [recId]
  );

  const resolved = mediaState;
  const loadingMedia = mediaState === undefined;

  if (!recording) return null;

  return (
    <Modal
      open={!!recording}
      onClose={onClose}
      title={`${recordingTypeLabel(recording.type)} — ${recording.awb}`}
      subtitle={`${formatIST(recording.startedAt)} · ${recording.durationSec}s · ${formatBytes(recording.videoBytes)}`}
      icon={Video}
      width="xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 truncate font-mono text-[11px] text-slate-500">
            {vaultSubPath(recording.type, recording.startedAt, recording.awb)}/
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={FolderArchive}
              onClick={() =>
                void revealAwbFolder(recording.awb, recording.type, recording.startedAt).then(
                  (ok) => {
                    if (!ok)
                      toast.warn(
                        'Vault folder not reachable',
                        'Connect the vault in Settings first.'
                      );
                  }
                )
              }
            >
              Open folder
            </Button>
            <Button variant="primary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Badge tone="proof">UNCUT VIDEO</Badge>
            {recording.demo && <Badge tone="warn">DEMO CAMERA</Badge>}
          </div>
          <div className="glass-soft overflow-hidden">
            {loadingMedia ? (
              <div className="flex h-56 items-center justify-center text-sm text-slate-500">
                Loading from vault…
              </div>
            ) : resolved?.videoUrl ? (
              <video
                key={resolved.videoUrl}
                src={resolved.videoUrl}
                controls
                playsInline
                className="aspect-video w-full bg-black"
              />
            ) : (
              <div className="flex h-56 flex-col items-center justify-center gap-2 text-sm text-slate-500">
                <FileText className="h-6 w-6" />
                Video file: {videoFileName(recording.awb, recording.videoMime)}
                <span className="text-xs">
                  Not in local cache — open the vault folder to play it.
                </span>
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Badge tone="info">PHOTO COLLAGE 2×2</Badge>
            {recording.photoCollage ? (
              <span className="text-[11px] text-slate-500">
                {formatBytes(recording.photoBytes)}
              </span>
            ) : (
              <Badge tone="outline">not generated</Badge>
            )}
          </div>
          <div className="glass-soft overflow-hidden">
            {resolved?.photoUrl ? (
              <img
                src={resolved.photoUrl}
                alt={`${recording.awb} collage evidence`}
                className="aspect-square w-full object-contain bg-black"
              />
            ) : (
              <div className="flex h-56 flex-col items-center justify-center gap-2 text-sm text-slate-500">
                <FileText className="h-6 w-6" />
                {photoCollageFileName(recording.awb)}
                <span className="text-xs">
                  {recording.photoCollage
                    ? 'Not in local cache.'
                    : 'Photo collage is a ClaimRadar Pro feature.'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Order ID', recording.orderId],
          ['SKU', recording.sku],
          ['Courier', recording.courier],
          ['Qty', String(recording.qty)]
        ].map(([label, value]) => (
          <div key={label} className="glass-soft p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
            <div className="mt-1 truncate font-mono text-xs font-semibold text-slate-200">
              {value}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default function VaultPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'recordings' | 'orders'>('recordings');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'dispatch' | 'return'>('all');
  const [selected, setSelected] = useState<RecordingMeta | null>(null);
  const [orderSortDesc, setOrderSortDesc] = useState(true);
  const [vaultStatus, setVaultStatus] = useState<VaultStatus>('connected');

  useEffect(() => {
    void getVaultStatus().then(setVaultStatus);
  }, []);

  const handleConnectVault = async () => {
    try {
      const mode = await connectVault();
      const status = await getVaultStatus();
      setVaultStatus(status);
      toast.success(
        mode === 'fs-api' ? 'Vault connected' : 'Downloads fallback active',
        'Evidence files will be organized automatically.'
      );
    } catch (e) {
      toast.error('Could not connect folder', e instanceof Error ? e.message : String(e));
    }
  };

  const recordings = useLiveQuery(
    () => db.recordings.orderBy('startedAt').reverse().limit(500).toArray(),
    []
  );
  const orders = useLiveQuery(
    () => db.orders.orderBy('createdAt').reverse().limit(1000).toArray(),
    []
  );

  const filteredRecordings = useMemo(() => {
    let list = recordings ?? [];
    if (typeFilter !== 'all') list = list.filter((r) => r.type === typeFilter);
    if (search.trim()) {
      const q = search.trim().toUpperCase();
      list = list.filter((r) =>
        [r.awb, r.orderId, r.sku, r.courier].some((v) => v.toUpperCase().includes(q))
      );
    }
    return list;
  }, [recordings, search, typeFilter]);

  const filteredOrders = useMemo(() => {
    let list = orders ?? [];
    if (search.trim()) {
      const q = search.trim().toUpperCase();
      list = list.filter((o) =>
        [o.awb, o.orderId, o.sku, o.courier, o.marketplace].some((v) => v.toUpperCase().includes(q))
      );
    }
    return orderSortDesc ? list : [...list].reverse();
  }, [orders, search, orderSortDesc]);

  const stats = useLiveQuery(async () => {
    const all = await db.recordings.toArray();
    const bytes = all.reduce((sum, r) => sum + r.videoBytes + r.photoBytes, 0);
    return {
      total: all.length,
      dispatch: all.filter((r) => r.type === 'dispatch').length,
      returns: all.filter((r) => r.type === 'return').length,
      flagged: all.filter((r) => r.flagged).length,
      bytes
    };
  }, []);

  function exportOrdersCsv(rows: StoredOrder[]) {
    const header =
      'AWB,Order ID,SKU,Size,Color,Qty,Courier,Marketplace,Invoice Total,Source File,Page\n';
    const body = rows
      .map((o) =>
        [
          o.awb,
          o.orderId,
          o.sku,
          o.size,
          o.color,
          o.qty,
          o.courier,
          o.marketplace,
          o.invoiceTotal ?? '',
          `"${o.sourceFile}"`,
          o.page
        ].join(',')
      )
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `saboot_orders_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('CSV exported', `${rows.length} rows`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FolderArchive}
        kicker="MODULE B+C · EVIDENCE"
        title="Vault"
        subtitle="Every recording & label ever processed on this workstation"
        actions={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'recordings', label: `Recordings ${stats ? `(${stats.total})` : ''}` },
              { value: 'orders', label: `Label memory ${orders ? `(${orders.length})` : ''}` }
            ]}
          />
        }
      />

      {vaultStatus === 'unset' && (
        <Card className="border-warn-500/40 bg-warn-500/10 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warn-500/20 text-warn-300">
              <FolderArchive className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-base font-bold text-white">
                No vault folder chosen
              </div>
              <div className="mt-1 text-xs leading-relaxed text-slate-300">
                Choose a dedicated folder on your computer (e.g. D:\SABOOT_Vault). Videos and
                evidence collages will be saved directly into dated subfolders on your hard drive.
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                icon={FolderArchive}
                onClick={() => void handleConnectVault()}
              >
                Connect vault folder
              </Button>
            </div>
          </div>
        </Card>
      )}

      {tab === 'recordings' && (
        <>
          <Stagger className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StaggerItem>
              <StatCard icon={Video} label="Total recordings" value={stats?.total ?? 0} />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                icon={ArrowDownUp}
                label="Dispatch / Return"
                value={`${stats?.dispatch ?? 0} / ${stats?.returns ?? 0}`}
                tone="info"
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                icon={Undo2}
                label="Flagged returns"
                value={stats?.flagged ?? 0}
                tone="danger"
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                icon={Database}
                label="Evidence on disk"
                value={formatBytes(stats?.bytes ?? 0)}
                tone="warn"
              />
            </StaggerItem>
          </Stagger>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
              <div className="glass-soft flex min-w-0 flex-1 items-center gap-2 px-3 py-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search AWB / Order / SKU / courier — sub-millisecond via IndexedDB…"
                  className="min-w-0 flex-1 bg-transparent font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="text-slate-500 hover:text-slate-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Segmented
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'dispatch', label: 'Dispatch' },
                  { value: 'return', label: 'Return' }
                ]}
              />
            </div>

            <div className="divide-y divide-line/60">
              {filteredRecordings.length === 0 ? (
                search.trim() ? (
                  <EmptyState
                    icon={Search}
                    title="No recordings match your search"
                    description={`No recordings found matching "${search}". Try searching by AWB number, Order ID, SKU, or courier partner.`}
                    primaryAction={{
                      label: 'Clear search',
                      onClick: () => setSearch(''),
                      icon: X,
                      variant: 'secondary'
                    }}
                  />
                ) : typeFilter !== 'all' ? (
                  <EmptyState
                    icon={Video}
                    title={`No ${typeFilter} recordings found`}
                    description={`You do not have any recordings categorized as ${typeFilter}.`}
                    primaryAction={{
                      label: 'Show all recordings',
                      onClick: () => setTypeFilter('all'),
                      variant: 'secondary'
                    }}
                  />
                ) : (
                  <EmptyState
                    icon={Video}
                    title="No proof videos in vault yet"
                    description="You have not recorded any packing or return unboxing videos on this PC. Open the AWB Recorder and scan a barcode to automatically record and save your first proof video."
                    primaryAction={{
                      label: 'Open AWB Recorder',
                      onClick: () => {
                        window.location.hash = '#recorder';
                      },
                      icon: Video
                    }}
                    secondaryLink={
                      vaultStatus === 'unset'
                        ? {
                            label: 'Connect vault folder first',
                            onClick: () => void handleConnectVault(),
                            icon: FolderArchive
                          }
                        : undefined
                    }
                  />
                )
              ) : (
                filteredRecordings.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelected(r)}
                    className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-ink-850/70"
                  >
                    <div
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                        r.type === 'dispatch'
                          ? 'border-info-500/25 bg-info-500/10 text-info-300'
                          : 'border-warn-500/25 bg-warn-500/10 text-warn-300'
                      )}
                    >
                      {r.type === 'dispatch' ? (
                        <Video className="h-4 w-4" />
                      ) : (
                        <Undo2 className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-white">{r.awb}</span>
                        <Badge tone={r.type === 'dispatch' ? 'info' : 'warn'}>
                          {recordingTypeLabel(r.type)}
                        </Badge>
                        {r.flagged && <Badge tone="danger">FLAGGED</Badge>}
                        {r.demo && <Badge tone="outline">demo</Badge>}
                        {r.photoCollage && <Badge tone="proof">collage</Badge>}
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                        {r.sku} · {r.courier} · {vaultSubPath(r.type, r.startedAt, r.awb)}
                      </div>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <div className="font-mono text-xs text-slate-300 mono-tabular">
                        {r.durationSec}s · {formatBytes(r.videoBytes + r.photoBytes)}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                        {formatISTShort(r.startedAt)}
                      </div>
                    </div>
                    <Play className="h-4 w-4 shrink-0 text-slate-600" />
                  </button>
                ))
              )}
            </div>
          </Card>
        </>
      )}

      {tab === 'orders' && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
            <div className="glass-soft flex min-w-0 flex-1 items-center gap-2 px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search the label memory (AWB / Order / SKU / marketplace)…"
                className="min-w-0 flex-1 bg-transparent font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              onClick={() => exportOrdersCsv(filteredOrders)}
              disabled={filteredOrders.length === 0}
            >
              Export CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              onClick={() => {
                if (
                  window.confirm('Clear the entire label memory? Recordings and claims are kept.')
                ) {
                  void db.orders.clear().then(() => toast.info('Label memory cleared'));
                }
              }}
            >
              Clear memory
            </Button>
          </div>
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-ink-900/95 backdrop-blur">
                <tr className="border-b border-line text-slate-500">
                  <th className="px-4 py-2.5">AWB</th>
                  <th className="px-4 py-2.5">Order</th>
                  <th className="px-4 py-2.5">SKU</th>
                  <th className="px-4 py-2.5">Qty</th>
                  <th className="px-4 py-2.5">Courier</th>
                  <th className="px-4 py-2.5">Marketplace</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => setOrderSortDesc((d) => !d)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-proof-300"
                    >
                      Cropped {orderSortDesc ? '↓' : '↑'}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {filteredOrders.map((o) => (
                  <tr key={o.id} className="transition-colors hover:bg-ink-850/60">
                    <td className="px-4 py-2.5 font-mono text-[13px] font-semibold text-white">
                      {o.awb}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400">
                      {truncate(o.orderId, 14)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-proof-300">{o.sku}</td>
                    <td className="px-4 py-2.5">
                      {o.qty > 1 ? (
                        <Badge tone="warn">×{o.qty}</Badge>
                      ) : (
                        <span className="font-mono text-xs text-slate-400">1</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone="neutral">{o.courier}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{o.marketplace}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-300">
                      {formatRupees(o.invoiceTotal)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[11px] text-slate-500">
                      {formatISTShort(o.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredOrders.length === 0 &&
              (search.trim() ? (
                <EmptyState
                  icon={Search}
                  title="No orders match your search"
                  description={`No parsed orders found matching "${search}". Try searching with a different AWB, Order ID, SKU, or courier.`}
                  primaryAction={{
                    label: 'Clear search',
                    onClick: () => setSearch(''),
                    icon: X,
                    variant: 'secondary'
                  }}
                />
              ) : (
                <EmptyState
                  icon={BadgeIndianRupee}
                  title="Label memory is empty"
                  description="Crop shipping labels in SmartLabel Studio. Every parsed AWB, Order ID, and SKU is remembered here so the AWB Recorder can automatically match them when packing."
                  primaryAction={{
                    label: 'Crop shipping labels',
                    onClick: () => {
                      window.location.hash = '#labels';
                    },
                    icon: FileText
                  }}
                />
              ))}
          </div>
        </Card>
      )}

      <RecordingPlayer recording={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

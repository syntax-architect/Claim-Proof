import { useCallback, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { BRAND } from '../../config/brand';
import {
  ArrowRight,
  CheckCircle2,
  Crop,
  FileDown,
  FileText,
  Grid2x2,
  Layers,
  ListChecks,
  RefreshCw,
  Ruler,
  Search,
  ScanBarcode,
  Square,
  Upload,
  Video,
  X
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import {
  processLabelFiles,
  type CropOptions,
  type ProgressFn
} from '../../services/pdfLabelProcessor';
import { saveLabelBatch } from '../../services/labelDataStore';
import {
  addLabelsCropped,
  checkLabelQuota,
  getTodayUsage,
  FREE_LABELS_PER_DAY
} from '../../lib/quota';
import { downloadBlob, formatRupees, truncate, cn } from '../../lib/utils';
import { navigateTo } from '../../lib/router';
import { trackFirstLabelExport } from '../../services/telemetry';
import { usePaywall } from '../../providers/PaywallProvider';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Kbd,
  PageHeader,
  ProgressBar,
  Spinner,
  Stagger,
  StaggerItem,
  Toggle,
  useToast
} from '../ui';
import type { CourierPartner, CropPreset, ExtractedLabel } from '../../types';
import { useLicense } from '../../services/licenseService';

type Stage = 'drop' | 'parsing' | 'review' | 'exporting' | 'done' | 'error';

const PRESETS: {
  value: CropPreset;
  title: string;
  sub: string;
  icon: typeof Ruler;
  art: ReactNode;
}[] = [
  {
    value: '4x6',
    title: '4×6 inch',
    sub: '100×150 mm thermal · standard',
    icon: Ruler,
    art: (
      <div className="flex h-12 w-10 flex-col justify-between rounded-sm border-2 border-proof-400/70 bg-proof-500/5 p-1">
        <div className="h-3 rounded-sm bg-proof-500/25" />
        <div className="space-y-0.5">
          <div className="h-1 rounded-sm bg-proof-500/40" />
          <div className="h-1 rounded-sm bg-proof-500/40" />
        </div>
      </div>
    )
  },
  {
    value: '4x4',
    title: '4×4 inch',
    sub: 'Square courier stickers',
    icon: Square,
    art: (
      <div className="flex h-10 w-10 flex-col justify-between rounded-sm border-2 border-proof-400/70 bg-proof-500/5 p-1">
        <div className="h-2.5 rounded-sm bg-proof-500/25" />
        <div className="h-1 rounded-sm bg-proof-500/40" />
      </div>
    )
  },
  {
    value: 'grid4',
    title: '4-per-A4',
    sub: 'Cut grid from A4 sheets',
    icon: Grid2x2,
    art: (
      <div className="grid h-11 w-11 grid-cols-2 gap-0.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-sm border border-proof-400/60 bg-proof-500/10" />
        ))}
      </div>
    )
  }
];

const COURIER_TONE: Partial<
  Record<CourierPartner, 'proof' | 'info' | 'warn' | 'neutral' | 'danger'>
> = {
  Valmo: 'proof',
  ValmoPlus: 'proof',
  Delhivery: 'info',
  Shadowfax: 'warn',
  Xpressbees: 'info',
  'Ecom Express': 'warn',
  DTDC: 'neutral',
  Ekart: 'info'
};

export function SmartLabelWorkbench() {
  const { openPaywall } = usePaywall();
  const toast = useToast();
  const license = useLicense();
  const usage = useLiveQuery(() => getTodayUsage(), []);
  const memoryCount = useLiveQuery(() => db.orders.count(), []);

  const [stage, setStage] = useState<Stage>('drop');
  const [files, setFiles] = useState<File[]>([]);
  const [labels, setLabels] = useState<ExtractedLabel[]>([]);
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState({ done: 0, total: 0, stage: '' });
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'courier' | 'sku' | 'qty' | 'awb'>('courier');
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [dragOver, setDragOver] = useState(false);
  const [doneInfo, setDoneInfo] = useState<{
    count: number;
    fileName: string;
    bytes: Uint8Array;
  } | null>(null);

  const [options, setOptions] = useState<CropOptions>({
    preset: '4x6',
    stampSku: true,
    multiQtyGuard: true,
    valmoPlusAsValmo: false,
    withManifest: true
  });

  const inputRef = useRef<HTMLInputElement>(null);

  const beginParse = useCallback(
    async (incoming: File[]) => {
      const pdfs = incoming.filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
      );
      if (pdfs.length === 0) {
        toast.error('No PDFs found', 'Only shipping-label PDFs can be processed.');
        return;
      }
      if (pdfs.length > 15) {
        toast.warn('Max 15 PDFs per batch', `Using the first 15 of ${pdfs.length} files.`);
      }
      const batch = pdfs.slice(0, 15);
      setFiles(batch);
      setStage('parsing');
      setProgress({ done: 0, total: batch.length, stage: 'Opening PDFs…' });
      setError('');
      try {
        const onProgress: ProgressFn = (done, total, stageText) =>
          setProgress({ done, total, stage: stageText });
        const isFree = license.plan === 'free';
        const result = await processLabelFiles(
          batch,
          { ...options, valmoPlusAsValmo: false, isFree },
          onProgress
        );
        setLabels(result.labels);
        setStage('review');
        toast.success(
          `${result.labels.length} labels parsed`,
          `${new Set(result.labels.map((l) => l.courier)).size} couriers · ${batch.length} file${batch.length > 1 ? 's' : ''}`
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStage('error');
      }
    },
    [options, toast, license.plan]
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      void beginParse(Array.from(e.dataTransfer.files));
    },
    [beginParse]
  );

  const trySampleLabels = useCallback(async () => {
    try {
      setStage('parsing');
      setProgress({ done: 0, total: 1, stage: 'Loading sample labels…' });
      let blob: Blob;
      try {
        const res = await fetch('/samples/sample_labels_meesho.pdf');
        if (!res.ok) throw new Error('sample fetch status: ' + res.status);
        blob = await res.blob();
      } catch {
        // In-memory fallback if samples/ is not reachable over HTTP
        const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
        const doc = await PDFDocument.create();
        const font = await doc.embedFont(StandardFonts.HelveticaBold);
        const page = doc.addPage([595.28, 841.89]);
        page.drawText('Meesho Shipping Label', {
          x: 50,
          y: 780,
          size: 14,
          font,
          color: rgb(0, 0, 0)
        });
        page.drawText('AWB: 5894372819', { x: 50, y: 750, size: 12, font, color: rgb(0, 0, 0) });
        page.drawText('Order ID: 6283749213', {
          x: 50,
          y: 730,
          size: 11,
          font,
          color: rgb(0, 0, 0)
        });
        page.drawText('SKU: MSH-KRT-BLU-XL', {
          x: 50,
          y: 710,
          size: 11,
          font,
          color: rgb(0, 0, 0)
        });
        page.drawText('Qty: 1', { x: 50, y: 690, size: 11, font, color: rgb(0, 0, 0) });
        page.drawText('Valmo Courier', { x: 50, y: 670, size: 11, font, color: rgb(0, 0, 0) });
        page.drawText('Rs. 899.00', { x: 50, y: 650, size: 11, font, color: rgb(0, 0, 0) });
        const bytes = await doc.save();
        blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      }
      const sampleFile = new File([blob], 'sample_labels_meesho.pdf', {
        type: 'application/pdf'
      });
      await beginParse([sampleFile]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sample label PDF');
      setStage('error');
    }
  }, [beginParse]);

  const handleReportPdf = useCallback(() => {
    const meta = {
      reportType: `${BRAND.name} Zero-Row PDF Diagnostics`,
      timestamp: new Date().toISOString(),
      fileCount: files.length,
      files: files.map((f) => ({
        name: f.name,
        sizeBytes: f.size,
        type: f.type || 'application/pdf',
        lastModified: f.lastModified
      })),
      browser: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown',
      note: 'Zero shipping labels extracted. No customer or order data included.'
    };
    const reportText = JSON.stringify(meta, null, 2);
    void navigator.clipboard?.writeText(reportText).then(() => {
      toast.success(
        'Diagnostic info copied to clipboard',
        'Only non-sensitive file names and sizes were copied. No customer or order data included.'
      );
    });
  }, [files, toast]);

  const displayLabels = useMemo(() => {
    let list = labels.map((l) => ({
      ...l,
      courier: (options.valmoPlusAsValmo && l.courier === 'ValmoPlus'
        ? 'Valmo'
        : l.courier) as CourierPartner
    }));
    if (search.trim()) {
      const q = search.trim().toUpperCase();
      list = list.filter((l) =>
        [l.awb, l.orderId, l.sku, l.courier, l.marketplace].some((v) => v.toUpperCase().includes(q))
      );
    }
    const dir = sortDir;
    list.sort((a, b) => {
      switch (sortKey) {
        case 'sku':
          return a.sku.localeCompare(b.sku) * dir;
        case 'qty':
          return (a.qty - b.qty) * dir;
        case 'awb':
          return a.awb.localeCompare(b.awb) * dir;
        default:
          return (a.courier + a.sku).localeCompare(b.courier + b.sku) * dir;
      }
    });
    return list;
  }, [labels, options.valmoPlusAsValmo, search, sortKey, sortDir]);

  const courierCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of displayLabels) map.set(l.courier, (map.get(l.courier) ?? 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [displayLabels]);

  const multiQtyCount = useMemo(() => labels.filter((l) => l.qty > 1).length, [labels]);

  async function runExport() {
    if (labels.length === 0) return;
    const quota = await checkLabelQuota(labels.length);
    if (!quota.allowed) {
      toast.error(
        'Daily free label limit reached',
        `${FREE_LABELS_PER_DAY} labels/day on Free. Upgrade for unlimited cropping.`
      );
      openPaywall({ scope: 'labels', reason: 'Free plan allows 40 cropped labels per day' });
      return;
    }
    setStage('exporting');
    setProgress({ done: 0, total: files.length, stage: 'Re-reading PDFs…' });
    try {
      const isFree = license.plan === 'free';
      const result = await processLabelFiles(
        files,
        { ...options, isFree },
        (done, total, stageText) => setProgress({ done, total, stage: stageText })
      );
      downloadBlob(
        new Blob([result.pdfBytes as BlobPart], { type: 'application/pdf' }),
        result.fileName
      );
      await addLabelsCropped(result.labels.length);
      await saveLabelBatch(
        result.labels,
        files.map((f) => f.name),
        options.preset,
        options.valmoPlusAsValmo
      );
      setDoneInfo({
        count: result.labels.length,
        fileName: result.fileName,
        bytes: result.pdfBytes
      });
      setStage('done');
      void trackFirstLabelExport();
      toast.success('Cropped PDF downloaded', `${result.labels.length} labels loaded into memory.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage('error');
    }
  }

  function reset() {
    setStage('drop');
    setFiles([]);
    setLabels([]);
    setDoneInfo(null);
    setError('');
    setSearch('');
  }

  const sortButton = (key: typeof sortKey, label: string) => (
    <button
      type="button"
      onClick={() => {
        if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
        else {
          setSortKey(key);
          setSortDir(1);
        }
      }}
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider transition-colors',
        sortKey === key ? 'text-proof-300' : 'text-slate-500 hover:text-slate-300'
      )}
    >
      {label}
      {sortKey === key && <span className="font-mono">{sortDir === 1 ? '↑' : '↓'}</span>}
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ScanBarcode}
        kicker="MODULE A · FREE FOREVER"
        title="SmartLabel SKU+ Studio"
        subtitle="Vector PDF label cropper, SKU stamper & courier sorter"
        actions={
          <>
            {memoryCount !== undefined && memoryCount > 0 && (
              <Badge tone="proof">{memoryCount} AWBs in memory</Badge>
            )}
            <Badge tone="outline">
              Today {usage?.labelsCropped ?? 0}
              {license.plan === 'free' ? `/${FREE_LABELS_PER_DAY}` : ' · unlimited'}
            </Badge>
          </>
        }
      />

      {/* ── Drop / parse stages ──────────────────────────────────── */}
      {(stage === 'drop' || stage === 'parsing' || stage === 'error') && (
        <Card
          className={cn(
            'relative overflow-hidden transition-colors',
            dragOver && 'border-proof-500/60'
          )}
        >
          <div className="grid-bg absolute inset-0 opacity-40" />
          <div
            role="region"
            aria-label="Shipping label drop zone"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className="relative flex flex-col items-center justify-center px-6 py-16 text-center"
          >
            {stage === 'parsing' ? (
              <>
                <div className="relative flex h-16 w-16 items-center justify-center">
                  <span className="absolute inset-0 animate-ping-slow rounded-full border border-proof-500/40" />
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-proof-500/30 bg-proof-500/10">
                    <Spinner className="h-6 w-6" />
                  </div>
                </div>
                <div className="mt-5 font-display text-lg font-bold text-white">
                  Parsing labels…
                </div>
                <div className="mt-1 font-mono text-xs text-slate-400">{progress.stage}</div>
                <div className="mt-5 w-full max-w-sm">
                  <ProgressBar
                    value={progress.total ? progress.done : 0}
                    max={Math.max(1, progress.total)}
                  />
                </div>
              </>
            ) : stage === 'error' ? (
              <ErrorState
                title="Could not parse these PDFs"
                message={error || 'An error occurred while reading the PDF documents.'}
                onRetry={reset}
                retryLabel="Try another batch"
              />
            ) : (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-proof-500/40 bg-proof-500/8 text-proof-300">
                  <Upload className="h-7 w-7" aria-hidden="true" />
                </div>
                <div className="mt-5 font-display text-xl font-bold text-white">
                  Drop shipping label PDFs here
                </div>
                <div className="mt-1.5 max-w-md text-sm text-slate-400">
                  Accepts PDF files (.pdf) from Meesho, Flipkart, Amazon India, Myntra, and AJIO. We
                  extract AWB, Order ID, SKU, Size, Qty &amp; courier — then crop losslessly to
                  thermal size.
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
                  <Badge tone="proof">PDF FORMAT ONLY</Badge>
                  <Badge tone="outline">up to 15 files</Badge>
                  <Badge tone="outline">100% offline &amp; private</Badge>
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    variant="primary"
                    size="md"
                    icon={Upload}
                    onClick={(e) => {
                      e.stopPropagation();
                      inputRef.current?.click();
                    }}
                  >
                    Select PDF files
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    icon={FileText}
                    onClick={(e) => {
                      e.stopPropagation();
                      void trySampleLabels();
                    }}
                  >
                    Try with sample labels
                  </Button>
                </div>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              aria-label="Upload shipping label PDF files"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                void beginParse(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
          </div>
        </Card>
      )}

      {/* ── Review stage ─────────────────────────────────────────── */}
      {stage === 'review' && labels.length === 0 && (
        <Card className="p-8">
          <EmptyState
            icon={FileText}
            title="No shipping labels detected in this PDF"
            description="Our offline parser could not extract any recognizable AWB, order ID, or SKU data from the uploaded file(s). This usually happens due to one of the following reasons:"
            primaryAction={{
              label: 'Report this PDF',
              icon: FileText,
              onClick: handleReportPdf
            }}
            secondaryLink={{
              label: 'Try another PDF batch',
              onClick: reset
            }}
          >
            <div className="mt-4 rounded-xl border border-line bg-ink-900/60 p-4 text-left text-xs text-slate-300">
              <div className="font-semibold text-white">Likely causes:</div>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-slate-400">
                <li>
                  <strong className="text-slate-200">Scanned image PDF:</strong> The PDF contains
                  photos or scanned bitmap images instead of digital vector text layers.
                </li>
                <li>
                  <strong className="text-slate-200">Unsupported marketplace layout:</strong> The
                  label uses a custom, non-standard, or newly updated courier layout.
                </li>
                <li>
                  <strong className="text-slate-200">Protected PDF:</strong> The PDF text is
                  encrypted or restricted from extraction.
                </li>
              </ul>
              <div className="mt-3 text-[11px] text-slate-500">
                Clicking &quot;Report this PDF&quot; copies only nonsensitive file metadata
                (filename, byte size) to your clipboard for debugging. No buyer or seller personal
                information is ever extracted or shared.
              </div>
            </div>
          </EmptyState>
        </Card>
      )}

      {stage === 'review' && labels.length > 0 && (
        <div className="space-y-5">
          <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Labels found', value: labels.length, icon: Layers },
              { label: 'Couriers', value: courierCounts.length, icon: Crop },
              { label: 'Multi-qty parcels', value: multiQtyCount, icon: ListChecks },
              { label: 'PDFs', value: files.length, icon: FileText }
            ].map((s) => (
              <StaggerItem key={s.label}>
                <Card className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-proof-500/25 bg-proof-500/10 text-proof-300">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-display text-xl font-bold text-white mono-tabular">
                      {s.value}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">
                      {s.label}
                    </div>
                  </div>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            {/* Options */}
            <Card className="space-y-5 p-5 xl:col-span-1">
              <div className="font-display text-base font-bold text-white">
                Crop &amp; stamp options
              </div>
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setOptions((o) => ({ ...o, preset: p.value }))}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border p-3 transition-all',
                      options.preset === p.value
                        ? 'border-proof-500/60 bg-proof-500/10 shadow-[0_10px_28px_-16px_rgba(37,99,235,0.55)]'
                        : 'border-line bg-ink-850/60 hover:border-line-bright'
                    )}
                  >
                    {p.art}
                    <div className="text-center">
                      <div className="text-xs font-semibold text-white">{p.title}</div>
                      <div className="mt-0.5 text-[9px] leading-tight text-slate-500">{p.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="space-y-3.5 border-t border-line pt-4">
                <Toggle
                  checked={options.stampSku}
                  onChange={(v) => setOptions((o) => ({ ...o, stampSku: v }))}
                  label="Stamp SKU strip"
                  hint="Bold 11pt SKU · Size · Qty · date on every label"
                />
                <Toggle
                  checked={options.multiQtyGuard}
                  onChange={(v) => setOptions((o) => ({ ...o, multiQtyGuard: v }))}
                  label="Multi-quantity guard"
                  hint="Red border + badge when Qty > 1"
                />
                <Toggle
                  checked={options.withManifest}
                  onChange={(v) => setOptions((o) => ({ ...o, withManifest: v }))}
                  label="Picklist manifest page"
                  hint={
                    license.plan === 'free'
                      ? `Courier handover summary with ${BRAND.name} verified seal`
                      : 'Clean white-label courier handover summary'
                  }
                />
                <Toggle
                  checked={options.valmoPlusAsValmo}
                  onChange={(v) => setOptions((o) => ({ ...o, valmoPlusAsValmo: v }))}
                  label="Treat ValmoPlus as Valmo"
                  hint="Group both under one courier handover"
                />
              </div>
              <Button
                variant="primary"
                size="lg"
                icon={FileDown}
                className="w-full"
                onClick={() => void runExport()}
              >
                Crop &amp; export {labels.length} labels
              </Button>
              <button
                type="button"
                onClick={reset}
                className="w-full text-center text-xs text-slate-500 transition-colors hover:text-slate-300"
              >
                Start over with different PDFs
              </button>
            </Card>

            {/* Table */}
            <Card className="overflow-hidden xl:col-span-2">
              <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
                <div className="glass-soft flex min-w-0 flex-1 items-center gap-2 px-3 py-2">
                  <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Filter labels"
                    placeholder="Filter AWB / Order / SKU / courier…"
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
                <div className="flex flex-wrap gap-1.5">
                  {courierCounts.slice(0, 4).map(([courier, count]) => (
                    <Badge
                      key={courier}
                      tone={COURIER_TONE[courier as CourierPartner] ?? 'neutral'}
                    >
                      {courier} · {count}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="max-h-[26rem] overflow-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-ink-900/95 backdrop-blur">
                    <tr className="border-b border-line text-slate-500">
                      <th className="px-4 py-2.5">{sortButton('awb', 'AWB')}</th>
                      <th className="px-4 py-2.5">Order</th>
                      <th className="px-4 py-2.5">{sortButton('sku', 'SKU')}</th>
                      <th className="px-4 py-2.5">Size</th>
                      <th className="px-4 py-2.5">{sortButton('qty', 'Qty')}</th>
                      <th className="px-4 py-2.5">{sortButton('courier', 'Courier')}</th>
                      <th className="px-4 py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {displayLabels.map((l, i) => (
                      <tr key={`${l.awb}-${i}`} className="transition-colors hover:bg-ink-850/60">
                        <td className="px-4 py-2.5 font-mono text-[13px] font-semibold text-white">
                          {l.awb}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400">
                          {truncate(l.orderId, 14)}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-proof-300">
                          {l.sku}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">{l.size || '—'}</td>
                        <td className="px-4 py-2.5">
                          {l.qty > 1 ? (
                            <Badge tone="warn">×{l.qty}</Badge>
                          ) : (
                            <span className="font-mono text-xs text-slate-400">1</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge tone={COURIER_TONE[l.courier] ?? 'neutral'}>{l.courier}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-300">
                          {formatRupees(l.invoiceTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {displayLabels.length === 0 && (
                  <EmptyState
                    icon={Search}
                    title="No labels match your filter"
                    description={`No shipping labels match "${search}". Try searching by AWB, order ID, SKU, or courier name.`}
                    primaryAction={{
                      label: 'Clear search filter',
                      onClick: () => setSearch('')
                    }}
                    className="py-10"
                  />
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── Exporting ────────────────────────────────────────────── */}
      {stage === 'exporting' && (
        <Card className="flex flex-col items-center px-6 py-16 text-center">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <span className="absolute inset-0 animate-ping-slow rounded-full border border-proof-500/40" />
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-proof-500/30 bg-proof-500/10">
              <Spinner className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-5 font-display text-lg font-bold text-white">
            Cropping, stamping &amp; sorting…
          </div>
          <div className="mt-1 font-mono text-xs text-slate-400">{progress.stage}</div>
          <div className="mt-5 w-full max-w-sm">
            <ProgressBar value={progress.done} max={Math.max(1, progress.total)} />
          </div>
          <div className="mt-4 text-xs text-slate-500">
            Vector output — barcode stays laser-sharp on thermal printers.
          </div>
        </Card>
      )}

      {/* ── Done + upsell ────────────────────────────────────────── */}
      {stage === 'done' && doneInfo && (
        <Card glow className="relative overflow-hidden">
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-proof-500/40 bg-proof-500/12 text-proof-300">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="mt-5 font-display text-2xl font-bold text-white">
              ✅ {doneInfo.count} Labels Cropped &amp; Loaded into Memory!
            </div>
            <div className="mt-2 font-mono text-xs text-slate-400">
              {doneInfo.fileName} · downloaded
            </div>
            <div className="mt-1 text-sm text-slate-400">
              Every AWB is now indexed in IndexedDB — the Recorder will auto-match SKU, Order ID and
              courier the instant you scan.
            </div>
            <Button
              variant="primary"
              size="xl"
              icon={Video}
              iconRight={ArrowRight}
              className="mt-7 w-full sm:w-auto"
              onClick={() => navigateTo('recorder')}
            >
              Open the AWB Recorder
            </Button>
            <div className="mt-2 text-sm text-slate-400">
              It will auto-match these {doneInfo.count} AWBs during packing.
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                icon={FileDown}
                onClick={() =>
                  downloadBlob(
                    new Blob([doneInfo.bytes as BlobPart], { type: 'application/pdf' }),
                    doneInfo.fileName
                  )
                }
              >
                Download PDF again
              </Button>
              <Button variant="ghost" size="sm" icon={RefreshCw} onClick={reset}>
                Start a new batch
              </Button>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-[11px] text-slate-600">
              Next: scan the first parcel barcode in the Recorder. <Kbd>Enter</Kbd> confirms manual
              entry.
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export default SmartLabelWorkbench;

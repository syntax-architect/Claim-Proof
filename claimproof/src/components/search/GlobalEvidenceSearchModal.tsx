/**
 * SABOOT Suite — Global Evidence & Claim Search Modal
 * Universal search for AWBs, Order IDs, and SKUs via keyboard or laser barcode scanner.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  ChevronDown,
  Clock,
  FileQuestion,
  FolderArchive,
  Image,
  Play,
  Radar,
  RotateCcw,
  ScanBarcode,
  Search,
  Video,
  X
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FEATURES } from '../../config/features';
import { formatIST, formatISTShort } from '../../lib/dateUtils';
import { startHidListener } from '../../lib/hidScanner';
import { navigateTo } from '../../lib/router';
import { cn, formatBytes } from '../../lib/utils';
import { RecordingPlayer } from '../../pages/VaultPage';
import {
  searchUnifiedEvidence,
  type UnifiedEvidenceDossier,
  type UnifiedSearchResult
} from '../../services/evidenceSearch';
import { connectVault } from '../../services/vaultWriter';
import { Badge, Button, Card, EmptyState, Kbd, LoadingSkeleton, useToast } from '../ui';

interface GlobalEvidenceSearchModalProps {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export function GlobalEvidenceSearchModal({
  open,
  onClose,
  initialQuery = ''
}: GlobalEvidenceSearchModalProps) {
  const toast = useToast();
  const [query, setQuery] = useState(initialQuery);
  const [searchState, setSearchState] = useState<UnifiedSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedRecording, setSelectedRecording] = useState<
    import('../../types').RecordingMeta | null
  >(null);
  const [expandedDuplicates, setExpandedDuplicates] = useState<Record<string, boolean>>({});

  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Synchronize initialQuery if provided when opening
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      if (initialQuery) {
        setQuery(initialQuery);
      }
      setPage(1);
      const timer = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(timer);
    } else if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [open, initialQuery]);

  // Execute unified search
  const executeSearch = useCallback(async (searchTerm: string, targetPage: number) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      setSearchState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await searchUnifiedEvidence(trimmed, {
        page: targetPage,
        pageSize: 10,
        checkDiskFiles: true
      });
      setSearchState(res);
    } catch (err) {
      console.error('[Search] Failed executing evidence search:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger search on query or page changes
  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => {
      void executeSearch(query, page);
    }, 120);
    return () => clearTimeout(timeout);
  }, [query, page, open, executeSearch]);

  // Reset page when query changes
  const handleQueryChange = (val: string) => {
    setQuery(val);
    setPage(1);
  };

  // Laser barcode scanner gun listener
  useEffect(() => {
    if (!open) return;
    const hid = startHidListener((scannedAwb) => {
      setQuery(scannedAwb);
      setPage(1);
      toast.info('Barcode Scanned', `Searching for AWB: ${scannedAwb}`);
    });
    return () => hid.stop();
  }, [open, toast]);

  // Connect vault folder handler
  const handleConnectVault = async () => {
    try {
      const mode = await connectVault();
      toast.success(
        mode === 'fs-api' ? 'Vault reconnected' : 'Downloads folder active',
        'Storage folder permissions updated.'
      );
      // Re-run search to re-check file statuses
      void executeSearch(query, page);
    } catch {
      toast.warn(
        'Vault connection cancelled',
        'Pick your evidence folder in Settings to relink video files.'
      );
    }
  };

  const toggleDuplicateList = (awb: string) => {
    setExpandedDuplicates((prev) => ({
      ...prev,
      [awb]: !prev[awb]
    }));
  };

  if (!FEATURES.globalEvidenceSearch) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-start justify-center p-3 pt-[6vh] sm:p-6 sm:pt-[8vh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Backdrop */}
            <button
              type="button"
              aria-label="Close search modal"
              tabIndex={-1}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={onClose}
            />

            {/* Modal Dialog */}
            <motion.div
              className="glass relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-line-bright shadow-2xl"
              initial={{ opacity: 0, scale: 0.98, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -6 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              role="dialog"
              aria-modal="true"
              aria-label="Global Evidence Search"
            >
              {/* Search Bar Header */}
              <div className="flex items-center gap-3 border-b border-line bg-ink-900/90 px-4 py-3.5 sm:px-6">
                <Search className="h-5 w-5 shrink-0 text-proof-400" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') onClose();
                  }}
                  aria-label="Search by AWB, Order ID, or SKU"
                  placeholder="Scan barcode or type AWB, Order ID, SKU…"
                  className="min-w-0 flex-1 bg-transparent font-sans text-base text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => handleQueryChange('')}
                    aria-label="Clear search input"
                    className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-ink-800 hover:text-slate-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <div className="hidden items-center gap-1.5 sm:flex">
                  <Kbd>esc</Kbd>
                </div>
              </div>

              {/* Status / Subheader Bar */}
              <div className="flex items-center justify-between border-b border-line/60 bg-ink-950/60 px-4 py-2 text-xs text-slate-400 sm:px-6">
                <div className="flex items-center gap-2">
                  <ScanBarcode className="h-3.5 w-3.5 text-proof-400" />
                  <span>
                    {loading
                      ? 'Searching indexed evidence…'
                      : searchState && searchState.cleanedQuery
                        ? `Found ${searchState.total} parcel${searchState.total === 1 ? '' : 's'} in ${Math.round(searchState.latencyMs)}ms`
                        : 'Laser barcode scanner ready · accepts instant scans anywhere'}
                  </span>
                </div>
                {searchState && searchState.totalPages > 1 && (
                  <div className="font-mono text-[11px] text-slate-500">
                    Page {searchState.page} of {searchState.totalPages}
                  </div>
                )}
              </div>

              {/* Scrollable Results Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {!query.trim() ? (
                  <EmptyState
                    icon={ScanBarcode}
                    title="Search Proof & Claims"
                    description="Scan a shipping label AWB with your barcode gun, or type an Order ID or SKU to view packing videos, return videos, photo collages, and claim dispute deadlines."
                    className="py-12"
                  />
                ) : loading && !searchState ? (
                  <div className="space-y-4">
                    <LoadingSkeleton variant="rect" className="h-36 w-full rounded-xl" />
                    <LoadingSkeleton variant="rect" className="h-36 w-full rounded-xl" />
                  </div>
                ) : searchState?.results.length === 0 ? (
                  <EmptyState
                    icon={FileQuestion}
                    title="No evidence found"
                    description={`No parcels found matching "${query}". Double-check the AWB code or scan the physical label barcode.`}
                    primaryAction={{
                      label: 'Clear search',
                      onClick: () => handleQueryChange(''),
                      variant: 'secondary'
                    }}
                    className="py-12"
                  />
                ) : (
                  <div className="space-y-4">
                    {searchState?.results.map((dossier) => (
                      <UnifiedDossierCard
                        key={dossier.awb}
                        dossier={dossier}
                        onPlayRecording={(rec) => setSelectedRecording(rec)}
                        onConnectVault={handleConnectVault}
                        onCloseModal={onClose}
                        isDuplicatesExpanded={Boolean(expandedDuplicates[dossier.awb])}
                        onToggleDuplicates={() => toggleDuplicateList(dossier.awb)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Pagination Footer */}
              {searchState && searchState.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-line bg-ink-950/80 px-4 py-3 sm:px-6">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={ArrowLeft}
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <div className="font-mono text-xs text-slate-400">
                    Page {searchState.page} of {searchState.totalPages} ({searchState.total} total)
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= searchState.totalPages}
                    onClick={() => setPage((p) => Math.min(searchState.totalPages, p + 1))}
                  >
                    Next
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video / Photo Player Dialog */}
      {selectedRecording && (
        <RecordingPlayer recording={selectedRecording} onClose={() => setSelectedRecording(null)} />
      )}
    </>
  );
}

/**
 * Unified Evidence Dossier Card: displays packing video, return video,
 * photo collage, and ClaimRadar claim status for a single AWB.
 */
function UnifiedDossierCard({
  dossier,
  onPlayRecording,
  onConnectVault,
  onCloseModal,
  isDuplicatesExpanded,
  onToggleDuplicates
}: {
  dossier: UnifiedEvidenceDossier;
  onPlayRecording: (rec: import('../../types').RecordingMeta) => void;
  onConnectVault: () => void;
  onCloseModal: () => void;
  isDuplicatesExpanded: boolean;
  onToggleDuplicates: () => void;
}) {
  const dispatchRec = dossier.dispatchRecording;
  const returnRec = dossier.returnRecording;
  const claim = dossier.claim;

  return (
    <Card className="p-4 sm:p-5">
      {/* Dossier Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line/60 pb-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-base font-bold text-white sm:text-lg">
              {dossier.awb}
            </span>
            <Badge tone="info">{dossier.marketplace}</Badge>
            <Badge tone="neutral">{dossier.courier}</Badge>
            {claim && (
              <Badge
                tone={
                  claim.status === 'won' ? 'proof' : claim.status === 'lost' ? 'danger' : 'warn'
                }
              >
                Dispute: {claim.status.toUpperCase()}
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-slate-400">
            <span>Order ID: {dossier.orderId}</span>
            <span>·</span>
            <span>SKU: {dossier.sku}</span>
            <span>·</span>
            <span>{formatISTShort(dossier.createdAt)}</span>
          </div>
        </div>

        {/* ClaimRadar quick link */}
        {claim ? (
          <Button
            variant="ghost"
            size="sm"
            icon={Radar}
            onClick={() => {
              onCloseModal();
              navigateTo('claims');
            }}
            className="text-proof-400 hover:text-proof-300"
          >
            ClaimRadar
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            icon={Radar}
            onClick={() => {
              onCloseModal();
              navigateTo('claims');
            }}
            className="text-slate-400 hover:text-slate-200"
          >
            Flag Return
          </Button>
        )}
      </div>

      {/* Primary Evidence Grid: Packing Video vs Return Video */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Packing / Dispatch Video Block */}
        <div className="rounded-xl border border-line bg-ink-950/40 p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <Video className="h-4 w-4 text-proof-400" />
              <span>Packing Video (Dispatch)</span>
            </div>
            {dispatchRec && (
              <Badge tone={dossier.dispatchStatus === 'found' ? 'proof' : 'danger'}>
                {dossier.dispatchStatus === 'found'
                  ? `${dispatchRec.durationSec}s · ${formatBytes(dispatchRec.videoBytes)}`
                  : 'FILE MISSING'}
              </Badge>
            )}
          </div>

          {dossier.dispatchStatus === 'found' && dispatchRec ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-mono text-[11px] text-slate-400">
                  Recorded: {formatIST(dispatchRec.startedAt)}
                </div>
                <div className="text-[11px] text-slate-500">Uncut continuous proof verified</div>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={Play}
                onClick={() => onPlayRecording(dispatchRec)}
              >
                Play
              </Button>
            </div>
          ) : dossier.dispatchStatus === 'missing_file' && dispatchRec ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2 rounded-lg bg-danger-500/10 p-2.5 text-xs text-danger-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-semibold">Video file not found on disk</div>
                  <div className="text-[11px] text-slate-400">
                    File was moved or the storage folder was disconnected.
                  </div>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={FolderArchive}
                onClick={onConnectVault}
                className="w-full"
              >
                Relink Vault Folder
              </Button>
            </div>
          ) : (
            <div className="space-y-2 py-1">
              <div className="text-xs text-slate-400">
                No packing video was recorded for this AWB.
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={Camera}
                onClick={() => {
                  onCloseModal();
                  navigateTo('recorder');
                }}
                className="text-xs text-proof-400 hover:text-proof-300"
              >
                Open Packing Station
              </Button>
            </div>
          )}
        </div>

        {/* Return Video Block */}
        <div className="rounded-xl border border-line bg-ink-950/40 p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <RotateCcw className="h-4 w-4 text-info-400" />
              <span>Return Video (Unboxing)</span>
            </div>
            {returnRec && (
              <Badge tone={dossier.returnStatus === 'found' ? 'info' : 'danger'}>
                {dossier.returnStatus === 'found'
                  ? `${returnRec.durationSec}s · ${formatBytes(returnRec.videoBytes)}`
                  : 'FILE MISSING'}
              </Badge>
            )}
          </div>

          {dossier.returnStatus === 'found' && returnRec ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-mono text-[11px] text-slate-400">
                  Scanned: {formatIST(returnRec.startedAt)}
                </div>
                <div className="text-[11px] text-slate-500">Unboxing proof verified</div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={Play}
                onClick={() => onPlayRecording(returnRec)}
              >
                Play
              </Button>
            </div>
          ) : dossier.returnStatus === 'missing_file' && returnRec ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2 rounded-lg bg-danger-500/10 p-2.5 text-xs text-danger-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-semibold">Return video file not found</div>
                  <div className="text-[11px] text-slate-400">
                    File was moved or storage folder was disconnected.
                  </div>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={FolderArchive}
                onClick={onConnectVault}
                className="w-full"
              >
                Relink Vault Folder
              </Button>
            </div>
          ) : (
            <div className="py-2 text-xs text-slate-500">
              No return recorded for this parcel (dispatched only).
            </div>
          )}
        </div>
      </div>

      {/* Supplemental Row: Photo Collages & Claim Details */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/40 pt-3 text-xs">
        <div className="flex items-center gap-3">
          {dossier.hasPhotoCollage ? (
            <div className="flex items-center gap-1.5 text-slate-300">
              <Image className="h-3.5 w-3.5 text-proof-400" />
              <span>2×2 Photo Collage ({formatBytes(dossier.photoBytes)})</span>
            </div>
          ) : (
            <span className="text-slate-500">No photo collage</span>
          )}

          {claim && (
            <div className="flex items-center gap-1.5 text-warn-400">
              <Clock className="h-3.5 w-3.5" />
              <span>
                Dispute flag: <strong className="text-slate-200">{claim.flagReason}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Duplicate Attempts Toggle */}
        {dossier.otherRecordings.length > 0 && (
          <button
            type="button"
            onClick={onToggleDuplicates}
            className="flex items-center gap-1 text-[11px] text-slate-400 transition-colors hover:text-slate-200"
          >
            <span>
              {dossier.otherRecordings.length} previous attempt
              {dossier.otherRecordings.length === 1 ? '' : 's'}
            </span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform',
                isDuplicatesExpanded && 'rotate-180'
              )}
            />
          </button>
        )}
      </div>

      {/* Expandable Duplicate Recordings */}
      {isDuplicatesExpanded && dossier.otherRecordings.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-line/40 pt-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            Previous takes / attempts for {dossier.awb}
          </div>
          {dossier.otherRecordings.map((rec) => (
            <div
              key={rec.id ?? rec.startedAt}
              className="flex items-center justify-between rounded-lg bg-ink-900/60 p-2 text-xs"
            >
              <div className="min-w-0">
                <span className="font-semibold uppercase text-slate-300">{rec.type}: </span>
                <span className="font-mono text-slate-400">{formatIST(rec.startedAt)}</span>
                <span className="text-slate-500">
                  {' '}
                  ({rec.durationSec}s · {formatBytes(rec.videoBytes)})
                </span>
              </div>
              <Button variant="ghost" size="sm" icon={Play} onClick={() => onPlayRecording(rec)}>
                Play
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

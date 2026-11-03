import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  FolderArchive,
  FolderDown,
  HardDrive,
  Package,
  Shield,
  Video
} from 'lucide-react';
import { Badge, Button, Modal, ProgressBar, useToast } from '../ui';
import { t } from '../../lib/i18n';
import { cn, downloadBlob, formatBytes } from '../../lib/utils';
import {
  createClaimKit,
  type ClaimKitProgress,
  type ClaimKitResult
} from '../../services/claimKitBuilder';
import { getPreferredVideoFormat, type PreferredFormat } from '../../services/videoProcessing';
import { MARKETPLACE_LIMITS } from '../../config/marketplaceLimits';
import type { ClaimItem } from '../../types';

export interface ClaimKitModalProps {
  claim: ClaimItem | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: (result: ClaimKitResult) => void;
}

type SizePreset = 'none' | 'meesho' | 'amazon' | 'flipkart' | 'custom';

export function ClaimKitModal({ claim, open, onClose, onSuccess }: ClaimKitModalProps) {
  const toast = useToast();

  // Configuration options state
  const [sizePreset, setSizePreset] = useState<SizePreset>('none');
  const [customSizeMB, setCustomSizeMB] = useState<number>(50);
  const [blurAddress, setBlurAddress] = useState<boolean>(false);
  const [destination, setDestination] = useState<'folder' | 'zip'>('folder');

  // Generation state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progress, setProgress] = useState<ClaimKitProgress>({
    stage: 'gathering',
    percent: 0,
    message: t('claimKit.progress.idle')
  });
  const [result, setResult] = useState<ClaimKitResult | null>(null);
  const [errorInfo, setErrorInfo] = useState<{ message: string; nextStep: string } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const [formatInfo, setFormatInfo] = useState<PreferredFormat>({
    format: 'mp4',
    mime: 'video/mp4',
    label: 'MP4'
  });

  useEffect(() => {
    if (open) {
      setFormatInfo(getPreferredVideoFormat());
      setResult(null);
      setErrorInfo(null);
      setIsGenerating(false);
      setProgress({
        stage: 'gathering',
        percent: 0,
        message: t('claimKit.progress.idle')
      });
    }
  }, [open]);

  // Compute effective target bytes
  const targetSizeBytes = useMemo<number | null>(() => {
    switch (sizePreset) {
      case 'none':
        return null;
      case 'meesho':
        return MARKETPLACE_LIMITS.Meesho.maxVideoMB * 1024 * 1024;
      case 'amazon':
        return MARKETPLACE_LIMITS.Amazon.maxVideoMB * 1024 * 1024;
      case 'flipkart':
        return MARKETPLACE_LIMITS.Flipkart.maxVideoMB * 1024 * 1024;
      case 'custom':
        return Math.max(1, customSizeMB) * 1024 * 1024;
    }
  }, [sizePreset, customSizeMB]);

  const handleStartGeneration = async () => {
    if (!claim) return;

    setIsGenerating(true);
    setErrorInfo(null);
    setResult(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await createClaimKit({
        awb: claim.awb,
        claimId: claim.id,
        targetSizeBytes,
        blurAddress,
        destination,
        signal: controller.signal,
        onProgress: (prog) => {
          setProgress(prog);
        }
      });

      setResult(res);
      setIsGenerating(false);

      if (res.mode === 'zip' && res.zipBlob) {
        downloadBlob(res.zipBlob, `ClaimKit_${claim.awb}.zip`);
      }

      toast.success(
        t('claimKit.status.success'),
        res.folderName
          ? `Saved to folder: ${res.folderName}`
          : 'ZIP file downloaded to your device.'
      );

      onSuccess?.(res);
    } catch (err: unknown) {
      setIsGenerating(false);
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes('cancelled') || controller.signal.aborted) {
        setErrorInfo({
          message: t('claimKit.error.cancelled'),
          nextStep: t('claimKit.error.cancelledNextStep')
        });
        toast.info(t('claimKit.error.cancelled'));
      } else if (msg.includes('permission')) {
        setErrorInfo({
          message: t('claimKit.error.permissionRevoked'),
          nextStep: t('claimKit.error.permissionRevokedNextStep')
        });
        toast.error(t('claimKit.error.permissionRevoked'));
      } else if (msg.includes('unreadable') || msg.includes('compressed')) {
        setErrorInfo({
          message: msg,
          nextStep: t('claimKit.error.qualityDegradeNextStep')
        });
        toast.error(msg);
      } else {
        setErrorInfo({
          message: msg,
          nextStep: t('claimKit.error.writeFailedNextStep')
        });
        toast.error(msg);
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  if (!claim) return null;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!isGenerating) onClose();
      }}
      title={t('claimKit.modal.title')}
      subtitle={t('claimKit.modal.subtitle', { awb: claim.awb })}
      icon={Package}
      width="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Video className="h-4 w-4 text-proof-400" />
            <span>
              {t('claimKit.status.formatNotice', {
                format: formatInfo.label,
                mime: formatInfo.mime
              })}
            </span>
          </div>
          <div className="flex gap-2">
            {isGenerating ? (
              <Button variant="secondary" size="sm" onClick={handleCancelGeneration}>
                {t('common.cancel')}
              </Button>
            ) : result ? (
              <Button variant="primary" size="sm" onClick={onClose}>
                {t('common.done')}
              </Button>
            ) : (
              <>
                <Button variant="secondary" size="sm" onClick={onClose}>
                  {t('common.close')}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={FolderDown}
                  onClick={handleStartGeneration}
                >
                  {t('claimKit.button.create')}
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Progress Display */}
        {isGenerating && (
          <div className="rounded-xl border border-proof-500/30 bg-proof-950/20 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-proof-300">
                {t('claimKit.button.creating')}
              </span>
              <span className="font-mono text-xs font-bold text-proof-400">
                {progress.percent}%
              </span>
            </div>
            <ProgressBar value={progress.percent} max={100} tone="proof" className="h-2" />
            <p className="text-xs text-slate-300">{progress.message}</p>
          </div>
        )}

        {/* Success Banner */}
        {result && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-sm font-semibold text-emerald-300">
                  {t('claimKit.status.success')}
                </div>
                <div className="text-xs text-slate-300">
                  {result.mode === 'folder'
                    ? `Folder saved: ${result.folderName}`
                    : 'ZIP archive packaged and downloaded.'}{' '}
                  · {t('claimKit.status.sizeNotice', { size: formatBytes(result.totalBytes) })}
                </div>
              </div>
            </div>

            {/* Warnings list */}
            {result.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-3 text-xs text-amber-200">
                {result.warnings.map((w, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* List of files packaged */}
            <div className="space-y-1.5 border-t border-emerald-500/20 pt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                Packaged Evidence Dossier:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-xs text-slate-300">
                {result.filesCreated.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 truncate">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Actionable Error Banner */}
        {errorInfo && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-rose-200">{errorInfo.message}</div>
                <div className="mt-1 text-xs text-slate-300">{errorInfo.nextStep}</div>
              </div>
            </div>
          </div>
        )}

        {/* Options Form (hidden while generating or after result) */}
        {!isGenerating && !result && (
          <div className="space-y-5">
            {/* Target Video Size Preset */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  {t('claimKit.options.targetSize')}
                </label>
                <Badge tone="mono">LOCAL-ONLY ON-DEVICE PROCESSING</Badge>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                    sizePreset === 'none'
                      ? 'border-proof-500 bg-proof-950/30'
                      : 'border-line bg-ink-950 hover:border-line-bright'
                  )}
                >
                  <input
                    type="radio"
                    name="targetSize"
                    value="none"
                    checked={sizePreset === 'none'}
                    onChange={() => setSizePreset('none')}
                    className="mt-1"
                  />
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-slate-200">
                      {t('claimKit.options.targetSizeNone')}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Fastest export, full bitrate and 720p clarity.
                    </div>
                  </div>
                </label>

                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                    sizePreset === 'meesho'
                      ? 'border-proof-500 bg-proof-950/30'
                      : 'border-line bg-ink-950 hover:border-line-bright'
                  )}
                >
                  <input
                    type="radio"
                    name="targetSize"
                    value="meesho"
                    checked={sizePreset === 'meesho'}
                    onChange={() => setSizePreset('meesho')}
                    className="mt-1"
                  />
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-slate-200">
                      {t('claimKit.options.targetSizePreset', {
                        sizeMB: 50,
                        marketplace: 'Meesho'
                      })}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Re-encodes only if original video exceeds 50 MB.
                    </div>
                  </div>
                </label>

                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                    sizePreset === 'amazon'
                      ? 'border-proof-500 bg-proof-950/30'
                      : 'border-line bg-ink-950 hover:border-line-bright'
                  )}
                >
                  <input
                    type="radio"
                    name="targetSize"
                    value="amazon"
                    checked={sizePreset === 'amazon'}
                    onChange={() => setSizePreset('amazon')}
                    className="mt-1"
                  />
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-slate-200">
                      {t('claimKit.options.targetSizePreset', {
                        sizeMB: 25,
                        marketplace: 'Amazon'
                      })}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      SAFE-T portal attachment limit (25 MB).
                    </div>
                  </div>
                </label>

                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                    sizePreset === 'flipkart'
                      ? 'border-proof-500 bg-proof-950/30'
                      : 'border-line bg-ink-950 hover:border-line-bright'
                  )}
                >
                  <input
                    type="radio"
                    name="targetSize"
                    value="flipkart"
                    checked={sizePreset === 'flipkart'}
                    onChange={() => setSizePreset('flipkart')}
                    className="mt-1"
                  />
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-slate-200">
                      {t('claimKit.options.targetSizePreset', {
                        sizeMB: 100,
                        marketplace: 'Flipkart'
                      })}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      SPF portal video upload limit (100 MB).
                    </div>
                  </div>
                </label>
              </div>

              {sizePreset === 'custom' && (
                <div className="mt-2 flex items-center gap-3">
                  <label className="text-xs text-slate-300">
                    {t('claimKit.options.targetSizeCustom')}:
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={500}
                    value={customSizeMB}
                    onChange={(e) => setCustomSizeMB(Number(e.target.value))}
                    className="w-24 rounded-lg border border-line bg-ink-900 px-3 py-1.5 text-xs font-mono text-white focus:border-proof-500"
                  />
                </div>
              )}
            </div>

            {/* Privacy Blur Address Option */}
            <div className="rounded-xl border border-line bg-ink-950/60 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={blurAddress}
                  onChange={(e) => setBlurAddress(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-line text-proof-500 focus:ring-proof-500"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-proof-400" />
                    <span className="text-xs font-semibold text-slate-200">
                      {t('claimKit.options.blurAddress')}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    {t('claimKit.options.blurAddressHelp')}
                  </p>
                </div>
              </label>
            </div>

            {/* Destination Mode: Local Vault Folder vs ZIP */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                {t('claimKit.options.exportFormat')}
              </label>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                    destination === 'folder'
                      ? 'border-proof-500 bg-proof-950/30'
                      : 'border-line bg-ink-950 hover:border-line-bright'
                  )}
                >
                  <input
                    type="radio"
                    name="destination"
                    value="folder"
                    checked={destination === 'folder'}
                    onChange={() => setDestination('folder')}
                    className="mt-1"
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                      <HardDrive className="h-3.5 w-3.5 text-proof-400" />
                      <span>{t('claimKit.options.formatFolder')}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Saves an organized folder under ClaimKit_{claim.awb} in your vault.
                    </div>
                  </div>
                </label>

                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                    destination === 'zip'
                      ? 'border-proof-500 bg-proof-950/30'
                      : 'border-line bg-ink-950 hover:border-line-bright'
                  )}
                >
                  <input
                    type="radio"
                    name="destination"
                    value="zip"
                    checked={destination === 'zip'}
                    onChange={() => setDestination('zip')}
                    className="mt-1"
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                      <FolderArchive className="h-3.5 w-3.5 text-proof-400" />
                      <span>{t('claimKit.options.formatZip')}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Downloads an archive file ready to attach to seller support tickets.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

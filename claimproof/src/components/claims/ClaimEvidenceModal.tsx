import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCopy,
  FileCheck2,
  FolderOpen,
  Package,
  RefreshCw,
  Undo2,
  Video
} from 'lucide-react';
import {
  findDispatchEvidence,
  findReturnEvidence,
  generateDisputeText,
  saveDisputeText,
  updateClaimStatus
} from '../../services/claimEngine';
import { loadRecordingMedia, type RecordingMedia } from '../../services/mediaLibrary';
import { revealAwbFolder } from '../../services/vaultWriter';
import { recordingTypeLabel } from '../../lib/claimRules';
import { formatIST } from '../../lib/dateUtils';
import { formatBytes } from '../../lib/utils';
import { Badge, Button, Modal, Spinner, useToast } from '../ui';
import type { ClaimItem, RecordingMeta } from '../../types';

interface Side {
  rec: RecordingMeta | null;
  media: RecordingMedia | null;
}

function EvidenceColumn({
  title,
  badge,
  side
}: {
  title: string;
  badge: 'proof' | 'warn';
  side: Side | null;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Badge tone={badge}>{title}</Badge>
        {side?.rec && (
          <span className="font-mono text-[10px] text-slate-500">
            {side.rec.durationSec}s · {formatBytes(side.rec.videoBytes + side.rec.photoBytes)}
          </span>
        )}
      </div>
      <div className="glass-soft overflow-hidden">
        {!side ? (
          <div className="flex h-56 items-center justify-center">
            <Spinner className="h-5 w-5" />
          </div>
        ) : side.rec && side.media?.videoUrl ? (
          <video
            key={side.media.videoUrl}
            src={side.media.videoUrl}
            controls
            playsInline
            className="aspect-video w-full bg-black"
          />
        ) : (
          <div className="flex h-56 flex-col items-center justify-center gap-2 border border-dashed border-line-bright px-6 text-center text-xs text-slate-500">
            <Video className="h-6 w-6" />
            {title === 'DISPATCH PROOF'
              ? 'No dispatch recording found for this AWB within the 10-day window.'
              : 'Return unboxing clip not linked — it may have been recorded before ClaimRadar was active.'}
          </div>
        )}
      </div>
      {side?.media?.photoUrl && (
        <img
          src={side.media.photoUrl}
          alt={`${title} collage`}
          className="mt-3 aspect-square w-full rounded-lg border border-line bg-black object-contain"
        />
      )}
      {side?.rec && (
        <div className="mt-2 font-mono text-[10px] text-slate-500">
          {recordingTypeLabel(side.rec.type)} · {formatIST(side.rec.startedAt)} · {side.rec.courier}
        </div>
      )}
    </div>
  );
}

export function ClaimEvidenceModal({
  claim,
  onClose
}: {
  claim: ClaimItem | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [dispatch, setDispatch] = useState<Side | null>(null);
  const [returnRec, setReturnRec] = useState<Side | null>(null);
  const [disputeText, setDisputeText] = useState('');
  const [saving, setSaving] = useState(false);

  const claimId = claim?.id;

  useEffect(() => {
    if (!claim) return;
    let cancelled = false;
    void (async () => {
      const [d, r] = await Promise.all([findDispatchEvidence(claim), findReturnEvidence(claim)]);
      if (cancelled) return;
      const dMedia = d?.id !== undefined ? await loadRecordingMedia(d.id) : null;
      const rMedia = r?.id !== undefined ? await loadRecordingMedia(r.id) : null;
      if (cancelled) return;
      setDispatch({ rec: d ?? null, media: dMedia });
      setReturnRec({ rec: r ?? null, media: rMedia });
      if (!claim.disputeText) {
        setDisputeText(generateDisputeText(claim, d, r));
      } else {
        setDisputeText(claim.disputeText);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [claim]);

  useEffect(() => {
    setDispatch(null);
    setReturnRec(null);
  }, [claimId]);

  const open = useMemo(() => claim !== null, [claim]);

  if (!claim) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Claim evidence — ${claim.awb}`}
      subtitle={`${claim.marketplace} · ${claim.flagReason} · window ends ${formatIST(claim.deadlineAt)}`}
      icon={Package}
      width="xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="secondary"
            size="sm"
            icon={FolderOpen}
            onClick={() =>
              void (async () => {
                const targets = [dispatch?.rec, returnRec?.rec].filter(Boolean) as NonNullable<
                  typeof dispatch
                >['rec'][];
                let any = false;
                for (const rec of targets) {
                  if (rec && revealAwbFolder) {
                    const ok = await revealAwbFolder(rec.awb, rec.type, rec.startedAt);
                    if (ok) any = true;
                  }
                }
                if (!any)
                  toast.warn('Vault folder not reachable', 'Connect the vault in Settings first.');
              })()
            }
          >
            Open Folder &amp; Drag Files to Seller Portal
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={FileCheck2}
              loading={saving}
              onClick={() => {
                if (claim.id === undefined) return;
                setSaving(true);
                void saveDisputeText(claim.id, disputeText)
                  .then(() => updateClaimStatus(claim.id!, 'submitted'))
                  .then(() => {
                    toast.success('Marked as submitted', 'Track the outcome from the queue.');
                    onClose();
                  })
                  .finally(() => setSaving(false));
              }}
            >
              Save &amp; Mark Submitted
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <EvidenceColumn title="DISPATCH PROOF" badge="proof" side={dispatch} />
        <EvidenceColumn title="RETURN UNBOXING" badge="warn" side={returnRec} />
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <Badge tone="mono">CLAIM DISPUTE TEXT — copy-paste ready</Badge>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="xs"
              icon={RefreshCw}
              onClick={() =>
                setDisputeText(
                  generateDisputeText(
                    claim,
                    dispatch?.rec ?? undefined,
                    returnRec?.rec ?? undefined
                  )
                )
              }
            >
              Regenerate
            </Button>
            <Button
              variant="secondary"
              size="xs"
              icon={ClipboardCopy}
              onClick={() =>
                void navigator.clipboard
                  .writeText(disputeText)
                  .then(() => toast.success('Dispute text copied'))
                  .catch(() =>
                    toast.error('Clipboard blocked', 'Select the text and copy manually.')
                  )
              }
            >
              Copy
            </Button>
          </div>
        </div>
        <textarea
          value={disputeText}
          onChange={(e) => setDisputeText(e.target.value)}
          rows={12}
          className="w-full rounded-xl border border-line bg-ink-950/80 p-4 font-mono text-xs leading-relaxed text-slate-200 focus:border-proof-500/50 focus:outline-none"
        />
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
          <Undo2 className="h-3 w-3" /> Cites AWB, dispatch &amp; return timestamps and the barcode
          verification chain — tailored to {claim.marketplace} support rubrics.
        </div>
      </div>
    </Modal>
  );
}

import { useEffect, useState } from 'react';
import {
  AlarmClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileCheck2,
  Radar,
  Send,
  Trash2,
  Trophy,
  Video
} from 'lucide-react';
import { deleteClaim, updateClaimStatus, useClaims } from '../../services/claimEngine';
import { claimWindowLabel } from '../../lib/claimRules';
import { deadlineTone, formatCountdown, formatISTShort } from '../../lib/dateUtils';
import { planHasFeature, useLicense } from '../../services/licenseService';
import { usePaywall } from '../../providers/PaywallProvider';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Ring,
  Segmented,
  StatCard,
  Stagger,
  StaggerItem,
  useToast
} from '../ui';
import type { ClaimItem, ClaimStatus } from '../../types';
import { cn } from '../../lib/utils';
import { ClaimEvidenceModal } from './ClaimEvidenceModal';

function ClaimRow({
  claim,
  onPrepare,
  onStatus,
  onDelete
}: {
  claim: ClaimItem;
  onPrepare: () => void;
  onStatus: (s: ClaimStatus) => void;
  onDelete: () => void;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const msLeft = claim.deadlineAt - Date.now();
  const windowMs = Math.max(1, claim.deadlineAt - claim.returnScanAt);
  const progress = Math.max(0, Math.min(1, msLeft / windowMs));
  const tone = deadlineTone(msLeft);
  const ringTone =
    tone === 'expired' || tone === 'urgent' ? 'danger' : tone === 'warn' ? 'warn' : 'proof';

  return (
    <Card hover className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Ring progress={progress} size={64} stroke={6} tone={ringTone}>
            <span
              className={cn(
                'font-mono text-[10px] font-bold',
                ringTone === 'danger'
                  ? 'text-danger-300'
                  : ringTone === 'warn'
                    ? 'text-warn-300'
                    : 'text-proof-300'
              )}
            >
              {msLeft <= 0 ? 'END' : `${Math.floor(msLeft / 3_600_000)}h`}
            </span>
          </Ring>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-lg font-bold text-white">{claim.awb}</span>
              <Badge tone="info">{claimWindowLabel(claim.marketplace)}</Badge>
              <Badge tone="warn">{claim.flagReason}</Badge>
              {claim.status !== 'pending' && (
                <Badge
                  tone={
                    claim.status === 'won'
                      ? 'proof'
                      : claim.status === 'lost'
                        ? 'danger'
                        : 'neutral'
                  }
                >
                  {claim.status}
                </Badge>
              )}
            </div>
            <div className="mt-1 truncate font-mono text-[11px] text-slate-500">
              {claim.sku} · Qty {claim.qty} · {claim.courier} · return scanned{' '}
              {formatISTShort(claim.returnScanAt)}
            </div>
            <div
              className={cn(
                'mt-2 font-mono text-sm font-bold mono-tabular',
                ringTone === 'danger'
                  ? 'text-danger-300'
                  : ringTone === 'warn'
                    ? 'text-warn-300'
                    : 'text-proof-300'
              )}
            >
              {msLeft <= 0
                ? 'WINDOW EXPIRED — file manually with proof of delay'
                : `${formatCountdown(msLeft)} left to file`}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" icon={FileCheck2} onClick={onPrepare}>
            Prepare Claim
          </Button>
          <Segmented
            value={claim.status}
            onChange={onStatus}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'submitted', label: 'Sent' },
              { value: 'won', label: 'Won' },
              { value: 'lost', label: 'Lost' }
            ]}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            onClick={onDelete}
            aria-label="Delete claim"
          />
        </div>
      </div>
      {claim.notes && (
        <div className="mt-3 rounded-lg border border-line bg-ink-950/60 p-2.5 font-mono text-[11px] text-slate-400">
          {claim.notes}
        </div>
      )}
    </Card>
  );
}

export function ClaimRadarDashboard({ className }: { className?: string }) {
  const license = useLicense();
  const { openPaywall } = usePaywall();
  const toast = useToast();
  const claims = useClaims();
  const [selected, setSelected] = useState<ClaimItem | null>(null);

  const pending = claims.filter((c) => c.status === 'pending' || c.status === 'prepared');
  const expiring24h = pending.filter((c) => c.deadlineAt - Date.now() <= 24 * 3_600_000);
  const submitted = claims.filter((c) => c.status === 'submitted');
  const won = claims.filter((c) => c.status === 'won');
  const nearest = pending[0];

  if (!planHasFeature(license.plan, 'claimRadar')) {
    return (
      <div className={cn('space-y-6', className)}>
        <PageHeader
          icon={Radar}
          kicker="MODULE C · PRO UPGRADE"
          title="ClaimRadar Pro"
          subtitle="Return-dispute deadline tracking & 1-click evidence packaging"
        />
        <Card className="relative overflow-hidden">
          <div className="grid-bg absolute inset-0 opacity-50" />
          <div className="relative flex flex-col items-center px-6 py-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-danger-500/30 bg-danger-500/10 text-danger-300">
              <Radar className="h-8 w-8" />
            </div>
            <div className="mt-5 font-display text-2xl font-bold text-white">
              Never lose a return dispute to a missed deadline again
            </div>
            <div className="mt-2 max-w-lg text-sm text-slate-400">
              {pending.length > 0
                ? `You have ${pending.length} flagged return${pending.length > 1 ? 's' : ''} waiting — unlock ClaimRadar Pro to run the deadline radar and package the evidence.`
                : 'Flag a bad return in the AWB Recorder (F2) and it lands in this queue with a live countdown.'}
            </div>
            <ul className="mt-6 space-y-2 text-left text-sm text-slate-300">
              {[
                '72-hour Meesho SAFE / AJIO / Snapdeal countdown radar',
                '14-day Flipkart SPF & 30-day Amazon SAFE-T windows',
                'Dispatch-vs-return side-by-side video matcher',
                '1-click claim evidence packager with ready dispute text'
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-proof-400" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              variant="primary"
              size="xl"
              icon={Radar}
              className="mt-8"
              onClick={() => openPaywall({ scope: 'claimRadar', plan: 'claimradar' })}
            >
              Unlock ClaimRadar Pro — ₹4,499/yr{' '}
              <span className="ml-1 font-mono text-sm text-[#ffffff] font-bold line-through">
                ₹7,188
              </span>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <PageHeader
        icon={Radar}
        kicker="MODULE C · ACTIVE"
        title="ClaimRadar Pro"
        subtitle="Flagged returns, live deadline radar and evidence packaging"
      />

      {nearest && (
        <Card className="flex items-center gap-3 border-warn-500/40 p-4">
          <AlarmClock className="h-5 w-5 shrink-0 animate-rec-pulse text-warn-400" />
          <div className="min-w-0 flex-1 truncate font-mono text-sm text-slate-200">
            {nearest.awb} — {formatCountdown(nearest.deadlineAt - Date.now())} left to file{' '}
            <span className="text-slate-500">({claimWindowLabel(nearest.marketplace)})</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            iconRight={ChevronRight}
            onClick={() => setSelected(nearest)}
          >
            Prepare now
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          icon={Clock}
          label="Pending claims"
          value={pending.length}
          tone={pending.length > 0 ? 'danger' : 'proof'}
        />
        <StatCard
          icon={AlarmClock}
          label="Expiring within 24h"
          value={expiring24h.length}
          tone="warn"
        />
        <StatCard icon={Send} label="Submitted" value={submitted.length} tone="info" />
        <StatCard icon={Trophy} label="Won" value={won.length} tone="proof" />
      </div>

      {claims.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={Radar}
            title="No return claims in your radar"
            description="You haven't flagged any bad or damaged returns yet. When customer returns arrive, record their unboxing with Return Unboxing Mode turned on in the AWB Recorder. Press F2 (or click Flag Bad Return) on any damaged, swapped, or missing item to start tracking its deadline here."
            primaryAction={{
              label: 'Open AWB Recorder',
              onClick: () => {
                window.location.hash = '#recorder';
              },
              icon: Video
            }}
          >
            <div className="mt-4 rounded-xl border border-line bg-ink-900/60 p-4 text-left text-xs text-slate-300">
              <div className="font-semibold text-white">Marketplace dispute deadlines tracked:</div>
              <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-warn-400">72 hours:</span>
                  <span>Meesho SAFE &amp; AJIO / Snapdeal claim window</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-info-400">14 days:</span>
                  <span>Flipkart Seller Protection Fund (SPF) window</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-success-400">30 days:</span>
                  <span>Amazon SAFE-T claim reimbursement window</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-proof-400">Ready dossier:</span>
                  <span>1-click evidence packaging with side-by-side videos</span>
                </li>
              </ul>
            </div>
          </EmptyState>
        </Card>
      ) : (
        <Stagger className="space-y-4">
          {claims.map((claim) => (
            <StaggerItem key={claim.id}>
              <ClaimRow
                claim={claim}
                onPrepare={() => setSelected(claim)}
                onStatus={(status) => {
                  if (claim.id !== undefined) void updateClaimStatus(claim.id, status);
                  toast.success(`Claim marked ${status}`);
                }}
                onDelete={() => {
                  if (
                    claim.id !== undefined &&
                    window.confirm(`Delete the claim for ${claim.awb}?`)
                  ) {
                    void deleteClaim(claim.id);
                  }
                }}
              />
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <ClaimEvidenceModal claim={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

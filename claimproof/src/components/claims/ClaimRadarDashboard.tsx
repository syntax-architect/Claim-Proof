import { useEffect, useState } from 'react';
import {
  AlarmClock,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCheck2,
  FolderDown,
  IndianRupee,
  Info,
  Lock,
  Radar,
  RotateCcw,
  Send,
  Sliders,
  Trash2,
  TriangleAlert,
  Trophy,
  Video
} from 'lucide-react';
import {
  deleteClaim,
  recalculateClaimsForMarketplace,
  updateClaimReturnDeliveryDate,
  updateClaimStatus,
  useClaims
} from '../../services/claimEngine';
import { claimWindowLabel, isClaimWindowUnverified, UNVERIFIED_LABEL } from '../../lib/claimRules';
import {
  getClaimWindowHours,
  MARKETPLACE_CLAIM_WINDOWS,
  getCustomClaimWindows,
  saveCustomClaimWindowHours,
  resetSingleClaimWindow
} from '../../config/claimWindows';
import {
  deadlineTone,
  formatCountdown,
  formatIST,
  formatISTForInput,
  formatISTShort,
  parseISTDateTime
} from '../../lib/dateUtils';
import { downloadClaimIcs } from '../../lib/calendarExport';
import {
  getNotificationPermission,
  requestClaimNotificationPermission
} from '../../lib/claimNotifications';
import { formatPaise } from '../../lib/money';
import { navigateTo } from '../../lib/router';
import { planHasFeature, useLicense } from '../../services/licenseService';
import { usePaywall } from '../../providers/PaywallProvider';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  PageHeader,
  Ring,
  Segmented,
  StatCard,
  Stagger,
  StaggerItem,
  useToast
} from '../ui';
import type { ClaimItem, ClaimStatus, Marketplace } from '../../types';
import { cn } from '../../lib/utils';
import { isFeatureEnabled } from '../../config/featureFlags';
import { ClaimEvidenceModal } from './ClaimEvidenceModal';
import { ClaimKitModal } from './ClaimKitModal';

function EditDeliveryDateModal({
  claim,
  onClose
}: {
  claim: ClaimItem | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [val, setVal] = useState('');
  useEffect(() => {
    if (claim) {
      setVal(formatISTForInput(claim.returnScanAt));
    }
  }, [claim]);

  if (!claim) return null;

  const hours = getClaimWindowHours(claim.marketplace);
  const parsedMs = parseISTDateTime(val);
  const calculatedDeadline = parsedMs + hours * 3_600_000;
  const isPastExpired = calculatedDeadline < Date.now();
  const isFuture = parsedMs > Date.now();

  const handleSave = async () => {
    if (claim.id === undefined) return;
    await updateClaimReturnDeliveryDate(claim.id, parsedMs, claim.marketplace);
    toast.success(
      'Return delivery date updated',
      `Deadline recalculated in IST: ${formatIST(calculatedDeadline)}.`
    );
    onClose();
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={`Edit Return Delivery Date — ${claim.awb}`}
      subtitle={`${claim.marketplace} claim window: ${hours} hours from delivery`}
      icon={Clock}
    >
      <div className="space-y-4">
        <div>
          <label
            htmlFor="return-delivery-date"
            className="block text-xs font-semibold text-slate-300"
          >
            Return Delivery Date &amp; Time (IST)
            <input
              id="return-delivery-date"
              type="datetime-local"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-line bg-ink-950 px-3 py-2 font-mono text-sm text-white focus:border-proof-500 focus:outline-none"
            />
          </label>
          <div className="mt-1 text-[11px] text-slate-500">
            Recorded in Indian Standard Time (IST, UTC+05:30).
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-line bg-ink-900/60 p-4 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Marketplace Window:</span>
            <span className="font-mono font-bold text-white">
              {hours} hours ({claim.marketplace})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Calculated Deadline:</span>
            <span className="font-mono font-bold text-proof-300">
              {formatIST(calculatedDeadline)}
            </span>
          </div>
        </div>

        {isPastExpired && (
          <div className="flex items-start gap-2 rounded-xl border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-300">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              <strong>Window expired:</strong> The entered return delivery date means the dispute
              deadline closed on {formatIST(calculatedDeadline)}. You will need to file manually with
              carrier proof of delivery delay.
            </span>
          </div>
        )}

        {isFuture && (
          <div className="flex items-start gap-2 rounded-xl border border-warn-500/30 bg-warn-500/10 p-3 text-xs text-warn-300">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              <strong>Future timestamp:</strong> The return delivery date is set in the future
              relative to this device&apos;s current clock.
            </span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={() => void handleSave()}>
            Save &amp; Recalculate
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function NotificationExplainerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [permission, setPermission] = useState(getNotificationPermission());

  if (!open) return null;

  const handleEnable = async () => {
    try {
      const result = await requestClaimNotificationPermission();
      setPermission(result);
      if (result === 'granted') {
        toast.success(
          'Dispute notifications enabled',
          'You will receive desktop alerts 24h and 6h before deadlines.'
        );
        onClose();
      } else {
        toast.warn(
          'Notification permission not granted',
          'You can enable it in your browser address bar.'
        );
      }
    } catch (err: unknown) {
      toast.error(
        'Could not request notifications',
        err instanceof Error ? err.message : String(err)
      );
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Dispute Deadline Notifications"
      subtitle="Never lose ₹ to a missed return dispute deadline"
      icon={Bell}
    >
      <div className="space-y-4 text-xs text-slate-300 sm:text-sm">
        <p className="leading-relaxed">
          Enable optional desktop browser notifications to receive high-priority alerts:
        </p>
        <ul className="space-y-2 rounded-xl border border-line bg-ink-900/60 p-4 font-mono text-xs text-slate-300">
          <li className="flex items-center gap-2">
            <span className="font-bold text-warn-400">24 hours remaining:</span>
            <span>Reminder to prepare claim kit and videos</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="font-bold text-danger-400">6 hours remaining:</span>
            <span>Urgent final reminder before dispute portal closes</span>
          </li>
        </ul>
        <div className="flex items-start gap-2 rounded-xl border border-proof-500/30 bg-proof-500/10 p-3 text-xs text-proof-300">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            <strong>Local &amp; Private:</strong> Notifications are generated directly by your
            browser on this device. Zero cloud servers, zero trackers, and zero marketing promotions.
          </span>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Not Now
          </Button>
          <Button variant="primary" size="sm" onClick={() => void handleEnable()}>
            {permission === 'granted' ? 'Notifications Active' : 'Enable Notifications'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EditClaimWindowsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [customWindows, setCustomWindows] = useState<Partial<Record<Marketplace, number>>>(() =>
    getCustomClaimWindows()
  );

  if (!open) return null;

  const marketplaces: Marketplace[] = [
    'Meesho',
    'Flipkart',
    'Amazon',
    'AJIO',
    'Snapdeal',
    'Myntra',
    'GlowRoad'
  ];

  const handleChange = (m: Marketplace, valStr: string) => {
    const prevHours = customWindows[m] ?? MARKETPLACE_CLAIM_WINDOWS[m]?.hours ?? 72;
    const val = Math.max(1, Math.min(2160, Number(valStr) || 1));
    saveCustomClaimWindowHours(m, val);
    setCustomWindows((prev) => ({ ...prev, [m]: val }));
    void recalculateClaimsForMarketplace(m, val, prevHours);
    toast.success(
      'Window updated',
      `${MARKETPLACE_CLAIM_WINDOWS[m]?.displayName || m} set to ${val} hours.`
    );
  };

  const handleReset = (m: Marketplace) => {
    const prevHours = customWindows[m] ?? MARKETPLACE_CLAIM_WINDOWS[m]?.hours ?? 72;
    resetSingleClaimWindow(m);
    setCustomWindows((prev) => {
      const next = { ...prev };
      delete next[m];
      return next;
    });
    const defaultHours = MARKETPLACE_CLAIM_WINDOWS[m]?.hours ?? 72;
    void recalculateClaimsForMarketplace(m, defaultHours, prevHours);
    toast.info(
      'Window reset',
      `${MARKETPLACE_CLAIM_WINDOWS[m]?.displayName || m} restored to default.`
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Marketplace Claim Windows"
      subtitle="Customize dispute filing deadlines based on your seller panel rubrics"
      icon={Sliders}
      width="lg"
    >
      <div className="space-y-4">
        <div className="divide-y divide-line rounded-xl border border-line bg-ink-900/60">
          {marketplaces.map((m) => {
            const config = MARKETPLACE_CLAIM_WINDOWS[m];
            const currentHours = customWindows[m] ?? config.hours;
            const isCustom = typeof customWindows[m] === 'number';
            const unverified = isClaimWindowUnverified(m);

            return (
              <div
                key={m}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">{config.displayName}</span>
                    {unverified && (
                      <Badge tone="warn" title="Unconfirmed dispute deadline — check seller panel">
                        {UNVERIFIED_LABEL}
                      </Badge>
                    )}
                    {isCustom && <Badge tone="info">Customized</Badge>}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                    <span>Default: {config.defaultHours}h</span>
                    {config.sourceUrl && (
                      <a
                        href={config.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-proof-300 underline hover:text-proof-200"
                      >
                        Official policy <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={2160}
                      value={currentHours}
                      onChange={(e) => handleChange(m, e.target.value)}
                      className="w-20 rounded-lg border border-line bg-ink-950 px-2.5 py-1 text-center font-mono text-sm text-white focus:border-proof-500 focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">hours</span>
                  </div>
                  {isCustom && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={RotateCcw}
                      title="Reset to marketplace default"
                      aria-label={`Reset ${config.displayName} to default`}
                      onClick={() => handleReset(m)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ClaimRow({
  claim,
  onPrepare,
  onClaimKit,
  onEditDate,
  onStatus,
  onDelete
}: {
  claim: ClaimItem;
  onPrepare: () => void;
  onClaimKit?: () => void;
  onEditDate?: () => void;
  onStatus: (s: ClaimStatus) => void;
  onDelete: () => void;
}) {
  const toast = useToast();
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
              {isClaimWindowUnverified(claim.marketplace) && (
                <Badge tone="warn" title="Unconfirmed dispute deadline — check seller panel">
                  {UNVERIFIED_LABEL}
                </Badge>
              )}
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
              {claim.amountClaimedPaise !== undefined && claim.amountClaimedPaise > 0 && (
                <span className="ml-2 font-bold text-slate-300">
                  · Claimed: {formatPaise(claim.amountClaimedPaise)}
                  {claim.amountRecoveredPaise !== undefined && claim.amountRecoveredPaise > 0 && (
                    <span className="text-proof-300 ml-1">
                      (Recovered: {formatPaise(claim.amountRecoveredPaise)})
                    </span>
                  )}
                </span>
              )}
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
          {isFeatureEnabled('claimKitBuilder') && (
            <Button
              variant="secondary"
              size="sm"
              icon={FolderDown}
              onClick={onClaimKit}
              title="Generate 1-Click Claim Kit (Videos, PDF Dossier, Dispute Text)"
            >
              1-Click Kit
            </Button>
          )}
          <Button variant="primary" size="sm" icon={FileCheck2} onClick={onPrepare}>
            Prepare Claim
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={Calendar}
            title="Export dispute deadline to calendar (.ics)"
            aria-label="Export dispute deadline to calendar (.ics)"
            onClick={() => {
              downloadClaimIcs(claim);
              toast.success(
                'Calendar file (.ics) downloaded',
                'Dispute deadline added to calendar.'
              );
            }}
          >
            .ics
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={Clock}
            title="Edit return delivery date & recalculate deadline"
            aria-label="Edit return delivery date & recalculate deadline"
            onClick={onEditDate}
          >
            Edit Date
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
  const [kitClaim, setKitClaim] = useState<ClaimItem | null>(null);
  const [editingDateClaim, setEditingDateClaim] = useState<ClaimItem | null>(null);
  const [showWindowsModal, setShowWindowsModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

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
          kicker="MODULE C"
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
              <span className="ml-1 font-mono text-sm text-on-accent font-bold line-through">
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
        kicker="MODULE C"
        title="ClaimRadar Pro"
        subtitle="Flagged returns, live deadline radar and evidence packaging"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Bell}
              onClick={() => setShowNotificationsModal(true)}
              aria-label="Dispute notifications"
            >
              Reminders
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Sliders}
              onClick={() => setShowWindowsModal(true)}
              aria-label="Marketplace claim windows"
            >
              Claim Windows
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={IndianRupee}
              onClick={() => navigateTo('money')}
              aria-label="Open Money Ledger"
            >
              Money Ledger
            </Button>
          </div>
        }
      />

      {nearest && (
        <Card className="flex items-center gap-3 border-warn-500/40 p-4">
          <AlarmClock className="h-5 w-5 shrink-0 animate-rec-pulse text-warn-400" />
          <div className="min-w-0 flex-1 truncate font-mono text-sm text-slate-200">
            {nearest.awb} — {formatCountdown(nearest.deadlineAt - Date.now())} left to file{' '}
            <span className="text-slate-500">({claimWindowLabel(nearest.marketplace)})</span>
            {isClaimWindowUnverified(nearest.marketplace) && (
              <Badge tone="warn" className="ml-2">
                {UNVERIFIED_LABEL}
              </Badge>
            )}
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
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">
                  Marketplace dispute deadlines tracked:
                </span>
                <span className="font-mono text-[10px] text-warn-300">
                  Default windows UNVERIFIED — edit in Settings
                </span>
              </div>
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
                onClaimKit={() => setKitClaim(claim)}
                onEditDate={() => setEditingDateClaim(claim)}
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
      <ClaimKitModal claim={kitClaim} open={kitClaim !== null} onClose={() => setKitClaim(null)} />
      <EditDeliveryDateModal claim={editingDateClaim} onClose={() => setEditingDateClaim(null)} />
      <NotificationExplainerModal
        open={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
      />
      <EditClaimWindowsModal open={showWindowsModal} onClose={() => setShowWindowsModal(false)} />
    </div>
  );
}

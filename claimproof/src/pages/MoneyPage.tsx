import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertCircle, CheckCircle2, HelpCircle, IndianRupee, Percent, Plus } from 'lucide-react';
import { db, getSetting, setSetting } from '../db/schema';
import { formatPaise, paiseToRupees } from '../lib/money';
import {
  computeLedgerTotals,
  computePlanRoi,
  filterClaimsByDate,
  validateRupeeAmount,
  type LedgerDateFilter
} from '../services/ledgerService';
import {
  Badge,
  Button,
  Card,
  Modal,
  PageHeader,
  ProgressBar,
  Segmented,
  StatCard,
  useToast
} from '../components/ui';
import type { Route } from '../lib/router';
import { ClaimsLedgerTable } from '../components/claims/ClaimsLedgerTable';
import { ClaimEditModal } from '../components/claims/ClaimEditModal';

const USER_PLAN_COST_KEY = 'userPlanCostPaise';
const STORAGE_PLAN_COST_KEY = 'saboot_user_plan_cost_paise';

export default function MoneyPage({ navigate: _navigate }: { navigate?: (route: Route) => void }) {
  const toast = useToast();
  const [dateFilter, setDateFilter] = useState<LedgerDateFilter>('all');
  const [userPlanCostPaise, setUserPlanCostPaise] = useState<number | null>(null);
  const [isPlanCostModalOpen, setIsPlanCostModalOpen] = useState(false);
  const [planCostInputRupees, setPlanCostInputRupees] = useState('');
  const [planCostError, setPlanCostError] = useState<string | null>(null);
  const [isNewClaimOpen, setIsNewClaimOpen] = useState(false);

  // Load claims live from Dexie
  const claims = useLiveQuery(() => db.claims.toArray(), [], []) ?? [];

  // Load user-entered plan cost
  useEffect(() => {
    async function loadPlanCost() {
      try {
        const storedLocal = localStorage.getItem(STORAGE_PLAN_COST_KEY);
        if (storedLocal !== null) {
          setUserPlanCostPaise(Number(storedLocal));
          return;
        }
        const dbSetting = await getSetting<number | null>(USER_PLAN_COST_KEY, null);
        if (dbSetting !== null) {
          setUserPlanCostPaise(dbSetting);
        }
      } catch {
        // Fallback to null
      }
    }
    void loadPlanCost();
  }, []);

  const handleSavePlanCost = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlanCostError(null);

    const val = validateRupeeAmount(planCostInputRupees, 'Plan cost');
    if (!val.valid) {
      setPlanCostError(val.error || 'Invalid amount.');
      return;
    }

    try {
      localStorage.setItem(STORAGE_PLAN_COST_KEY, String(val.paise));
      await setSetting(USER_PLAN_COST_KEY, val.paise);
      setUserPlanCostPaise(val.paise);
      setIsPlanCostModalOpen(false);
      toast.success(
        val.paise > 0
          ? `Plan cost updated to ${formatPaise(val.paise)}.`
          : 'Plan cost meter cleared.'
      );
    } catch {
      setPlanCostError('Failed to save plan cost. Please try again.');
    }
  };

  // Filter claims based on date filter
  const filteredClaims = filterClaimsByDate(claims, dateFilter);
  const totals = computeLedgerTotals(filteredClaims);

  // Meter comparing recovered amount to user plan cost
  const planRoi = computePlanRoi(totals.totalRecoveredPaise, userPlanCostPaise);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={IndianRupee}
        title="Money & Claims Ledger"
        subtitle="Track marketplace return disputes, rupee recoveries, and software ROI, computed exclusively from your own data."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={IndianRupee}
              onClick={() => {
                setPlanCostInputRupees(
                  userPlanCostPaise ? String(paiseToRupees(userPlanCostPaise)) : ''
                );
                setPlanCostError(null);
                setIsPlanCostModalOpen(true);
              }}
              aria-label="Set or update plan cost"
            >
              {userPlanCostPaise && userPlanCostPaise > 0 ? 'Edit Plan Cost' : 'Enter Plan Cost'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setIsNewClaimOpen(true)}
              aria-label="Log new dispute claim"
            >
              Log Claim
            </Button>
          </div>
        }
      />

      {/* Date Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-ink-900/60 p-3 backdrop-blur-xl">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Filter by Date (IST):
        </div>
        <Segmented<LedgerDateFilter>
          value={dateFilter}
          onChange={setDateFilter}
          options={[
            { value: 'all', label: 'All Time' },
            { value: 'today', label: 'Today' },
            { value: 'last7', label: 'Last 7 Days' },
            { value: 'last30', label: 'Last 30 Days' },
            { value: 'thisMonth', label: 'This Month' }
          ]}
        />
      </div>

      {/* "Plan has paid for itself" Meter (Hidden if no data / no cost entered) */}
      {planRoi && (
        <Card
          className={`p-5 border transition-all ${
            planRoi.paidForItself
              ? 'border-proof-500/40 bg-proof-500/10'
              : 'border-line bg-ink-900/60'
          }`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-2 font-display text-base font-bold text-white">
                  {planRoi.paidForItself && (
                    <CheckCircle2 className="h-4.5 w-4.5 text-proof-400" aria-hidden="true" />
                  )}
                  {planRoi.paidForItself
                    ? 'Your plan has paid for itself!'
                    : 'Plan Breakeven Meter'}
                </span>
                <Badge tone={planRoi.paidForItself ? 'proof' : 'neutral'}>
                  {planRoi.ratioPercent}% ROI
                </Badge>
              </div>
              <p className="text-xs text-slate-300">
                {planRoi.paidForItself ? (
                  <>
                    You recovered{' '}
                    <span className="font-bold text-proof-300">
                      {formatPaise(planRoi.totalRecoveredPaise)}
                    </span>{' '}
                    against your{' '}
                    <span className="font-bold text-slate-200">
                      {formatPaise(planRoi.planCostPaise)}
                    </span>{' '}
                    plan cost (
                    <span className="text-proof-400 font-bold">
                      +{formatPaise(planRoi.netGainPaise)}
                    </span>{' '}
                    net gain).
                  </>
                ) : (
                  <>
                    Recovered{' '}
                    <span className="font-bold text-proof-300">
                      {formatPaise(planRoi.totalRecoveredPaise)}
                    </span>{' '}
                    of{' '}
                    <span className="font-bold text-slate-200">
                      {formatPaise(planRoi.planCostPaise)}
                    </span>{' '}
                    plan cost ({formatPaise(planRoi.remainingPaise)} left to break even).
                  </>
                )}
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPlanCostInputRupees(String(paiseToRupees(planRoi.planCostPaise)));
                setPlanCostError(null);
                setIsPlanCostModalOpen(true);
              }}
              className="self-start sm:self-auto text-xs"
            >
              Update Cost
            </Button>
          </div>

          <div className="mt-3">
            <ProgressBar
              value={planRoi.totalRecoveredPaise}
              max={planRoi.planCostPaise}
              tone={planRoi.paidForItself ? 'proof' : 'warn'}
            />
          </div>
        </Card>
      )}

      {/* Key Metric Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {/* Total Recovered */}
        <StatCard
          icon={IndianRupee}
          label="Total Recovered"
          value={formatPaise(totals.totalRecoveredPaise)}
          sub="Cash recovered from claims"
          tone="proof"
        />

        {/* Claims Filed */}
        <Card className="p-4 flex flex-col justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Claims Filed
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-white mono-tabular">
            {totals.claimsFiled.count}
          </div>
          <div className="mt-1 font-mono text-[11px] text-slate-400 mono-tabular">
            Claimed: {formatPaise(totals.claimsFiled.claimedPaise)}
          </div>
        </Card>

        {/* Claims Won */}
        <Card className="p-4 flex flex-col justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-proof-400">
            Claims Won
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-proof-300 mono-tabular">
            {totals.claimsWon.count}
          </div>
          <div className="mt-1 font-mono text-[11px] text-proof-400/90 mono-tabular">
            Won: {formatPaise(totals.claimsWon.recoveredPaise)}
          </div>
        </Card>

        {/* Partly Won */}
        <Card className="p-4 flex flex-col justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-warn-400">
            Partly Won
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-warn-300 mono-tabular">
            {totals.claimsPartlyWon.count}
          </div>
          <div className="mt-1 font-mono text-[11px] text-warn-400/90 mono-tabular">
            Partial: {formatPaise(totals.claimsPartlyWon.recoveredPaise)}
          </div>
        </Card>

        {/* Claims Lost */}
        <Card className="p-4 flex flex-col justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-danger-400">
            Claims Lost
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-danger-300 mono-tabular">
            {totals.claimsLost.count}
          </div>
          <div className="mt-1 font-mono text-[11px] text-slate-500 mono-tabular">
            Lost: {formatPaise(totals.claimsLost.claimedPaise)}
          </div>
        </Card>

        {/* Pending / Not Filed */}
        <Card className="p-4 flex flex-col justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Not Filed / Pending
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-300 mono-tabular">
            {totals.claimsPending.count}
          </div>
          <div className="mt-1 font-mono text-[11px] text-slate-500 mono-tabular">
            Pending: {formatPaise(totals.claimsPending.claimedPaise)}
          </div>
        </Card>
      </div>

      {/* Dispute Success Rate Banner (Strictly gated by 10 resolved claims rule) */}
      <Card className="p-4 border border-line bg-ink-950/70">
        {totals.hasEnoughDataForPercentage ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-proof-500/15 border border-proof-500/30 text-proof-300">
                <Percent className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-proof-400">
                  Your Own Results
                </div>
                <div className="text-sm font-semibold text-white">
                  <span className="font-bold text-proof-300 font-mono text-base">
                    {totals.winRatePercent}%
                  </span>{' '}
                  dispute success rate across {totals.resolvedCount} resolved claims (
                  <span className="font-bold text-proof-300 font-mono">
                    {totals.recoveryRatePercent}%
                  </span>{' '}
                  of claimed value recovered)
                </div>
              </div>
            </div>
            <Badge tone="proof">Computed from your device data</Badge>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <HelpCircle className="h-4 w-4 shrink-0 text-slate-500" />
            <div>
              <span className="font-semibold text-slate-300">
                Percentage statistics unlock after 10 resolved claims
              </span>{' '}
              (currently {totals.resolvedCount}/10 resolved). Showing exact counts and rupee totals
              only to prevent skewed early statistics.
            </div>
          </div>
        )}
      </Card>

      {/* Ledger Table Component */}
      <ClaimsLedgerTable claims={filteredClaims} />

      {/* Quick Add Modal */}
      <ClaimEditModal open={isNewClaimOpen} onClose={() => setIsNewClaimOpen(false)} claim={null} />

      {/* Plan Cost Configuration Modal */}
      <Modal
        open={isPlanCostModalOpen}
        onClose={() => setIsPlanCostModalOpen(false)}
        title="Set Your Software Plan Cost"
        subtitle="Track when SABOOT pays for itself by comparing recovered dispute revenue to what you paid."
        icon={IndianRupee}
        width="md"
      >
        <form onSubmit={handleSavePlanCost} className="space-y-4">
          {planCostError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-danger-500/40 bg-danger-500/10 p-3 text-xs text-danger-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-danger-400 mt-0.5" />
              <div>{planCostError}</div>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="plan-cost-input"
              className="text-xs font-semibold uppercase tracking-wider text-slate-400"
            >
              What did you pay for your plan? (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-slate-500">
                ₹
              </span>
              <input
                id="plan-cost-input"
                type="number"
                min="0"
                step="any"
                value={planCostInputRupees}
                onChange={(e) => setPlanCostInputRupees(e.target.value)}
                placeholder="e.g. 4499"
                aria-label="Plan cost in rupees"
                className="w-full rounded-xl border border-line bg-ink-900 pl-8 pr-3.5 py-2 font-mono text-sm text-white focus:border-proof-400 focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              e.g. ₹349 for monthly Starter Station, ₹4,499 for annual ClaimRadar Pro. Stored
              strictly on your device. Enter 0 to hide the meter.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
            <Button type="button" variant="ghost" onClick={() => setIsPlanCostModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" aria-label="Save plan cost">
              Save Plan Cost
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

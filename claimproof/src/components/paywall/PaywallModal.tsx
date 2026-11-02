/* PaywallModal — Simplified launch checkout surface for the SABOOT Suite.
 * Flow:
 * 1. Pick interval & plan (single source of truth: src/config/plans.ts).
 * 2. "Buy" button opens Razorpay Payment Link in a new tab.
 * 3. Customer receives license key and enters it in the "Enter license key" box.
 * 4. Verified on-device by licenseService (ES256, offline) with soft device binding.
 */

import { motion } from 'framer-motion';
import { BRAND } from '../../config/brand';
import {
  AlertTriangle,
  Check,
  Crop,
  ExternalLink,
  KeyRound,
  Radar,
  Receipt,
  ShieldCheck,
  Sparkles,
  Warehouse,
  type LucideIcon
} from 'lucide-react';
import { useEffect, useState, type JSX } from 'react';
import { usePaywall } from '../../providers/PaywallProvider';
import { activateDemoPlan, verifyAndActivateToken } from '../../services/licenseService';
import { cn, formatRupees } from '../../lib/utils';
import { getPaymentUrl, PLANS } from '../../config/plans';
import { trackEvent } from '../../services/telemetry';
import { Badge, Button, Field, Modal, useToast } from '../ui';
import type { BillingInterval, PlanId } from '../../types';

const PLAN_ICONS: Record<PlanId, LucideIcon> = {
  starter: Crop,
  claimradar: Radar,
  warehouse: Warehouse
};

export function PaywallModal(): JSX.Element {
  const ctx = usePaywall();
  const toast = useToast();

  const [interval, setInterval] = useState<BillingInterval>('annual');
  const [selected, setSelected] = useState<PlanId>(() => ctx.request?.plan ?? 'claimradar');
  const [token, setToken] = useState('');
  const [activating, setActivating] = useState(false);
  const [movePrompt, setMovePrompt] = useState<string | null>(null);

  // A module can request a specific plan when raising the paywall.
  useEffect(() => {
    if (ctx.open && ctx.request?.plan) setSelected(ctx.request.plan);
  }, [ctx.open, ctx.request]);

  // Track paywall view
  useEffect(() => {
    if (ctx.open) {
      void trackEvent('paywall_viewed', { plan: selected, interval });
    }
  }, [ctx.open, selected, interval]);

  // Clear sensitive transient state between openings.
  useEffect(() => {
    if (!ctx.open) {
      setToken('');
      setActivating(false);
      setMovePrompt(null);
    }
  }, [ctx.open]);

  const selectedPlan = PLANS.find((p) => p.id === selected) ?? PLANS[1];
  const payableAmount =
    interval === 'annual' ? selectedPlan.annualPrice : selectedPlan.monthlyPrice;

  const handleBuy = () => {
    void trackEvent('purchase_started', { plan: selected, interval });
    const url = getPaymentUrl(selected, interval);
    window.open(url, '_blank', 'noopener,noreferrer');
    toast.info(
      'Razorpay checkout opened',
      'Complete payment in the new tab. You will receive an offline license key to activate below.'
    );
  };

  const activate = async (opts?: { moveDevice?: boolean }) => {
    const t = token.trim();
    if (!t) {
      toast.warn('Enter license key', 'Paste the key you received after completing payment.');
      return;
    }
    setActivating(true);
    try {
      const res = await verifyAndActivateToken(t, opts);
      if (res.ok) {
        toast.success(
          opts?.moveDevice ? 'License moved to this device' : 'License activated successfully!'
        );
        ctx.closePaywall();
      } else {
        if (res.canMove) {
          setMovePrompt(res.error ?? 'Device mismatch');
        } else {
          setMovePrompt(null);
        }
        toast.error('Activation failed', res.error ?? 'Invalid license token');
      }
    } catch {
      toast.error('Activation failed', 'The token could not be verified on this device.');
    } finally {
      setActivating(false);
    }
  };

  // Testing path — clearly labeled, activates a local demo license without payment (DEV ONLY).
  const startDemo = async () => {
    if (!import.meta.env.DEV || !activateDemoPlan) return;
    try {
      await activateDemoPlan(selected);
      toast.info('Demo license activated');
      ctx.closePaywall();
    } catch {
      toast.error('Demo activation failed');
    }
  };

  return (
    <Modal
      open={ctx.open}
      onClose={ctx.closePaywall}
      icon={ShieldCheck}
      title={`Unlock ${BRAND.name} Suite`}
      subtitle="Designed for Indian marketplace sellers · Direct Razorpay checkout · Verified offline with zero server downtime"
      width="xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-proof-400" />
            Offline-first: your license is verified on-device via an ES256 signature. No account
            required.
          </div>
          {import.meta.env.DEV && (
            <div className="flex items-center gap-2.5">
              <Badge tone="outline">TEST ONLY</Badge>
              <button
                type="button"
                onClick={startDemo}
                className="text-xs text-slate-500 underline decoration-line-bright underline-offset-4 transition-colors hover:text-proof-300"
              >
                Try without paying (demo license)
              </button>
            </div>
          )}
        </div>
      }
    >
      {ctx.request?.reason && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-warn-500/30 bg-warn-500/10 px-4 py-3 text-sm text-warn-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{ctx.request.reason}</span>
        </div>
      )}

      {/* ── Billing interval toggle ── */}
      <div className="mb-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
        <div className="inline-flex rounded-xl border border-line bg-ink-900/80 p-1">
          <button
            type="button"
            onClick={() => setInterval('monthly')}
            className={cn(
              'rounded-lg px-4 py-1.5 text-xs font-semibold transition-all',
              interval === 'monthly'
                ? 'bg-ink-800 text-white shadow-sm ring-1 ring-line-bright'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            onClick={() => setInterval('annual')}
            className={cn(
              'relative flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all',
              interval === 'annual'
                ? 'bg-proof-500/20 text-proof-200 shadow-sm ring-1 ring-proof-400/50'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-proof-400" />
            <span>Annual Pass</span>
            <span className="rounded bg-proof-500/30 px-1.5 py-0.5 text-[10px] font-bold text-proof-300">
              SAVE UP TO 40%
            </span>
          </button>
        </div>
        <div className="text-center text-xs text-slate-400">
          {interval === 'annual' ? (
            <span className="text-proof-300 font-medium">
              ★ Best value for Indian sellers: 4 months free + instant offline license key
            </span>
          ) : (
            <span>Recurring monthly billing · cancel anytime</span>
          )}
        </div>
      </div>

      {/* ── Value anchor banner ── */}
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-proof-500/20 bg-proof-500/5 px-4 py-2.5 text-xs text-slate-300">
        <Receipt className="h-4 w-4 shrink-0 text-proof-400" />
        <div className="flex-1">
          <strong className="text-white">One recovered return covers your entire cost:</strong>{' '}
          Recovering just one ₹500–₹1,200 wrongful return on Meesho, Flipkart, or Amazon pays for
          months of {BRAND.name}!
        </div>
        <Badge tone="proof" className="shrink-0 text-[10px]">
          18% GST ITC Available
        </Badge>
      </div>

      {/* ── Plan cards ── */}
      <div className="grid gap-4 pt-1 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isSelected = plan.id === selected;
          const displayPrice = interval === 'annual' ? plan.annualPrice : plan.monthlyPrice;
          const strikePrice = interval === 'annual' ? plan.annualStrike : undefined;
          const monthlyEquivalent =
            interval === 'annual' ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice;
          const Icon = PLAN_ICONS[plan.id] ?? Crop;

          return (
            <button
              key={plan.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelected(plan.id)}
              className={cn(
                'glass group relative flex flex-col p-5 text-left transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proof-500/60',
                'hover:-translate-y-0.5',
                plan.best &&
                  'md:-translate-y-1.5 md:shadow-[0_18px_44px_-22px_color-mix(in_srgb,var(--cp-accentsolid)_55%,transparent)]',
                isSelected
                  ? 'ring-2 ring-proof-400/80 bg-ink-850/90'
                  : plan.best
                    ? 'ring-1 ring-proof-500/50'
                    : ''
              )}
            >
              {plan.tag && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <Badge tone="proof" className="uppercase tracking-[0.14em]">
                    {plan.tag}
                  </Badge>
                </div>
              )}
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-ink-800 text-proof-300">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="font-display text-[15px] font-bold leading-tight text-white">
                  {plan.name}
                </div>
              </div>
              <div className="mt-2 min-h-[2.5rem] text-xs leading-relaxed text-slate-400">
                {plan.tagline}
              </div>

              <div className="mt-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-2xl font-bold text-white mono-tabular">
                    {formatRupees(displayPrice)}
                  </span>
                  <span className="text-xs text-slate-400 font-sans">
                    / {interval === 'annual' ? 'year' : 'month'}
                  </span>
                  {strikePrice && (
                    <span className="font-mono text-xs text-slate-500 line-through mono-tabular ml-auto">
                      {formatRupees(strikePrice)}
                    </span>
                  )}
                </div>

                {interval === 'annual' ? (
                  <div className="mt-1 flex items-center justify-between text-[11px] text-proof-300 font-medium">
                    <span>
                      ₹{monthlyEquivalent}/mo (₹{plan.dailyAnnualCost}/day)
                    </span>
                    <span className="rounded bg-proof-500/20 px-1 text-[10px] text-proof-300">
                      Save {plan.annualSavingsPercent}%
                    </span>
                  </div>
                ) : (
                  <div className="mt-1 text-[11px] text-slate-500">
                    Billed monthly · cancel anytime
                  </div>
                )}
              </div>

              <ul className="mt-4 flex-1 space-y-2 border-t border-line/60 pt-3">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-[12px] leading-snug text-slate-300"
                  >
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-proof-400" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div
                className={cn(
                  'mt-5 inline-flex h-9 items-center justify-center rounded-xl border text-[13px] font-semibold transition-colors',
                  isSelected
                    ? 'border-proof-400/70 bg-proof-500/20 text-proof-200'
                    : 'border-line-bright text-slate-300 group-hover:border-proof-500/40 group-hover:text-proof-300'
                )}
              >
                {isSelected ? '✓ Selected' : 'Select plan'}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Buy via Razorpay + Activation panel ── */}
      <motion.div
        key={`${selected}-${interval}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="glass mt-5 p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Step 1 · Complete Payment
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold tracking-tight text-white">
                {selectedPlan.name} · {formatRupees(payableAmount)}
              </span>
              <span className="text-xs text-slate-400">
                ({interval === 'annual' ? 'Annual Pass — 12 Months' : 'Monthly Subscription'})
              </span>
            </div>
          </div>
          <Button
            size="lg"
            variant="primary"
            icon={ExternalLink}
            onClick={handleBuy}
            className="w-full sm:w-auto"
          >
            Buy {selectedPlan.name} via Razorpay
          </Button>
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Step 2 · Enter License Key
          </div>
          <p className="mt-1 text-xs text-slate-400">
            After completing payment, you will receive your signed offline license key. Paste it
            below to unlock on this workstation:
          </p>

          <div className="mt-3">
            <Field label="License key">
              <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                <input
                  aria-label="License key"
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    if (movePrompt) setMovePrompt(null);
                  }}
                  placeholder="eyJhbGciOiJFUzI1NiIs…"
                  spellCheck={false}
                  autoComplete="off"
                  className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-ink-850 px-3.5 font-mono text-[13px] text-slate-100 placeholder:text-slate-600 focus:border-proof-500/60 focus:outline-none focus:ring-2 focus:ring-proof-500/25"
                />
                <Button
                  variant="primary"
                  icon={KeyRound}
                  loading={activating}
                  onClick={() => void activate()}
                  className="h-10"
                >
                  Activate License
                </Button>
              </div>
            </Field>

            {movePrompt && (
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-warn-500/40 bg-warn-500/10 p-3.5 text-xs text-warn-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warn-400" />
                  <span>{movePrompt}</span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  loading={activating}
                  onClick={() => void activate({ moveDevice: true })}
                >
                  Move license to this device
                </Button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </Modal>
  );
}

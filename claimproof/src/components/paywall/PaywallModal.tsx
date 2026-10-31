/* PaywallModal — the single UPI checkout surface for the ClaimProof Suite.
 * Raised from anywhere via usePaywall().openPaywall({ reason, plan }).
 * Flow: pick interval & plan → scan UPI QR / open UPI app → paste the signed
 * activation token → verified on-device by licenseService (ES256, offline).
 */

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BadgePercent,
  Check,
  Copy,
  Crop,
  FileCheck,
  KeyRound,
  QrCode,
  Radar,
  Receipt,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Warehouse,
  type LucideIcon
} from 'lucide-react';
import { useEffect, useMemo, useState, type JSX } from 'react';
import { usePaywall } from '../../providers/PaywallProvider';
import { activateDemoPlan, verifyAndActivateToken } from '../../services/licenseService';
import { cn, formatRupees } from '../../lib/utils';
import { CLAIMPROOF_VPA, buildUpiIntent, renderUpiQr } from '../../lib/upi';
import { Badge, Button, Field, Modal, Spinner, useToast } from '../ui';
import type { BillingInterval, PlanId } from '../../types';

interface PlanDefinition {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  annualStrikePrice: number;
  monthlyStrikePrice?: number;
  dailyAnnualCost: number;
  annualSavingsPercent: number;
  features: string[];
  icon: LucideIcon;
  popular?: boolean;
}

const PLANS: PlanDefinition[] = [
  {
    id: 'starter',
    name: 'Starter Station',
    tagline: 'Unlimited label cropping & barcode packing videos for 1 workstation',
    monthlyPrice: 349,
    annualPrice: 2499,
    annualStrikePrice: 4188,
    dailyAnnualCost: 7,
    annualSavingsPercent: 40,
    features: [
      'Unlimited 4×6 / 4×4 label cropping & sorting',
      'Unlimited uncut AWB packing videos',
      'Burnt-in IST forensic timestamp watermark',
      'Warehouse picklists & handover manifests',
      '1 workstation offline-verifiable license'
    ],
    icon: Crop
  },
  {
    id: 'claimradar',
    name: 'ClaimRadar Pro',
    tagline: 'Complete forensic dispute proof suite to overturn rejected claims',
    monthlyPrice: 599,
    annualPrice: 4499,
    annualStrikePrice: 7188,
    dailyAnnualCost: 12,
    annualSavingsPercent: 37,
    popular: true,
    features: [
      'Everything in Starter Station',
      'Auto 4-photo forensic collage (T+0.5, 3, 6, 9s)',
      '72-hr / 14-day / 30-day claim deadline radar',
      'Dispatch-to-return side-by-side video & still matcher',
      '1-click auto-generated dispute text for Meesho, Flipkart & Amazon'
    ],
    icon: Radar
  },
  {
    id: 'warehouse',
    name: 'Warehouse 3-Table Pack',
    tagline: 'Multi-table packing team license for factories & wholesale hubs',
    monthlyPrice: 1199,
    annualPrice: 8999,
    annualStrikePrice: 14388,
    dailyAnnualCost: 25,
    annualSavingsPercent: 37,
    features: [
      '3 simultaneous PC workstation licenses',
      'All ClaimRadar Pro forensic & deadline features',
      'Phone companion barcode scanner seats',
      'Centralized shared vault path support',
      'Priority 1-on-1 WhatsApp dispute support'
    ],
    icon: Warehouse
  }
];

export function PaywallModal(): JSX.Element {
  const ctx = usePaywall();
  const toast = useToast();

  const [interval, setInterval] = useState<BillingInterval>('annual');
  const [selected, setSelected] = useState<PlanId>(() => ctx.request?.plan ?? 'claimradar');
  const [qr, setQr] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);
  const [token, setToken] = useState('');
  const [activating, setActivating] = useState(false);
  const [copied, setCopied] = useState(false);

  // A module can request a specific plan when raising the paywall.
  useEffect(() => {
    if (ctx.open && ctx.request?.plan) setSelected(ctx.request.plan);
  }, [ctx.open, ctx.request]);

  // Clear sensitive transient state between openings.
  useEffect(() => {
    if (!ctx.open) {
      setToken('');
      setActivating(false);
      setCopied(false);
    }
  }, [ctx.open]);

  const selectedPlan = PLANS.find((p) => p.id === selected) ?? PLANS[1];
  const payableAmount = interval === 'annual' ? selectedPlan.annualPrice : selectedPlan.monthlyPrice;

  const intentUrl = useMemo(
    () =>
      buildUpiIntent({
        pa: CLAIMPROOF_VPA,
        pn: 'ClaimProof.in',
        am: payableAmount,
        tn: `ClaimProof ${selectedPlan.name} (${interval === 'annual' ? 'Annual Pass' : 'Monthly Sub'})`
      }),
    [payableAmount, selectedPlan.name, interval]
  );

  // Render the UPI QR for the selected plan and interval.
  useEffect(() => {
    if (!ctx.open) return;
    let cancelled = false;
    setQr(null);
    setQrFailed(false);
    renderUpiQr(intentUrl)
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {
        if (!cancelled) setQrFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ctx.open, intentUrl]);

  const copyVpa = async () => {
    try {
      await navigator.clipboard.writeText(CLAIMPROOF_VPA);
      setCopied(true);
      toast.success('VPA copied', CLAIMPROOF_VPA);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed', 'Select the VPA text and copy it manually.');
    }
  };

  const activate = async () => {
    const t = token.trim();
    if (!t) {
      toast.warn('Paste your activation token', 'It is issued after your UPI payment is received.');
      return;
    }
    setActivating(true);
    try {
      const res = await verifyAndActivateToken(t);
      if (res.ok) {
        toast.success('License activated');
        ctx.closePaywall();
      } else {
        toast.error(res.error ?? 'Invalid license token');
      }
    } catch {
      toast.error('Activation failed', 'The token could not be verified on this device.');
    } finally {
      setActivating(false);
    }
  };

  // Testing path — clearly labeled, activates a local demo license without payment.
  const startDemo = async () => {
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
      title="Unlock ClaimProof Suite"
      subtitle="Recurring protection for Indian e-commerce sellers · UPI Autopay / Instant QR · Verified offline"
      width="xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-proof-400" />
            Offline-first: your license is verified on-device via an ES256 signature. No account required.
          </div>
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
            <span className="text-proof-300 font-medium">★ Best value for Indian sellers: 4 months free + immediate activation</span>
          ) : (
            <span>Recurring monthly mandate via UPI Autopay · cancel anytime</span>
          )}
        </div>
      </div>

      {/* ── Value anchor banner ── */}
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-proof-500/20 bg-proof-500/5 px-4 py-2.5 text-xs text-slate-300">
        <Receipt className="h-4 w-4 shrink-0 text-proof-400" />
        <div className="flex-1">
          <strong className="text-white">One recovered return covers your entire cost:</strong> Recovering just one ₹500–₹1,200 wrongful return on Meesho, Flipkart, or Amazon pays for months of ClaimProof!
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
          const strikePrice = interval === 'annual' ? plan.annualStrikePrice : plan.monthlyStrikePrice;
          const monthlyEquivalent = interval === 'annual' ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice;

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
                plan.popular &&
                  'md:-translate-y-1.5 md:shadow-[0_18px_44px_-22px_rgba(5,150,105,0.55)]',
                isSelected
                  ? 'ring-2 ring-proof-400/80 bg-ink-850/90'
                  : plan.popular
                    ? 'ring-1 ring-proof-500/50'
                    : ''
              )}
            >
              {plan.popular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <Badge tone="proof" className="uppercase tracking-[0.14em]">
                    Most Popular · 80% Sellers
                  </Badge>
                </div>
              )}
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-ink-800 text-proof-300">
                  <plan.icon className="h-4.5 w-4.5" />
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
                    <span>₹{monthlyEquivalent}/mo (₹{plan.dailyAnnualCost}/day)</span>
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
                  <li key={f} className="flex items-start gap-2 text-[12px] leading-snug text-slate-300">
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

      {/* ── UPI payment + activation panel ── */}
      <motion.div
        key={`${selected}-${interval}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="glass mt-5 p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            <QrCode className="h-3.5 w-3.5 text-proof-400" />
            Scan &amp; pay with any UPI App (GPay / PhonePe / Paytm / BHIM)
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-proof-300">
            <FileCheck className="h-3.5 w-3.5" />
            <span>Instant token generation after scan</span>
          </div>
        </div>

        <div className="mt-4 grid gap-5 sm:grid-cols-[220px,1fr]">
          <div className="mx-auto sm:mx-0">
            <div className="qr-plate rounded-xl p-2 bg-white">
              {qr ? (
                <img
                  src={qr}
                  width={220}
                  height={220}
                  alt={`UPI QR code — pay ${formatRupees(payableAmount)} to ${CLAIMPROOF_VPA}`}
                  className="block h-[220px] w-[220px]"
                />
              ) : (
                <div className="flex h-[220px] w-[220px] items-center justify-center">
                  {qrFailed ? (
                    <span className="px-6 text-center text-xs text-ink-600">
                      QR unavailable — use “Open UPI app” instead.
                    </span>
                  ) : (
                    <Spinner className="h-6 w-6 text-ink-900" />
                  )}
                </div>
              )}
            </div>
            {qrFailed && (
              <div className="mt-2 text-center text-xs text-danger-300">
                QR could not be rendered on this device.
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {selectedPlan.name} · {interval === 'annual' ? 'Annual Pass (12 Months)' : 'Monthly Subscription'}
                </div>
                {interval === 'annual' && (
                  <Badge tone="proof" className="text-[10px]">
                    Includes 4 Months Free
                  </Badge>
                )}
              </div>
              
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-4xl font-bold tracking-tight text-white">
                  {formatRupees(payableAmount)}
                </span>
                <span className="text-sm text-slate-400">
                  {interval === 'annual' ? 'net upfront for 1 year' : 'per month'}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <div className="glass-soft flex h-10 min-w-0 flex-1 items-center gap-2 px-3">
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    VPA
                  </span>
                  <span className="truncate font-mono text-[13px] text-slate-200">
                    {CLAIMPROOF_VPA}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={copied ? Check : Copy}
                  onClick={copyVpa}
                  className="h-10"
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <a
                  href={intentUrl}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-proof-500/40 bg-proof-500/10 px-4 text-sm font-medium text-proof-300 transition-colors hover:border-proof-400/70 hover:bg-proof-500/20"
                >
                  <Smartphone className="h-4 w-4 shrink-0" />
                  Open in UPI App
                </a>
                <span className="text-xs text-slate-400">
                  Supported on GPay, PhonePe, Paytm, Cred &amp; BHIM
                </span>
              </div>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-slate-500 border-t border-line/60 pt-3">
              After completing the UPI payment, copy the activation token sent to your registered WhatsApp/SMS or generated via webhook and paste below:
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-line pt-5">
          <Field label="Activation token">
            <div className="flex flex-wrap gap-2 sm:flex-nowrap">
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="eyJhbGciOiJFUzI1NiIs…"
                spellCheck={false}
                autoComplete="off"
                className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-ink-850 px-3.5 font-mono text-[13px] text-slate-100 placeholder:text-slate-600 focus:border-proof-500/60 focus:outline-none focus:ring-2 focus:ring-proof-500/25"
              />
              <Button
                variant="primary"
                icon={KeyRound}
                loading={activating}
                onClick={activate}
                className="h-10"
              >
                Activate License
              </Button>
            </div>
          </Field>
        </div>
      </motion.div>
    </Modal>
  );
}

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  ExternalLink,
  Fingerprint,
  IndianRupee,
  KeyRound,
  MonitorSmartphone,
  Radar,
  Receipt,
  ScanBarcode,
  ShieldCheck,
  Sparkles,
  X
} from 'lucide-react';
import {
  activateDemoPlan,
  deactivateLicense,
  getDeviceFingerprint,
  useLicense,
  verifyAndActivateToken
} from '../services/licenseService';
import { BRAND } from '../config/brand';
import { getPaymentUrl, PLANS } from '../config/plans';
import { getWhatsAppBuyUrl } from '../config/support';
import { trackEvent } from '../services/telemetry';
import { formatISTShort } from '../lib/dateUtils';
import { cn, formatRupees, truncate } from '../lib/utils';
import { Badge, Button, Card, EmptyState, PageHeader, useToast } from '../components/ui';
import type { BillingInterval, PlanId } from '../types';

const COMPARISON: {
  feature: string;
  free: string;
  starter: string;
  pro: string;
  warehouse: string;
}[] = [
  {
    feature: 'Label cropping & sorting',
    free: '40 / day',
    starter: 'Unlimited',
    pro: 'Unlimited',
    warehouse: 'Unlimited'
  },
  {
    feature: 'AWB proof videos',
    free: '10 / day (watermarked)',
    starter: 'Unlimited HD',
    pro: 'Unlimited HD',
    warehouse: 'Unlimited HD'
  },
  {
    feature: 'Live IST timestamp overlay',
    free: '✓ Standard',
    starter: '✓ Burnt-in HD',
    pro: '✓ Burnt-in HD',
    warehouse: '✓ Burnt-in HD'
  },
  {
    feature: 'Picklist & Courier handover manifests',
    free: `✓ (${BRAND.name} seal)`,
    starter: '✓ White-label (Clean)',
    pro: '✓ White-label (Clean)',
    warehouse: '✓ White-label (Clean)'
  },
  {
    feature: 'Auto 4-photo evidence collage',
    free: '—',
    starter: '—',
    pro: '✓ (T+0.5, 3, 6, 9s)',
    warehouse: '✓ (T+0.5, 3, 6, 9s)'
  },
  {
    feature: 'Marketplace claim deadline radar',
    free: '—',
    starter: '—',
    pro: '✓ (72h / 14d / 30d)',
    warehouse: '✓ (72h / 14d / 30d)'
  },
  {
    feature: 'Return matcher + dispute dossier generator',
    free: '—',
    starter: '—',
    pro: '✓',
    warehouse: '✓'
  },
  {
    feature: 'Workstation licenses',
    free: '1 PC',
    starter: '1 PC',
    pro: '1 PC',
    warehouse: '3 PCs simultaneous'
  },
  {
    feature: 'Phone companion wireless scanner',
    free: '—',
    starter: '—',
    pro: '—',
    warehouse: '✓'
  },
  {
    feature: 'Dispute support channel',
    free: 'Community',
    starter: 'Email',
    pro: 'Priority Email',
    warehouse: 'Dedicated WhatsApp'
  }
];

export default function PricingPage() {
  const license = useLicense();
  const toast = useToast();
  const [interval, setInterval] = useState<BillingInterval>('annual');
  const [token, setToken] = useState('');
  const [activating, setActivating] = useState(false);
  const [movePrompt, setMovePrompt] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  useEffect(() => {
    void trackEvent('paywall_viewed', { plan: 'pricing_page', interval });
  }, [interval]);

  const currentPlan = PLANS.find((p) => p.id === license.plan);

  const isExpired =
    Boolean(license.expiresAt && Date.now() > license.expiresAt) ||
    license.subscriptionStatus === 'expired' ||
    license.subscriptionStatus === 'revoked';

  const isPaymentFailed =
    license.subscriptionStatus === 'payment_failed' || license.subscriptionStatus === 'halted';

  const isRenewing =
    !isExpired &&
    !isPaymentFailed &&
    (license.subscriptionStatus === 'active' || Boolean(license.renewsAt));

  async function activate(opts?: { moveDevice?: boolean }) {
    const t = token.trim();
    if (!t) return;
    setActivating(true);
    try {
      const result = await verifyAndActivateToken(t, opts);
      if (result.ok) {
        toast.success(
          opts?.moveDevice ? 'License moved' : 'License activated',
          'All plan features unlocked on this workstation.'
        );
        setToken('');
        setMovePrompt(null);
      } else {
        if (result.canMove) {
          setMovePrompt(result.error ?? 'Device mismatch');
        } else {
          setMovePrompt(null);
        }
        toast.error('Activation failed', result.error ?? 'Invalid token.');
      }
    } finally {
      setActivating(false);
    }
  }

  const handleBuy = (planId: PlanId) => {
    void trackEvent('purchase_started', { planId, interval });
    const url = getPaymentUrl(planId, interval);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      toast.info(
        'Opening Razorpay checkout',
        'Complete payment in the new tab. Your license key will be issued for offline activation.'
      );
    } else {
      const plan = PLANS.find((p) => p.id === planId);
      window.open(getWhatsAppBuyUrl(plan?.name, interval), '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="space-y-6 pb-28">
      <PageHeader
        icon={IndianRupee}
        kicker="MODULE D"
        title="Seller Protection Plans"
        subtitle="Plans for Indian marketplace sellers. UPI Autopay and instant QR, verified offline with zero server downtime."
      />

      {/* Current license status card */}
      {license.plan === 'free' ? (
        <Card className="p-6">
          <EmptyState
            icon={ShieldCheck}
            title="No paid license active"
            description="You are currently running on the Free Tier (40 labels & 10 watermarked proof videos per day). Choose a plan below to unlock unlimited recordings, white-label picklists, and automated claim deadline radar — or enter a license key if you have already purchased one."
            primaryAction={{
              label: 'Enter license key',
              onClick: () => {
                const el = document.querySelector<HTMLInputElement>('input[placeholder^="eyJ"]');
                el?.focus();
              },
              icon: KeyRound
            }}
            secondaryLink={{
              label: 'Compare paid plans below',
              onClick: () => {
                document.getElementById('plans-grid')?.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          />
        </Card>
      ) : (
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-proof-500/30 bg-proof-500/12 text-proof-300">
              <BadgeCheck className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-lg font-bold text-white">
                  {currentPlan ? currentPlan.name : 'Paid License'}
                </span>
                {license.demo && <Badge tone="warn">DEMO LICENSE</Badge>}

                {isPaymentFailed && (
                  <Badge tone="danger">payment failed, update your payment method</Badge>
                )}

                {isExpired && <Badge tone="danger">expired, features limited</Badge>}

                {!isExpired &&
                  !isPaymentFailed &&
                  isRenewing &&
                  (license.renewsAt || license.expiresAt) && (
                    <Badge tone="proof">
                      renews on {formatISTShort(license.renewsAt ?? license.expiresAt!)}
                    </Badge>
                  )}

                {!isExpired && !isPaymentFailed && !isRenewing && license.expiresAt && (
                  <Badge tone="outline">expires {formatISTShort(license.expiresAt)}</Badge>
                )}
              </div>

              {isPaymentFailed && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-xs text-danger-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-danger-400" />
                  <span>
                    <strong>payment failed, update your payment method:</strong> Your recurring
                    subscription charge could not be processed. Please update your UPI Autopay /
                    Card details to avoid cancellation.
                  </span>
                </div>
              )}

              {isExpired && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-warn-500/40 bg-warn-500/10 px-3 py-2 text-xs text-warn-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warn-400" />
                  <span>
                    <strong>expired, features limited:</strong> Your paid license and 3-day grace
                    period have expired. Daily quotas have reverted to the Free tier (40 labels & 10
                    watermarked videos/day). Pro tools remain locked until renewed.
                  </span>
                </div>
              )}

              <div className="mt-0.5 text-xs text-slate-400">
                {license.seats} workstation seat{license.seats > 1 ? 's' : ''} · activated{' '}
                {license.activatedAt ? formatISTShort(license.activatedAt) : '—'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={Fingerprint}
                onClick={() =>
                  void getDeviceFingerprint().then((fp) => {
                    setFingerprint(fp);
                    void navigator.clipboard?.writeText(fp).catch(() => undefined);
                    toast.info('Device fingerprint copied', truncate(fp, 24));
                  })
                }
              >
                Fingerprint
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void deactivateLicense().then(() => toast.info('License deactivated on this PC'))
                }
              >
                Deactivate
              </Button>
            </div>
          </div>
          {fingerprint && (
            <div className="mt-3 break-all rounded-lg border border-line bg-ink-950/70 p-3 font-mono text-[10px] text-slate-500">
              {fingerprint}
            </div>
          )}
        </Card>
      )}

      {/* ROI & Trust Callout Banner */}
      <Card className="border-proof-500/30 bg-proof-500/10 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-proof-500/20 text-proof-300">
            <Receipt className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-sm font-bold text-white">
              The Math: How {BRAND.name} Pays for Itself on Day 1
            </div>
            <div className="mt-1 text-xs text-slate-300 leading-relaxed">
              In Indian e-commerce, a single rejected return on Meesho SAFE, Flipkart SPF, or Amazon
              SAFE-T costs you ₹400 to ₹1,500. ClaimRadar Pro costs just{' '}
              <strong className="text-proof-300">₹12/day</strong>. Saves each packing video named by
              AWB in your own folder so your team has clear evidence ready for marketplace claims.
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone="proof" className="px-3 py-1 text-xs">
              18% GST Input Credit Available
            </Badge>
          </div>
        </div>
      </Card>

      {/* Billing Interval Switcher */}
      <div className="flex flex-col items-center justify-center gap-2 pt-2">
        <div className="inline-flex rounded-xl border border-line bg-ink-900/90 p-1">
          <button
            type="button"
            onClick={() => setInterval('monthly')}
            className={cn(
              'rounded-lg px-5 py-2 text-xs font-semibold transition-all',
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
              'relative flex items-center gap-2 rounded-lg px-5 py-2 text-xs font-semibold transition-all',
              interval === 'annual'
                ? 'bg-proof-500/25 text-proof-700 dark:text-white shadow-sm ring-1 ring-proof-400/60'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-proof-400" />
            <span>Annual Pass</span>
            <span className="rounded bg-proof-600 text-on-accent px-1.5 py-0.5 text-[10px] font-bold shadow-xs">
              SAVE UP TO 40% (4 MONTHS FREE)
            </span>
          </button>
        </div>
        <div className="text-xs text-slate-400">
          {interval === 'annual' ? (
            <span className="text-proof-300">
              Annual payment collects full 1-year access with no monthly card deductions
            </span>
          ) : (
            <span>Recurring monthly payment via UPI Autopay · Cancel anytime with 1 click</span>
          )}
        </div>
      </div>

      {/* Plans Grid */}
      <div id="plans-grid" className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const owned = license.plan === plan.id && !license.demo;
          const displayPrice = interval === 'annual' ? plan.annualPrice : plan.monthlyPrice;
          const monthlyEquiv =
            interval === 'annual' ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice;

          return (
            <Card
              key={plan.id}
              hover
              glow={plan.best}
              className={cn(
                'relative flex flex-col p-6',
                plan.best ? 'border-proof-500/60 bg-ink-850/80' : 'border-line'
              )}
            >
              {plan.tag && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge
                    tone="proof"
                    className="border-proof-400/60 bg-proof-500/30 px-3 py-1 text-[11px] font-bold"
                  >
                    {plan.tag}
                  </Badge>
                </div>
              )}
              <div className="flex items-center gap-2">
                {plan.id === 'warehouse' ? (
                  <MonitorSmartphone className="h-4.5 w-4.5 text-info-300" />
                ) : plan.id === 'claimradar' ? (
                  <Radar className="h-4.5 w-4.5 text-proof-300" />
                ) : (
                  <ScanBarcode className="h-4.5 w-4.5 text-proof-300" />
                )}
                <div className="font-display text-lg font-bold text-white">{plan.name}</div>
              </div>

              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <div className="font-display text-4xl font-bold text-white">
                    {formatRupees(displayPrice)}
                  </div>
                  <span className="text-xs text-slate-400">
                    / {interval === 'annual' ? 'year' : 'month'}
                  </span>
                  {interval === 'annual' && plan.annualStrike && (
                    <div className="ml-auto font-mono text-sm text-slate-500 line-through">
                      {formatRupees(plan.annualStrike)}
                    </div>
                  )}
                </div>

                {interval === 'annual' ? (
                  <div className="mt-1 flex items-center justify-between text-xs text-proof-300 font-medium">
                    <span>
                      Just ₹{monthlyEquiv}/mo · ₹{plan.dailyAnnualCost}/day
                    </span>
                    <span className="rounded bg-proof-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-proof-300">
                      Save {plan.annualSavingsPercent}%
                    </span>
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-slate-400">Billed monthly via UPI Autopay</div>
                )}
              </div>

              <div className="mt-3 text-[11px] uppercase tracking-wider text-slate-500 border-t border-line/60 pt-3">
                {plan.id === 'warehouse'
                  ? '3 workstation seats included'
                  : '1 workstation seat · offline verified'}
              </div>

              <ul className="mt-4 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-xs leading-relaxed text-slate-300"
                  >
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-proof-400" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {owned ? (
                <Button
                  variant="secondary"
                  size="lg"
                  className="mt-6 w-full"
                  disabled
                  icon={BadgeCheck}
                >
                  Current plan active
                </Button>
              ) : getPaymentUrl(plan.id, interval) ? (
                <Button
                  variant={plan.best ? 'primary' : 'secondary'}
                  size="lg"
                  className="mt-6 w-full"
                  icon={ExternalLink}
                  onClick={() => handleBuy(plan.id)}
                >
                  Buy {plan.name}
                </Button>
              ) : (
                <a
                  href={getWhatsAppBuyUrl(plan.name, interval)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all',
                    plan.best
                      ? 'bg-proof-600 text-white shadow-sm hover:bg-proof-500'
                      : 'border border-line-bright bg-ink-800 text-slate-200 hover:bg-ink-750 hover:text-white'
                  )}
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Contact support to buy</span>
                </a>
              )}
            </Card>
          );
        })}
      </div>

      {/* Detailed Feature Comparison */}
      <Card className="overflow-hidden">
        <div className="border-b border-line p-4 font-display text-base font-bold text-white">
          Complete Feature Comparison
        </div>
        <div
          className="overflow-x-auto focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-proof-500"
          role="region"
          tabIndex={0}
          aria-label="Complete Feature Comparison"
        >
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Feature</th>
                <th className="px-4 py-3">Free Tier</th>
                <th className="px-4 py-3">Starter</th>
                <th className="px-4 py-3 text-proof-300">ClaimRadar Pro ★</th>
                <th className="px-4 py-3">Warehouse 3-Pack</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {COMPARISON.map((row) => (
                <tr key={row.feature} className="transition-colors hover:bg-ink-850/60">
                  <td className="px-4 py-3 text-xs text-slate-200 font-medium">{row.feature}</td>
                  {[row.free, row.starter, row.pro, row.warehouse].map((cell, i) => (
                    <td
                      key={i}
                      className={cn(
                        'px-4 py-3 text-xs',
                        cell.includes('✓')
                          ? 'text-proof-700 dark:text-proof-400'
                          : cell === '—'
                            ? 'text-slate-600'
                            : 'text-slate-300'
                      )}
                    >
                      {cell === '✓' ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : cell === '—' ? (
                        <X className="h-3.5 w-3.5" />
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Token activation card */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-proof-500/25 bg-proof-500/12 text-proof-300">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-base font-bold text-white">Enter License Key</div>
            <div className="mt-0.5 text-xs text-slate-400">
              Completed payment via Razorpay? Paste your signed license key below. It is verified
              directly on-device via ES256 and bound to this workstation without needing internet
              access.
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  if (movePrompt) setMovePrompt(null);
                }}
                placeholder="eyJhbGciOiJFUzI1NiIs…"
                className="glass-soft min-w-0 flex-1 px-3 py-2.5 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:border-proof-500/50 focus:outline-none"
              />
              <Button
                variant="primary"
                loading={activating}
                onClick={() => void activate()}
                disabled={!token.trim()}
              >
                Activate License
              </Button>
            </div>

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
            {import.meta.env.DEV && (
              <button
                type="button"
                onClick={() => {
                  if (activateDemoPlan) {
                    void activateDemoPlan('claimradar').then(() =>
                      toast.info('Demo license activated', 'All Pro features unlocked for testing.')
                    );
                  }
                }}
                className="mt-3 text-xs text-slate-500 underline-offset-2 transition-colors hover:text-slate-300 hover:underline"
              >
                Or activate a demo license for testing
              </button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

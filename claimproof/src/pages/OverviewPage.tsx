import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Package,
  Radar,
  ScanBarcode,
  Timer,
  TrendingUp,
  Video
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting } from '../db/schema';
import {
  consumablesAlertDue,
  FREE_AWBS_PER_DAY,
  FREE_LABELS_PER_DAY,
  getCumulativeLabels,
  getTodayUsage,
  markConsumablesShown
} from '../lib/quota';
import { claimWindowLabel, recordingTypeLabel } from '../lib/claimRules';
import { formatCountdown, formatISTShort, greeting, istDateKey } from '../lib/dateUtils';
import { istDayStartEpoch, type Route } from '../lib/router';
import { Badge, Button, Card, EmptyState, PageHeader, StatCard, Stagger, StaggerItem } from '../components/ui';
import { useLicense } from '../services/licenseService';
import { usePaywall } from '../providers/PaywallProvider';

function PipelineCard({
  icon: Icon,
  step,
  title,
  body,
  stat,
  cta,
  onClick,
  accent
}: {
  icon: typeof ScanBarcode;
  step: string;
  title: string;
  body: string;
  stat: string;
  cta: string;
  onClick: () => void;
  accent: 'proof' | 'danger' | 'info';
}) {
  const chip =
    accent === 'proof'
      ? 'border-proof-500/25 bg-proof-500/12 text-proof-300'
      : accent === 'danger'
        ? 'border-danger-500/25 bg-danger-500/12 text-danger-300'
        : 'border-info-500/25 bg-info-500/12 text-info-300';
  return (
    <Card hover className="group relative flex flex-col p-5">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${chip}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
          {step}
        </span>
      </div>
      <div className="mt-4 font-display text-lg font-bold text-white">{title}</div>
      <div className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-400">{body}</div>
      <div className="mt-4 font-mono text-sm font-semibold text-proof-300 mono-tabular">{stat}</div>
      <Button variant="secondary" size="sm" iconRight={ArrowRight} onClick={onClick} className="mt-3 w-full">
        {cta}
      </Button>
    </Card>
  );
}

export default function OverviewPage({ navigate }: { navigate: (r: Route) => void }) {
  const license = useLicense();
  const { openPaywall } = usePaywall();

  const usage = useLiveQuery(() => getTodayUsage(), []);
  const consumables = useLiveQuery(
    async () => ({
      cumulative: await getCumulativeLabels(),
      lastShown: await getSetting<number>('consumables_last_shown', 0)
    }),
    []
  );
  const ordersInMemory = useLiveQuery(() => db.orders.count(), []);
  const totalRecordings = useLiveQuery(() => db.recordings.count(), []);
  const recordingsToday = useLiveQuery(
    () => db.recordings.where('startedAt').aboveOrEqual(istDayStartEpoch()).count(),
    [istDateKey()]
  );
  const recentRecordings = useLiveQuery(
    () => db.recordings.orderBy('startedAt').reverse().limit(6).toArray(),
    []
  );
  const pendingClaims = useLiveQuery(
    () => db.claims.filter((c) => c.status === 'pending' || c.status === 'prepared').sortBy('deadlineAt'),
    []
  );
  const claimStats = useLiveQuery(
    async () => {
      const all = await db.claims.toArray();
      const won = all.filter((c) => c.status === 'won').length;
      const lost = all.filter((c) => c.status === 'lost').length;
      return { won, lost, rate: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null };
    },
    []
  );

  const nearestClaim = pendingClaims && pendingClaims.length > 0 ? pendingClaims[0] : undefined;
  const showConsumables =
    consumables &&
    consumablesAlertDue(consumables.cumulative, consumables.lastShown) &&
    (recentRecordings?.length ?? 0) >= 0;

  const activity = useLiveQuery(
    async () => {
      const recs = await db.recordings.orderBy('startedAt').reverse().limit(8).toArray();
      const claims = await db.claims.orderBy('returnScanAt').reverse().limit(8).toArray();
      const merged = [
        ...recs.map((r) => ({
          kind: 'recording' as const,
          at: r.startedAt,
          awb: r.awb,
          title: `${recordingTypeLabel(r.type)} recorded`,
          detail: `${r.durationSec}s · ${r.courier}${r.demo ? ' · demo cam' : ''}`,
          flagged: r.flagged
        })),
        ...claims.map((c) => ({
          kind: 'claim' as const,
          at: c.returnScanAt,
          awb: c.awb,
          title: `Bad return flagged — ${c.flagReason}`,
          detail: `${claimWindowLabel(c.marketplace)} · ${c.sku}`,
          flagged: false
        }))
      ];
      return merged.sort((a, b) => b.at - a.at).slice(0, 8);
    },
    []
  );

  return (
    <div className="space-y-6">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <Card className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0 opacity-70" />
        <div
          className="absolute -right-24 -top-32 h-80 w-80 animate-float-slow rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(closest-side, var(--cp-accent-solid), transparent)' }}
        />
        <div
          className="absolute -left-20 bottom-0 h-64 w-64 animate-float-slower rounded-full opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(closest-side, var(--cp-info-text), transparent)' }}
        />
        <div className="relative p-7 sm:p-9">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="proof">LOCAL-FIRST · ₹0 SERVER</Badge>
            <Badge tone="outline">Meesho · Flipkart · Amazon · AJIO</Badge>
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-white sm:text-[2.6rem] sm:leading-[1.1]">
            {greeting()}, seller.{' '}
            <span className="text-proof-300">Every parcel, proven.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-400">
            Crop shipping labels to thermal size, record uncut barcode-verified packing videos, and
            beat every 72-hour / 14-day claim window — all on this PC, all free to start.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="primary" size="lg" icon={ScanBarcode} onClick={() => navigate('labels')}>
              Crop labels — free
            </Button>
            <Button variant="outline" size="lg" icon={Video} onClick={() => navigate('recorder')}>
              Open AWB Recorder
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Stats ────────────────────────────────────────────────── */}
      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
        <StatCard
          icon={ScanBarcode}
          label="Labels cropped today"
          value={usage?.labelsCropped ?? 0}
          sub={license.plan === 'free' ? `Free limit ${FREE_LABELS_PER_DAY}/day` : 'Unlimited plan'}
          tone="proof"
          progress={
            license.plan === 'free'
              ? { value: usage?.labelsCropped ?? 0, max: FREE_LABELS_PER_DAY }
              : undefined
          }
        />
        </StaggerItem>
        <StaggerItem>
        <StatCard
          icon={Video}
          label="Parcels recorded today"
          value={recordingsToday ?? 0}
          sub={license.plan === 'free' ? `Free limit ${FREE_AWBS_PER_DAY}/day` : 'Unlimited plan'}
          tone="info"
          progress={
            license.plan === 'free'
              ? { value: recordingsToday ?? 0, max: FREE_AWBS_PER_DAY }
              : undefined
          }
        />
        </StaggerItem>
        <StaggerItem>
        <StatCard
          icon={Radar}
          label="Pending claims"
          value={pendingClaims?.length ?? 0}
          sub={nearestClaim ? `${formatCountdown(nearestClaim.deadlineAt - Date.now())} to next deadline` : 'Nothing waiting'}
          tone={(pendingClaims?.length ?? 0) > 0 ? 'danger' : 'proof'}
        />
        </StaggerItem>
        <StaggerItem>
        <StatCard
          icon={TrendingUp}
          label="Claim win rate"
          value={claimStats?.rate === null || claimStats?.rate === undefined ? '—' : claimStats.rate}
          suffix={claimStats?.rate !== null && claimStats?.rate !== undefined ? '%' : undefined}
          sub={`${claimStats?.won ?? 0} won · ${claimStats?.lost ?? 0} lost`}
          tone="warn"
        />
        </StaggerItem>
      </Stagger>

      {/* ── Pipeline ─────────────────────────────────────────────── */}
      <div>
        <PageHeader
          icon={ChevronRight}
          kicker="THE DAILY LOOP"
          title="From label PDF to won claim"
          className="mb-4 [&>div>h1]:text-lg"
        />
        <Stagger className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
          <StaggerItem className="h-full">
          <PipelineCard
            icon={ScanBarcode}
            step="STEP 1"
            title="SmartLabel SKU+"
            body="Drop up to 15 label PDFs. Vector-crop to 4×6, stamp SKU · Size · Qty, auto-sort by courier and print the picklist manifest."
            stat={`${ordersInMemory ?? 0} AWBs loaded in memory`}
            cta="Open SmartLabel Studio"
            onClick={() => navigate('labels')}
            accent="proof"
          />
          </StaggerItem>
          <StaggerItem className="h-full">
          <PipelineCard
            icon={Video}
            step="STEP 2"
            title="ClaimProof AWB"
            body="Scan a barcode — the uncut video starts itself with a burnt-in forensic bar. Scan the next parcel and it chains in under 100 ms."
            stat={`${totalRecordings ?? 0} proof clips in the vault`}
            cta="Open the Recorder"
            onClick={() => navigate('recorder')}
            accent="info"
          />
          </StaggerItem>
          <StaggerItem className="h-full">
          <PipelineCard
            icon={Radar}
            step="STEP 3"
            title="ClaimRadar Pro"
            body="Flag bad returns with F2. Deadlines tick per marketplace — 72 h Meesho, 14 days Flipkart SPF, 30 days Amazon SAFE-T — with 1-click evidence."
            stat={
              nearestClaim
                ? `${formatCountdown(nearestClaim.deadlineAt - Date.now())} — ${nearestClaim.awb}`
                : 'No live deadlines'
            }
            cta="Open ClaimRadar"
            onClick={() => navigate('claims')}
            accent="danger"
          />
          </StaggerItem>
        </Stagger>
      </div>

      {/* ── Consumables reorder widget ───────────────────────────── */}
      {showConsumables && (
        <Card className="flex flex-col gap-4 border-warn-500/30 p-5 sm:flex-row sm:items-center">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-warn-500/25 bg-warn-500/12 text-warn-300">
            <Package className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white">
              📦 Packing Supply Alert: ~{(consumables?.cumulative ?? 0).toLocaleString('en-IN')} labels printed.
            </div>
            <div className="mt-0.5 text-xs text-slate-400">
              Reorder 4×6 thermal rolls &amp; tamper-proof courier bags at direct Surat factory rates before you run out mid-dispatch.
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void markConsumablesShown(consumables?.cumulative ?? 0);
            }}
          >
            Got it
          </Button>
        </Card>
      )}

      {/* ── Free-tier upsell ─────────────────────────────────────── */}
      {license.plan === 'free' && (
        <Card glow className="relative overflow-hidden p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="font-display text-lg font-bold text-white">
                You&apos;re on Free — 40 labels &amp; 10 videos every day
              </div>
              <div className="mt-1 text-sm text-slate-400">
                Starter Station (from ₹208/mo) removes all limits on this PC. ClaimRadar Pro (from ₹375/mo) adds the
                photo collage engine, return matcher, and marketplace deadline radar.
              </div>
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={() => openPaywall({ scope: 'general', reason: 'Unlock unlimited recording & ClaimRadar' })}
            >
              See plans
            </Button>
          </div>
        </Card>
      )}

      {/* ── Activity + deadlines ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <div className="flex items-center justify-between">
            <div className="font-display text-base font-bold text-white">Recent activity</div>
            <Button variant="ghost" size="xs" iconRight={ArrowRight} onClick={() => navigate('vault')}>
              Vault
            </Button>
          </div>
          <div className="mt-3 divide-y divide-line">
            {(activity?.length ?? 0) === 0 ? (
              <EmptyState
                icon={Video}
                title="No recordings yet"
                hint="Crop a label batch, then scan its first AWB in the Recorder."
                className="py-10"
              />
            ) : (
              activity?.map((item, i) => (
                <div key={`${item.awb}-${item.at}-${i}`} className="flex items-center gap-3 py-2.5">
                  {item.kind === 'recording' ? (
                    <Video className="h-4 w-4 shrink-0 text-info-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-warn-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm text-slate-200">{item.title}</span>
                      {item.flagged && <Badge tone="danger">FLAGGED</Badge>}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                      {item.awb} · {item.detail}
                    </div>
                  </div>
                  <div className="shrink-0 font-mono text-[11px] text-slate-500 mono-tabular">
                    {formatISTShort(item.at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="font-display text-base font-bold text-white">Deadline radar</div>
            <Button variant="ghost" size="xs" iconRight={ArrowRight} onClick={() => navigate('claims')}>
              ClaimRadar
            </Button>
          </div>
          <div className="mt-3 space-y-3">
            {(pendingClaims?.length ?? 0) === 0 ? (
              <EmptyState
                icon={Timer}
                title="No live deadlines"
                hint="Flag a bad return with F2 in Return Unboxing Mode and it lands here."
                className="py-10"
              />
            ) : (
              pendingClaims?.slice(0, 4).map((claim) => {
                const left = claim.deadlineAt - Date.now();
                const tone = left <= 0 ? 'danger' : left < 8 * 3_600_000 ? 'danger' : left < 24 * 3_600_000 ? 'warn' : 'proof';
                return (
                  <button
                    key={claim.id}
                    type="button"
                    onClick={() => navigate('claims')}
                    className="glass-soft flex w-full items-center gap-3 p-3 text-left transition-colors hover:border-line-bright"
                  >
                    <Timer className={`h-4 w-4 shrink-0 ${tone === 'danger' ? 'text-danger-400' : tone === 'warn' ? 'text-warn-400' : 'text-proof-400'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-sm font-semibold text-white">{claim.awb}</div>
                      <div className="truncate text-[11px] text-slate-500">{claimWindowLabel(claim.marketplace)}</div>
                    </div>
                    <div
                      className={`shrink-0 font-mono text-xs font-bold mono-tabular ${
                        tone === 'danger' ? 'text-danger-300' : tone === 'warn' ? 'text-warn-300' : 'text-proof-300'
                      }`}
                    >
                      {formatCountdown(left)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { AlarmClock, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { useClaims } from '../../services/claimEngine';
import { formatCountdown } from '../../lib/dateUtils';
import { isFeatureEnabled } from '../../config/featureFlags';
import { checkAndSendClaimNotifications } from '../../lib/claimNotifications';
import type { Route } from '../../lib/router';
import { cn } from '../../lib/utils';

export function ClaimUrgencyAlertBanner({
  navigate,
  className
}: {
  navigate: (route: Route) => void;
  className?: string;
}) {
  const [, setTick] = useState(0);
  const [dismissedUntil, setDismissedUntil] = useState<number>(0);
  const claims = useClaims();

  // Tick every second to ensure live countdown updates
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((n) => n + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check background notifications if enabled
  useEffect(() => {
    if (claims && claims.length > 0) {
      checkAndSendClaimNotifications(claims);
    }
  }, [claims]);

  if (!isFeatureEnabled('claimRadarUrgencyBanner')) {
    return null;
  }

  const now = Date.now();
  if (now < dismissedUntil) {
    return null;
  }

  // Active claims pending submission
  const pending = claims.filter((c) => c.status === 'pending' || c.status === 'prepared');
  if (pending.length === 0) {
    return null;
  }

  // Find claims under 24 hours
  const expiringClaims = pending
    .map((c) => ({
      claim: c,
      msLeft: c.deadlineAt - now
    }))
    .filter((entry) => entry.msLeft > 0 && entry.msLeft <= 24 * 3_600_000)
    .sort((a, b) => a.msLeft - b.msLeft);

  if (expiringClaims.length === 0) {
    return null;
  }

  const mostUrgent = expiringClaims[0];
  const isCritical6h = mostUrgent.msLeft <= 6 * 3_600_000;
  const otherExpiringCount = expiringClaims.length - 1;

  const toneClass = isCritical6h
    ? 'border-danger-500/40 bg-danger-500/12 text-danger-300'
    : 'border-warn-500/40 bg-warn-500/12 text-warn-300';

  const iconColor = isCritical6h ? 'text-danger-400' : 'text-warn-400';
  const badgeClass = isCritical6h
    ? 'bg-danger-500/20 text-danger-200 border-danger-500/30'
    : 'bg-warn-500/20 text-warn-200 border-warn-500/30';

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="claim-urgency-banner"
      className={cn(
        'relative border-b px-4 py-2.5 sm:px-6 transition-colors shadow-sm',
        toneClass,
        className
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {isCritical6h ? (
            <AlertTriangle className={cn('h-4 w-4 shrink-0 animate-rec-pulse', iconColor)} />
          ) : (
            <AlarmClock className={cn('h-4 w-4 shrink-0', iconColor)} />
          )}

          <span
            className={cn(
              'rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider',
              badgeClass
            )}
          >
            {isCritical6h ? 'CRITICAL · < 6H' : 'DEADLINE · < 24H'}
          </span>

          <div className="min-w-0 truncate font-medium">
            <span className="font-mono font-bold text-white">{mostUrgent.claim.awb}</span>
            <span className="mx-1.5 opacity-60">·</span>
            <span>{mostUrgent.claim.marketplace} dispute closes in</span>{' '}
            <span className="font-mono font-bold tracking-tight text-white underline decoration-dotted">
              {formatCountdown(mostUrgent.msLeft)}
            </span>
            {otherExpiringCount > 0 && (
              <span className="ml-2 font-mono text-[11px] opacity-75">
                (+{otherExpiringCount} more return{otherExpiringCount > 1 ? 's' : ''})
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('claims')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold shadow-sm transition hover:opacity-90',
              isCritical6h ? 'bg-danger-500 text-white' : 'bg-warn-500 text-ink-950 font-bold'
            )}
          >
            <span>Prepare Claim</span>
            <ArrowRight className="h-3 w-3" />
          </button>

          <button
            type="button"
            aria-label="Dismiss urgency reminder for 15 minutes"
            onClick={() => setDismissedUntil(Date.now() + 15 * 60 * 1000)}
            className="rounded p-1 text-slate-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FolderCheck,
  FolderMinus,
  IndianRupee,
  Layers,
  Moon,
  Search,
  Sun,
  Video
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { formatIST, istDateKey } from '../../lib/dateUtils';
import { FREE_AWBS_PER_DAY, FREE_LABELS_PER_DAY, getTodayUsage } from '../../lib/quota';
import { istDayStartEpoch, navigateTo, ROUTE_LABELS, type Route } from '../../lib/router';
import { cn } from '../../lib/utils';
import { getVaultStatus } from '../../services/vaultWriter';
import { useLicense } from '../../services/licenseService';
import { currentTheme, toggleTheme, type Theme } from '../../lib/theme';
import { BRAND } from '../../config/brand';
import { Badge, Logo, StatusDot } from '../ui';

function QuotaChip({
  icon: Icon,
  label,
  used,
  limit
}: {
  icon: typeof Layers;
  label: string;
  used: number;
  limit: number | null;
}) {
  const nearLimit = limit !== null && used >= limit * 0.8;
  return (
    <div
      className={cn(
        'glass-soft hidden items-center gap-2 px-3 py-1.5 sm:flex',
        nearLimit && 'border-warn-500/40'
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', nearLimit ? 'text-warn-400' : 'text-proof-400')} />
      <div className="leading-tight">
        <div className="font-mono text-xs font-semibold text-slate-200 mono-tabular">
          {used}
          <span className="text-slate-500">/{limit === null ? '∞' : limit}</span>
        </div>
        <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      </div>
    </div>
  );
}

export default function TopBar({ route }: { route: Route }) {
  const license = useLicense();
  const usage = useLiveQuery(() => getTodayUsage(), []);
  const [clock, setClock] = useState(() => formatIST(Date.now()));
  const [theme, setTheme] = useState<Theme>(() => currentTheme());
  const vaultStatus = useLiveQuery(() => getVaultStatus(), []);

  useEffect(() => {
    const t = setInterval(() => setClock(formatIST(Date.now())), 1000);
    return () => clearInterval(t);
  }, []);

  /* Keep the toggle icon in sync when the theme changes from the command palette. */
  useEffect(() => {
    const sync = () => setTheme(currentTheme());
    window.addEventListener('cp-theme-changed', sync);
    return () => window.removeEventListener('cp-theme-changed', sync);
  }, []);

  const recordingsToday = useLiveQuery(
    () => db.recordings.where('startedAt').aboveOrEqual(istDayStartEpoch()).count(),
    [istDateKey()]
  );

  const planBadge =
    license.plan === 'free'
      ? 'Free'
      : license.plan === 'starter'
        ? 'Starter'
        : license.plan === 'claimradar'
          ? 'Pro'
          : 'Warehouse';

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="md:hidden">
            <Logo />
          </div>
          <div className="hidden min-w-0 md:block">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-proof-300">
              {BRAND.domain}
            </div>
            <div className="truncate font-display text-sm font-bold text-white">
              {ROUTE_LABELS[route]}
            </div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('cp-open-palette'))}
            className="glass-soft hidden h-9 items-center gap-2 px-3 text-slate-400 transition-colors hover:text-slate-200 md:flex"
            title="Command menu (Ctrl+K)"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="text-xs">Commands</span>
            <span className="font-mono text-[10px] text-slate-500">⌃K</span>
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('cp-open-palette'))}
            aria-label="Open command menu"
            className="glass-soft flex h-9 w-9 shrink-0 items-center justify-center text-slate-300 md:hidden"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setTheme((t) => toggleTheme(t))}
            aria-label="Toggle light / dark theme"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="glass-soft flex h-9 w-9 shrink-0 items-center justify-center text-slate-300 transition-colors hover:text-proof-300"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={theme}
                initial={{ rotate: -80, opacity: 0, scale: 0.7 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 80, opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="flex"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </motion.span>
            </AnimatePresence>
          </button>

          <QuotaChip
            icon={Layers}
            label="labels today"
            used={usage?.labelsCropped ?? 0}
            limit={license.plan === 'free' ? FREE_LABELS_PER_DAY : null}
          />
          <QuotaChip
            icon={Video}
            label="videos today"
            used={recordingsToday ?? 0}
            limit={license.plan === 'free' ? FREE_AWBS_PER_DAY : null}
          />

          <div
            className="glass-soft hidden items-center gap-2 px-3 py-1.5 lg:flex"
            title="On-disk vault status"
          >
            {vaultStatus === 'connected' ? (
              <FolderCheck className="h-3.5 w-3.5 text-proof-400" />
            ) : (
              <FolderMinus className="h-3.5 w-3.5 text-slate-500" />
            )}
            <span className="text-[11px] text-slate-400">
              {vaultStatus === 'connected'
                ? 'Vault'
                : vaultStatus === 'downloads'
                  ? 'Downloads'
                  : 'Vault off'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => navigateTo('pricing')}
            className="glass-soft flex items-center gap-2 px-3 py-1.5 transition-colors hover:border-line-bright"
            title="License"
          >
            <StatusDot tone={license.plan === 'free' ? 'warn' : 'proof'} />
            <span className="text-[11px] font-semibold text-slate-200">{planBadge}</span>
            {license.demo && <Badge tone="warn">DEMO</Badge>}
            {license.plan === 'free' && <IndianRupee className="h-3 w-3 text-warn-400" />}
          </button>

          <div className="hidden font-mono text-xs text-slate-400 mono-tabular xl:block">
            {clock}
          </div>
        </div>
      </div>
    </header>
  );
}

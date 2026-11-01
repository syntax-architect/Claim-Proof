import {
  FolderArchive,
  IndianRupee,
  LayoutDashboard,
  Radar,
  ScanBarcode,
  Settings,
  ShieldCheck,
  Video
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { db } from '../../db/schema';
import { cn } from '../../lib/utils';
import { ROUTE_LABELS, type Route } from '../../lib/router';
import { Badge, Logo } from '../ui';

interface NavEntry {
  route: Route;
  label: string;
  icon: LucideIcon;
  badge?: number;
  badgeTone?: 'proof' | 'danger' | 'warn' | 'neutral';
}

function NavItem({
  entry,
  active,
  onClick
}: {
  entry: NavEntry;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = entry.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150',
        active ? 'text-proof-300' : 'text-slate-400 hover:bg-ink-800/60 hover:text-slate-200'
      )}
    >
      {active && (
        <motion.span
          layoutId="cp-nav-pill"
          className="absolute inset-0 rounded-xl border border-proof-500/25 bg-proof-500/10"
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        />
      )}
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-proof-400" />
      )}
      <Icon className="relative z-10 h-4.5 w-4.5 shrink-0" />
      <span className="relative z-10 flex-1 truncate text-left">{entry.label}</span>
      {entry.badge !== undefined && entry.badge > 0 && (
        <span className="relative z-10">
          <Badge tone={entry.badgeTone ?? 'neutral'}>{entry.badge}</Badge>
        </span>
      )}
    </button>
  );
}

export default function Sidebar({
  route,
  navigate
}: {
  route: Route;
  navigate: (r: Route) => void;
}) {
  const pendingClaims = useLiveQuery(
    () => db.claims.filter((c) => c.status === 'pending' || c.status === 'prepared').count(),
    []
  );
  const ordersInMemory = useLiveQuery(() => db.orders.count(), []);

  const operate: NavEntry[] = [
    { route: 'overview', label: ROUTE_LABELS.overview, icon: LayoutDashboard },
    {
      route: 'labels',
      label: ROUTE_LABELS.labels,
      icon: ScanBarcode,
      badge: ordersInMemory ?? 0,
      badgeTone: 'neutral'
    },
    { route: 'recorder', label: ROUTE_LABELS.recorder, icon: Video },
    {
      route: 'claims',
      label: ROUTE_LABELS.claims,
      icon: Radar,
      badge: pendingClaims ?? 0,
      badgeTone: 'danger'
    }
  ];

  const manage: NavEntry[] = [
    { route: 'vault', label: ROUTE_LABELS.vault, icon: FolderArchive },
    { route: 'pricing', label: ROUTE_LABELS.pricing, icon: IndianRupee },
    { route: 'settings', label: ROUTE_LABELS.settings, icon: Settings }
  ];

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-ink-900/60 px-3 py-5 backdrop-blur-xl md:flex">
      <div className="px-3 pb-6">
        <Logo />
      </div>

      <div className="space-y-6 overflow-y-auto">
        <div>
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Operate
          </div>
          <nav className="space-y-1">
            {operate.map((entry) => (
              <NavItem
                key={entry.route}
                entry={entry}
                active={route === entry.route}
                onClick={() => navigate(entry.route)}
              />
            ))}
          </nav>
        </div>
        <div>
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Manage
          </div>
          <nav className="space-y-1">
            {manage.map((entry) => (
              <NavItem
                key={entry.route}
                entry={entry}
                active={route === entry.route}
                onClick={() => navigate(entry.route)}
              />
            ))}
          </nav>
        </div>
      </div>

      <div className="mt-auto space-y-3 pt-6">
        <div className="glass-soft flex items-center gap-2.5 p-3">
          <ShieldCheck className="h-4 w-4 shrink-0 text-proof-400" />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-200">100% local-first</div>
            <div className="text-[10px] text-slate-500">₹0 server · files stay on this PC</div>
          </div>
        </div>
        <div className="px-3 font-mono text-[10px] text-slate-600">ClaimProof Suite v1.0.0</div>
      </div>
    </aside>
  );
}

/** Compact icon rail for small screens. */
export function MobileNav({ route, navigate }: { route: Route; navigate: (r: Route) => void }) {
  const entries: NavEntry[] = [
    { route: 'overview', label: ROUTE_LABELS.overview, icon: LayoutDashboard },
    { route: 'labels', label: ROUTE_LABELS.labels, icon: ScanBarcode },
    { route: 'recorder', label: ROUTE_LABELS.recorder, icon: Video },
    { route: 'claims', label: ROUTE_LABELS.claims, icon: Radar },
    { route: 'vault', label: ROUTE_LABELS.vault, icon: FolderArchive },
    { route: 'pricing', label: ROUTE_LABELS.pricing, icon: IndianRupee },
    { route: 'settings', label: ROUTE_LABELS.settings, icon: Settings }
  ];
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line bg-ink-900/70 px-3 py-2 backdrop-blur-xl md:hidden">
      {entries.map(({ route: r, label, icon: Icon }) => (
        <button
          key={r}
          type="button"
          onClick={() => navigate(r)}
          className={cn(
            'relative flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
            route === r ? 'text-proof-300' : 'text-slate-400'
          )}
        >
          {route === r && (
            <motion.span
              layoutId="cp-mnav-pill"
              className="absolute inset-0 rounded-lg border border-proof-500/25 bg-proof-500/10"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          )}
          <Icon className="relative z-10 h-3.5 w-3.5" />
          <span className="relative z-10">{label}</span>
        </button>
      ))}
    </div>
  );
}

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
import { BRAND } from '../../config/brand';
import { Badge, Logo } from '../ui';
import { useI18n, type I18nKey } from '../../lib/i18n';

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
          layoutId="sidebar-active-gold-indicator"
          className="absolute inset-0 rounded-xl border border-proof-400/40 bg-proof-500/10 shadow-[0_0_14px_rgba(201,164,92,0.15)]"
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-proof-400 shadow-[0_0_8px_rgba(201,164,92,0.45)]" />
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
  const { t } = useI18n();
  const pendingClaims = useLiveQuery(
    () => db.claims.filter((c) => c.status === 'pending' || c.status === 'prepared').count(),
    []
  );
  const ordersInMemory = useLiveQuery(() => db.orders.count(), []);

  const getLabel = (r: Route) => {
    const key = `nav.${r}` as I18nKey;
    try {
      const loc = t(key);
      if (loc && loc !== key) return loc;
    } catch {
      // fallback
    }
    return ROUTE_LABELS[r];
  };

  const operate: NavEntry[] = [
    { route: 'overview', label: getLabel('overview'), icon: LayoutDashboard },
    {
      route: 'labels',
      label: getLabel('labels'),
      icon: ScanBarcode,
      badge: ordersInMemory ?? 0,
      badgeTone: 'neutral'
    },
    { route: 'recorder', label: getLabel('recorder'), icon: Video },
    {
      route: 'claims',
      label: getLabel('claims'),
      icon: Radar,
      badge: pendingClaims ?? 0,
      badgeTone: 'danger'
    },
    {
      route: 'money',
      label: ROUTE_LABELS.money,
      icon: IndianRupee
    }
  ];

  const manage: NavEntry[] = [
    { route: 'vault', label: getLabel('vault'), icon: FolderArchive },
    { route: 'pricing', label: getLabel('pricing'), icon: IndianRupee },
    { route: 'settings', label: getLabel('settings'), icon: Settings }
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
            <div className="text-[11px] font-semibold text-slate-200">Local-first storage</div>
            <div className="text-[10px] text-slate-500">₹0 server · files stay on this PC</div>
          </div>
        </div>
        <div className="px-3 font-mono text-[10px] text-slate-600">{BRAND.legalName} v1.0.0</div>
      </div>
    </aside>
  );
}

/** Compact icon rail for small screens. */
export function MobileNav({ route, navigate }: { route: Route; navigate: (r: Route) => void }) {
  const { t } = useI18n();
  const getLabel = (r: Route) => {
    const key = `nav.${r}` as I18nKey;
    try {
      const loc = t(key);
      if (loc && loc !== key) return loc;
    } catch {
      // fallback
    }
    return ROUTE_LABELS[r];
  };

  const entries: NavEntry[] = [
    { route: 'overview', label: getLabel('overview'), icon: LayoutDashboard },
    { route: 'labels', label: getLabel('labels'), icon: ScanBarcode },
    { route: 'recorder', label: getLabel('recorder'), icon: Video },
    { route: 'claims', label: getLabel('claims'), icon: Radar },
    { route: 'money', label: ROUTE_LABELS.money, icon: IndianRupee },
    { route: 'vault', label: getLabel('vault'), icon: FolderArchive },
    { route: 'pricing', label: getLabel('pricing'), icon: IndianRupee },
    { route: 'settings', label: getLabel('settings'), icon: Settings }
  ];
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line bg-ink-900 px-3 py-2 md:hidden">
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
              layoutId="mobile-sidebar-active-gold-indicator"
              className="absolute inset-0 rounded-lg border border-proof-400/40 bg-proof-500/10 shadow-[0_0_10px_rgba(201,164,92,0.15)]"
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            />
          )}
          <Icon className="relative z-10 h-3.5 w-3.5" />
          <span className="relative z-10">{label}</span>
        </button>
      ))}
    </div>
  );
}

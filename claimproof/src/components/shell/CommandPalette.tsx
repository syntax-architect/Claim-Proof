/* Command palette — ⌘K / Ctrl+K universal control. Linear-grade polish. */

import { BRAND } from '../../config/brand';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CornerDownLeft,
  FileText,
  FolderOpen,
  IndianRupee,
  LayoutDashboard,
  LifeBuoy,
  MonitorDown,
  Radar,
  RotateCcw,
  ScanBarcode,
  Search,
  Settings,
  ShieldCheck,
  SunMoon,
  Video,
  Volume2,
  VolumeX,
  type LucideIcon
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react';
import { isBeepsMuted, setBeepsMuted } from '../../lib/audioBeeps';
import { ROUTES, ROUTE_LABELS, navigateTo } from '../../lib/router';
import { currentTheme, toggleTheme } from '../../lib/theme';
import { connectVault } from '../../services/vaultWriter';
import { cn } from '../../lib/utils';
import { EmptyState, Kbd, useToast } from '../ui';

interface Command {
  id: string;
  label: string;
  icon: LucideIcon;
  group: 'Navigate' | 'Actions';
  run: () => void;
  available?: boolean;
}

const ROUTE_ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  labels: ScanBarcode,
  recorder: Video,
  claims: Radar,
  vault: FolderOpen,
  pricing: IndianRupee,
  settings: Settings,
  privacy: ShieldCheck,
  terms: FileText,
  refund: RotateCcw,
  support: LifeBuoy
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [beeps, setBeeps] = useState(() => isBeepsMuted());
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = ROUTES.map((r) => ({
      id: `nav-${r}`,
      label: ROUTE_LABELS[r],
      icon: ROUTE_ICONS[r] ?? ScanBarcode,
      group: 'Navigate',
      run: () => navigateTo(r)
    }));
    const actions: Command[] = [
      {
        id: 'theme',
        label: 'Toggle light / dark theme',
        icon: SunMoon,
        group: 'Actions',
        run: () => {
          toggleTheme(currentTheme());
          window.dispatchEvent(new Event('cp-theme-changed'));
        }
      },
      {
        id: 'sound',
        label: beeps ? 'Unmute scanner beeps' : 'Mute scanner beeps',
        icon: beeps ? VolumeX : Volume2,
        group: 'Actions',
        run: () => {
          setBeepsMuted(!isBeepsMuted());
          setBeeps(isBeepsMuted());
        }
      },
      {
        id: 'vault',
        label: 'Connect evidence vault folder',
        icon: FolderOpen,
        group: 'Actions',
        run: () => {
          void connectVault()
            .then((mode) =>
              toast.success(
                mode === 'fs-api' ? 'Vault connected' : 'Downloads fallback active',
                mode === 'fs-api'
                  ? 'Evidence writes straight to disk.'
                  : 'This browser has no File System Access API.'
              )
            )
            .catch(() => toast.warn('Vault connection cancelled'));
        }
      }
    ];
    if (window.__cpInstallAvailable && window.__cpInstall) {
      actions.push({
        id: 'install',
        label: `Install ${BRAND.name} as a desktop app`,
        icon: MonitorDown,
        group: 'Actions',
        available: true,
        run: () => {
          window.__cpInstall?.();
          toast.info('Install started', `${BRAND.name} will open in its own window.`);
        }
      });
    }
    return [...nav, ...actions];
  }, [toast, beeps]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands
      .filter((c) => c.label.toLowerCase().includes(q))
      .sort((a, b) => {
        const as = a.label.toLowerCase().startsWith(q) ? 0 : 1;
        const bs = b.label.toLowerCase().startsWith(q) ? 0 : 1;
        return as - bs;
      });
  }, [commands, query]);

  useEffect(() => {
    setIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      setQuery('');
      setBeeps(isBeepsMuted());
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    } else if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  function runCommand(cmd: Command | undefined): void {
    if (!cmd) return;
    onClose();
    cmd.run();
  }

  function onKeyDown(e: ReactKeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runCommand(filtered[index]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  /* Grouped rendering preserving filter order. */
  const groups: { group: string; items: { cmd: Command; globalIndex: number }[] }[] = [];
  filtered.forEach((cmd, globalIndex) => {
    const last = groups[groups.length - 1];
    if (last && last.group === cmd.group) last.items.push({ cmd, globalIndex });
    else groups.push({ group: cmd.group, items: [{ cmd, globalIndex }] });
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <button
            type="button"
            aria-label="Close command palette"
            tabIndex={-1}
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            className="glass relative w-full max-w-xl overflow-hidden border-line-bright shadow-2xl"
            initial={{ opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
          >
            <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                aria-label="Search commands"
                placeholder="Search commands…"
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
              />
              <Kbd>esc</Kbd>
            </div>
            <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No matching commands"
                  description={`No commands found matching "${query}". Try searching for pages, themes, or sounds.`}
                  primaryAction={{
                    label: 'Clear search',
                    onClick: () => setQuery(''),
                    variant: 'secondary'
                  }}
                  className="py-6"
                />
              ) : (
                groups.map(({ group, items }) => (
                  <div key={group} className="pb-1">
                    <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {group}
                    </div>
                    {items.map(({ cmd, globalIndex }) => {
                      const active = globalIndex === index;
                      return (
                        <button
                          key={cmd.id}
                          ref={active ? activeRef : undefined}
                          type="button"
                          onMouseEnter={() => setIndex(globalIndex)}
                          onClick={() => runCommand(cmd)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                            active ? 'bg-proof-50 text-slate-200' : 'text-slate-400'
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors',
                              active
                                ? 'border-transparent bg-proof-500'
                                : 'border-line bg-ink-800/60'
                            )}
                          >
                            <cmd.icon
                              className={cn(
                                'h-3.5 w-3.5',
                                active ? 'text-on-accent' : 'text-slate-300'
                              )}
                            />
                          </span>
                          <span className="flex-1 truncate">{cmd.label}</span>
                          {active && <CornerDownLeft className="h-3.5 w-3.5 text-slate-500" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate · <Kbd>enter</Kbd> run
              </span>
              <span>{BRAND.name} Command</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

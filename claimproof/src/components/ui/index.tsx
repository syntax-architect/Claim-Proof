/* ClaimProof UI kit — dark control-room primitives.
 * Every module builds on these; do not hand-roll variants elsewhere. */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  X,
  XCircle,
  type LucideIcon
} from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode
} from 'react';
import { cn } from '../../lib/utils';

/* ── Card ────────────────────────────────────────────────────────────── */

export function Card({
  className,
  children,
  hover = false,
  glow = false
}: {
  className?: string;
  children: ReactNode;
  hover?: boolean;
  glow?: boolean;
}) {
  return (
    <div
      className={cn(
        'glass',
        hover && 'hover:-translate-y-0.5 hover:border-line-bright',
        glow && 'border-proof-500/35 shadow-[0_10px_36px_-16px_rgba(5,150,105,0.35)]',
        className
      )}
    >
      {children}
    </div>
  );
}

/* ── Stagger (framer-motion list reveal helpers) ───────────────────── */

export function Stagger({
  children,
  className,
  gap = 0.06,
  delay = 0
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="off"
      animate="on"
      variants={{
        on: { transition: { staggerChildren: gap, delayChildren: delay } }
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  y = 14
}: {
  children: ReactNode;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        off: { opacity: 0, y },
        on: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } }
      }}
    >
      {children}
    </motion.div>
  );
}

/* ── Button ──────────────────────────────────────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-proof-500 text-on-accent font-semibold hover:bg-proof-600 active:bg-proof-700 shadow-sm hover:shadow-md active:scale-[0.98]',
  secondary: 'bg-ink-700/70 text-slate-100 border border-line hover:bg-ink-600 hover:border-line-bright active:scale-[0.98]',
  ghost: 'text-slate-400 hover:text-slate-200 hover:bg-ink-800/70',
  outline: 'border border-proof-500/45 text-proof-300 hover:bg-proof-500/10 hover:border-proof-500/70 active:scale-[0.98]',
  danger: 'bg-danger-500/90 text-white hover:bg-danger-500 border border-danger-400/40 active:scale-[0.98]'
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs rounded-lg gap-1.5',
  sm: 'h-8 px-3 text-[13px] rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-6 text-[15px] rounded-xl gap-2.5',
  xl: 'h-14 px-8 text-base rounded-2xl gap-3'
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex select-none items-center justify-center font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proof-500/60',
        'disabled:pointer-events-none disabled:opacity-45',
        BUTTON_SIZES[size],
        BUTTON_VARIANTS[variant],
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      ) : (
        Icon && <Icon className={size === 'xs' || size === 'sm' ? 'h-3.5 w-3.5 shrink-0' : 'h-4 w-4 shrink-0'} />
      )}
      {children}
      {IconRight && <IconRight className={size === 'xs' || size === 'sm' ? 'h-3.5 w-3.5 shrink-0' : 'h-4 w-4 shrink-0'} />}
    </button>
  );
}

/* ── Badge / Kbd / StatusDot ─────────────────────────────────────────── */

export type BadgeTone = 'neutral' | 'proof' | 'warn' | 'danger' | 'info' | 'outline' | 'mono';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-ink-700/80 text-slate-300 border border-line',
  proof: 'bg-proof-500/15 text-proof-300 border border-proof-500/30',
  warn: 'bg-warn-500/15 text-warn-300 border border-warn-500/30',
  danger: 'bg-danger-500/15 text-danger-300 border border-danger-500/30',
  info: 'bg-info-500/15 text-info-300 border border-info-500/30',
  outline: 'bg-transparent text-slate-400 border border-line-bright',
  mono: 'bg-ink-800 text-slate-200 border border-line font-mono'
};

export function Badge({
  tone = 'neutral',
  className,
  children
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold leading-4 tracking-wide',
        BADGE_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line-bright bg-ink-800/80 px-1.5 font-mono text-[10px] font-semibold text-slate-400 shadow-[0_1px_0_rgba(0,0,0,0.25)]',
        className
      )}
    >
      {children}
    </kbd>
  );
}

export function StatusDot({
  tone = 'proof',
  pulse = false,
  className
}: {
  tone?: 'proof' | 'warn' | 'danger' | 'info' | 'neutral';
  pulse?: boolean;
  className?: string;
}) {
  const color =
    tone === 'proof'
      ? 'bg-proof-400'
      : tone === 'warn'
        ? 'bg-warn-400'
        : tone === 'danger'
          ? 'bg-danger-400'
          : tone === 'info'
            ? 'bg-info-400'
            : 'bg-slate-500';
  return (
    <span className={cn('relative inline-flex h-2 w-2 shrink-0', className)}>
      <span className={cn('absolute inset-0 rounded-full', color)} />
      {pulse && (
        <span className={cn('absolute inset-0 animate-ping-slow rounded-full', color)} />
      )}
    </span>
  );
}

/* ── CountUp / StatCard ──────────────────────────────────────────────── */

function CountUp({ value, duration = 750 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else prev.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{display.toLocaleString('en-IN')}</>;
}

const STAT_TONES = {
  proof: { chip: 'bg-proof-500/12 text-proof-300 border-proof-500/25', bar: 'from-proof-600 to-proof-400' },
  warn: { chip: 'bg-warn-500/12 text-warn-300 border-warn-500/25', bar: 'from-warn-600 to-warn-400' },
  danger: { chip: 'bg-danger-500/12 text-danger-300 border-danger-500/25', bar: 'from-danger-600 to-danger-400' },
  info: { chip: 'bg-info-500/12 text-info-300 border-info-500/25', bar: 'from-info-500 to-info-300' }
} as const;

export function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  sub,
  tone = 'proof',
  progress,
  className
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  suffix?: string;
  sub?: ReactNode;
  tone?: keyof typeof STAT_TONES;
  progress?: { value: number; max: number };
  className?: string;
}) {
  const t = STAT_TONES[tone];
  const pct =
    progress && progress.max > 0 ? Math.min(100, Math.round((progress.value / progress.max) * 100)) : null;
  return (
    <Card hover className={cn('relative overflow-hidden p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {label}
          </div>
          <div className="mt-2 font-display text-3xl font-bold tracking-tight text-white mono-tabular">
            {typeof value === 'number' ? <CountUp value={value} /> : value}
            {suffix && <span className="ml-1 text-lg font-semibold text-slate-400">{suffix}</span>}
          </div>
          {sub && <div className="mt-1.5 text-xs text-slate-400">{sub}</div>}
        </div>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', t.chip)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {pct !== null && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink-700">
          <div
            className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', t.bar)}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </Card>
  );
}

/* ── Ring (circular progress) ────────────────────────────────────────── */

const RING_COLORS: Record<string, string> = {
  proof: 'var(--cp-accent-solid)',
  warn: '#f59e0b',
  danger: '#ef4444',
  info: '#0ea5e9',
  neutral: 'var(--cp-surface-3)'
};

export function Ring({
  progress,
  size = 52,
  stroke = 5,
  tone = 'proof',
  className,
  children
}: {
  progress: number;
  size?: number;
  stroke?: number;
  tone?: keyof typeof RING_COLORS;
  className?: string;
  children?: ReactNode;
}) {
  const clamped = Math.max(0, Math.min(1, progress));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--cp-surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={RING_COLORS[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}

/* ── ProgressBar ─────────────────────────────────────────────────── */

export function ProgressBar({
  value,
  max,
  tone = 'proof',
  className
}: {
  value: number;
  max: number;
  tone?: 'proof' | 'warn' | 'danger' | 'info';
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const bar =
    tone === 'warn'
      ? 'from-warn-600 to-warn-400'
      : tone === 'danger'
        ? 'from-danger-600 to-danger-400'
        : tone === 'info'
          ? 'from-info-500 to-info-300'
          : 'from-proof-600 to-proof-400';
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-ink-700', className)}>
      <div
        className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', bar)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ── Toggle / Segmented / Field ──────────────────────────────────────── */

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled = false
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
  hint?: string;
  disabled?: boolean;
}) {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proof-500/60',
        checked ? 'border-proof-400/60 bg-proof-500' : 'border-line-bright bg-ink-600',
        disabled && 'pointer-events-none opacity-40'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-[#ffffff] shadow transition-transform duration-200',
          checked ? 'translate-x-[19px]' : 'translate-x-0.5'
        )}
      />
    </button>
  );
  if (!label && !hint) return control;
  return (
    <label className={cn('flex cursor-pointer items-center justify-between gap-4', disabled && 'opacity-50')}>
      <span className="min-w-0">
        {label && <span className="block text-sm text-slate-200">{label}</span>}
        {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
      </span>
      {control}
    </label>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('glass-soft inline-flex items-center gap-1 p-1', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all',
            value === opt.value
              ? 'bg-ink-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      {children}
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

/* ── Modal ───────────────────────────────────────────────────────────── */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  width = 'lg',
  children,
  footer
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  width?: 'md' | 'lg' | 'xl' | 'full';
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const maxW =
    width === 'md' ? 'max-w-md' : width === 'lg' ? 'max-w-2xl' : width === 'xl' ? 'max-w-5xl' : 'max-w-[92rem]';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="absolute inset-0 bg-ink-950/85 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className={cn(
              'glass relative flex max-h-[88vh] w-full flex-col border-line-bright bg-ink-900/95 shadow-2xl',
              maxW
            )}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            role="dialog"
            aria-modal="true"
          >
            {(title || Icon) && (
              <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  {Icon && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-proof-500/25 bg-proof-500/12 text-proof-300">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-display text-lg font-bold text-white">{title}</div>
                    {subtitle && <div className="mt-0.5 text-xs text-slate-400">{subtitle}</div>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-ink-700 hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && <div className="border-t border-line px-6 py-4">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── EmptyState ──────────────────────────────────────────────────────── */

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-line-bright bg-ink-850 text-slate-500">
        <Icon className="h-6 w-6" />
      </div>
      <div className="mt-4 font-display text-base font-semibold text-slate-200">{title}</div>
      {hint && <div className="mt-1 max-w-sm text-sm text-slate-500">{hint}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ── PageHeader ──────────────────────────────────────────────────────── */

export function PageHeader({
  icon: Icon,
  kicker,
  title,
  subtitle,
  actions,
  className
}: {
  icon: LucideIcon;
  kicker?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-4', className)}>
      <div className="flex items-center gap-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-proof-500/25 bg-proof-500/12 text-proof-300">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          {kicker && (
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-proof-300">
              {kicker}
            </div>
          )}
          <h1 className="font-display text-[22px] font-bold leading-tight tracking-tight text-white">
            {title}
          </h1>
          {subtitle && <div className="mt-0.5 text-sm text-slate-400">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ── Logo ────────────────────────────────────────────────────────────── */

export function LogoMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="14" fill="#0A0E13" stroke="#1B2432" />
      <g stroke="#34D399" strokeWidth="4.5" strokeLinecap="round" fill="none">
        <path d="M14 23 V17 a3 3 0 0 1 3 -3 h6" />
        <path d="M41 14 h6 a3 3 0 0 1 3 3 v6" />
        <path d="M50 41 v6 a3 3 0 0 1 -3 3 h-6" />
        <path d="M23 50 h-6 a3 3 0 0 1 -3 -3 v-6" />
      </g>
      <rect x="23" y="25" width="18" height="14" rx="2.5" fill="none" stroke="#6EE7B7" strokeWidth="3" />
      <path d="M35.5 27.5 l-5 4.5 h3.4 l-2.4 4.5 5.6 -5.2 h-3.4 z" fill="#FBBF24" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark size={32} />
      <div className="leading-none">
        <div className="font-display text-[17px] font-bold tracking-tight text-white">
          ClaimProof<span className="text-proof-400">.in</span>
        </div>
        <div className="mt-1 font-mono text-[9px] font-medium uppercase tracking-[0.24em] text-slate-500">
          Proof Suite
        </div>
      </div>
    </div>
  );
}

/* ── Toasts ──────────────────────────────────────────────────────────── */

export interface ToastPayload {
  tone: 'success' | 'error' | 'info' | 'warn';
  title: string;
  message?: string;
}

interface ToastItem extends ToastPayload {
  id: number;
}

interface ToastApi {
  toast: (t: ToastPayload) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warn: (title: string, message?: string) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

const TOAST_ICONS: Record<ToastItem['tone'], LucideIcon> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warn: AlertTriangle
};

const TOAST_STYLES: Record<ToastItem['tone'], string> = {
  success: 'border-proof-500/40 text-proof-300',
  error: 'border-danger-500/40 text-danger-300',
  info: 'border-info-500/40 text-info-300',
  warn: 'border-warn-500/40 text-warn-300'
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((t: ToastPayload) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-4), { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (title, message) => toast({ tone: 'success', title, message }),
      error: (title, message) => toast({ tone: 'error', title, message }),
      info: (title, message) => toast({ tone: 'info', title, message }),
      warn: (title, message) => toast({ tone: 'warn', title, message })
    }),
    [toast]
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(92vw,360px)] flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = TOAST_ICONS[t.tone];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 40, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="glass pointer-events-auto flex items-start gap-3 border-line-bright bg-ink-900/95 p-3.5 shadow-xl"
              >
                <Icon className={cn('mt-0.5 h-4.5 w-4.5 shrink-0', TOAST_STYLES[t.tone].split(' ')[1])} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">{t.title}</div>
                  {t.message && <div className="mt-0.5 text-xs leading-relaxed text-slate-400">{t.message}</div>}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

/* ── Spinner ─────────────────────────────────────────────────────────── */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin text-proof-400', className)} />;
}

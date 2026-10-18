import clsx from 'clsx';
import { motion } from 'framer-motion';
import { Check, ChevronDown, Copy, type LucideIcon } from 'lucide-react';
import { useCallback, useState, type ReactNode, type SelectHTMLAttributes } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatedNumber, spring } from '../../shared/motion';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={clsx('relative', className)}>
      <select {...rest} className="input h-10 w-full cursor-pointer appearance-none py-0 pr-9 text-[13.5px] font-medium shadow-soft">
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[12px] leading-snug text-muted">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx('flex h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors disabled:opacity-50', checked ? 'bg-brand' : 'bg-surface-3')}
    >
      <motion.span layout transition={spring} className={clsx('h-5 w-5 rounded-full bg-white shadow-soft', checked && 'ml-auto')} />
    </button>
  );
}

export function Card({
  title,
  icon,
  actions,
  children,
  className,
  pad = true,
  delay = 0,
}: {
  title?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: boolean;
  delay?: number;
}) {
  const Icon = icon;
  return (
    <section className={clsx('page-in card overflow-hidden shadow-card', className)} style={{ animationDelay: `${delay * 1000}ms` }}>
      {title && (
        <div className="flex items-center justify-between gap-2 border-b border-line/60 px-5 py-4">
          <h2 className="flex items-center gap-2.5 font-display text-[15.5px] font-bold">
            {Icon && (
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Icon className="h-4 w-4" />
              </span>
            )}
            {title}
          </h2>
          {actions}
        </div>
      )}
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

const TONE = {
  brand: { fg: 'var(--c-brand)', bg: 'color-mix(in srgb, var(--c-brand) 12%, transparent)' },
  good: { fg: '#16a34a', bg: '#16a34a1a' },
  warning: { fg: '#d97706', bg: '#f59e0b1f' },
  danger: { fg: '#dc2626', bg: '#ef44441a' },
  info: { fg: '#0284c7', bg: '#0ea5e91a' },
  violet: { fg: '#7c3aed', bg: '#8b5cf61a' },
};

export function KpiTile({
  label,
  value,
  sub,
  tone = 'brand',
  icon: Icon,
  delay = 0,
  suffix,
}: {
  label: string;
  value: number | string;
  sub?: ReactNode;
  tone?: keyof typeof TONE;
  icon?: LucideIcon;
  delay?: number;
  suffix?: string;
}) {
  const t = TONE[tone];
  return (
    <div
      className="page-in card relative overflow-hidden p-4 shadow-card transition-transform duration-300 hover:-translate-y-0.5"
      style={{ animationDelay: `${delay * 1000}ms` }}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-60 blur-2xl" style={{ backgroundColor: t.bg }} />
      <div className="relative flex items-start justify-between gap-2">
        <p className="text-[12.5px] font-semibold text-muted">{label}</p>
        {Icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: t.bg, color: t.fg }}>
            <Icon className="h-4 w-4" strokeWidth={2.3} />
          </span>
        )}
      </div>
      <p className="relative mt-2 font-display text-[28px] font-extrabold leading-none tracking-tight">
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
        {suffix}
      </p>
      {sub && <p className="relative mt-2 text-[12px] text-muted">{sub}</p>}
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={clsx('whitespace-nowrap px-4 py-3 text-left text-[11.5px] font-bold uppercase tracking-wide text-muted', className)}>{children}</th>;
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={clsx('px-4 py-3.5 align-middle', className)}>{children}</td>;
}

/** Jadval satri — ketma-ket paydo bo'ladi */
export function Tr({ children, onClick, index = 0, className }: { children: ReactNode; onClick?: () => void; index?: number; className?: string }) {
  return (
    <motion.tr
      initial={false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, delay: Math.min(index, 15) * 0.02 }}
      onClick={onClick}
      className={clsx('transition-colors', onClick && 'cursor-pointer hover:bg-surface-2/70', className)}
    >
      {children}
    </motion.tr>
  );
}

/** Segmentli tanlov (tugmalar guruhi) */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  id,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  id: string;
}) {
  return (
    <div className="flex rounded-xl bg-surface p-1 shadow-soft ring-1 ring-line/70">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={clsx('relative rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors', value === o.value ? 'text-white' : 'text-muted hover:text-fg')}
        >
          {value === o.value && <motion.span layoutId={`seg-${id}`} transition={spring} className="absolute inset-0 rounded-lg bg-brand-gradient shadow-glow" />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Istalgan sahifadan lid kartasini (drawer) ochish: ?lead=ID */
export function useOpenLead() {
  const [params, setParams] = useSearchParams();
  return useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(params);
      if (id) next.set('lead', id);
      else next.delete('lead');
      setParams(next, { replace: !id });
    },
    [params, setParams],
  );
}

export function CopyField({ value, onCopy }: { value: string; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-xl bg-surface-2 px-3.5 py-2.5 font-mono text-[13px] ring-1 ring-line/60">{value}</code>
      <motion.button
        whileTap={{ scale: 0.94 }}
        type="button"
        className={clsx(
          'flex h-10 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold ring-1 transition-colors',
          copied ? 'bg-emerald-500/10 text-good ring-emerald-500/30' : 'bg-surface ring-line hover:bg-surface-2',
        )}
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            onCopy?.();
            setTimeout(() => setCopied(false), 1600);
          });
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Olindi' : 'Nusxa'}
      </motion.button>
    </div>
  );
}

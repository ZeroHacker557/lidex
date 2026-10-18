import clsx from 'clsx';
import { useCallback, type ReactNode, type SelectHTMLAttributes } from 'react';
import { useSearchParams } from 'react-router-dom';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={clsx('input h-10 cursor-pointer py-0 pr-8 text-sm', className)}>
      {children}
    </select>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
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
      className={clsx('relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50', checked ? 'bg-brand' : 'bg-line')}
    >
      <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

export function Card({ title, actions, children, className, pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={clsx('card shadow-card', className)}>
      {title && (
        <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3.5">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {actions}
        </div>
      )}
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

export function KpiTile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'danger' | 'warning' | 'good' }) {
  return (
    <div className="card p-4 shadow-card">
      <p className="text-[13px] text-muted">{label}</p>
      <p
        className={clsx(
          'mt-1.5 text-[26px] font-semibold leading-none tabular-nums',
          tone === 'danger' && 'text-red-600',
          tone === 'warning' && 'text-amber-600',
          tone === 'good' && 'text-emerald-600',
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[12px] text-muted">{sub}</p>}
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={clsx('whitespace-nowrap px-4 py-2.5 text-left text-[12px] font-medium text-muted', className)}>{children}</th>;
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={clsx('px-4 py-3 align-middle', className)}>{children}</td>;
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
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-2 px-3 py-2 font-mono text-[13px]">{value}</code>
      <button
        type="button"
        className="rounded-lg border border-line px-3 py-2 text-[13px] font-medium hover:bg-surface-2"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => onCopy?.());
        }}
      >
        Nusxa
      </button>
    </div>
  );
}

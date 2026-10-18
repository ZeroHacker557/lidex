import clsx from 'clsx';
import { Loader2, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { STATUS_META, type LeadStatus } from '@shared/statuses';
import { initials } from './format';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('animate-spin', className ?? 'h-5 w-5')} />;
}

export function FullScreenLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted">
      <Spinner className="h-7 w-7" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex select-none items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'h-8 px-3 text-[13px]',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-5 text-[15px]',
        variant === 'primary' && 'bg-brand text-brand-fg hover:brightness-110',
        variant === 'secondary' && 'bg-surface-2 text-fg hover:bg-line/60',
        variant === 'outline' && 'border border-line bg-surface text-fg hover:bg-surface-2',
        variant === 'ghost' && 'text-fg hover:bg-surface-2',
        variant === 'danger' && 'bg-danger text-white hover:brightness-110',
        className,
      )}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function StatusBadge({ status, size = 'md', short }: { status: LeadStatus; size?: 'sm' | 'md'; short?: boolean }) {
  const m = STATUS_META[status];
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
      )}
      style={{ color: m.color, backgroundColor: `${m.color}1f` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: m.color }} />
      {short ? m.short : m.label}
    </span>
  );
}

export function StatusDot({ status, className }: { status: LeadStatus; className?: string }) {
  return <span className={clsx('inline-block h-2.5 w-2.5 rounded-full', className)} style={{ backgroundColor: STATUS_META[status].color }} />;
}

export function Avatar({ name, online, size = 36 }: { name: string | null | undefined; online?: boolean; size?: number }) {
  // Ismdan barqaror rang
  let h = 0;
  for (const ch of name ?? '') h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white"
        style={{ background: `hsl(${h} 55% 52%)`, fontSize: size * 0.38 }}
      >
        {initials(name)}
      </span>
      {online !== undefined && (
        <span
          className={clsx('absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface', online ? 'bg-green-500' : 'bg-slate-400')}
        />
      )}
    </span>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Xatolik yuz berdi';
  return (
    <div className="m-4 rounded-2xl border border-danger/30 bg-danger/5 p-4 text-sm">
      <p className="font-medium text-danger">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Qayta urinish
        </Button>
      )}
    </div>
  );
}

/** Pastdan chiquvchi panel (Mini App) va markaziy oyna (admin, md+) */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div className="absolute inset-0 animate-fade-in bg-black/40" onClick={onClose} />
      <div
        className={clsx(
          'relative flex max-h-[92vh] w-full animate-slide-up flex-col rounded-t-3xl bg-surface shadow-pop md:rounded-2xl',
          wide ? 'md:max-w-2xl' : 'md:max-w-md',
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line md:hidden" />
        {title && (
          <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
            <h3 className="text-[17px] font-semibold">{title}</h3>
            <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-surface-2" aria-label="Yopish">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="border-t border-line px-5 py-3 pb-safe">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- Toast ----------

interface Toast {
  id: number;
  text: string;
  tone: 'success' | 'error' | 'info';
}
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'pointer-events-auto max-w-sm animate-fade-in rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-pop',
              t.tone === 'success' && 'bg-emerald-600',
              t.tone === 'error' && 'bg-red-600',
              t.tone === 'info' && 'bg-slate-800',
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'Xatolik yuz berdi';
}

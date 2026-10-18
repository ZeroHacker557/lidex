import clsx from 'clsx';
import { AnimatePresence, motion, useDragControls, type HTMLMotionProps } from 'framer-motion';
import { CircleAlert, CircleCheckBig, Info, Loader2, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { STATUS_META, type LeadStatus } from '@shared/statuses';
import { initials } from './format';
import { ease, spring } from './motion';
import { STATUS_ICON } from './statusIcons';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('animate-spin', className ?? 'h-5 w-5')} />;
}

export function FullScreenLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-muted">
      <div className="relative h-12 w-12">
        <span className="absolute inset-0 animate-pulse-ring rounded-2xl bg-brand/30" />
        <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-brand-gradient shadow-glow">
          <Logo className="h-6 w-6 text-white" />
        </span>
      </div>
      {label && <p className="text-sm font-medium">{label}</p>}
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M6 4v13.5A2.5 2.5 0 0 0 8.5 20H19" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="17" cy="7" r="2.6" fill="currentColor" />
    </svg>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'soft';

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...rest
}: HTMLMotionProps<'button'> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean; children?: ReactNode }) {
  return (
    <motion.button
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      transition={spring}
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold outline-none transition-[background,box-shadow,color,opacity] duration-200 focus-visible:ring-4 focus-visible:ring-brand/25 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'h-8 px-3 text-[13px]',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-5 text-[15px]',
        variant === 'primary' && 'bg-brand-gradient text-brand-fg shadow-glow hover:brightness-110',
        variant === 'secondary' && 'bg-surface-2 text-fg hover:bg-surface-3',
        variant === 'soft' && 'bg-brand/10 text-brand hover:bg-brand/15',
        variant === 'outline' && 'border border-line bg-surface text-fg shadow-soft hover:border-muted/40 hover:bg-surface-2',
        variant === 'ghost' && 'text-muted hover:bg-surface-2 hover:text-fg',
        variant === 'danger' && 'bg-danger text-white hover:brightness-110',
        className,
      )}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </motion.button>
  );
}

export function StatusIcon({ status, className }: { status: LeadStatus; className?: string }) {
  const Icon = STATUS_ICON[status];
  return <Icon className={className ?? 'h-4 w-4'} style={{ color: STATUS_META[status].color }} strokeWidth={2.2} />;
}

export function StatusBadge({ status, size = 'md', short }: { status: LeadStatus; size?: 'sm' | 'md'; short?: boolean }) {
  const m = STATUS_META[status];
  const Icon = STATUS_ICON[status];
  return (
    <motion.span
      key={status}
      initial={{ scale: 0.85 }}
      animate={{ scale: 1 }}
      transition={spring}
      className={clsx(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
      )}
      style={{ color: m.color, backgroundColor: `${m.color}14`, ['--tw-ring-color' as string]: `${m.color}33` }}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={2.4} />
      {short ? m.short : m.label}
    </motion.span>
  );
}

export function StatusDot({ status, className }: { status: LeadStatus; className?: string }) {
  return <span className={clsx('inline-block h-2.5 w-2.5 rounded-full', className)} style={{ backgroundColor: STATUS_META[status].color }} />;
}

export function Avatar({ name, online, size = 36, ring }: { name: string | null | undefined; online?: boolean; size?: number; ring?: string }) {
  let h = 0;
  for (const ch of name ?? '') h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        className="flex h-full w-full items-center justify-center rounded-full font-display font-bold text-white"
        style={{
          background: `linear-gradient(135deg, hsl(${h} 70% 62%), hsl(${(h + 40) % 360} 65% 48%))`,
          fontSize: size * 0.36,
          boxShadow: ring ? `0 0 0 2px var(--c-surface), 0 0 0 4px ${ring}` : undefined,
        }}
      >
        {initials(name)}
      </span>
      {online !== undefined && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-surface">
          <span className={clsx('h-2.5 w-2.5 rounded-full', online ? 'bg-emerald-500' : 'bg-slate-400')} />
          {online && <span className="absolute h-2.5 w-2.5 animate-pulse-ring rounded-full bg-emerald-500" />}
        </span>
      )}
    </span>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <motion.div
      initial={{ y: 8 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.4, ease }}
      className="flex flex-col items-center justify-center px-6 py-14 text-center"
    >
      {icon && (
        <div className="relative mb-4">
          <div className="absolute inset-0 scale-150 rounded-full bg-brand/10 blur-2xl" />
          <div className="relative flex h-16 w-16 animate-float items-center justify-center rounded-2xl bg-surface text-brand shadow-lift ring-1 ring-line">
            {icon}
          </div>
        </div>
      )}
      <p className="font-display text-[17px] font-bold">{title}</p>
      {text && <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Xatolik yuz berdi';
  return (
    <div className="m-4 flex gap-3 rounded-2xl border border-danger/25 bg-danger/5 p-4 text-sm">
      <CircleAlert className="h-5 w-5 shrink-0 text-danger" />
      <div>
        <p className="font-semibold text-danger">{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            Qayta urinish
          </Button>
        )}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />;
}

/** Pastdan chiquvchi panel (mobil, sudrab yopish mumkin) / markaziy oyna (md+) */
export function Sheet({
  open,
  onClose,
  title,
  icon,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const drag = useDragControls();
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const on = () => setDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
          <motion.div
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={clsx(
              'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-surface shadow-pop ring-1 ring-line/60 md:rounded-3xl',
              wide ? 'md:max-w-2xl' : 'md:max-w-md',
            )}
            initial={desktop ? { opacity: 0, scale: 0.96, y: 12 } : { y: '100%' }}
            animate={desktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={desktop ? { opacity: 0, scale: 0.97, y: 8 } : { y: '100%' }}
            transition={desktop ? { duration: 0.24, ease } : spring}
            drag={desktop ? false : 'y'}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_e, info) => (info.offset.y > 110 || info.velocity.y > 600) && onClose()}
          >
            <div className="flex justify-center pb-1 pt-2.5 md:hidden" onPointerDown={(e) => drag.start(e)} style={{ touchAction: 'none' }}>
              <span className="h-1.5 w-11 rounded-full bg-line" />
            </div>
            {title && (
              <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-2 md:pt-5" onPointerDown={(e) => !desktop && drag.start(e)}>
                <h3 className="flex items-center gap-2.5 font-display text-[18px] font-bold">
                  {icon}
                  {title}
                </h3>
                <button onClick={onClose} className="rounded-full p-1.5 text-muted transition hover:bg-surface-2 hover:text-fg" aria-label="Yopish">
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            <div className="thin-scroll overflow-y-auto px-5 pb-5">{children}</div>
            {footer && <div className="border-t border-line/70 bg-surface px-5 py-3.5 pb-safe">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
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
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-4">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icon = t.tone === 'success' ? CircleCheckBig : t.tone === 'error' ? CircleAlert : Info;
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: -24, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.95, transition: { duration: 0.18 } }}
                transition={spring}
                className="pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-2xl bg-slate-900/95 py-2.5 pl-3 pr-4 text-[13.5px] font-medium text-white shadow-pop ring-1 ring-white/10 backdrop-blur"
              >
                <Icon
                  className={clsx('h-[18px] w-[18px] shrink-0', t.tone === 'success' && 'text-emerald-400', t.tone === 'error' && 'text-red-400', t.tone === 'info' && 'text-sky-400')}
                />
                {t.text}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'Xatolik yuz berdi';
}

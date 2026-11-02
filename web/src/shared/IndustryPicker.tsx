import clsx from 'clsx';
import { INDUSTRIES, INDUSTRY_META, type Industry } from '@shared/statuses';

/** Mijoz kompaniyasining sohasi: bittasini tanlash, tanlanganini qayta bossa — olib tashlanadi */
export function IndustryPicker({
  value,
  onChange,
  disabled,
}: {
  value: Industry | null | undefined;
  onChange: (v: Industry | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {INDUSTRIES.map((i) => {
        const on = value === i;
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onChange(on ? null : i)}
            aria-pressed={on}
            className={clsx(
              'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors disabled:opacity-60',
              on ? 'bg-brand text-brand-fg shadow-soft' : 'bg-surface-2 text-fg/80 hover:bg-surface-3',
            )}
          >
            <span aria-hidden>{INDUSTRY_META[i].emoji}</span>
            {INDUSTRY_META[i].label}
          </button>
        );
      })}
    </div>
  );
}

/** Kichik belgi (ro'yxat va kartochkalarda) */
export function IndustryTag({ industry, className }: { industry: Industry | null | undefined; className?: string }) {
  if (!industry) return null;
  const m = INDUSTRY_META[industry];
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 font-semibold text-fg/75', className)}>
      <span aria-hidden>{m.emoji}</span>
      {m.label}
    </span>
  );
}

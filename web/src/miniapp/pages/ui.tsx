import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { insideTelegram } from '../telegram';

export function PageTitle({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        {onBack && !insideTelegram && (
          <button onClick={onBack} className="-ml-1 mt-1 rounded-full bg-surface p-1.5 shadow-soft" aria-label="Orqaga">
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div>
          <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-[13.5px] leading-snug text-muted">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

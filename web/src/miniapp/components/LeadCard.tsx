import { AlarmClock, Flag, Phone, Repeat2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { STATUS_META } from '@shared/statuses';
import { formatPhone, smartDate, timeAgo } from '../../shared/format';
import type { Lead } from '../../shared/types';
import { StatusBadge } from '../../shared/ui';
import { haptic } from '../telegram';

export function LeadCard({ lead, showReminder }: { lead: Lead; showReminder?: boolean }) {
  const meta = STATUS_META[lead.status];
  const reminder = lead.status === 'postponed' || lead.status === 'no_answer' ? lead.nextReminderAt : null;
  const overdue = reminder && new Date(reminder).getTime() < Date.now();
  return (
    <Link
      to={`/lead/${lead.id}`}
      onClick={() => haptic.tap()}
      className="relative block overflow-hidden rounded-2xl bg-surface p-3.5 pl-4 shadow-card active:opacity-80"
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: meta.color }} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">
            {lead.name ?? <span className="text-muted">Ism ko'rsatilmagan</span>}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
            <Phone className="h-3.5 w-3.5" />
            {formatPhone(lead.phone)}
          </p>
        </div>
        <StatusBadge status={lead.status} size="sm" short />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>#{lead.seq}</span>
        <span>{timeAgo(lead.createdAt)}</span>
        <span className="truncate">{lead.groupTitle}</span>
        {lead.isDuplicate && (
          <span className="inline-flex items-center gap-1 text-violet-500">
            <Repeat2 className="h-3.5 w-3.5" /> takroriy
          </span>
        )}
        {lead.flagged && (
          <span className="inline-flex items-center gap-1 font-medium text-red-500">
            <Flag className="h-3.5 w-3.5" /> admin belgilagan
          </span>
        )}
      </div>
      {(showReminder || overdue) && reminder && (
        <div
          className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${
            overdue ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-600'
          }`}
        >
          <AlarmClock className="h-3.5 w-3.5" />
          {overdue ? 'Muddati o\'tgan: ' : 'Eslatma: '}
          {smartDate(reminder)}
        </div>
      )}
    </Link>
  );
}

export function LeadCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-card">
      <div className="h-4 w-1/2 animate-pulse rounded bg-surface-2" />
      <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-surface-2" />
      <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-surface-2" />
    </div>
  );
}

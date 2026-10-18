import { motion } from 'framer-motion';
import { AlarmClock, ChevronRight, Flag, Phone, Repeat2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { STATUS_META } from '@shared/statuses';
import { formatPhone, smartDate, timeAgo } from '../../shared/format';
import { itemVariants } from '../../shared/motion';
import { STATUS_ICON } from '../../shared/statusIcons';
import type { Lead } from '../../shared/types';
import { Skeleton } from '../../shared/ui';
import { haptic } from '../telegram';

export function LeadCard({ lead, showReminder }: { lead: Lead; showReminder?: boolean }) {
  const navigate = useNavigate();
  const meta = STATUS_META[lead.status];
  const Icon = STATUS_ICON[lead.status];
  const reminder = lead.status === 'postponed' || lead.status === 'no_answer' ? lead.nextReminderAt : null;
  const overdue = reminder && new Date(reminder).getTime() < Date.now();
  const isNew = lead.status === 'new';

  return (
    <motion.button
      variants={itemVariants}
      layout="position"
      whileTap={{ scale: 0.98 }}
      onClick={() => {
        haptic.tap();
        navigate(`/lead/${lead.id}`);
      }}
      className="group relative flex w-full items-center gap-3 rounded-[20px] border border-line/60 bg-surface p-3.5 text-left shadow-soft"
    >
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: `${meta.color}17`, color: meta.color }}>
        <Icon className="h-5 w-5" strokeWidth={2.3} />
        {isNew && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-surface" style={{ backgroundColor: meta.color }} />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-display text-[15.5px] font-bold">{lead.name ?? <span className="font-medium text-muted">Ism ko'rsatilmagan</span>}</span>
          {lead.flagged && <Flag className="h-3.5 w-3.5 shrink-0 text-danger" fill="currentColor" />}
          {lead.isDuplicate && <Repeat2 className="h-3.5 w-3.5 shrink-0 text-violet-500" />}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
          <Phone className="h-3 w-3" />
          <span className="tabular">{formatPhone(lead.phone)}</span>
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted">
          <span className="rounded-md px-1.5 py-0.5 font-semibold" style={{ backgroundColor: `${meta.color}14`, color: meta.color }}>
            {meta.short}
          </span>
          <span>#{lead.seq}</span>
          <span className="h-1 w-1 rounded-full bg-muted/40" />
          <span>{timeAgo(lead.createdAt)}</span>
        </span>
        {(showReminder || overdue) && reminder && (
          <span
            className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-semibold ${
              overdue ? 'bg-red-500/10 text-danger' : 'bg-amber-500/10 text-warn'
            }`}
          >
            <AlarmClock className="h-3.5 w-3.5" />
            {overdue ? "Muddati o'tgan · " : ''}
            {smartDate(reminder)}
          </span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted/60 transition group-active:translate-x-0.5" />
    </motion.button>
  );
}

export function LeadCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-[20px] border border-line/60 bg-surface p-3.5">
      <Skeleton className="h-11 w-11 rounded-2xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-2/5" />
      </div>
    </div>
  );
}

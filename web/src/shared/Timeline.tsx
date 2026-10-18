import { motion } from 'framer-motion';
import {
  BellRing,
  Eye,
  Flag,
  Inbox,
  Mail,
  PencilLine,
  Repeat2,
  Siren,
  TriangleAlert,
  UserRoundCheck,
  type LucideIcon,
} from 'lucide-react';
import { EVENT_LABELS, STATUS_META } from '@shared/statuses';
import { fullDate } from './format';
import { itemVariants, listVariants } from './motion';
import { STATUS_ICON } from './statusIcons';
import type { LeadEvent } from './types';

const ICONS: Partial<Record<LeadEvent['type'], [LucideIcon, string]>> = {
  created: [Inbox, '#5b5bf6'],
  assigned: [UserRoundCheck, '#0ea5e9'],
  reassigned: [Repeat2, '#8b5cf6'],
  note: [PencilLine, '#64748b'],
  reminder_sent: [BellRing, '#eab308'],
  sla_warning: [TriangleAlert, '#f97316'],
  escalated: [Siren, '#dc2626'],
  admin_message: [Mail, '#5b5bf6'],
  flagged: [Flag, '#dc2626'],
  unflagged: [Flag, '#64748b'],
  viewed: [Eye, '#64748b'],
};

export function Timeline({ events, showActor = true }: { events: LeadEvent[]; showActor?: boolean }) {
  if (!events.length) return <p className="py-4 text-center text-sm text-muted">Hali hech qanday harakat yo'q</p>;
  return (
    <motion.ol className="relative" variants={listVariants} initial="hidden" animate="show">
      <span className="absolute bottom-3 left-[15px] top-3 w-px bg-gradient-to-b from-line via-line to-transparent" />
      {events.map((e) => {
        const toMeta = e.toStatus ? STATUS_META[e.toStatus] : null;
        const isStatus = e.type === 'status_changed' && toMeta && e.toStatus;
        const [Icon, color] = isStatus ? [STATUS_ICON[e.toStatus!], toMeta!.color] : ICONS[e.type] ?? [Inbox, '#64748b'];
        const postponedUntil = typeof e.meta?.postponedUntil === 'string' ? e.meta.postponedUntil : null;
        return (
          <motion.li key={e.id} variants={itemVariants} className="relative flex gap-3 pb-4 last:pb-0">
            <span
              className="relative z-10 flex h-[31px] w-[31px] shrink-0 items-center justify-center rounded-full ring-4 ring-surface"
              style={{ backgroundColor: `${color}1c`, color }}
            >
              <Icon className="h-4 w-4" strokeWidth={2.3} />
            </span>
            <div className="min-w-0 flex-1 pt-1 text-[13.5px] leading-snug">
              {isStatus ? (
                <p className="font-semibold">
                  <span style={{ color }}>{toMeta!.label}</span>
                  {e.fromStatus && e.fromStatus !== 'new' && <span className="font-normal text-muted"> · avval {STATUS_META[e.fromStatus].short}</span>}
                  {e.meta?.edit === true && <span className="ml-1.5 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted">tahrir</span>}
                </p>
              ) : (
                <p className="font-semibold">
                  {EVENT_LABELS[e.type]}
                  {(e.type === 'assigned' || e.type === 'reassigned') && e.text ? <span className="font-normal text-muted"> → {e.text}</span> : ''}
                </p>
              )}
              {postponedUntil && <p className="mt-0.5 text-muted">📅 {fullDate(postponedUntil)} ga</p>}
              {e.text && e.type !== 'assigned' && e.type !== 'reassigned' && (
                <p className="selectable mt-1.5 whitespace-pre-wrap rounded-xl bg-surface-2 px-3 py-2 text-fg/90">{e.text}</p>
              )}
              <p className="mt-1 text-[11.5px] text-muted">
                {fullDate(e.createdAt)}
                {showActor && e.actorType !== 'system' && ` · ${e.actorName}`}
                {e.actorType === 'admin' && ' (admin)'}
              </p>
            </div>
          </motion.li>
        );
      })}
    </motion.ol>
  );
}

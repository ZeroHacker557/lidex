import { EVENT_LABELS, STATUS_META } from '@shared/statuses';
import { fullDate } from './format';
import type { LeadEvent } from './types';

const ICONS: Partial<Record<LeadEvent['type'], string>> = {
  created: '📥',
  assigned: '👤',
  reassigned: '🔁',
  note: '📝',
  reminder_sent: '⏰',
  sla_warning: '⚠️',
  escalated: '🚨',
  admin_message: '✉️',
  flagged: '🚩',
  unflagged: '🏳️',
  viewed: '👁',
};

export function Timeline({ events, showActor = true }: { events: LeadEvent[]; showActor?: boolean }) {
  if (!events.length) return <p className="py-4 text-center text-sm text-muted">Hali hech qanday harakat yo'q</p>;
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {events.map((e) => {
        const toMeta = e.toStatus ? STATUS_META[e.toStatus] : null;
        const isStatus = e.type === 'status_changed' && toMeta;
        const postponedUntil = typeof e.meta?.postponedUntil === 'string' ? e.meta.postponedUntil : null;
        return (
          <li key={e.id} className="relative">
            <span
              className="absolute -left-[27px] top-0.5 flex h-[13px] w-[13px] items-center justify-center rounded-full border-2 border-surface"
              style={{ backgroundColor: isStatus ? toMeta.color : 'var(--c-muted)' }}
            />
            <div className="text-[13px] leading-snug">
              {isStatus ? (
                <p>
                  <span className="font-semibold" style={{ color: toMeta.color }}>
                    {toMeta.emoji} {toMeta.label}
                  </span>
                  {e.fromStatus && e.fromStatus !== 'new' && (
                    <span className="text-muted"> ← {STATUS_META[e.fromStatus].short}</span>
                  )}
                  {e.meta?.edit === true && <span className="ml-1 rounded bg-surface-2 px-1 text-[11px] text-muted">tahrir</span>}
                </p>
              ) : (
                <p className="font-medium">
                  {ICONS[e.type] ?? '•'} {EVENT_LABELS[e.type]}
                  {(e.type === 'assigned' || e.type === 'reassigned') && e.text ? `: ${e.text}` : ''}
                </p>
              )}
              {postponedUntil && <p className="text-muted">📅 {fullDate(postponedUntil)} ga</p>}
              {e.text && e.type !== 'assigned' && e.type !== 'reassigned' && (
                <p className="selectable mt-1 whitespace-pre-wrap rounded-lg bg-surface-2 px-2.5 py-1.5">{e.text}</p>
              )}
              <p className="mt-0.5 text-[11px] text-muted">
                {fullDate(e.createdAt)}
                {showActor && e.actorType !== 'system' && ` · ${e.actorName}`}
                {e.actorType === 'admin' && ' (admin)'}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

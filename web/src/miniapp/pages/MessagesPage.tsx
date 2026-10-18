import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCheck, Inbox, Mail, Paperclip, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { smartDate } from '../../shared/format';
import { Stagger } from '../../shared/motion';
import type { StaffMessage } from '../../shared/types';
import { Button, Empty, ErrorBox, Skeleton, errorText, useToast } from '../../shared/ui';
import { api } from '../session';
import { haptic } from '../telegram';
import { PageTitle } from './ui';

export function MessagesPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['messages'], queryFn: () => api.get<{ items: StaffMessage[] }>('/messages') });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['messages'] });
    void qc.invalidateQueries({ queryKey: ['summary'] });
  };
  const items = query.data?.items ?? [];
  const unread = items.filter((m) => !m.readAt).length;

  return (
    <div className="mx-auto max-w-xl px-4 pt-5">
      <PageTitle title="Xabarlar" subtitle={unread ? `${unread} ta o'qilmagan xabar` : 'Rahbarlardan kelgan xabar va ogohlantirishlar'} />
      <div className="mt-5">
        {query.isPending && (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 rounded-[20px]" />
            ))}
          </div>
        )}
        {query.isError && <ErrorBox error={query.error} onRetry={() => query.refetch()} />}
        {query.isSuccess && !items.length && <Empty icon={<Inbox className="h-7 w-7" />} title="Xabarlar yo'q" text="Rahbarlar yozgan xabarlar shu yerda ko'rinadi" />}
        <Stagger className="space-y-2.5">
          {items.map((m) => (
            <MessageCard key={m.id} m={m} onChanged={refresh} />
          ))}
        </Stagger>
      </div>
    </div>
  );
}

function MessageCard({ m, onChanged }: { m: StaffMessage; onChanged: () => void }) {
  const toast = useToast();
  const [reply, setReply] = useState('');
  const [open, setOpen] = useState(!m.readAt);
  const warning = m.type === 'warning';
  const accent = warning ? '#f59e0b' : 'var(--c-brand)';

  const read = useMutation({ mutationFn: () => api.post(`/messages/${m.id}/read`), onSuccess: onChanged });
  const ack = useMutation({
    mutationFn: () => api.post(`/messages/${m.id}/ack`, { replyText: reply.trim() || null }),
    onSuccess: () => {
      haptic.success();
      toast('Qabul qilindi');
      onChanged();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  return (
    <motion.div
      className={clsx('relative overflow-hidden rounded-[20px] border bg-surface p-4 shadow-soft', !m.readAt ? 'border-transparent' : 'border-line/60')}
      style={!m.readAt ? { boxShadow: `0 0 0 1.5px ${warning ? '#f59e0b' : 'var(--c-brand)'}, 0 8px 24px -12px ${warning ? '#f59e0b' : 'var(--c-brand)'}` } : undefined}
      onClick={() => {
        if (!m.readAt && !read.isPending) read.mutate();
        setOpen(true);
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: warning ? '#f59e0b1f' : 'color-mix(in srgb, var(--c-brand) 12%, transparent)', color: accent }}
        >
          {warning ? <TriangleAlert className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-display text-[15px] font-bold">{m.adminName}</p>
            <span className="shrink-0 text-[11.5px] text-muted">{smartDate(m.createdAt)}</span>
          </div>
          <p className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: accent }}>
            {warning ? 'Ogohlantirish' : 'Xabar'}
          </p>
          <p className={clsx('selectable mt-2 whitespace-pre-wrap text-[14px] leading-relaxed', !open && 'line-clamp-2')}>{m.text}</p>
        </div>
      </div>
      {m.leadId && (
        <Link
          to={`/lead/${m.leadId}`}
          onClick={(e) => e.stopPropagation()}
          className="ml-[52px] mt-3 inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-1.5 text-[13px] font-semibold"
        >
          <Paperclip className="h-3.5 w-3.5" /> Lid #{m.leadSeq} {m.leadName ?? ''}
        </Link>
      )}
      {m.ackAt ? (
        <p className="ml-[52px] mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-good">
          <CheckCheck className="h-4 w-4" /> Tasdiqlangan · {smartDate(m.ackAt)}
          {m.replyText && <span className="font-normal text-muted">— “{m.replyText}”</span>}
        </p>
      ) : (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mt-3 space-y-2">
                <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Javob yozish (ixtiyoriy)" className="input rounded-2xl" maxLength={1000} />
                <Button className="w-full" loading={ack.isPending} onClick={() => ack.mutate()}>
                  <CheckCheck className="h-4 w-4" /> Tushundim
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
}

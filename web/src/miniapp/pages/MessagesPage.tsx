import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { CheckCheck, Inbox, Paperclip } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { smartDate } from '../../shared/format';
import type { StaffMessage } from '../../shared/types';
import { Button, Empty, ErrorBox, FullScreenLoader, errorText, useToast } from '../../shared/ui';
import { api } from '../session';
import { haptic } from '../telegram';

export function MessagesPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['messages'], queryFn: () => api.get<{ items: StaffMessage[] }>('/messages') });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['messages'] });
    void qc.invalidateQueries({ queryKey: ['summary'] });
  };

  if (query.isPending) return <FullScreenLoader />;
  if (query.isError) return <ErrorBox error={query.error} onRetry={() => query.refetch()} />;
  const items = query.data.items;

  return (
    <div className="mx-auto max-w-xl px-4 pt-4">
      <h1 className="text-[22px] font-bold">Xabarlar</h1>
      <p className="mt-1 text-sm text-muted">Rahbarlardan kelgan xabar va ogohlantirishlar</p>
      <div className="mt-4 space-y-2.5">
        {!items.length && <Empty icon={<Inbox className="h-10 w-10" />} title="Xabarlar yo'q" text="Rahbarlar yozgan xabarlar shu yerda ko'rinadi" />}
        {items.map((m) => (
          <MessageCard key={m.id} m={m} onChanged={refresh} />
        ))}
      </div>
    </div>
  );
}

function MessageCard({ m, onChanged }: { m: StaffMessage; onChanged: () => void }) {
  const toast = useToast();
  const [reply, setReply] = useState('');
  const [open, setOpen] = useState(!m.readAt);
  const warning = m.type === 'warning';

  const read = useMutation({ mutationFn: () => api.post(`/messages/${m.id}/read`), onSuccess: onChanged });
  const ack = useMutation({
    mutationFn: () => api.post(`/messages/${m.id}/ack`, { replyText: reply.trim() || null }),
    onSuccess: () => {
      haptic.success();
      toast('✅ Qabul qilindi');
      onChanged();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  return (
    <div
      className={clsx('rounded-2xl bg-surface p-4 shadow-card', !m.readAt && 'ring-2', warning ? 'ring-amber-400' : 'ring-brand/50')}
      onClick={() => {
        if (!m.readAt && !read.isPending) read.mutate();
        setOpen(true);
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={clsx('text-[12px] font-semibold uppercase tracking-wide', warning ? 'text-amber-600' : 'text-brand')}>
            {warning ? '⚠️ Ogohlantirish' : '✉️ Xabar'}
          </p>
          <p className="mt-0.5 font-semibold">{m.adminName}</p>
        </div>
        <span className="text-[12px] text-muted">{smartDate(m.createdAt)}</span>
      </div>
      <p className={clsx('selectable mt-2 whitespace-pre-wrap text-[14px]', !open && 'line-clamp-2')}>{m.text}</p>
      {m.leadId && (
        <Link
          to={`/lead/${m.leadId}`}
          onClick={(e) => e.stopPropagation()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[13px] font-medium"
        >
          <Paperclip className="h-3.5 w-3.5" /> Lid #{m.leadSeq} {m.leadName ?? ''}
        </Link>
      )}
      {m.ackAt ? (
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-emerald-600">
          <CheckCheck className="h-4 w-4" /> Tasdiqlangan · {smartDate(m.ackAt)}
          {m.replyText && <span className="text-muted">— “{m.replyText}”</span>}
        </p>
      ) : (
        open && (
          <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
            <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Javob (ixtiyoriy)" className="input" maxLength={1000} />
            <Button className="w-full" loading={ack.isPending} onClick={() => ack.mutate()}>
              ✅ Tushundim
            </Button>
          </div>
        )
      )}
    </div>
  );
}

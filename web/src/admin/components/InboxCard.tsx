import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { CircleAlert, CircleCheckBig, Hourglass, Inbox, MessageSquareDashed, Plus } from 'lucide-react';
import { useState } from 'react';
import { fullDate, smartDate } from '../../shared/format';
import type { InboxItem } from '../../shared/types';
import { Button, Empty, Spinner, errorText, useToast } from '../../shared/ui';
import { api } from '../api';
import { Card, Segmented, useOpenLead } from './common';

const REASONS: Record<string, string> = {
  no_phone: 'Telefon raqami topilmadi',
  not_bot: "Odam yozgan xabar (guruhda faqat bot xabarlari lid hisoblanadi)",
  group_inactive: 'Guruh o\'sha paytda faol emas edi',
};

function StatusPill({ item }: { item: InboxItem }) {
  const map = {
    lead: { icon: CircleCheckBig, text: item.leadSeq ? `Lid #${item.leadSeq}` : 'Lid', cls: 'bg-emerald-500/10 text-good' },
    skipped: { icon: MessageSquareDashed, text: 'Lid emas', cls: 'bg-surface-2 text-muted' },
    failed: { icon: CircleAlert, text: `Xato · ${item.attempts} urinish`, cls: 'bg-red-500/10 text-danger' },
    pending: { icon: Hourglass, text: 'Ishlanmoqda', cls: 'bg-amber-500/10 text-warn' },
  }[item.status];
  const Icon = map.icon;
  return (
    <span className={clsx('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold', map.cls)}>
      <Icon className="h-3.5 w-3.5" /> {map.text}
    </span>
  );
}

/** Guruhga tushgan har bir xabar va uning natijasi — lid yo'qolmaganini nazorat qilish uchun */
export function InboxCard({ groupId }: { groupId: string }) {
  const [filter, setFilter] = useState<'' | 'lead' | 'skipped' | 'failed'>('');
  const q = useQuery({
    queryKey: ['inbox', groupId, filter],
    queryFn: () => api.get<{ items: InboxItem[] }>(`/groups/${groupId}/inbox`, { status: filter || undefined }),
  });
  const items = q.data?.items ?? [];

  return (
    <Card
      title="Kiruvchi xabarlar"
      icon={Inbox}
      pad={false}
      actions={
        <Segmented
          id="inbox"
          value={filter}
          onChange={setFilter}
          options={[
            { value: '', label: 'Hammasi' },
            { value: 'lead', label: 'Lid' },
            { value: 'skipped', label: 'Lid emas' },
            { value: 'failed', label: 'Xato' },
          ]}
        />
      }
    >
      <p className="border-b border-line/60 px-5 py-3 text-[12.5px] text-muted">
        Guruhga tushgan har bir xabar shu yerda saqlanadi. Internet uzilsa yoki xato bo'lsa, tizim xabarni avtomatik qayta ishlaydi.
        Lid deb topilmagan xabarni <b className="text-fg">"Lid qilish"</b> orqali qo'lda qo'shishingiz mumkin.
      </p>
      {q.isPending && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}
      {q.isSuccess && !items.length && <Empty title="Xabarlar yo'q" text="Guruhga yangi xabar tushganda shu yerda ko'rinadi" />}
      <ul className="thin-scroll max-h-[560px] divide-y divide-line/60 overflow-y-auto">
        {items.map((it) => (
          <InboxRow key={it.id} item={it} />
        ))}
      </ul>
    </Card>
  );
}

function InboxRow({ item }: { item: InboxItem }) {
  const qc = useQueryClient();
  const toast = useToast();
  const openLead = useOpenLead();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const ingest = useMutation({
    mutationFn: () => api.post<{ lead: { id: string; seq: number } }>(`/inbox/${item.id}/ingest`, { name: name || null, phone: phone || null }),
    onSuccess: ({ lead }) => {
      toast(`Lid #${lead.seq} yaratildi va xodimga yuborildi`);
      setForm(false);
      void qc.invalidateQueries({ queryKey: ['inbox'] });
      void qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  const reason = item.status === 'skipped' || item.status === 'failed' ? (REASONS[item.reason ?? ''] ?? item.reason) : null;

  return (
    <li className="px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <StatusPill item={item} />
        <span className="text-muted" title={fullDate(item.messageDate)}>
          {smartDate(item.messageDate)}
        </span>
        {item.from && <span className="truncate text-muted">· {item.from}</span>}
        {item.isEdit && <span className="rounded bg-surface-2 px-1.5 text-[11px] text-muted">tahrirlangan</span>}
        <span className="flex-1" />
        {item.status === 'lead' && item.leadId && (
          <button className="font-semibold text-brand hover:underline" onClick={() => openLead(item.leadId)}>
            Lidni ochish →
          </button>
        )}
        {(item.status === 'skipped' || item.status === 'failed') && !form && (
          <Button size="sm" variant="soft" onClick={() => setForm(true)}>
            <Plus className="h-3.5 w-3.5" /> Lid qilish
          </Button>
        )}
      </div>
      {reason && <p className="mt-1 text-[12px] text-muted">Sabab: {reason}</p>}
      <button onClick={() => setOpen((v) => !v)} className="mt-1.5 block w-full text-left">
        <pre className={clsx('whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-fg/85', !open && 'line-clamp-3')}>{item.text}</pre>
      </button>
      {form && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-surface-2/70 p-3 ring-1 ring-line/60">
          <input className="input h-9 w-44 py-0 text-sm" placeholder="Ism (ixtiyoriy)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input h-9 w-44 py-0 text-sm" placeholder="Telefon" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button size="sm" loading={ingest.isPending} onClick={() => ingest.mutate()}>
            Lid yaratish
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setForm(false)}>
            Bekor
          </Button>
          <p className="w-full text-[11.5px] text-muted">Bo'sh qoldirsangiz, matndan o'zi ajratib olishga urinadi.</p>
        </div>
      )}
    </li>
  );
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bot, Plus, Workflow } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { timeAgo } from '../../shared/format';
import type { Group } from '../../shared/types';
import { Button, Empty, ErrorBox, Sheet, Spinner, errorText, useToast } from '../../shared/ui';
import { api } from '../api';
import { Field, PageHeader } from '../components/common';
import { useAdmin, useGroups } from '../context';
import { Badge } from './EmployeesPage';

export function groupStatusBadge(g: Group) {
  return g.status === 'active' ? <Badge tone="green">Faol</Badge> : g.status === 'pending' ? <Badge tone="amber">Tasdiqlash kutilmoqda</Badge> : <Badge tone="gray">O'chirilgan</Badge>;
}

export function GroupsPage() {
  const groups = useGroups();
  const { isSuper, botUsername } = useAdmin();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="Guruhlar (lid manbalari)"
        subtitle="Bot qo'shilgan Telegram guruhlar va API manbalar. Har bir guruhning o'z xodimlari va sozlamalari bor"
        actions={
          isSuper && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Manba qo'shish
            </Button>
          )
        }
      />

      <div className="card mb-5 flex gap-3 p-4 text-[13px] shadow-card">
        <Bot className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <div>
          <p className="font-medium">Yangi guruh ulash</p>
          <p className="mt-0.5 text-muted">
            1) {botUsername ? <b>@{botUsername}</b> : 'Botni'} lidlar tushadigan guruhga qo'shing va <b>admin</b> qiling. 2) Guruh shu ro'yxatda
            "Tasdiqlash kutilmoqda" bo'lib paydo bo'ladi. 3) Guruhni oching, xodimlarni biriktiring va <b>Faollashtiring</b>.
          </p>
        </div>
      </div>

      {groups.isError && <ErrorBox error={groups.error} />}
      {groups.isPending ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : !groups.data?.length ? (
        <div className="card">
          <Empty icon={<Workflow className="h-10 w-10" />} title="Guruhlar yo'q" text="Botni Telegram guruhga qo'shing — u shu yerda avtomatik paydo bo'ladi" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.data.map((g) => (
            <Link key={g.id} to={`/groups/${g.id}`} className="card block p-5 shadow-card transition hover:border-brand/40">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{g.title}</h3>
                  <p className="mt-0.5 text-[12px] text-muted">
                    {g.chatType === 'api' ? 'API / sayt manbasi' : `Telegram ${g.chatType}`} · {g.chatId ?? '—'}
                  </p>
                </div>
                {groupStatusBadge(g)}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Mini label="Jami lid" value={g.leadCount ?? 0} />
                <Mini label="Xodimlar" value={g.employeeCount ?? 0} />
                <Mini label="Lid oladi" value={g.activeEmployeeCount ?? 0} warn={g.status === 'active' && !g.activeEmployeeCount} />
              </div>
              <p className="mt-3 text-[12px] text-muted">
                SLA: {g.settings.slaMinutes} daq · Keyinga: har {g.settings.postponeIntervalDays} kun · {g.chatType !== 'api' && !g.botMember ? '⚠️ bot guruhda emas · ' : ''}
                qo'shilgan {timeAgo(g.createdAt)}
              </p>
            </Link>
          ))}
        </div>
      )}
      {createOpen && <CreateGroupModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function Mini({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`rounded-xl px-2 py-2 ${warn ? 'bg-red-500/10 text-red-600' : 'bg-surface-2'}`}>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}

function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [chatId, setChatId] = useState('');
  const create = useMutation({
    mutationFn: () => api.post('/groups', { title, chatId: chatId.trim() ? Number(chatId) : null }),
    onSuccess: () => {
      toast('Manba qo\'shildi');
      void qc.invalidateQueries({ queryKey: ['groups'] });
      onClose();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });
  return (
    <Sheet
      open
      onClose={onClose}
      title="Manba qo'shish"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Bekor
          </Button>
          <Button loading={create.isPending} disabled={title.trim().length < 2} onClick={() => create.mutate()}>
            Qo'shish
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-[13px] text-muted">
          Telegram guruhlar odatda bot qo'shilganda avtomatik paydo bo'ladi. Bu yerda <b>sayt/API manbasi</b> (webhook orqali lid yuboriladigan) yoki
          chat ID si ma'lum guruhni qo'lda qo'shishingiz mumkin.
        </p>
        <Field label="Nomi">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Masalan: Sayt formasi" autoFocus />
        </Field>
        <Field label="Telegram chat ID (ixtiyoriy)" hint="Guruhda /chatid buyrug'ini yuborib bilib olish mumkin. API manba uchun bo'sh qoldiring">
          <input className="input" value={chatId} onChange={(e) => setChatId(e.target.value.replace(/[^\d-]/g, ''))} placeholder="-1001234567890" />
        </Field>
      </div>
    </Sheet>
  );
}

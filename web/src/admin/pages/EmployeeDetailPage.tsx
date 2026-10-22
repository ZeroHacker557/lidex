import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRightLeft, KeyRound, Mail, Pencil, Shuffle, Unlink } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EVENT_LABELS, STATUS_META } from '@shared/statuses';
import { duration, fullDate, smartDate, timeAgo } from '../../shared/format';
import type { Employee, EmployeeStatsRow, LeadEvent, StaffMessage } from '../../shared/types';
import { Avatar, Button, ErrorBox, FullScreenLoader, errorText, useToast } from '../../shared/ui';
import { api } from '../api';
import { StatusBreakdown } from '../components/charts';
import { Card, KpiTile, Select, Toggle, useOpenLead } from '../components/common';
import { BulkAssignModal } from '../components/BulkAssignModal';
import { EmployeeFormModal, KeyModal } from '../components/EmployeeForm';
import { SendMessageModal } from '../components/SendMessageModal';
import { Badge } from './EmployeesPage';

interface Detail {
  employee: Employee;
  stats: EmployeeStatsRow;
  events: LeadEvent[];
  messages: StaffMessage[];
  groups: Array<{ id: string; title: string }>;
}

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [days, setDays] = useState(30);
  const qc = useQueryClient();
  const toast = useToast();
  const openLead = useOpenLead();
  const [editOpen, setEditOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [newKey, setNewKey] = useState<{ key: string; deepLink: string | null } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const q = useQuery({ queryKey: ['employee', id, days], queryFn: () => api.get<Detail>(`/employees/${id}`, { days }) });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['employee', id] });
    void qc.invalidateQueries({ queryKey: ['employees'] });
  };
  const patch = useMutation({
    mutationFn: (body: Partial<Employee>) => api.patch(`/employees/${id}`, body),
    onSuccess: () => {
      toast('Saqlandi');
      refresh();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });
  const regen = useMutation({
    mutationFn: () => api.post<{ key: string; deepLink: string | null }>(`/employees/${id}/key`),
    onSuccess: (r) => {
      setNewKey(r);
      refresh();
    },
  });
  const unbind = useMutation({
    mutationFn: () => api.post(`/employees/${id}/unbind`),
    onSuccess: () => {
      toast('Telegram bog\'lanishi uzildi');
      refresh();
    },
  });
  const redistribute = useMutation({
    mutationFn: () => api.post<{ moved: number; total: number }>(`/employees/${id}/redistribute`),
    onSuccess: (r) => {
      toast(`🔁 ${r.moved} / ${r.total} ta ochiq lid boshqa xodimlarga o'tkazildi`);
      refresh();
      void qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  if (q.isPending) return <FullScreenLoader />;
  if (q.isError) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const { employee: e, stats, events, messages, groups } = q.data;

  return (
    <div className="space-y-5">
      <Link to="/employees" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Xodimlar
      </Link>

      <div className="card flex flex-wrap items-center gap-4 p-5 shadow-card">
        <Avatar name={e.fullName} size={56} online={e.telegramId ? e.online : undefined} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold">{e.fullName}</h1>
            {!e.isActive ? <Badge tone="gray">Nofaol</Badge> : !e.telegramId ? <Badge tone="amber">Botga ulanmagan</Badge> : e.botBlocked ? <Badge tone="red">Botni bloklagan</Badge> : <Badge tone="green">Faol</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">
            {[e.telegramUsername && `@${e.telegramUsername}`, e.phone, groups.map((g) => g.title).join(', '), e.online ? 'onlayn' : `oxirgi faollik: ${timeAgo(e.lastSeenAt)}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setMsgOpen(true)}>
            <Mail className="h-4 w-4" /> Xabar / ogohlantirish
          </Button>
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <ArrowRightLeft className="h-4 w-4" /> Lidlarni biriktirish
          </Button>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Tahrirlash
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Natijalar</h2>
        <Select value={days} onChange={(ev) => setDays(Number(ev.target.value))} className="w-40">
          <option value={1}>Bugun</option>
          <option value={7}>7 kun</option>
          <option value={30}>30 kun</option>
          <option value={90}>90 kun</option>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiTile label="Jami lid" value={stats.total} />
        <KpiTile label="Konversiya" value={`${stats.conversion}%`} tone="good" />
        <KpiTile label="O'rtacha javob" value={duration(stats.avgResponseSeconds)} />
        <KpiTile label="Hozir ochiq" value={stats.openNow} />
        <KpiTile label="Kechikkan yangi lidlar" value={stats.lateNew} tone={stats.lateNew ? 'danger' : undefined} />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="Statuslar">
          <StatusBreakdown byStatus={stats.byStatus} />
          <Link to={`/leads?employeeId=${e.id}`} className="mt-4 inline-block text-[13px] font-medium text-brand">
            Xodimning lidlari →
          </Link>
        </Card>

        <Card title="Faollik tarixi" className="xl:col-span-2" pad={false}>
          <ul className="max-h-[480px] divide-y divide-line overflow-y-auto">
            {events.map((ev) => (
              <li key={ev.id}>
                <button onClick={() => openLead(ev.leadId)} className="flex w-full items-start gap-3 px-5 py-2.5 text-left text-[13px] hover:bg-surface-2">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: ev.toStatus ? STATUS_META[ev.toStatus].color : 'var(--c-muted)' }} />
                  <span className="min-w-0 flex-1">
                    <b>{ev.actorName}</b> · {ev.type === 'status_changed' && ev.toStatus ? `${STATUS_META[ev.toStatus].label}${ev.fromStatus ? ` (avval: ${STATUS_META[ev.fromStatus].short})` : ''}` : EVENT_LABELS[ev.type]}
                    <span className="text-muted"> · lid #{ev.leadSeq}</span>
                    {ev.text && <span className="block truncate text-muted">“{ev.text}”</span>}
                  </span>
                  <span className="shrink-0 text-[12px] text-muted" title={fullDate(ev.createdAt)}>
                    {smartDate(ev.createdAt)}
                  </span>
                </button>
              </li>
            ))}
            {!events.length && <li className="px-5 py-8 text-center text-sm text-muted">Hali faollik yo'q</li>}
          </ul>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Yuborilgan xabarlar" pad={false}>
          <ul className="max-h-80 divide-y divide-line overflow-y-auto">
            {messages.map((m) => (
              <li key={m.id} className="px-5 py-3 text-[13px]">
                <p>
                  {m.type === 'warning' ? '⚠️' : '✉️'} {m.text}
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  {m.adminName} · {smartDate(m.createdAt)}
                  {m.leadSeq && ` · lid #${m.leadSeq}`} · {m.ackAt ? '✅ tasdiqladi' : m.readAt ? "👁 o'qidi" : m.deliveredAt ? 'yetkazildi' : 'yetkazilmadi'}
                  {m.replyText && ` · “${m.replyText}”`}
                </p>
              </li>
            ))}
            {!messages.length && <li className="px-5 py-8 text-center text-sm text-muted">Xabar yuborilmagan</li>}
          </ul>
        </Card>

        <Card title="Boshqaruv">
          <div className="space-y-4">
            <Row title="Faol xodim" text="O'chirilsa — panelga kira olmaydi va lid olmaydi">
              <Toggle checked={e.isActive} onChange={(v) => patch.mutate({ isActive: v })} disabled={patch.isPending} />
            </Row>
            <Row title="Lid qabul qiladi" text="Vaqtincha to'xtatish (ta'til, kasallik)">
              <Toggle checked={e.acceptingLeads} onChange={(v) => patch.mutate({ acceptingLeads: v })} disabled={patch.isPending} />
            </Row>
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Button
                variant="outline"
                size="sm"
                loading={regen.isPending}
                onClick={() => confirm('Yangi kalit yaratilsinmi? Eski kalit bekor bo\'ladi va xodim qayta kirishi kerak.') && regen.mutate()}
              >
                <KeyRound className="h-4 w-4" /> Yangi kalit
              </Button>
              {e.telegramId && (
                <Button variant="outline" size="sm" loading={unbind.isPending} onClick={() => confirm('Telegram bog\'lanishi uzilsinmi?') && unbind.mutate()}>
                  <Unlink className="h-4 w-4" /> Telegramdan uzish
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                loading={redistribute.isPending}
                disabled={!stats.openNow}
                onClick={() => confirm(`${stats.openNow} ta ochiq lid guruhdagi boshqa xodimlarga taqsimlansinmi?`) && redistribute.mutate()}
              >
                <Shuffle className="h-4 w-4" /> Ochiq lidlarni boshqalarga taqsimlash
              </Button>
            </div>
            <p className="text-[12px] text-muted">
              Kalit: …{e.keyHint} · Yaratilgan: {fullDate(e.createdAt)}
              {e.boundAt && ` · Ulangan: ${fullDate(e.boundAt)}`}
            </p>
          </div>
        </Card>
      </div>

      {editOpen && <EmployeeFormModal employee={e} onClose={() => setEditOpen(false)} />}
      {msgOpen && <SendMessageModal open onClose={() => setMsgOpen(false)} employee={e} />}
      {newKey && <KeyModal data={newKey} name={e.fullName} onClose={() => setNewKey(null)} />}
      {bulkOpen && <BulkAssignModal employee={e} groups={groups} onClose={() => setBulkOpen(false)} />}
    </div>
  );
}

function Row({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[14px] font-medium">{title}</p>
        <p className="text-[12px] text-muted">{text}</p>
      </div>
      {children}
    </div>
  );
}

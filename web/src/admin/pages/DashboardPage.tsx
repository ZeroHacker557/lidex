import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EVENT_LABELS, STATUS_META, type LeadStatus } from '@shared/statuses';
import { duration, startOfTashkentDay, timeAgo } from '../../shared/format';
import type { EmployeeStatsRow, LeadEvent } from '../../shared/types';
import { Avatar, ErrorBox, FullScreenLoader } from '../../shared/ui';
import { api } from '../api';
import { AlertsPanel, type Alerts } from '../components/AlertsPanel';
import { DailyChart, StatusBreakdown, type DailyPoint } from '../components/charts';
import { Card, KpiTile, PageHeader, Select, Td, Th, useOpenLead } from '../components/common';
import { useGroups } from '../context';

interface Dashboard {
  total: number;
  byStatus: Record<LeadStatus, number>;
  conversion: number;
  avgResponseSeconds: number | null;
  openNow: number;
  overdueReminders: number;
  unassigned: number;
  flagged: number;
  daily: DailyPoint[];
  employees: EmployeeStatsRow[];
}

const PERIODS = [
  { days: 1, label: 'Bugun' },
  { days: 7, label: '7 kun' },
  { days: 30, label: '30 kun' },
];

export function DashboardPage() {
  const [days, setDays] = useState(7);
  const [groupId, setGroupId] = useState('');
  const groups = useGroups();
  const navigate = useNavigate();
  const openLead = useOpenLead();

  const from = startOfTashkentDay(-(days - 1)).toISOString();
  const q = useQuery({
    queryKey: ['dashboard', days, groupId],
    queryFn: () => api.get<Dashboard>('/dashboard', { from, groupId }),
    refetchInterval: 60_000,
  });
  const alerts = useQuery({ queryKey: ['alerts'], queryFn: () => api.get<Alerts>('/alerts') });
  const activity = useQuery({
    queryKey: ['activity', 'feed', groupId],
    queryFn: () => api.get<{ items: LeadEvent[] }>('/activity', { groupId, limit: 15 }),
  });

  const d = q.data;
  const goLeads = (status?: string) => navigate(`/leads?${new URLSearchParams({ ...(status ? { status } : {}), ...(groupId ? { groupId } : {}) })}`);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Lidlar, xodimlar va natijalar — real vaqtda"
        actions={
          <>
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="w-52">
              <option value="">Barcha guruhlar</option>
              {groups.data?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
            <div className="flex rounded-xl border border-line bg-surface p-0.5">
              {PERIODS.map((p) => (
                <button
                  key={p.days}
                  onClick={() => setDays(p.days)}
                  className={clsx('rounded-lg px-3 py-1.5 text-[13px] font-medium', days === p.days ? 'bg-brand text-brand-fg' : 'text-muted hover:text-fg')}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </>
        }
      />

      {q.isPending && <FullScreenLoader />}
      {q.isError && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {d && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiTile label="Jami lid" value={d.total} sub={PERIODS.find((p) => p.days === days)?.label} />
            <KpiTile label="Konversiya (HA dedi)" value={`${d.conversion}%`} sub={`${d.byStatus.success} ta muvaffaqiyatli`} tone="good" />
            <KpiTile label="O'rtacha javob vaqti" value={duration(d.avgResponseSeconds)} sub="lid tushgandan birinchi amalgacha" />
            <KpiTile label="Hozir ochiq lidlar" value={d.openNow} sub="yangi + ko'tarmadi + keyinga" />
            <KpiTile label="Eslatma muddati o'tgan" value={d.overdueReminders} tone={d.overdueReminders ? 'warning' : undefined} />
            <KpiTile label="Biriktirilmagan" value={d.unassigned} tone={d.unassigned ? 'danger' : undefined} />
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <Card title="Kunlik lidlar" className="xl:col-span-2">
              <DailyChart data={d.daily} />
            </Card>
            <Card title="Statuslar bo'yicha">
              <StatusBreakdown byStatus={d.byStatus} onPick={(s) => goLeads(s)} />
            </Card>
          </div>

          <Card title="Xodimlar samaradorligi" pad={false} actions={<Link to="/employees" className="text-[13px] font-medium text-brand">Barchasi →</Link>}>
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead className="border-b border-line">
                  <tr>
                    <Th>Xodim</Th>
                    <Th className="text-right">Jami</Th>
                    {(['new', 'success', 'rejected', 'no_answer', 'postponed', 'cancelled'] as LeadStatus[]).map((s) => (
                      <Th key={s} className="text-right">
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_META[s].color }} />
                          {STATUS_META[s].short}
                        </span>
                      </Th>
                    ))}
                    <Th className="text-right">Konv.</Th>
                    <Th className="text-right">O'rt. javob</Th>
                    <Th className="text-right">Ochiq</Th>
                    <Th className="text-right">Kechikkan</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {d.employees.map((e) => (
                    <tr key={e.id} className="cursor-pointer hover:bg-surface-2" onClick={() => navigate(`/employees/${e.id}`)}>
                      <Td>
                        <span className="flex items-center gap-2.5">
                          <Avatar name={e.fullName} online={e.online} size={30} />
                          <span>
                            <span className="block font-medium">{e.fullName}</span>
                            <span className="text-[12px] text-muted">
                              {!e.bound ? 'botga ulanmagan' : !e.acceptingLeads ? "⏸ to'xtatilgan" : e.online ? 'onlayn' : `oxirgi: ${timeAgo(e.lastSeenAt)}`}
                            </span>
                          </span>
                        </span>
                      </Td>
                      <Td className="text-right font-semibold tabular-nums">{e.total}</Td>
                      {(['new', 'success', 'rejected', 'no_answer', 'postponed', 'cancelled'] as LeadStatus[]).map((s) => (
                        <Td key={s} className="text-right tabular-nums text-muted">
                          {e.byStatus[s] || '·'}
                        </Td>
                      ))}
                      <Td className="text-right tabular-nums">{e.conversion}%</Td>
                      <Td className="text-right tabular-nums">{duration(e.avgResponseSeconds)}</Td>
                      <Td className="text-right tabular-nums">{e.openNow}</Td>
                      <Td className={clsx('text-right tabular-nums', e.lateNew > 0 && 'font-semibold text-red-600')}>{e.lateNew}</Td>
                    </tr>
                  ))}
                  {!d.employees.length && (
                    <tr>
                      <Td className="py-8 text-center text-muted">
                        Hali xodim yo'q. <Link to="/employees" className="text-brand">Xodim qo'shing</Link>
                      </Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="Diqqat talab" pad={false}>
              <div className="max-h-[420px] overflow-y-auto">
                <AlertsPanel data={alerts.data} />
              </div>
            </Card>
            <Card title="So'nggi faollik" pad={false} actions={<Link to="/activity" className="text-[13px] font-medium text-brand">Jurnal →</Link>}>
              <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
                {activity.data?.items.map((e) => (
                  <li key={e.id}>
                    <button onClick={() => openLead(e.leadId)} className="flex w-full items-start gap-3 px-5 py-2.5 text-left hover:bg-surface-2">
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: e.toStatus ? STATUS_META[e.toStatus].color : 'var(--c-muted)' }}
                      />
                      <span className="min-w-0 flex-1 text-[13px]">
                        <b>{e.actorName}</b> · {e.type === 'status_changed' && e.toStatus ? STATUS_META[e.toStatus].label : EVENT_LABELS[e.type]}
                        <span className="text-muted"> · lid #{e.leadSeq}</span>
                        {(e.type === 'assigned' || e.type === 'reassigned') && e.text && <span className="text-muted"> → {e.text}</span>}
                        {e.text && e.type !== 'assigned' && e.type !== 'reassigned' && <span className="block truncate text-muted">“{e.text}”</span>}
                      </span>
                      <span className="shrink-0 text-[12px] text-muted">{timeAgo(e.createdAt)}</span>
                    </button>
                  </li>
                ))}
                {activity.data && !activity.data.items.length && <li className="px-5 py-8 text-center text-sm text-muted">Hali faollik yo'q</li>}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { Activity, AlarmClock, BarChart3, CircleDashed, Ghost, Layers, PieChart, Timer, TriangleAlert, TrendingUp, UserX, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EVENT_LABELS, STATUS_META, type LeadStatus } from '@shared/statuses';
import { duration, startOfTashkentDay, timeAgo } from '../../shared/format';
import { ease } from '../../shared/motion';
import type { EmployeeStatsRow, LeadEvent } from '../../shared/types';
import { Avatar, ErrorBox, Skeleton } from '../../shared/ui';
import { api } from '../api';
import { AlertsPanel, type Alerts } from '../components/AlertsPanel';
import { DailyChart, StatusBreakdown, type DailyPoint } from '../components/charts';
import { Card, KpiTile, PageHeader, Segmented, Select, Td, Th, Tr, useOpenLead } from '../components/common';
import { useAdmin, useGroups } from '../context';

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
  { value: 1, label: 'Bugun' },
  { value: 7, label: '7 kun' },
  { value: 30, label: '30 kun' },
];
const COLS: LeadStatus[] = ['new', 'success', 'rejected', 'no_answer', 'postponed', 'cancelled', 'fake'];

export function DashboardPage() {
  const { admin } = useAdmin();
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
    placeholderData: (prev) => prev,
  });
  const alerts = useQuery({ queryKey: ['alerts'], queryFn: () => api.get<Alerts>('/alerts') });
  const activity = useQuery({
    queryKey: ['activity', 'feed', groupId],
    queryFn: () => api.get<{ items: LeadEvent[] }>('/activity', { groupId, limit: 15 }),
  });

  const d = q.data;
  const goLeads = (status?: string) =>
    navigate(`/leads?${new URLSearchParams({ ...(status ? { status } : {}), ...(groupId ? { groupId } : {}) })}`);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Xush kelibsiz, ${admin.fullName} — lidlar va natijalar real vaqtda`}
        actions={
          <>
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="w-56">
              <option value="">Barcha guruhlar</option>
              {groups.data?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
            <Segmented id="period" value={days} onChange={setDays} options={PERIODS} />
          </>
        }
      />

      {q.isError && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {!d && !q.isError && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-[118px] rounded-2xl" />
          ))}
        </div>
      )}
      {d && (
        <div className={clsx('space-y-5 transition-opacity', q.isFetching && q.isPlaceholderData && 'opacity-60')}>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
            <KpiTile icon={Layers} label="Jami lid" value={d.total} sub={PERIODS.find((p) => p.value === days)?.label} delay={0} />
            <KpiTile icon={TrendingUp} tone="good" label="Konversiya" value={d.conversion} suffix="%" sub={`${d.byStatus.success} ta HA dedi · soxtalarsiz`} delay={0.04} />
            <KpiTile icon={Timer} tone="info" label="O'rtacha javob" value={duration(d.avgResponseSeconds)} sub="birinchi amalgacha" delay={0.08} />
            <KpiTile icon={CircleDashed} tone="violet" label="Hozir ochiq" value={d.openNow} sub="yangi · ko'tarmadi · keyinga" delay={0.12} />
            <KpiTile icon={AlarmClock} tone="warning" label="Muddati o'tgan" value={d.overdueReminders} sub="keyinga qoldirilganlar" delay={0.16} />
            <KpiTile icon={UserX} tone="danger" label="Biriktirilmagan" value={d.unassigned} sub={d.unassigned ? 'xodimga biriktiring' : 'hammasi taqsimlangan'} delay={0.2} />
            {/* Ariza qoldirmagan (hazil uchun yozilgan) lidlar — reklama sifatini ko'rsatadi */}
            <button onClick={() => goLeads('fake')} className="text-left" title="Soxta lidlarni ko'rish">
              <KpiTile
                icon={Ghost}
                tone="violet"
                label="Soxta lidlar"
                value={d.byStatus.fake ?? 0}
                sub={`${d.total ? Math.round(((d.byStatus.fake ?? 0) / d.total) * 100) : 0}% · ariza qoldirmagan`}
                delay={0.24}
              />
            </button>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <Card title="Kunlik lidlar" icon={BarChart3} className="xl:col-span-2" delay={0.1}>
              <DailyChart data={d.daily} />
            </Card>
            <Card title="Statuslar bo'yicha" icon={PieChart} delay={0.15}>
              <StatusBreakdown byStatus={d.byStatus} onPick={(s) => goLeads(s)} />
            </Card>
          </div>

          <Card
            title="Xodimlar samaradorligi"
            icon={UsersRound}
            pad={false}
            delay={0.2}
            actions={
              <Link to="/employees" className="text-[13px] font-semibold text-brand hover:underline">
                Barchasi →
              </Link>
            }
          >
            <div className="thin-scroll overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead className="bg-surface-2/50">
                  <tr>
                    <Th>Xodim</Th>
                    <Th className="text-right">Jami</Th>
                    {COLS.map((s) => (
                      <Th key={s} className="text-right">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_META[s].color }} />
                          {STATUS_META[s].short}
                        </span>
                      </Th>
                    ))}
                    <Th>Konversiya</Th>
                    <Th className="text-right">O'rt. javob</Th>
                    <Th className="text-right">Ochiq</Th>
                    <Th className="text-right">Kechikkan</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {d.employees.map((e, i) => (
                    <Tr key={e.id} index={i} onClick={() => navigate(`/employees/${e.id}`)}>
                      <Td>
                        <span className="flex items-center gap-3">
                          <Avatar name={e.fullName} online={e.bound ? e.online : undefined} size={34} />
                          <span>
                            <span className="block font-semibold">{e.fullName}</span>
                            <span className="text-[12px] text-muted">
                              {!e.bound ? 'botga ulanmagan' : !e.acceptingLeads ? "to'xtatilgan" : e.online ? 'onlayn' : `oxirgi: ${timeAgo(e.lastSeenAt)}`}
                            </span>
                          </span>
                        </span>
                      </Td>
                      <Td className="tabular text-right font-display text-[15px] font-extrabold">{e.total}</Td>
                      {COLS.map((s) => (
                        <Td key={s} className="tabular text-right text-muted">
                          {e.byStatus[s] || <span className="opacity-40">—</span>}
                        </Td>
                      ))}
                      <Td>
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                            <motion.span
                              className="block h-full rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${e.conversion}%` }}
                              transition={{ duration: 0.8, ease, delay: 0.2 + i * 0.04 }}
                              style={{ backgroundColor: STATUS_META.success.color }}
                            />
                          </span>
                          <span className="tabular text-[13px] font-semibold">{e.conversion}%</span>
                        </span>
                      </Td>
                      <Td className="tabular text-right">{duration(e.avgResponseSeconds)}</Td>
                      <Td className="tabular text-right font-semibold">{e.openNow}</Td>
                      <Td className="text-right">
                        {e.lateNew > 0 ? (
                          <span className="tabular inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[12px] font-bold text-danger">
                            <TriangleAlert className="h-3 w-3" /> {e.lateNew}
                          </span>
                        ) : (
                          <span className="text-muted opacity-40">—</span>
                        )}
                      </Td>
                    </Tr>
                  ))}
                  {!d.employees.length && (
                    <tr>
                      <td colSpan={12} className="px-5 py-10 text-center text-sm text-muted">
                        Hali xodim yo'q.{' '}
                        <Link to="/employees" className="font-semibold text-brand">
                          Xodim qo'shing
                        </Link>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="Diqqat talab" icon={TriangleAlert} pad={false} delay={0.25}>
              <div className="thin-scroll max-h-[440px] overflow-y-auto">
                <AlertsPanel data={alerts.data} />
              </div>
            </Card>
            <Card
              title="So'nggi faollik"
              icon={Activity}
              pad={false}
              delay={0.3}
              actions={
                <Link to="/activity" className="text-[13px] font-semibold text-brand hover:underline">
                  Jurnal →
                </Link>
              }
            >
              <ul className="thin-scroll max-h-[440px] divide-y divide-line/60 overflow-y-auto">
                {activity.data?.items.map((e, i) => (
                  <motion.li key={e.id} initial={{ x: -6 }} animate={{ x: 0 }} transition={{ delay: i * 0.025, duration: 0.25 }}>
                    <button onClick={() => openLead(e.leadId)} className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-2/70">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: e.toStatus ? STATUS_META[e.toStatus].color : 'var(--c-muted)' }} />
                      <span className="min-w-0 flex-1 text-[13px]">
                        <b className="font-semibold">{e.actorName}</b>
                        <span className="text-muted"> · </span>
                        {e.type === 'status_changed' && e.toStatus ? STATUS_META[e.toStatus].label : EVENT_LABELS[e.type]}
                        {(e.type === 'assigned' || e.type === 'reassigned') && e.text && <span className="text-muted"> → {e.text}</span>}
                        <span className="text-muted"> · lid #{e.leadSeq}</span>
                        {e.text && e.type !== 'assigned' && e.type !== 'reassigned' && <span className="block truncate text-muted">“{e.text}”</span>}
                      </span>
                      <span className="shrink-0 text-[12px] text-muted">{timeAgo(e.createdAt)}</span>
                    </button>
                  </motion.li>
                ))}
                {activity.data && !activity.data.items.length && <li className="px-5 py-10 text-center text-sm text-muted">Hali faollik yo'q</li>}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

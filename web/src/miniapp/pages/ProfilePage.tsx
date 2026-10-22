import { useMutation, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { BookOpen, Check, ChevronRight, Map as MapIcon, PlayCircle, Target, Timer, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LEAD_STATUSES, STATUS_META, type LeadStatus } from '@shared/statuses';
import { duration } from '../../shared/format';
import { AnimatedNumber, ease, spring } from '../../shared/motion';
import { Avatar, errorText, useToast } from '../../shared/ui';
import { InstallCard } from '../components/InstallCard';
import { ROADMAP } from '../guide';
import { api, useSession } from '../session';
import { haptic } from '../telegram';

interface Stats {
  total: number;
  byStatus: Record<LeadStatus, number>;
  conversion: number;
  avgResponseSeconds: number | null;
}

const PERIODS = [
  { id: 'today', label: 'Bugun' },
  { id: 'week', label: '7 kun' },
  { id: 'month', label: '30 kun' },
] as const;

export function ProfilePage({ onReplayOnboarding }: { onReplayOnboarding: () => void }) {
  const { employee, refresh } = useSession();
  const toast = useToast();
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const stats = useQuery({ queryKey: ['stats', period], queryFn: () => api.get<Stats>('/stats', { period }) });
  const me = useQuery({ queryKey: ['me'], queryFn: () => api.get<{ groups: Array<{ id: string; title: string }> }>('/me') });

  const toggle = useMutation({
    mutationFn: (acceptingLeads: boolean) => api.patch('/me', { acceptingLeads }),
    onSuccess: (_d, v) => {
      haptic.success();
      toast(v ? 'Lid qabul qilish yoqildi' : "Lid qabul qilish to'xtatildi");
      refresh();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  const done = (key: (typeof ROADMAP)[number]['key']) =>
    key === 'bound' ? true : key === 'onboarding' ? employee.onboardingDone : !!employee.progress?.[key];
  const doneCount = ROADMAP.filter((r) => done(r.key)).length;
  const s = stats.data;

  return (
    <div className="mx-auto max-w-xl space-y-3 px-4 pt-5">
      {/* Profil kartasi */}
      <div className="relative overflow-hidden rounded-[26px] bg-surface p-5 shadow-card ring-1 ring-line/60">
        <div className="mesh pointer-events-none absolute inset-0" />
        <div className="relative flex items-center gap-4">
          <Avatar name={employee.fullName} size={64} />
          <div className="min-w-0">
            <h1 className="truncate font-display text-[21px] font-extrabold tracking-tight">{employee.fullName}</h1>
            <p className="truncate text-[13px] text-muted">{employee.telegramUsername ? `@${employee.telegramUsername}` : 'Operator'}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {me.data?.groups.map((g) => (
                <span key={g.id} className="rounded-lg bg-brand/10 px-2 py-0.5 text-[11.5px] font-semibold text-brand">
                  {g.title}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="relative mt-4 flex items-center justify-between gap-3 rounded-2xl bg-surface-2/80 p-3.5">
          <div>
            <p className="text-[14px] font-semibold">Lid qabul qilish</p>
            <p className="text-[12.5px] text-muted">{employee.acceptingLeads ? 'Yangi lidlar sizga taqsimlanadi' : "To'xtatilgan (ta'til, tushlik)"}</p>
          </div>
          <button
            role="switch"
            aria-checked={employee.acceptingLeads}
            disabled={toggle.isPending}
            onClick={() => toggle.mutate(!employee.acceptingLeads)}
            className={clsx('relative h-8 w-14 shrink-0 rounded-full p-1 transition-colors', employee.acceptingLeads ? 'bg-emerald-500' : 'bg-surface-3')}
          >
            <motion.span layout transition={spring} className={clsx('block h-6 w-6 rounded-full bg-white shadow-card', employee.acceptingLeads && 'ml-auto')} />
          </button>
        </div>
      </div>

      {/* Statistika */}
      <section className="card p-4 shadow-soft">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[16px] font-bold">Natijalarim</h2>
          <div className="relative flex rounded-xl bg-surface-2 p-1 text-[12px] font-semibold">
            {PERIODS.map((p) => (
              <button key={p.id} onClick={() => setPeriod(p.id)} className={clsx('relative rounded-lg px-2.5 py-1 transition-colors', period === p.id ? 'text-fg' : 'text-muted')}>
                {period === p.id && <motion.span layoutId="period-pill" transition={spring} className="absolute inset-0 rounded-lg bg-surface shadow-soft" />}
                <span className="relative">{p.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Metric icon={Target} value={s ? <AnimatedNumber value={s.total} /> : '–'} label="Jami lid" color="var(--c-brand)" />
          <Metric icon={TrendingUp} value={s ? <><AnimatedNumber value={s.conversion} />%</> : '–'} label="Konversiya" color={STATUS_META.success.color} />
          <Metric icon={Timer} value={s ? duration(s.avgResponseSeconds) : '–'} label="O'rt. javob" color="#f59e0b" />
        </div>
        {s && s.total > 0 && (
          <>
            <div className="mt-4 flex h-3 gap-[3px] overflow-hidden rounded-full">
              {LEAD_STATUSES.map((st) =>
                s.byStatus[st] ? (
                  <motion.span
                    key={st}
                    initial={{ width: 0 }}
                    animate={{ width: `${(s.byStatus[st] / s.total) * 100}%` }}
                    transition={{ duration: 0.8, ease }}
                    className="h-full first:rounded-l-full last:rounded-r-full"
                    style={{ backgroundColor: STATUS_META[st].color }}
                  />
                ) : null,
              )}
            </div>
            <ul className="mt-3.5 grid grid-cols-2 gap-x-5 gap-y-2 text-[13px]">
              {LEAD_STATUSES.map((st) => (
                <li key={st} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-fg/80">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_META[st].color }} />
                    {STATUS_META[st].short}
                  </span>
                  <span className="tabular font-bold">{s.byStatus[st]}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Yo'l xaritasi */}
      {doneCount < ROADMAP.length && (
        <section className="card p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-[16px] font-bold">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient text-white">
                <MapIcon className="h-4 w-4" />
              </span>
              Boshlang'ich yo'l xaritasi
            </h2>
            <span className="tabular text-[13px] font-bold text-brand">
              {doneCount}/{ROADMAP.length}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
            <motion.span
              className="block h-full rounded-full bg-brand-gradient"
              initial={{ width: 0 }}
              animate={{ width: `${(doneCount / ROADMAP.length) * 100}%` }}
              transition={{ duration: 0.9, ease }}
            />
          </div>
          <ol className="relative mt-4 space-y-3">
            {ROADMAP.map((r, i) => {
              const ok = done(r.key);
              return (
                <motion.li key={r.key} initial={{ x: -8 }} animate={{ x: 0 }} transition={{ delay: i * 0.05, duration: 0.3, ease }} className="flex gap-3">
                  <span
                    className={clsx(
                      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                      ok ? 'bg-emerald-500 text-white' : 'bg-surface-2 text-muted ring-1 ring-line',
                    )}
                  >
                    {ok ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span>
                    <span className={clsx('block text-[14px] font-semibold', ok && 'text-muted line-through')}>{r.title}</span>
                    {!ok && <span className="text-[12.5px] text-muted">{r.hint}</span>}
                  </span>
                </motion.li>
              );
            })}
          </ol>
        </section>
      )}

      <InstallCard />

      <section className="card divide-y divide-line/70 overflow-hidden shadow-soft">
        <Link to="/guide" className="flex items-center gap-3 p-4 active:bg-surface-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <BookOpen className="h-[18px] w-[18px]" />
          </span>
          <span className="flex-1 font-semibold">Qo'llanma va savollar</span>
          <ChevronRight className="h-4 w-4 text-muted" />
        </Link>
        <button onClick={onReplayOnboarding} className="flex w-full items-center gap-3 p-4 text-left active:bg-surface-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
            <PlayCircle className="h-[18px] w-[18px]" />
          </span>
          <span className="flex-1 font-semibold">Tanishuvni qayta ko'rish</span>
          <ChevronRight className="h-4 w-4 text-muted" />
        </button>
      </section>
      <p className="pb-4 text-center text-[11px] text-muted">Lidex · kalit …{employee.keyHint}</p>
    </div>
  );
}

function Metric({ icon: Icon, value, label, color }: { icon: typeof Target; value: React.ReactNode; label: string; color: string }) {
  return (
    <div className="rounded-2xl bg-surface-2/70 p-3">
      <Icon className="h-4 w-4" style={{ color }} />
      <p className="mt-2 font-display text-[19px] font-extrabold leading-tight">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium text-muted">{label}</p>
    </div>
  );
}

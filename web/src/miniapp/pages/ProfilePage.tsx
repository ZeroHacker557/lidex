import { useMutation, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { BookOpen, Check, ChevronRight, PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LEAD_STATUSES, STATUS_META, type LeadStatus } from '@shared/statuses';
import { duration } from '../../shared/format';
import { Avatar, errorText, useToast } from '../../shared/ui';
import { ROADMAP } from '../guide';
import { api, useSession } from '../session';
import { haptic } from '../telegram';

interface Stats {
  total: number;
  byStatus: Record<LeadStatus, number>;
  conversion: number;
  avgResponseSeconds: number | null;
}

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
      toast(v ? '▶️ Lid qabul qilish yoqildi' : '⏸ Lid qabul qilish to\'xtatildi');
      refresh();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  const done = (key: (typeof ROADMAP)[number]['key']) =>
    key === 'bound' ? true : key === 'onboarding' ? employee.onboardingDone : !!employee.progress?.[key];
  const doneCount = ROADMAP.filter((r) => done(r.key)).length;
  const s = stats.data;

  return (
    <div className="mx-auto max-w-xl space-y-3 px-4 pt-4">
      <div className="flex items-center gap-3">
        <Avatar name={employee.fullName} size={56} />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{employee.fullName}</h1>
          <p className="truncate text-sm text-muted">
            {employee.telegramUsername ? `@${employee.telegramUsername} · ` : ''}
            {me.data?.groups.map((g) => g.title).join(', ') ?? '…'}
          </p>
        </div>
      </div>

      {/* Lid qabul qilish */}
      <section className="card flex items-center justify-between gap-3 p-4">
        <div>
          <p className="font-semibold">Lid qabul qilish</p>
          <p className="text-[13px] text-muted">
            {employee.acceptingLeads ? 'Yangi lidlar sizga taqsimlanadi' : "To'xtatilgan — yangi lid kelmaydi (ta'til, tushlik)"}
          </p>
        </div>
        <button
          role="switch"
          aria-checked={employee.acceptingLeads}
          disabled={toggle.isPending}
          onClick={() => toggle.mutate(!employee.acceptingLeads)}
          className={clsx('relative h-7 w-12 shrink-0 rounded-full transition', employee.acceptingLeads ? 'bg-green-500' : 'bg-line')}
        >
          <span className={clsx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition', employee.acceptingLeads ? 'left-[22px]' : 'left-0.5')} />
        </button>
      </section>

      {/* Statistika */}
      <section className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Natijalarim</h2>
          <div className="flex rounded-lg bg-surface-2 p-0.5 text-[12px] font-medium">
            {(['today', 'week', 'month'] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)} className={clsx('rounded-md px-2.5 py-1', period === p ? 'bg-surface shadow-card' : 'text-muted')}>
                {p === 'today' ? 'Bugun' : p === 'week' ? '7 kun' : '30 kun'}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Metric value={s?.total} label="Jami lid" />
          <Metric value={s ? `${s.conversion}%` : undefined} label="Konversiya" color={STATUS_META.success.color} />
          <Metric value={s ? duration(s.avgResponseSeconds) : undefined} label="O'rt. javob" />
        </div>
        {s && s.total > 0 && (
          <>
            <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-surface-2">
              {LEAD_STATUSES.map((st) =>
                s.byStatus[st] ? (
                  <span key={st} style={{ width: `${(s.byStatus[st] / s.total) * 100}%`, backgroundColor: STATUS_META[st].color }} />
                ) : null,
              )}
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
              {LEAD_STATUSES.map((st) => (
                <li key={st} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_META[st].color }} />
                    {STATUS_META[st].short}
                  </span>
                  <span className="font-semibold tabular-nums">{s.byStatus[st]}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Yo'l xaritasi */}
      {doneCount < ROADMAP.length && (
        <section className="card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">🗺 Boshlang'ich yo'l xaritasi</h2>
            <span className="text-[13px] font-medium text-muted">
              {doneCount}/{ROADMAP.length}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full bg-brand transition-all" style={{ width: `${(doneCount / ROADMAP.length) * 100}%` }} />
          </div>
          <ol className="mt-3 space-y-2.5">
            {ROADMAP.map((r) => {
              const ok = done(r.key);
              return (
                <li key={r.key} className="flex gap-3">
                  <span
                    className={clsx(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                      ok ? 'border-green-500 bg-green-500 text-white' : 'border-line',
                    )}
                  >
                    {ok && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span>
                    <span className={clsx('block text-[14px] font-medium', ok && 'text-muted line-through')}>{r.title}</span>
                    {!ok && <span className="text-[12.5px] text-muted">{r.hint}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="card divide-y divide-line">
        <Link to="/guide" className="flex items-center gap-3 p-4">
          <BookOpen className="h-5 w-5 text-brand" />
          <span className="flex-1 font-medium">Qo'llanma va savollar</span>
          <ChevronRight className="h-4 w-4 text-muted" />
        </Link>
        <button onClick={onReplayOnboarding} className="flex w-full items-center gap-3 p-4 text-left">
          <PlayCircle className="h-5 w-5 text-brand" />
          <span className="flex-1 font-medium">Tanishuvni qayta ko'rish</span>
          <ChevronRight className="h-4 w-4 text-muted" />
        </button>
      </section>
      <p className="pb-4 text-center text-[11px] text-muted">Lidex · kalit …{employee.keyHint}</p>
    </div>
  );
}

function Metric({ value, label, color }: { value?: string | number; label: string; color?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-2.5">
      <p className="text-lg font-bold leading-tight" style={{ color }}>
        {value ?? '–'}
      </p>
      <p className="mt-0.5 text-[11px] text-muted">{label}</p>
    </div>
  );
}

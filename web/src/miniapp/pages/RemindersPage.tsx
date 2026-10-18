import { useQuery } from '@tanstack/react-query';
import { BellOff, CalendarDays, CircleAlert, Sun, Sunrise } from 'lucide-react';
import { startOfTashkentDay } from '../../shared/format';
import { Stagger } from '../../shared/motion';
import type { Lead } from '../../shared/types';
import { Empty, ErrorBox } from '../../shared/ui';
import { LeadCard, LeadCardSkeleton } from '../components/LeadCard';
import { api } from '../session';
import { PageTitle } from './ui';

export function RemindersPage() {
  const query = useQuery({ queryKey: ['reminders'], queryFn: () => api.get<{ items: Lead[] }>('/reminders') });
  const items = query.data?.items ?? [];

  const now = Date.now();
  const tomorrow = startOfTashkentDay(1).getTime();
  const dayAfter = startOfTashkentDay(2).getTime();
  const at = (l: Lead) => (l.nextReminderAt ? new Date(l.nextReminderAt).getTime() : Infinity);

  const sections = [
    { title: "Muddati o'tgan", icon: CircleAlert, color: '#ef4444', items: items.filter((l) => at(l) < now) },
    { title: 'Bugun', icon: Sun, color: '#f59e0b', items: items.filter((l) => at(l) >= now && at(l) < tomorrow) },
    { title: 'Ertaga', icon: Sunrise, color: '#5b5bf6', items: items.filter((l) => at(l) >= tomorrow && at(l) < dayAfter) },
    { title: 'Keyinroq', icon: CalendarDays, color: '#64748b', items: items.filter((l) => at(l) >= dayAfter) },
  ].filter((s) => s.items.length);

  return (
    <div className="mx-auto max-w-xl px-4 pt-5">
      <PageTitle title="Eslatmalar" subtitle="Keyinga qoldirilgan va ko'tarmagan mijozlar — bot vaqti kelganda eslatadi" />

      <div className="mt-5 space-y-6">
        {query.isPending && Array.from({ length: 3 }, (_, i) => <LeadCardSkeleton key={i} />)}
        {query.isError && <ErrorBox error={query.error} onRetry={() => query.refetch()} />}
        {query.isSuccess && !items.length && (
          <Empty icon={<BellOff className="h-7 w-7" />} title="Eslatmalar yo'q" text={'Lidni "Keyinga qoldirildi" deb belgilasangiz, shu yerda ko\'rinadi'} />
        )}
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="mb-2.5 flex items-center gap-2 text-[13px] font-bold">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ backgroundColor: `${s.color}1a`, color: s.color }}>
                <s.icon className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
              {s.title}
              <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted ring-1 ring-line/70">{s.items.length}</span>
            </h2>
            <Stagger className="space-y-2.5">
              {s.items.map((l) => (
                <LeadCard key={l.id} lead={l} showReminder />
              ))}
            </Stagger>
          </section>
        ))}
      </div>
    </div>
  );
}

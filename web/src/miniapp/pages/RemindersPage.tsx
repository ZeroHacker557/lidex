import { useQuery } from '@tanstack/react-query';
import { BellOff } from 'lucide-react';
import { startOfTashkentDay } from '../../shared/format';
import type { Lead } from '../../shared/types';
import { Empty, ErrorBox } from '../../shared/ui';
import { LeadCard, LeadCardSkeleton } from '../components/LeadCard';
import { api } from '../session';

export function RemindersPage() {
  const query = useQuery({ queryKey: ['reminders'], queryFn: () => api.get<{ items: Lead[] }>('/reminders') });
  const items = query.data?.items ?? [];

  const now = Date.now();
  const tomorrow = startOfTashkentDay(1).getTime();
  const dayAfter = startOfTashkentDay(2).getTime();
  const at = (l: Lead) => (l.nextReminderAt ? new Date(l.nextReminderAt).getTime() : Infinity);

  const sections = [
    { title: "⛔️ Muddati o'tgan", items: items.filter((l) => at(l) < now) },
    { title: '📅 Bugun', items: items.filter((l) => at(l) >= now && at(l) < tomorrow) },
    { title: '🌅 Ertaga', items: items.filter((l) => at(l) >= tomorrow && at(l) < dayAfter) },
    { title: '🗓 Keyinroq', items: items.filter((l) => at(l) >= dayAfter) },
  ].filter((s) => s.items.length);

  return (
    <div className="mx-auto max-w-xl px-4 pt-4">
      <h1 className="text-[22px] font-bold">Eslatmalar</h1>
      <p className="mt-1 text-sm text-muted">Keyinga qoldirilgan va ko'tarmagan mijozlar — bot vaqti kelganda eslatadi</p>

      <div className="mt-4 space-y-5">
        {query.isPending && Array.from({ length: 3 }, (_, i) => <LeadCardSkeleton key={i} />)}
        {query.isError && <ErrorBox error={query.error} onRetry={() => query.refetch()} />}
        {query.isSuccess && !items.length && (
          <Empty icon={<BellOff className="h-10 w-10" />} title="Eslatmalar yo'q" text={'Lidni "Keyinga qoldirildi" deb belgilasangiz, shu yerda ko\'rinadi'} />
        )}
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-muted">
              {s.title} <span className="rounded-full bg-surface px-2 py-0.5 text-[11px]">{s.items.length}</span>
            </h2>
            <div className="space-y-2.5">
              {s.items.map((l) => (
                <LeadCard key={l.id} lead={l} showReminder />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

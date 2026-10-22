import { useInfiniteQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { Bell, CalendarDays, CircleCheckBig, Inbox, RefreshCw, Search, Sparkles, Trophy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LEAD_STATUSES, STATUS_META, type LeadStatus } from '@shared/statuses';
import { dateKeyOf, dayLabel, tashkentDateKey } from '../../shared/format';
import { AnimatedNumber, Stagger, spring } from '../../shared/motion';
import type { Lead, Paged } from '../../shared/types';
import { Avatar, Button, Empty, ErrorBox } from '../../shared/ui';
import { LeadCard, LeadCardSkeleton } from '../components/LeadCard';
import { useSummary } from '../hooks';
import { api, useSession } from '../session';
import { haptic } from '../telegram';

type Tab = 'active' | 'all' | LeadStatus;

function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  return h < 5 ? 'Xayrli tun' : h < 11 ? 'Xayrli tong' : h < 18 ? 'Xayrli kun' : 'Xayrli kech';
}

export function LeadsPage() {
  const { employee } = useSession();
  const navigate = useNavigate();
  const [date, setDate] = useState<string | null>(() => sessionStorage.getItem('lx_date') || null);
  const { data: summary } = useSummary(date);
  const [tab, setTab] = useState<Tab>(() => (sessionStorage.getItem('lx_tab') as Tab) || 'active');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());

  useEffect(() => sessionStorage.setItem('lx_tab', tab), [tab]);
  useEffect(() => (date ? sessionStorage.setItem('lx_date', date) : sessionStorage.removeItem('lx_date')), [date]);

  const query = useInfiniteQuery({
    queryKey: ['leads', tab, q, date ?? 'all'],
    queryFn: ({ pageParam }) => api.get<Paged<Lead>>('/leads', { tab, q, cursor: pageParam, date: date ?? undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const leads = query.data?.pages.flatMap((p) => p.items) ?? [];

  // Sana tanlangan bo'lsa — tablardagi sonlar shu kun bo'yicha
  const counts = date ? summary?.day : summary;
  const tabs: Array<{ id: Tab; label: string; count?: number; color?: string }> = [
    { id: 'active', label: 'Faol', count: counts?.active },
    { id: 'all', label: 'Hammasi', count: counts?.total },
    ...LEAD_STATUSES.map((s) => ({ id: s as Tab, label: STATUS_META[s].short, count: counts?.byStatus[s], color: STATUS_META[s].color })),
  ];

  return (
    <div className="mx-auto max-w-xl">
      {/* Hero */}
      <header className="px-4 pt-4">
        <div className="relative overflow-hidden rounded-[26px] bg-[#0f1222] p-4 text-white shadow-lift ring-1 ring-white/10">
          {/* Yumshoq nur va nuqtali fon */}
          <div className="pointer-events-none absolute -right-20 -top-24 h-60 w-60 rounded-full bg-[#5b5bf6]/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-20 h-56 w-56 rounded-full bg-[#14b8a6]/[0.12] blur-3xl" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.9) 1px, transparent 1px)', backgroundSize: '14px 14px' }}
          />

          <div className="relative flex items-center gap-3">
            <Avatar name={employee.fullName} size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-white/50">{greeting()}</p>
              <h1 className="truncate font-display text-[19px] font-bold leading-tight tracking-tight">{employee.fullName}</h1>
            </div>
            <motion.button
              whileTap={{ rotate: 180, scale: 0.9 }}
              onClick={() => {
                haptic.tap();
                void query.refetch();
              }}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.07] text-white/80 ring-1 ring-white/10"
              aria-label="Yangilash"
            >
              <RefreshCw className={clsx('h-[17px] w-[17px]', query.isRefetching && 'animate-spin')} />
            </motion.button>
          </div>

          <div className="relative mt-4 flex items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-2 text-[12.5px] ring-1 ring-white/[0.07]">
            {summary && summary.active > 0 ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inset-0 animate-pulse-ring rounded-full bg-amber-400" />
                  <span className="relative h-2 w-2 rounded-full bg-amber-400" />
                </span>
                <span className="text-white/70">
                  <b className="font-semibold text-white">{summary.active} ta</b> faol lid javobingizni kutmoqda
                </span>
              </>
            ) : (
              <>
                <CircleCheckBig className="h-4 w-4 text-emerald-400" />
                <span className="text-white/70">{summary ? "Barcha lidlar ishlangan — ajoyib natija" : 'Yuklanmoqda…'}</span>
              </>
            )}
          </div>

          <div className="relative mt-3 grid grid-cols-3 gap-2">
            <HeroStat icon={Sparkles} color="#60a5fa" label="Yangi" value={summary?.byStatus.new} onClick={() => setTab('new')} />
            <HeroStat icon={Bell} color="#fbbf24" label="Bugun eslatma" value={summary?.dueToday} onClick={() => navigate('/reminders')} />
            <HeroStat icon={Trophy} color="#4ade80" label="HA dedi" value={summary?.byStatus.success} onClick={() => setTab('success')} />
          </div>
        </div>

        {!employee.acceptingLeads && (
          <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-[13px] font-medium text-warn">
            ⏸ Siz hozir yangi lid qabul qilmayapsiz. Profil bo'limidan yoqishingiz mumkin.
          </div>
        )}

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ism, telefon yoki #raqam bo'yicha qidirish"
            className="input h-12 rounded-2xl border-line/60 pl-11 pr-10 shadow-soft"
            inputMode="search"
          />
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-surface-2 p-1 text-muted" onClick={() => setSearch('')} aria-label="Tozalash">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <DateBar value={date} onChange={(d) => setDate(d)} />
      </header>

      {/* Filtrlar */}
      <div className="no-scrollbar sticky top-0 z-30 -mb-1 flex gap-1.5 overflow-x-auto bg-bg/80 px-4 py-3 backdrop-blur-xl">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                haptic.select();
                setTab(t.id);
              }}
              className={clsx(
                'relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors',
                active ? 'text-white' : 'bg-surface text-fg/80 ring-1 ring-line/70',
              )}
            >
              {active && <motion.span layoutId="tab-pill" transition={spring} className="absolute inset-0 rounded-full bg-fg shadow-card" />}
              {t.color && <span className="relative h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />}
              <span className={clsx('relative', active && 'text-bg')}>{t.label}</span>
              {t.count !== undefined && (
                <span className={clsx('relative tabular text-[11.5px]', active ? 'text-bg/60' : 'text-muted')}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-4 pt-2">
        {query.isPending && (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }, (_, i) => (
              <LeadCardSkeleton key={i} />
            ))}
          </div>
        )}
        {query.isError && <ErrorBox error={query.error} onRetry={() => query.refetch()} />}
        {query.isSuccess && leads.length === 0 && (
          <Empty
            icon={<Inbox className="h-7 w-7" />}
            title={q ? 'Hech narsa topilmadi' : date ? "Bu kunda lid yo'q" : tab === 'active' ? "Ochiq lidlar yo'q 🎉" : "Bu bo'limda lid yo'q"}
            text={q ? "Boshqa so'z bilan qidirib ko'ring" : 'Yangi lid kelganda bot sizga darhol xabar beradi'}
          />
        )}
        <Stagger key={`${tab}:${q}:${date ?? 'all'}`} className="space-y-2.5">
          {leads.flatMap((l, i) => {
            // Barcha kunlar ko'rinishida — har bir kun boshida sarlavha
            const key = dateKeyOf(l.createdAt);
            const items = [];
            if (!date && (i === 0 || dateKeyOf(leads[i - 1]!.createdAt) !== key)) {
              items.push(
                <div key={`d-${key}`} className="flex items-center gap-2 pb-0.5 pt-2 first:pt-0">
                  <CalendarDays className="h-3.5 w-3.5 text-muted" />
                  <span className="text-[12.5px] font-bold text-fg/70">{dayLabel(l.createdAt)}</span>
                  <span className="h-px flex-1 bg-line/70" />
                </div>,
              );
            }
            items.push(<LeadCard key={l.id} lead={l} />);
            return items;
          })}
        </Stagger>
        {query.hasNextPage && (
          <Button variant="secondary" className="mt-3 w-full" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
            Ko'proq yuklash
          </Button>
        )}
      </div>
    </div>
  );
}

/** Sana bo'yicha ko'rish: barcha kunlar / bugun / kecha / istalgan kun */
function DateBar({ value, onChange }: { value: string | null; onChange: (d: string | null) => void }) {
  const today = tashkentDateKey(0);
  const yesterday = tashkentDateKey(-1);
  const custom = value && value !== today && value !== yesterday ? value : null;
  const opts: Array<{ id: string | null; label: string }> = [
    { id: null, label: 'Barcha kunlar' },
    { id: today, label: 'Bugun' },
    { id: yesterday, label: 'Kecha' },
  ];
  const pick = (d: string | null) => {
    haptic.select();
    onChange(d);
  };
  return (
    <div className="no-scrollbar mt-3 flex items-center gap-1.5 overflow-x-auto">
      {opts.map((o) => (
        <button
          key={o.label}
          onClick={() => pick(o.id)}
          className={clsx(
            'shrink-0 rounded-xl px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
            value === o.id ? 'bg-brand text-white shadow-glow' : 'bg-surface text-fg/70 ring-1 ring-line/70',
          )}
        >
          {o.label}
        </button>
      ))}
      <label
        className={clsx(
          'relative flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
          custom ? 'bg-brand text-white shadow-glow' : 'bg-surface text-fg/70 ring-1 ring-line/70',
        )}
      >
        <CalendarDays className="h-3.5 w-3.5" />
        {custom ? dayLabel(`${custom}T12:00:00+05:00`) : 'Sana tanlash'}
        <input
          type="date"
          max={today}
          value={custom ?? ''}
          onChange={(e) => pick(e.target.value || null)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Sana tanlash"
        />
      </label>
    </div>
  );
}

function HeroStat({ icon: Icon, label, value, color, onClick }: { icon: typeof Bell; label: string; value?: number; color: string; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      transition={spring}
      onClick={() => {
        haptic.tap();
        onClick();
      }}
      className="flex flex-col items-start rounded-2xl bg-white/[0.05] p-3 text-left ring-1 ring-white/[0.08] transition-colors active:bg-white/[0.09]"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}26`, color }}>
        <Icon className="h-[15px] w-[15px]" strokeWidth={2.3} />
      </span>
      <span className="mt-2.5 font-display text-[24px] font-bold leading-none tracking-tight">{value === undefined ? '–' : <AnimatedNumber value={value} />}</span>
      <span className="mt-1 text-[11px] font-medium text-white/50">{label}</span>
    </motion.button>
  );
}

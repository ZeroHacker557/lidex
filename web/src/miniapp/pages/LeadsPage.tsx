import { useInfiniteQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { Bell, Inbox, RefreshCw, Search, Sparkles, Trophy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LEAD_STATUSES, STATUS_META, type LeadStatus } from '@shared/statuses';
import { AnimatedNumber, Stagger, spring } from '../../shared/motion';
import type { Lead, Paged } from '../../shared/types';
import { Button, Empty, ErrorBox } from '../../shared/ui';
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
  const { data: summary } = useSummary();
  const [tab, setTab] = useState<Tab>(() => (sessionStorage.getItem('lx_tab') as Tab) || 'active');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());

  useEffect(() => sessionStorage.setItem('lx_tab', tab), [tab]);

  const query = useInfiniteQuery({
    queryKey: ['leads', tab, q],
    queryFn: ({ pageParam }) => api.get<Paged<Lead>>('/leads', { tab, q, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const leads = query.data?.pages.flatMap((p) => p.items) ?? [];

  const tabs: Array<{ id: Tab; label: string; count?: number; color?: string }> = [
    { id: 'active', label: 'Faol', count: summary?.active },
    ...LEAD_STATUSES.map((s) => ({ id: s as Tab, label: STATUS_META[s].short, count: summary?.byStatus[s], color: STATUS_META[s].color })),
    { id: 'all', label: 'Hammasi', count: summary?.total },
  ];

  const firstName = employee.fullName.split(' ')[0];

  return (
    <div className="mx-auto max-w-xl">
      {/* Hero */}
      <header className="px-4 pt-4">
        <div className="relative overflow-hidden rounded-[26px] bg-brand-gradient p-5 text-white shadow-glow">
          <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-fuchsia-300/20 blur-2xl" />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-[13px] font-medium text-white/75">{greeting()},</p>
              <h1 className="mt-0.5 font-display text-[26px] font-extrabold leading-tight tracking-tight">{firstName} 👋</h1>
              <p className="mt-1 text-[13px] text-white/80">
                {summary ? (
                  summary.active ? (
                    <>
                      Sizda <b className="font-bold text-white">{summary.active}</b> ta faol lid bor
                    </>
                  ) : (
                    'Barcha lidlar ishlangan — zo\'r! 🎉'
                  )
                ) : (
                  ' '
                )}
              </p>
            </div>
            <motion.button
              whileTap={{ rotate: 180, scale: 0.9 }}
              onClick={() => {
                haptic.tap();
                void query.refetch();
              }}
              className="rounded-full bg-white/15 p-2.5 backdrop-blur"
              aria-label="Yangilash"
            >
              <RefreshCw className={clsx('h-[18px] w-[18px]', query.isRefetching && 'animate-spin')} />
            </motion.button>
          </div>

          <div className="relative mt-5 grid grid-cols-3 gap-2">
            <HeroStat icon={Sparkles} label="Yangi" value={summary?.byStatus.new} onClick={() => setTab('new')} />
            <HeroStat icon={Bell} label="Bugun eslatma" value={summary?.dueToday} onClick={() => navigate('/reminders')} />
            <HeroStat icon={Trophy} label="HA dedi" value={summary?.byStatus.success} onClick={() => setTab('success')} />
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
            title={q ? 'Hech narsa topilmadi' : tab === 'active' ? "Ochiq lidlar yo'q 🎉" : "Bu bo'limda lid yo'q"}
            text={q ? "Boshqa so'z bilan qidirib ko'ring" : 'Yangi lid kelganda bot sizga darhol xabar beradi'}
          />
        )}
        <Stagger key={`${tab}:${q}`} className="space-y-2.5">
          {leads.map((l) => (
            <LeadCard key={l.id} lead={l} />
          ))}
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

function HeroStat({ icon: Icon, label, value, onClick }: { icon: typeof Bell; label: string; value?: number; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      transition={spring}
      onClick={() => {
        haptic.tap();
        onClick();
      }}
      className="flex flex-col items-start rounded-2xl bg-white/15 p-3 text-left ring-1 ring-inset ring-white/20 backdrop-blur-md"
    >
      <Icon className="h-4 w-4 text-white/80" />
      <span className="mt-2 font-display text-[24px] font-extrabold leading-none">{value === undefined ? '–' : <AnimatedNumber value={value} />}</span>
      <span className="mt-1 text-[11px] font-medium text-white/75">{label}</span>
    </motion.button>
  );
}

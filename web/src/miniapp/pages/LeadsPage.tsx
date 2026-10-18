import { useInfiniteQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Inbox, RefreshCw, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LEAD_STATUSES, STATUS_META, type LeadStatus } from '@shared/statuses';
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

export function LeadsPage() {
  const { employee } = useSession();
  const navigate = useNavigate();
  const { data: summary } = useSummary();
  const [tab, setTab] = useState<Tab>(() => (sessionStorage.getItem('lx_tab') as Tab) || 'active');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
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
  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Xayrli tong' : hour < 18 ? 'Xayrli kun' : 'Xayrli kech';

  return (
    <div className="mx-auto max-w-xl">
      <header className="px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted">{greeting},</p>
            <h1 className="text-[22px] font-bold leading-tight">{firstName} 👋</h1>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => {
                setSearchOpen((v) => !v);
                if (searchOpen) setSearch('');
              }}
              className="rounded-full p-2.5 text-muted active:bg-surface"
              aria-label="Qidirish"
            >
              {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </button>
            <button onClick={() => query.refetch()} className="rounded-full p-2.5 text-muted active:bg-surface" aria-label="Yangilash">
              <RefreshCw className={clsx('h-5 w-5', query.isRefetching && 'animate-spin')} />
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Yangi" value={summary?.byStatus.new} color={STATUS_META.new.color} onClick={() => setTab('new')} />
          <Stat label="Bugun eslatma" value={summary?.dueToday} color={STATUS_META.postponed.color} onClick={() => navigate('/reminders')} />
          <Stat label="HA dedi" value={summary?.byStatus.success} color={STATUS_META.success.color} onClick={() => setTab('success')} />
        </div>

        {!employee.acceptingLeads && (
          <div className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-[13px] text-amber-600">
            ⏸ Siz hozir yangi lid qabul qilmayapsiz. Profil bo'limidan yoqishingiz mumkin.
          </div>
        )}

        {searchOpen && (
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ism, telefon yoki #raqam"
              className="input pl-9"
              inputMode="search"
            />
          </div>
        )}
      </header>

      <div className="no-scrollbar sticky top-0 z-30 flex gap-2 overflow-x-auto bg-bg/95 px-4 py-2 backdrop-blur">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              haptic.select();
              setTab(t.id);
            }}
            className={clsx(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition',
              tab === t.id ? 'bg-fg text-bg' : 'bg-surface text-fg',
            )}
          >
            {t.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />}
            {t.label}
            {t.count !== undefined && <span className={tab === t.id ? 'opacity-70' : 'text-muted'}>{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="space-y-2.5 px-4 pt-2">
        {query.isPending && Array.from({ length: 5 }, (_, i) => <LeadCardSkeleton key={i} />)}
        {query.isError && <ErrorBox error={query.error} onRetry={() => query.refetch()} />}
        {query.isSuccess && leads.length === 0 && (
          <Empty
            icon={<Inbox className="h-10 w-10" />}
            title={q ? 'Hech narsa topilmadi' : tab === 'active' ? 'Ochiq lidlar yo\'q 🎉' : 'Bu bo\'limda lid yo\'q'}
            text={q ? 'Boshqa so\'z bilan qidirib ko\'ring' : 'Yangi lid kelganda bot sizga darhol xabar beradi'}
          />
        )}
        {leads.map((l) => (
          <LeadCard key={l.id} lead={l} />
        ))}
        {query.hasNextPage && (
          <Button variant="secondary" className="w-full" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
            Ko'proq yuklash
          </Button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color, onClick }: { label: string; value?: number; color: string; onClick: () => void }) {
  return (
    <button
      onClick={() => {
        haptic.tap();
        onClick();
      }}
      className="flex flex-col items-start rounded-2xl bg-surface p-3 text-left shadow-card active:opacity-80"
    >
      <span className="text-[22px] font-bold leading-none" style={{ color }}>
        {value ?? '–'}
      </span>
      <span className="mt-1 text-[11px] text-muted">{label}</span>
    </button>
  );
}

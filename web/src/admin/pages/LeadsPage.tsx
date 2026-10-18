import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Flag, Plus, Repeat2, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LEAD_STATUSES, STATUS_META } from '@shared/statuses';
import { duration, formatPhone, smartDate, tashkentDateKey } from '../../shared/format';
import type { Lead, Paged } from '../../shared/types';
import { Button, Empty, ErrorBox, Sheet, Spinner, StatusBadge, errorText, useToast } from '../../shared/ui';
import { api } from '../api';
import { Field, PageHeader, Select, Td, Th, useOpenLead } from '../components/common';
import { useEmployees, useGroups } from '../context';

export function LeadsPage() {
  const [params, setParams] = useSearchParams();
  const groups = useGroups();
  const employees = useEmployees();
  const openLead = useOpenLead();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [addOpen, setAddOpen] = useState(false);

  const filters = useMemo(
    () => ({
      groupId: params.get('groupId') ?? '',
      employeeId: params.get('employeeId') ?? '',
      status: params.get('status') ?? '',
      from: params.get('from') ?? '',
      to: params.get('to') ?? '',
      q: params.get('q') ?? '',
      flagged: params.get('flagged') ?? '',
    }),
    [params],
  );

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('lead');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const t = setTimeout(() => search !== filters.q && set('q', search.trim()), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const apiQuery = {
    groupId: filters.groupId || undefined,
    employeeId: filters.employeeId || undefined,
    status: filters.status || undefined,
    from: filters.from ? new Date(`${filters.from}T00:00:00+05:00`).toISOString() : undefined,
    to: filters.to ? new Date(new Date(`${filters.to}T00:00:00+05:00`).getTime() + 86_400_000).toISOString() : undefined,
    q: filters.q || undefined,
    flagged: filters.flagged || undefined,
  };

  const query = useInfiniteQuery({
    queryKey: ['leads', 'admin', apiQuery],
    queryFn: ({ pageParam }) => api.get<Paged<Lead>>('/leads', { ...apiQuery, cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });
  const leads = query.data?.pages.flatMap((p) => p.items) ?? [];
  const empName = new Map((employees.data ?? []).map((e) => [e.id, e.fullName]));
  const hasFilters = Object.values(filters).some(Boolean);

  const presets = [
    { label: 'Bugun', from: tashkentDateKey(0), to: tashkentDateKey(0) },
    { label: 'Kecha', from: tashkentDateKey(-1), to: tashkentDateKey(-1) },
    { label: '7 kun', from: tashkentDateKey(-6), to: tashkentDateKey(0) },
    { label: '30 kun', from: tashkentDateKey(-29), to: tashkentDateKey(0) },
  ];

  return (
    <div>
      <PageHeader
        title="Lidlar"
        subtitle="Barcha guruhlardan tushgan lidlar, statuslari va mas'ul xodimlar"
        actions={
          <>
            <a href={api.url('/leads/export.csv', apiQuery)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium hover:bg-surface-2">
              <Download className="h-4 w-4" /> Excel (CSV)
            </a>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Lid qo'shish
            </Button>
          </>
        }
      />

      <div className="card mb-4 grid gap-3 p-4 shadow-card md:grid-cols-2 xl:grid-cols-6">
        <div className="relative xl:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ism, telefon yoki #raqam" className="input h-10 pl-9 text-sm" />
        </div>
        <Select value={filters.groupId} onChange={(e) => set('groupId', e.target.value)}>
          <option value="">Barcha guruhlar</option>
          {groups.data?.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </Select>
        <Select value={filters.employeeId} onChange={(e) => set('employeeId', e.target.value)}>
          <option value="">Barcha xodimlar</option>
          <option value="none">— Biriktirilmagan —</option>
          {employees.data?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.fullName}
            </option>
          ))}
        </Select>
        <Select value={filters.status} onChange={(e) => set('status', e.target.value)}>
          <option value="">Barcha statuslar</option>
          <option value="open">Ochiq (ishlanmoqda)</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].emoji} {STATUS_META[s].label}
            </option>
          ))}
        </Select>
        <label className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm">
          <input type="checkbox" checked={!!filters.flagged} onChange={(e) => set('flagged', e.target.checked ? '1' : '')} />
          <Flag className="h-4 w-4 text-danger" /> Belgilanganlar
        </label>
        <div className="flex flex-wrap items-center gap-2 md:col-span-2 xl:col-span-6">
          <input type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} className="input h-9 w-40 py-0 text-sm" />
          <span className="text-muted">—</span>
          <input type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} className="input h-9 w-40 py-0 text-sm" />
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set('from', p.from);
                next.set('to', p.to);
                setParams(next, { replace: true });
              }}
              className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-[12px] font-medium hover:bg-line/60"
            >
              {p.label}
            </button>
          ))}
          {hasFilters && (
            <button
              onClick={() => {
                setSearch('');
                setParams(new URLSearchParams(), { replace: true });
              }}
              className="ml-auto text-[13px] font-medium text-brand"
            >
              Filtrlarni tozalash
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden shadow-card">
        {query.isError && <ErrorBox error={query.error} onRetry={() => query.refetch()} />}
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead className="bg-surface-2/50">
              <tr>
                <Th>#</Th>
                <Th>Mijoz</Th>
                <Th>Status</Th>
                <Th>Xodim</Th>
                <Th>Guruh</Th>
                <Th>Tushgan</Th>
                <Th>Javob</Th>
                <Th>Eslatma</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {leads.map((l) => (
                <tr key={l.id} onClick={() => openLead(l.id)} className="cursor-pointer transition-colors hover:bg-surface-2/70">
                  <Td className="tabular-nums text-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="h-6 w-1 rounded-full" style={{ backgroundColor: STATUS_META[l.status].color }} />
                      {l.seq}
                    </span>
                  </Td>
                  <Td>
                    <span className="block font-medium">
                      {l.name ?? <span className="text-muted">Ism yo'q</span>}
                      {l.flagged && <Flag className="ml-1.5 inline h-3.5 w-3.5 text-danger" />}
                      {l.isDuplicate && <Repeat2 className="ml-1.5 inline h-3.5 w-3.5 text-violet-500" />}
                    </span>
                    <span className="text-[12px] text-muted">{formatPhone(l.phone)}</span>
                  </Td>
                  <Td>
                    <StatusBadge status={l.status} size="sm" />
                  </Td>
                  <Td>{l.assignedEmployeeId ? empName.get(l.assignedEmployeeId) ?? '…' : <span className="font-medium text-danger">Biriktirilmagan</span>}</Td>
                  <Td className="text-muted">{l.groupTitle}</Td>
                  <Td className="whitespace-nowrap text-muted">{smartDate(l.createdAt)}</Td>
                  <Td className="whitespace-nowrap">
                    {l.responseSeconds != null ? (
                      duration(l.responseSeconds)
                    ) : l.status === 'new' ? (
                      <span className={l.slaNotifiedAt ? 'font-medium text-danger' : 'text-warn'}>kutilmoqda</span>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-muted">
                    {l.status === 'postponed' ? (l.postponedUntil ? smartDate(l.postponedUntil) : 'har N kunda') : l.status === 'no_answer' ? smartDate(l.nextReminderAt) : ''}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {query.isPending && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}
        {query.isSuccess && !leads.length && <Empty title="Lidlar topilmadi" text={hasFilters ? 'Filtrlarni o\'zgartirib ko\'ring' : 'Guruhga lid tushishi bilan shu yerda paydo bo\'ladi'} />}
        {query.hasNextPage && (
          <div className="border-t border-line p-3 text-center">
            <Button variant="secondary" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
              Ko'proq yuklash
            </Button>
          </div>
        )}
      </div>
      {addOpen && <AddLeadModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function AddLeadModal({ onClose }: { onClose: () => void }) {
  const groups = useGroups();
  const qc = useQueryClient();
  const toast = useToast();
  const active = (groups.data ?? []).filter((g) => g.status === 'active');
  const [groupId, setGroupId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [text, setText] = useState('');
  const gid = groupId || active[0]?.id || '';

  const add = useMutation({
    mutationFn: () => api.post<{ lead: Lead | null }>('/leads', { groupId: gid, name, phone, text }),
    onSuccess: ({ lead }) => {
      toast(lead ? `✅ Lid #${lead.seq} qo'shildi va taqsimlandi` : 'Lid qo\'shilmadi');
      void qc.invalidateQueries({ queryKey: ['leads'] });
      onClose();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  return (
    <Sheet
      open
      onClose={onClose}
      title="Lidni qo'lda qo'shish"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Bekor
          </Button>
          <Button loading={add.isPending} disabled={!gid || (!name.trim() && !phone.trim())} onClick={() => add.mutate()}>
            Qo'shish
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="Guruh">
          <Select value={gid} onChange={(e) => setGroupId(e.target.value)}>
            {active.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ism">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Telefon">
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" />
        </Field>
        <Field label="Qo'shimcha ma'lumot" hint="Masalan: Manzil: Chilonzor (har bir qator alohida maydon bo'ladi)">
          <textarea className="input resize-none" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <p className="text-[12px] text-muted">Lid guruh sozlamasi bo'yicha xodimga avtomatik biriktiriladi va unga bot orqali xabar boradi.</p>
      </div>
    </Sheet>
  );
}

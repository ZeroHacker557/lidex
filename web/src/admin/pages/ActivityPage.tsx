import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { EVENT_LABELS, STATUS_META, type EventType } from '@shared/statuses';
import { fullDate } from '../../shared/format';
import type { LeadEvent, Paged } from '../../shared/types';
import { Button, Empty, ErrorBox, Spinner } from '../../shared/ui';
import { api } from '../api';
import { PageHeader, Select, Td, Th, useOpenLead } from '../components/common';
import { useEmployees, useGroups } from '../context';

export function ActivityPage() {
  const [employeeId, setEmployeeId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [type, setType] = useState('');
  const employees = useEmployees();
  const groups = useGroups();
  const openLead = useOpenLead();
  const filters = { employeeId: employeeId || undefined, groupId: employeeId ? undefined : groupId || undefined, type: type || undefined };

  const q = useInfiniteQuery({
    queryKey: ['activity', 'log', filters],
    queryFn: ({ pageParam }) => api.get<Paged<LeadEvent>>('/activity', { ...filters, cursor: pageParam, limit: 100 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div>
      <PageHeader
        title="Faollik jurnali"
        subtitle="Kim, qachon, qaysi lidga nima qildi — barcha harakatlar o'zgarmas tarzda yoziladi"
        actions={
          <>
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="w-44" disabled={!!employeeId}>
              <option value="">Barcha guruhlar</option>
              {groups.data?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
            <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-44">
              <option value="">Barcha xodimlar</option>
              {employees.data?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </Select>
            <Select value={type} onChange={(e) => setType(e.target.value)} className="w-52">
              <option value="">Barcha harakatlar</option>
              {(Object.keys(EVENT_LABELS) as EventType[]).map((t) => (
                <option key={t} value={t}>
                  {EVENT_LABELS[t]}
                </option>
              ))}
            </Select>
          </>
        }
      />
      <div className="card overflow-hidden shadow-card">
        {q.isError && <ErrorBox error={q.error} />}
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead className="border-b border-line bg-surface-2/50">
              <tr>
                <Th>Vaqt</Th>
                <Th>Kim</Th>
                <Th>Harakat</Th>
                <Th>Lid</Th>
                <Th>Izoh</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((e) => (
                <tr key={e.id} className="cursor-pointer hover:bg-surface-2" onClick={() => openLead(e.leadId)}>
                  <Td className="whitespace-nowrap tabular-nums text-muted">{fullDate(e.createdAt)}</Td>
                  <Td className="whitespace-nowrap">
                    {e.actorName}
                    {e.actorType === 'admin' && <span className="ml-1 text-[11px] text-muted">(admin)</span>}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {e.type === 'status_changed' && e.toStatus ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_META[e.toStatus].color }} />
                        {STATUS_META[e.toStatus].label}
                        {e.fromStatus && <span className="text-muted">← {STATUS_META[e.fromStatus].short}</span>}
                        {e.meta?.edit === true && <span className="rounded bg-surface-2 px-1 text-[11px] text-muted">tahrir</span>}
                      </span>
                    ) : (
                      <>
                        {EVENT_LABELS[e.type]}
                        {(e.type === 'assigned' || e.type === 'reassigned') && e.text && <span className="text-muted">: {e.text}</span>}
                      </>
                    )}
                  </Td>
                  <Td className="text-brand">#{e.leadSeq}</Td>
                  <Td className="max-w-sm truncate text-muted">{e.type !== 'assigned' && e.type !== 'reassigned' ? e.text ?? '' : ''}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {q.isPending && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}
        {q.isSuccess && !items.length && <Empty title="Yozuvlar yo'q" />}
        {q.hasNextPage && (
          <div className="border-t border-line p-3 text-center">
            <Button variant="secondary" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
              Ko'proq
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

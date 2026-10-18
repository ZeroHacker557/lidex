import { Plus, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { timeAgo } from '../../shared/format';
import { Avatar, Button, Empty, ErrorBox, Spinner } from '../../shared/ui';
import { PageHeader, Select, Td, Th } from '../components/common';
import { EmployeeFormModal } from '../components/EmployeeForm';
import { useEmployees, useGroups } from '../context';

export function EmployeesPage() {
  const [groupId, setGroupId] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const employees = useEmployees(groupId || undefined);
  const groups = useGroups();
  const navigate = useNavigate();
  const groupName = new Map((groups.data ?? []).map((g) => [g.id, g.title]));
  const list = (employees.data ?? []).filter((e) => showInactive || e.isActive);

  return (
    <div>
      <PageHeader
        title="Xodimlar"
        subtitle="Lidlarga javob beradigan operatorlar. Har biri kalit orqali botga ulanadi"
        actions={
          <>
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="w-52">
              <option value="">Barcha guruhlar</option>
              {groups.data?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Nofaollar
            </label>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Xodim qo'shish
            </Button>
          </>
        }
      />
      <div className="card overflow-hidden shadow-card">
        {employees.isError && <ErrorBox error={employees.error} />}
        {employees.isPending ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : !list.length ? (
          <Empty
            icon={<UsersRound className="h-10 w-10" />}
            title="Xodimlar yo'q"
            text="Xodim qo'shing — tizim unga kirish kaliti yaratadi"
            action={<Button onClick={() => setCreateOpen(true)}>Xodim qo'shish</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead className="bg-surface-2/50">
                <tr>
                  <Th>Xodim</Th>
                  <Th>Holat</Th>
                  <Th>Guruhlar</Th>
                  <Th className="text-right">Ochiq lidlar</Th>
                  <Th>Oxirgi faollik</Th>
                  <Th>Kalit</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {list.map((e) => (
                  <tr key={e.id} onClick={() => navigate(`/employees/${e.id}`)} className="cursor-pointer transition-colors hover:bg-surface-2/70">
                    <Td>
                      <span className="flex items-center gap-2.5">
                        <Avatar name={e.fullName} online={e.telegramId ? !!e.online : undefined} size={32} />
                        <span>
                          <span className="block font-medium">{e.fullName}</span>
                          <span className="text-[12px] text-muted">{e.telegramUsername ? `@${e.telegramUsername}` : e.phone ?? ''}</span>
                        </span>
                      </span>
                    </Td>
                    <Td>
                      {!e.isActive ? (
                        <Badge tone="gray">Nofaol</Badge>
                      ) : !e.telegramId ? (
                        <Badge tone="amber">Botga ulanmagan</Badge>
                      ) : e.botBlocked ? (
                        <Badge tone="red">Botni bloklagan</Badge>
                      ) : !e.acceptingLeads ? (
                        <Badge tone="gray">⏸ To'xtatilgan</Badge>
                      ) : (
                        <Badge tone="green">Faol</Badge>
                      )}
                    </Td>
                    <Td className="text-muted">{e.groupIds.map((g) => groupName.get(g) ?? '…').join(', ') || '—'}</Td>
                    <Td className="text-right font-semibold tabular-nums">{e.openLeads ?? 0}</Td>
                    <Td className="text-muted">{e.online ? 'onlayn' : timeAgo(e.lastSeenAt)}</Td>
                    <Td className="font-mono text-[12px] text-muted">…{e.keyHint}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {createOpen && <EmployeeFormModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

export function Badge({ tone, children }: { tone: 'green' | 'amber' | 'red' | 'gray' | 'blue'; children: React.ReactNode }) {
  const cls = {
    green: 'bg-emerald-500/10 text-good',
    amber: 'bg-amber-500/10 text-warn',
    red: 'bg-red-500/10 text-danger',
    gray: 'bg-surface-2 text-muted',
    blue: 'bg-brand/10 text-brand',
  }[tone];
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium ${cls}`}>{children}</span>;
}

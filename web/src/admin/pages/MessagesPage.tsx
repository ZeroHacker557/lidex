import { useQuery } from '@tanstack/react-query';
import { Mail, Send } from 'lucide-react';
import { useState } from 'react';
import { fullDate, smartDate } from '../../shared/format';
import type { StaffMessage } from '../../shared/types';
import { Button, Empty, ErrorBox, Spinner } from '../../shared/ui';
import { PageHeader, Select, Td, Th, useOpenLead } from '../components/common';
import { SendMessageModal } from '../components/SendMessageModal';
import { useEmployees } from '../context';
import { Badge } from './EmployeesPage';
import { api } from '../api';

export function MessagesPage() {
  const [employeeId, setEmployeeId] = useState('');
  const [open, setOpen] = useState(false);
  const employees = useEmployees();
  const openLead = useOpenLead();
  const q = useQuery({
    queryKey: ['messages', employeeId],
    queryFn: () => api.get<{ items: StaffMessage[] }>('/messages', { employeeId }),
  });
  const name = new Map((employees.data ?? []).map((e) => [e.id, e.fullName]));

  return (
    <div>
      <PageHeader
        title="Xabarlar va ogohlantirishlar"
        subtitle="Xodimlarga yuborilgan xabarlar: yetkazildi, o'qildi, tasdiqlandi"
        actions={
          <>
            <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-52">
              <option value="">Barcha xodimlar</option>
              {employees.data?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </Select>
            <Button onClick={() => setOpen(true)}>
              <Send className="h-4 w-4" /> Yangi xabar
            </Button>
          </>
        }
      />
      <div className="card overflow-hidden shadow-card">
        {q.isError && <ErrorBox error={q.error} />}
        {q.isPending ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : !q.data?.items.length ? (
          <Empty icon={<Mail className="h-10 w-10" />} title="Xabarlar yo'q" text="Lid kartasidan yoki shu yerdan xodimga xabar yuboring" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead className="border-b border-line bg-surface-2/50">
                <tr>
                  <Th>Sana</Th>
                  <Th>Kimga</Th>
                  <Th>Xabar</Th>
                  <Th>Lid</Th>
                  <Th>Holat</Th>
                  <Th>Kimdan</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {q.data.items.map((m) => (
                  <tr key={m.id}>
                    <Td className="whitespace-nowrap text-muted" >
                      <span title={fullDate(m.createdAt)}>{smartDate(m.createdAt)}</span>
                    </Td>
                    <Td className="whitespace-nowrap font-medium">{name.get(m.employeeId) ?? '…'}</Td>
                    <Td className="max-w-md">
                      <span className="mr-1">{m.type === 'warning' ? '⚠️' : '✉️'}</span>
                      {m.text}
                      {m.replyText && <span className="mt-1 block text-[12px] text-muted">↩︎ “{m.replyText}”</span>}
                    </Td>
                    <Td>
                      {m.leadId ? (
                        <button className="text-brand" onClick={() => openLead(m.leadId)}>
                          #{m.leadSeq}
                        </button>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td>
                      {m.ackAt ? (
                        <Badge tone="green">✅ Tasdiqladi</Badge>
                      ) : m.readAt ? (
                        <Badge tone="blue">👁 O'qidi</Badge>
                      ) : m.deliveredAt ? (
                        <Badge tone="gray">Yetkazildi</Badge>
                      ) : (
                        <Badge tone="amber">Botda yetkazilmadi</Badge>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{m.adminName}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {open && <SendMessageModal open onClose={() => setOpen(false)} employee={employeeId ? { id: employeeId, fullName: name.get(employeeId) ?? '' } : null} />}
    </div>
  );
}

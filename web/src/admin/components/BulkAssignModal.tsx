import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowRightLeft } from 'lucide-react';
import { useState } from 'react';
import type { Employee } from '../../shared/types';
import { Button, Sheet, errorText, useToast } from '../../shared/ui';
import { api } from '../api';
import { useEmployees } from '../context';
import { Field, Select } from './common';

/** Guruh lidlarini shu xodimga ommaviy biriktirish (yangi xodim qo'shilganda va h.k.) */
export function BulkAssignModal({ employee, groups, onClose }: { employee: Employee; groups: Array<{ id: string; title: string }>; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const employees = useEmployees();
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '');
  const [from, setFrom] = useState('');
  const [scope, setScope] = useState<'open' | 'all'>('open');

  const run = useMutation({
    mutationFn: () =>
      api.post<{ moved: number; total: number; waitingNew: number }>(`/employees/${employee.id}/bulk-assign`, {
        groupId: groupId || undefined,
        fromEmployeeId: from || null,
        scope,
      }),
    onSuccess: (r) => {
      toast(r.moved ? `${r.moved} ta lid ${employee.fullName}ga biriktirildi` : "Ko'chiriladigan lid topilmadi", r.moved ? 'success' : 'info');
      void qc.invalidateQueries({ queryKey: ['employee'] });
      void qc.invalidateQueries({ queryKey: ['employees'] });
      void qc.invalidateQueries({ queryKey: ['leads'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  const others = (employees.data ?? []).filter((e) => e.id !== employee.id);

  return (
    <Sheet
      open
      onClose={onClose}
      title="Lidlarni biriktirish"
      icon={
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <ArrowRightLeft className="h-4 w-4" />
        </span>
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Bekor
          </Button>
          <Button loading={run.isPending} disabled={!groupId} onClick={() => run.mutate()}>
            Biriktirish
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-[13.5px] text-muted">
          Tanlangan lidlar <b className="text-fg">{employee.fullName}</b>ga o'tkaziladi. Har bir lid uchun alohida xabar yuborilmaydi — xodimga bitta umumiy
          "Sizga N ta lid biriktirildi" xabari boradi. Har bir o'tkazish lid tarixida saqlanadi.
        </p>
        {groups.length > 1 && (
          <Field label="Guruh">
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Kimdan">
          <Select value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">Barcha xodimlardan (va biriktirilmaganlardan)</option>
            {others.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Qaysi lidlar">
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['open', 'Faqat ochiqlar', "Yangi, Ko'tarmadi, Keyinga — hali ishlanmaganlar"],
                ['all', 'Hammasi', "Yopilganlari (HA / YO'Q / Bekor) ham — 1-liddan oxirgisigacha"],
              ] as const
            ).map(([id, title, text]) => (
              <button
                key={id}
                type="button"
                onClick={() => setScope(id)}
                className={clsx('rounded-xl p-3 text-left transition', scope === id ? 'bg-brand/5 ring-2 ring-brand' : 'ring-1 ring-line')}
              >
                <span className="block text-[14px] font-semibold">{title}</span>
                <span className="text-[12px] text-muted">{text}</span>
              </button>
            ))}
          </div>
        </Field>
      </div>
    </Sheet>
  );
}

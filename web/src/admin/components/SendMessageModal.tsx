import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';
import type { Employee, Lead } from '../../shared/types';
import { Button, Sheet, errorText, useToast } from '../../shared/ui';
import { api } from '../api';
import { useEmployees } from '../context';
import { Field } from './common';

const TEMPLATES = [
  'Bu lidga hali javob berilmagan — iltimos, darhol qo\'ng\'iroq qiling.',
  'Statusni to\'g\'ri belgilang va izoh qoldiring.',
  'Mijoz qayta murojaat qildi, bugun bog\'laning.',
];

export function SendMessageModal({
  open,
  onClose,
  employee,
  lead,
}: {
  open: boolean;
  onClose: () => void;
  employee?: Pick<Employee, 'id' | 'fullName'> | null;
  lead?: Lead | null;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const employees = useEmployees();
  const [type, setType] = useState<'info' | 'warning'>('warning');
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<string[]>(employee ? [employee.id] : []);
  const fixed = !!employee;

  const send = useMutation({
    mutationFn: () =>
      api.post('/messages', {
        employeeIds: fixed ? [employee!.id] : selected,
        leadId: lead?.id ?? null,
        type,
        text,
      }),
    onSuccess: () => {
      toast('✅ Xabar yuborildi');
      setText('');
      void qc.invalidateQueries({ queryKey: ['messages'] });
      void qc.invalidateQueries({ queryKey: ['lead'] });
      onClose();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  const active = (employees.data ?? []).filter((e) => e.isActive);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={lead ? `Lid #${lead.seq} bo'yicha xabar` : 'Xodimga xabar'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button loading={send.isPending} disabled={!text.trim() || (!fixed && !selected.length)} onClick={() => send.mutate()}>
            Yuborish
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {fixed ? (
          <p className="text-sm">
            Kimga: <b>{employee!.fullName}</b>
          </p>
        ) : (
          <Field label="Kimga">
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
              {active.map((e) => (
                <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(e.id)}
                    onChange={(ev) => setSelected((s) => (ev.target.checked ? [...s, e.id] : s.filter((x) => x !== e.id)))}
                  />
                  {e.fullName}
                </label>
              ))}
            </div>
          </Field>
        )}
        {lead && (
          <div className="rounded-xl bg-surface-2 px-3 py-2 text-[13px]">
            📎 Biriktirilgan lid: <b>#{lead.seq}</b> {lead.name ?? lead.phone}
          </div>
        )}
        <div className="flex gap-2">
          {(['warning', 'info'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={clsx(
                'flex-1 rounded-xl border px-3 py-2 text-sm font-medium',
                type === t ? (t === 'warning' ? 'border-amber-500 bg-amber-500/10 text-amber-700' : 'border-brand bg-brand/10 text-brand') : 'border-line',
              )}
            >
              {t === 'warning' ? '⚠️ Ogohlantirish' : '✉️ Oddiy xabar'}
            </button>
          ))}
        </div>
        <Field label="Matn" hint="Xabar xodimning Telegramiga push-bildirishnoma bo'lib boradi va panelida saqlanadi">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={2000} className="input resize-none" />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map((t) => (
            <button key={t} onClick={() => setText(t)} className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] hover:bg-line/60">
              {t.slice(0, 38)}…
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

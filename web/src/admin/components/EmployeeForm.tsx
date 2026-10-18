import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Employee } from '../../shared/types';
import { Button, Sheet, errorText, useToast } from '../../shared/ui';
import { api } from '../api';
import { useAdmin, useGroups } from '../context';
import { CopyField, Field } from './common';

export function KeyModal({ data, name, onClose }: { data: { key: string; deepLink: string | null }; name: string; onClose: () => void }) {
  const toast = useToast();
  const { botUsername } = useAdmin();
  const copied = () => toast('Nusxa olindi');
  const instruction =
    `Assalomu alaykum, ${name}!\n\nLidex paneliga kirish:\n` +
    (data.deepLink ? `1) Havolani oching: ${data.deepLink}\n2) "Start" tugmasini bosing — tamom.` : `1) Botni oching: @${botUsername ?? 'bot'}\n2) Kalitni yuboring: ${data.key}`) +
    `\n\nKalit: ${data.key}\nKalitni boshqalarga bermang.`;
  return (
    <Sheet
      open
      onClose={onClose}
      title="🔑 Kirish kaliti tayyor"
      footer={
        <Button className="w-full" onClick={onClose}>
          Tushunarli
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-[13px] text-warn">
          Kalit faqat <b>hozir</b> ko'rsatiladi (xavfsizlik uchun saqlanmaydi). Yo'qolsa — yangisini yarating.
        </p>
        <Field label="Kalit">
          <CopyField value={data.key} onCopy={copied} />
        </Field>
        {data.deepLink && (
          <Field label="Bir bosishda kirish havolasi" hint="Xodim havolani ochib Start bossa, kalit avtomatik qabul qilinadi">
            <CopyField value={data.deepLink} onCopy={copied} />
          </Field>
        )}
        <Field label="Xodimga yuboriladigan matn">
          <textarea readOnly value={instruction} rows={7} className="input resize-none font-mono text-[12px]" />
        </Field>
        <Button variant="outline" className="w-full" onClick={() => void navigator.clipboard.writeText(instruction).then(copied)}>
          Matnni nusxalash
        </Button>
      </div>
    </Sheet>
  );
}

export function EmployeeFormModal({ employee, onClose }: { employee?: Employee; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const groups = useGroups();
  const [fullName, setFullName] = useState(employee?.fullName ?? '');
  const [phone, setPhone] = useState(employee?.phone ?? '');
  const [groupIds, setGroupIds] = useState<string[]>(employee?.groupIds ?? []);
  const [created, setCreated] = useState<{ key: string; deepLink: string | null } | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const body = { fullName, phone: phone || null, groupIds };
      if (employee) return api.patch(`/employees/${employee.id}`, body);
      return api.post<{ key: string; deepLink: string | null }>('/employees', body);
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['employees'] });
      void qc.invalidateQueries({ queryKey: ['employee'] });
      void qc.invalidateQueries({ queryKey: ['groups'] });
      if (employee) {
        toast('Saqlandi');
        onClose();
      } else setCreated(res as { key: string; deepLink: string | null });
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  if (created) return <KeyModal data={created} name={fullName} onClose={onClose} />;

  const selectable = (groups.data ?? []).filter((g) => g.status !== 'disabled');
  return (
    <Sheet
      open
      onClose={onClose}
      title={employee ? 'Xodimni tahrirlash' : "Yangi xodim qo'shish"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Bekor
          </Button>
          <Button loading={save.isPending} disabled={fullName.trim().length < 2} onClick={() => save.mutate()}>
            {employee ? 'Saqlash' : 'Yaratish va kalit olish'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="F.I.Sh">
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus placeholder="Masalan: Dilnoza Rahimova" />
        </Field>
        <Field label="Telefon (ixtiyoriy)">
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Guruhlar" hint="Xodim faqat shu guruhlardan tushgan lidlarni oladi va ko'radi">
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
            {selectable.map((g) => (
              <label key={g.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                <input
                  type="checkbox"
                  checked={groupIds.includes(g.id)}
                  onChange={(e) => setGroupIds((s) => (e.target.checked ? [...s, g.id] : s.filter((x) => x !== g.id)))}
                />
                {g.title}
                {g.status === 'pending' && <span className="text-[11px] text-warn">(tasdiqlanmagan)</span>}
              </label>
            ))}
            {!selectable.length && <p className="px-2 py-1.5 text-sm text-muted">Avval guruh qo'shing (botni guruhga qo'shing)</p>}
          </div>
        </Field>
      </div>
    </Sheet>
  );
}

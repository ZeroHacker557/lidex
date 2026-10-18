import clsx from 'clsx';
import { CalendarClock, Repeat } from 'lucide-react';
import { useState } from 'react';
import { dayLabel, tashkentDateKey, tashkentIso, tzParts } from '../../shared/format';
import { Button, Sheet } from '../../shared/ui';

export interface PostponeChoice {
  postponedUntil: string | null;
}

export function PostponeSheet({
  open,
  onClose,
  onSubmit,
  intervalDays,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (c: PostponeChoice) => void;
  intervalDays: number;
  loading?: boolean;
}) {
  const nowHour = tzParts(new Date()).h;
  const presets = [
    ...(nowHour < 17 ? [{ id: 'evening', label: 'Bugun kechqurun', sub: '18:00', iso: tashkentIso(tashkentDateKey(0), '18:00') }] : []),
    { id: 'tomorrow', label: 'Ertaga ertalab', sub: '09:00', iso: tashkentIso(tashkentDateKey(1), '09:00') },
    { id: 'd2', label: '2 kundan keyin', sub: dayLabel(tashkentIso(tashkentDateKey(2), '09:00')), iso: tashkentIso(tashkentDateKey(2), '09:00') },
    { id: 'w1', label: '1 haftadan keyin', sub: dayLabel(tashkentIso(tashkentDateKey(7), '09:00')), iso: tashkentIso(tashkentDateKey(7), '09:00') },
  ];
  const [choice, setChoice] = useState<string>('tomorrow');
  const [date, setDate] = useState(tashkentDateKey(1));
  const [time, setTime] = useState('10:00');

  const submit = () => {
    if (choice === 'nodate') return onSubmit({ postponedUntil: null });
    if (choice === 'custom') return onSubmit({ postponedUntil: tashkentIso(date, time) });
    const p = presets.find((x) => x.id === choice);
    onSubmit({ postponedUntil: p?.iso ?? null });
  };

  const customInvalid = choice === 'custom' && new Date(tashkentIso(date, time)).getTime() < Date.now();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="🟡 Keyinga qoldirish"
      footer={
        <Button size="lg" className="w-full" onClick={submit} loading={loading} disabled={customInvalid}>
          Saqlash
        </Button>
      }
    >
      <p className="mb-3 text-sm text-muted">Qachon qayta qo'ng'iroq qilasiz? Bot aynan o'sha vaqtda eslatadi.</p>
      <div className="grid grid-cols-2 gap-2">
        {presets.map((p) => (
          <Option key={p.id} active={choice === p.id} onClick={() => setChoice(p.id)} title={p.label} sub={p.sub} />
        ))}
      </div>

      <div className={clsx('mt-2 rounded-2xl border p-3 transition', choice === 'custom' ? 'border-brand bg-brand/5' : 'border-line')}>
        <button className="flex w-full items-center gap-2 text-left text-[15px] font-medium" onClick={() => setChoice('custom')}>
          <CalendarClock className="h-5 w-5 text-brand" /> Aniq sana va vaqt
        </button>
        {choice === 'custom' && (
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <input type="date" className="input" value={date} min={tashkentDateKey(0)} onChange={(e) => setDate(e.target.value)} />
            <input type="time" className="input w-28" value={time} onChange={(e) => setTime(e.target.value)} />
            {customInvalid && <p className="col-span-2 text-xs text-danger">O'tib ketgan vaqtni tanlab bo'lmaydi</p>}
          </div>
        )}
      </div>

      <button
        onClick={() => setChoice('nodate')}
        className={clsx(
          'mt-2 flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition',
          choice === 'nodate' ? 'border-brand bg-brand/5' : 'border-line',
        )}
      >
        <Repeat className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <span>
          <span className="block text-[15px] font-medium">Sanasiz</span>
          <span className="text-[13px] text-muted">Har {intervalDays} kunda eslatib turaman — status o'zgarguncha</span>
        </span>
      </button>
    </Sheet>
  );
}

function Option({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className={clsx('rounded-2xl border p-3 text-left transition', active ? 'border-brand bg-brand/5' : 'border-line')}
    >
      <span className="block text-[14px] font-medium">{title}</span>
      <span className="text-[12px] text-muted">{sub}</span>
    </button>
  );
}

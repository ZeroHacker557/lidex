import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, CalendarDays, Clock3, Moon, Repeat, Sunrise } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { dayLabel, tashkentDateKey, tashkentIso, tzParts } from '../../shared/format';
import { spring } from '../../shared/motion';
import { Button, Sheet } from '../../shared/ui';
import { haptic } from '../telegram';

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
    ...(nowHour < 17 ? [{ id: 'evening', icon: Moon, label: 'Bugun kechqurun', sub: '18:00', iso: tashkentIso(tashkentDateKey(0), '18:00') }] : []),
    { id: 'tomorrow', icon: Sunrise, label: 'Ertaga ertalab', sub: '09:00', iso: tashkentIso(tashkentDateKey(1), '09:00') },
    { id: 'd2', icon: Clock3, label: '2 kundan keyin', sub: dayLabel(tashkentIso(tashkentDateKey(2), '09:00')), iso: tashkentIso(tashkentDateKey(2), '09:00') },
    { id: 'w1', icon: CalendarDays, label: '1 haftadan keyin', sub: dayLabel(tashkentIso(tashkentDateKey(7), '09:00')), iso: tashkentIso(tashkentDateKey(7), '09:00') },
  ];
  const [choice, setChoice] = useState<string>('tomorrow');
  const [date, setDate] = useState(tashkentDateKey(1));
  const [time, setTime] = useState('10:00');

  const pick = (id: string) => {
    haptic.select();
    setChoice(id);
  };

  const submit = () => {
    if (choice === 'nodate') return onSubmit({ postponedUntil: null });
    if (choice === 'custom') return onSubmit({ postponedUntil: tashkentIso(date, time) });
    onSubmit({ postponedUntil: presets.find((x) => x.id === choice)?.iso ?? null });
  };
  const customInvalid = choice === 'custom' && new Date(tashkentIso(date, time)).getTime() < Date.now();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      icon={
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
          <Clock3 className="h-[18px] w-[18px]" />
        </span>
      }
      title="Keyinga qoldirish"
      footer={
        <Button size="lg" className="w-full" onClick={submit} loading={loading} disabled={customInvalid}>
          Saqlash
        </Button>
      }
    >
      <p className="mb-4 text-[14px] text-muted">Qachon qayta qo'ng'iroq qilasiz? Bot aynan o'sha vaqtda eslatadi.</p>
      <div className="grid grid-cols-2 gap-2">
        {presets.map((p) => (
          <Option key={p.id} active={choice === p.id} onClick={() => pick(p.id)} icon={<p.icon className="h-[18px] w-[18px]" />} title={p.label} sub={p.sub} />
        ))}
      </div>

      <div className={clsx('relative mt-2 rounded-2xl p-3.5 transition', choice === 'custom' ? 'bg-brand/5 ring-2 ring-brand' : 'ring-1 ring-line')}>
        <button className="flex w-full items-center gap-2.5 text-left text-[14.5px] font-semibold" onClick={() => pick('custom')}>
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <CalendarClock className="h-[18px] w-[18px]" />
          </span>
          Aniq sana va vaqt
        </button>
        <AnimatePresence initial={false}>
          {choice === 'custom' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="grid grid-cols-[1fr_auto] gap-2 pt-3">
                <input type="date" className="input" value={date} min={tashkentDateKey(0)} onChange={(e) => setDate(e.target.value)} />
                <input type="time" className="input w-28" value={time} onChange={(e) => setTime(e.target.value)} />
                {customInvalid && <p className="col-span-2 text-xs font-medium text-danger">O'tib ketgan vaqtni tanlab bo'lmaydi</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        onClick={() => pick('nodate')}
        className={clsx('relative mt-2 flex w-full items-start gap-3 rounded-2xl p-3.5 text-left transition', choice === 'nodate' ? 'bg-brand/5 ring-2 ring-brand' : 'ring-1 ring-line')}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
          <Repeat className="h-[18px] w-[18px]" />
        </span>
        <span>
          <span className="block text-[14.5px] font-semibold">Sanasiz</span>
          <span className="text-[13px] text-muted">Har {intervalDays} kunda eslatib turaman — status o'zgarguncha</span>
        </span>
      </button>
    </Sheet>
  );
}

function Option({ active, onClick, title, sub, icon }: { active: boolean; onClick: () => void; title: string; sub: string; icon: ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      transition={spring}
      onClick={onClick}
      className={clsx('relative rounded-2xl p-3.5 text-left transition', active ? 'bg-brand/5 ring-2 ring-brand' : 'ring-1 ring-line')}
    >
      <span className={clsx('mb-2 flex h-8 w-8 items-center justify-center rounded-xl transition', active ? 'bg-brand text-white' : 'bg-surface-2 text-muted')}>{icon}</span>
      <span className="block text-[14px] font-semibold">{title}</span>
      <span className="text-[12px] text-muted">{sub}</span>
    </motion.button>
  );
}

import clsx from 'clsx';
import { useState } from 'react';
import { Button } from '../../shared/ui';
import { GUIDE_STEPS } from '../guide';
import { haptic } from '../telegram';

export function Onboarding({ onDone }: { onDone: () => void | Promise<void> }) {
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const step = GUIDE_STEPS[i]!;
  const last = i === GUIDE_STEPS.length - 1;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col px-5 pb-6 pt-6">
      <div className="flex items-center gap-1.5">
        {GUIDE_STEPS.map((_, k) => (
          <span key={k} className={clsx('h-1.5 flex-1 rounded-full transition', k <= i ? 'bg-brand' : 'bg-line')} />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[12px] text-muted">
        <span>
          Qo'llanma · {i + 1}/{GUIDE_STEPS.length}
        </span>
        {!last && (
          <button className="font-medium" onClick={() => setI(GUIDE_STEPS.length - 1)}>
            O'tkazib yuborish
          </button>
        )}
      </div>

      <div key={i} className="flex flex-1 animate-fade-in flex-col pt-10">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-surface text-5xl shadow-card">{step.emoji}</div>
        <h1 className="text-[26px] font-bold leading-tight">{step.title}</h1>
        <div className="mt-4 text-[15px] leading-relaxed">{step.body}</div>
      </div>

      <div className="mt-8 flex gap-2">
        {i > 0 && (
          <Button variant="secondary" size="lg" onClick={() => setI(i - 1)}>
            Orqaga
          </Button>
        )}
        <Button
          size="lg"
          className="flex-1"
          loading={busy}
          onClick={async () => {
            haptic.tap();
            if (!last) return setI(i + 1);
            setBusy(true);
            await onDone();
          }}
        >
          {last ? 'Ishni boshlash 🚀' : 'Keyingisi'}
        </Button>
      </div>
    </div>
  );
}

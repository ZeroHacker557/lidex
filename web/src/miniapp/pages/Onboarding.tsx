import { motion } from 'framer-motion';
import { useState } from 'react';
import { ease, spring } from '../../shared/motion';
import { Button } from '../../shared/ui';
import { GUIDE_STEPS } from '../guide';
import { haptic } from '../telegram';

export function Onboarding({ onDone }: { onDone: () => void | Promise<void> }) {
  const [[i, dir], setStep] = useState<[number, number]>([0, 1]);
  const [busy, setBusy] = useState(false);
  const step = GUIDE_STEPS[i]!;
  const last = i === GUIDE_STEPS.length - 1;
  const go = (n: number) => setStep([n, n > i ? 1 : -1]);

  return (
    <div className="relative mx-auto flex min-h-[100dvh] max-w-xl flex-col overflow-hidden px-5 pb-6 pt-5">
      {/* Fon */}
      <motion.div
        key={step.color}
        className="pointer-events-none absolute inset-x-0 top-0 h-[55vh]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        style={{ background: `radial-gradient(80% 70% at 50% 0%, ${step.color}33, transparent 70%)` }}
      />

      <div className="relative flex items-center justify-between">
        <div className="flex gap-1.5">
          {GUIDE_STEPS.map((_, k) => (
            <motion.span
              key={k}
              animate={{ width: k === i ? 24 : 8, opacity: k <= i ? 1 : 0.35 }}
              transition={spring}
              className="h-2 rounded-full"
              style={{ backgroundColor: k <= i ? step.color : 'var(--c-muted)' }}
            />
          ))}
        </div>
        {!last && (
          <button className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-muted active:bg-surface" onClick={() => go(GUIDE_STEPS.length - 1)}>
            O'tkazib yuborish
          </button>
        )}
      </div>

      <div className="relative flex flex-1 flex-col">
        <>
          <motion.div
            key={i}
            custom={dir}
            initial={{ x: dir * 40 }}
            animate={{ x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.32, ease }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.25}
            onDragEnd={(_e, info) => {
              if (info.offset.x < -60 && !last) go(i + 1);
              if (info.offset.x > 60 && i > 0) go(i - 1);
            }}
            className="flex flex-1 flex-col pt-12"
          >
            <motion.div
              initial={{ scale: 0.6, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ ...spring, delay: 0.08 }}
              className="relative mb-7 h-24 w-24"
            >
              <span className="absolute inset-0 animate-pulse-ring rounded-[30px]" style={{ backgroundColor: `${step.color}40` }} />
              <span
                className="relative flex h-full w-full items-center justify-center rounded-[30px] text-white"
                style={{ background: `linear-gradient(135deg, ${step.color}, ${step.color}b3)`, boxShadow: `0 18px 40px -12px ${step.color}` }}
              >
                <step.icon className="h-11 w-11" strokeWidth={2} />
              </span>
            </motion.div>
            <p className="text-[13px] font-bold uppercase tracking-[0.14em]" style={{ color: step.color }}>
              Qadam {i + 1} / {GUIDE_STEPS.length}
            </p>
            <h1 className="mt-2 font-display text-[30px] font-extrabold leading-[1.1] tracking-tight">{step.title}</h1>
            <div className="mt-4 text-[15.5px] leading-relaxed text-fg/85">{step.body}</div>
          </motion.div>
        </>
      </div>

      <div className="relative mt-8 flex gap-2">
        {i > 0 && (
          <Button variant="secondary" size="lg" onClick={() => go(i - 1)}>
            Orqaga
          </Button>
        )}
        <Button
          size="lg"
          className="flex-1"
          loading={busy}
          onClick={async () => {
            haptic.tap();
            if (!last) return go(i + 1);
            setBusy(true);
            haptic.success();
            await onDone();
          }}
        >
          {last ? 'Ishni boshlash 🚀' : 'Keyingisi'}
        </Button>
      </div>
    </div>
  );
}

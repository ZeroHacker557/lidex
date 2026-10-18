import { motion, useAnimationControls } from 'framer-motion';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { ease, spring } from '../../shared/motion';
import type { Employee } from '../../shared/types';
import { Button, Logo, errorText } from '../../shared/ui';
import { api } from '../session';
import { haptic } from '../telegram';

export function KeyScreen({
  initData,
  firstName,
  onSuccess,
}: {
  initData: string;
  firstName: string;
  onSuccess: (token: string, employee: Employee) => void;
}) {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shake = useAnimationControls();

  // LX-XXXX-XXXX formatiga avtomatik keltirish
  const onChange = (v: string) => {
    const raw = v.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^LX/, '').slice(0, 8);
    setKey(raw.length > 4 ? `LX-${raw.slice(0, 4)}-${raw.slice(4)}` : raw ? `LX-${raw}` : '');
    setError(null);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ token: string; employee: Employee }>('/auth/key', { initData, key });
      onSuccess(res.token, res.employee);
    } catch (e) {
      haptic.error();
      setError(errorText(e));
      void shake.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.4 } });
    } finally {
      setBusy(false);
    }
  };

  const filled = key.replace(/[^A-Z0-9]/g, '').replace(/^LX/, '').length;

  return (
    <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center overflow-hidden px-6 py-10">
      <div className="mesh pointer-events-none absolute inset-0" />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="relative">
        <div className="mb-7 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
            <Logo className="h-5 w-5" />
          </span>
          <span className="font-display text-[20px] font-extrabold tracking-tight">Lidex</span>
        </div>

        <motion.div
          initial={{ scale: 0.7, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ ...spring, delay: 0.1 }}
          className="mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-amber-400/15 text-amber-500 ring-1 ring-amber-400/30"
        >
          <KeyRound className="h-8 w-8" />
        </motion.div>
        <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-tight">Salom{firstName ? `, ${firstName}` : ''}!</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Panelga kirish uchun rahbaringiz bergan <b className="text-fg">kirish kalitini</b> kiriting.
        </p>

        <form
          className="mt-7"
          onSubmit={(e) => {
            e.preventDefault();
            if (key.length >= 12) void submit();
          }}
        >
          <motion.div animate={shake}>
            <input
              autoFocus
              value={key}
              onChange={(e) => onChange(e.target.value)}
              placeholder="LX-XXXX-XXXX"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="input h-16 rounded-2xl text-center font-mono text-[22px] font-bold tracking-[0.22em] shadow-card"
            />
          </motion.div>
          <div className="mt-3 flex justify-center gap-1">
            {Array.from({ length: 8 }, (_, k) => (
              <motion.span
                key={k}
                animate={{ backgroundColor: k < filled ? 'var(--c-brand)' : 'var(--c-line)', scale: k === filled - 1 ? 1.3 : 1 }}
                transition={spring}
                className="h-1.5 w-5 rounded-full"
              />
            ))}
          </div>
          {error && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-center text-sm font-semibold text-danger">
              {error}
            </motion.p>
          )}
          <Button type="submit" size="lg" className="mt-5 w-full" loading={busy} disabled={key.length < 12}>
            Kirish
          </Button>
        </form>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[12.5px] text-muted">
          <ShieldCheck className="h-4 w-4" /> Kalit faqat bir marta kiritiladi va Telegramingizga bog'lanadi
        </p>
      </motion.div>
    </div>
  );
}

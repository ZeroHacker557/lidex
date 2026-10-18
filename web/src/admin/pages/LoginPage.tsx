import { motion, useAnimationControls } from 'framer-motion';
import { BellRing, Eye, EyeOff, LockKeyhole, ShieldCheck, TrendingUp, UserRound, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { STATUS_META } from '@shared/statuses';
import { ease, spring } from '../../shared/motion';
import { Button, Logo, errorText } from '../../shared/ui';
import { api } from '../api';

const FEATURES = [
  { icon: BellRing, text: 'Har bir lid xodimga darhol push-bildirishnoma bilan' },
  { icon: UsersRound, text: 'Xodimlar faolligi va javob tezligini kuzatish' },
  { icon: TrendingUp, text: 'Konversiya, statuslar va kunlik dinamika' },
];

export function LoginPage({ onLogin }: { onLogin: () => void | Promise<void> }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shake = useAnimationControls();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/login', { username, password });
      await onLogin();
    } catch (err) {
      setError(errorText(err));
      void shake.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.4 } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brend paneli */}
      <div className="relative hidden overflow-hidden bg-[#0b0d1a] p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -left-32 -top-32 h-[480px] w-[480px] rounded-full bg-[#5b5bf6] opacity-40 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-40 right-0 h-[420px] w-[420px] rounded-full bg-[#9b5cf6] opacity-30 blur-[120px]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '44px 44px' }}
        />

        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5b5bf6] to-[#9b5cf6] shadow-[0_10px_30px_-8px_#5b5bf6]">
            <Logo className="h-5 w-5" />
          </span>
          <span className="font-display text-[22px] font-extrabold tracking-tight">Lidex</span>
        </div>

        <div className="relative my-auto max-w-lg">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="font-display text-[44px] font-extrabold leading-[1.08] tracking-tight"
          >
            Har bir lid —{' '}
            <span className="bg-gradient-to-r from-[#a5b4fc] via-[#c4b5fd] to-[#f0abfc] bg-clip-text text-transparent">nazoratda.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease, delay: 0.1 }} className="mt-4 text-[16px] leading-relaxed text-white/65">
            Telegram guruhlardan tushgan mijozlar avtomatik xodimlarga taqsimlanadi, siz esa natijani real vaqtda ko'rasiz.
          </motion.p>
          <ul className="mt-8 space-y-3.5">
            {FEATURES.map((f, i) => (
              <motion.li
                key={f.text}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, ease, delay: 0.2 + i * 0.08 }}
                className="flex items-center gap-3 text-[14.5px] text-white/85"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <f.icon className="h-[18px] w-[18px]" />
                </span>
                {f.text}
              </motion.li>
            ))}
          </ul>

          {/* Bezak: status kartochkalari */}
          <div className="relative mt-12 h-28">
            {(['success', 'postponed', 'new'] as const).map((s, i) => (
              <motion.div
                key={s}
                initial={{ opacity: 0, y: 20, rotate: 0 }}
                animate={{ opacity: 1, y: 0, rotate: [-4, 3, -2][i] }}
                transition={{ ...spring, delay: 0.45 + i * 0.1 }}
                className="absolute flex w-56 items-center gap-3 rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10 backdrop-blur-md"
                style={{ left: i * 120, top: [8, 34, 0][i] }}
              >
                <span className="h-9 w-9 shrink-0 rounded-xl" style={{ backgroundColor: `${STATUS_META[s].color}`, opacity: 0.9 }} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">{['Aziz Karimov', 'Dilnoza R.', 'Yangi lid #1042'][i]}</span>
                  <span className="text-[11.5px] text-white/60">{STATUS_META[s].label}</span>
                </span>
              </motion.div>
            ))}
          </div>
        </div>
        <p className="relative text-[12px] text-white/40">© Lidex · Lidlar boshqaruv tizimi</p>
      </div>

      {/* Forma */}
      <div className="mesh relative flex items-center justify-center px-5 py-12">
        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="w-full max-w-[400px]"
        >
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
              <Logo className="h-5 w-5" />
            </span>
            <span className="font-display text-[22px] font-extrabold tracking-tight">Lidex</span>
          </div>
          <h2 className="font-display text-[30px] font-extrabold tracking-tight">Xush kelibsiz</h2>
          <p className="mt-1.5 text-[14.5px] text-muted">Boshqaruv paneliga kirish uchun login va parolingizni kiriting</p>

          <motion.div animate={shake} className="mt-8 space-y-4">
            <label className="block">
              <span className="label">Login</span>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
                <input className="input h-12 pl-11" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus placeholder="admin" />
              </div>
            </label>
            <label className="block">
              <span className="label">Parol</span>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
                <input
                  className="input h-12 pl-11 pr-11"
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted hover:text-fg" aria-label="Parolni ko'rsatish">
                  {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                </button>
              </div>
            </label>
          </motion.div>
          {error && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl bg-danger/10 px-3.5 py-2.5 text-[13.5px] font-semibold text-danger">
              {error}
            </motion.p>
          )}
          <Button type="submit" size="lg" className="mt-6 w-full" loading={busy} disabled={!username || !password}>
            Kirish
          </Button>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-[12.5px] text-muted">
            <ShieldCheck className="h-4 w-4" /> Faqat katta xodimlar uchun. Login va parolni superadmin beradi.
          </p>
        </motion.form>
      </div>
    </div>
  );
}

import clsx from 'clsx';
import { Loader2, Send, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../shared/api';
import type { Employee } from '../../shared/types';
import { Button, ErrorBox, Logo } from '../../shared/ui';
import { InstallCard } from '../components/InstallCard';
import { useInstallState } from '../pwa';
import { api } from '../session';

/** Kirish so'rovi qurilmada saqlanadi: Telegram'dan qaytganda (ilova qayta yuklansa ham) davom etadi */
const PENDING_KEY = 'lx_web_login';

interface Pending {
  id: string;
  secret: string;
  botUrl: string;
  expiresAt: string;
  opened?: boolean;
}
type PollResponse = { status: 'pending' | 'expired' } | { status: 'approved'; token: string; employee: Employee };

const LINK_BTN =
  'flex w-full select-none items-center justify-center gap-2 rounded-xl font-semibold transition-transform duration-150 active:scale-[0.97]';

const isLive = (p: Pending | null): p is Pending => !!p && new Date(p.expiresAt).getTime() - Date.now() > 15_000;

function loadPending(): Pending | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null') as Pending | null;
    return isLive(p) ? p : null;
  } catch {
    return null;
  }
}
function savePending(p: Pending | null) {
  try {
    if (p) localStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    /* xususiy rejim */
  }
}

/** https://t.me/bot?start=x -> tg://resolve?domain=bot&start=x (Telegram ilovasini to'g'ridan-to'g'ri ochadi) */
function tgDeepLink(botUrl: string): string {
  const u = new URL(botUrl);
  return `tg://resolve?domain=${u.pathname.slice(1)}&start=${u.searchParams.get('start') ?? ''}`;
}

/** Sayt / o'rnatilgan ilova: Telegram orqali bir marta tasdiqlab kirish */
export function WebLogin({ onSuccess }: { onSuccess: (token: string, employee: Employee) => void }) {
  const [login, setLogin] = useState<Pending | null>(loadPending);
  const [waiting, setWaiting] = useState(() => !!loadPending()?.opened);
  const [error, setError] = useState<unknown>(null);
  const install = useInstallState();
  const busy = useRef(false);

  const create = useCallback(async () => {
    setError(null);
    try {
      const r = await api.post<Pending>('/web-login');
      savePending(r);
      setLogin(r);
      setWaiting(false);
    } catch (e) {
      setError(e);
    }
  }, []);

  // So'rov bo'lmasa yoki eskirsa — yangisini tayyorlab qo'yamiz (tugma darhol havola bo'lishi uchun)
  useEffect(() => {
    if (!isLive(login)) {
      void create();
      return;
    }
    const t = setTimeout(() => void create(), new Date(login.expiresAt).getTime() - Date.now() - 15_000);
    return () => clearTimeout(t);
  }, [login, create]);

  // Telegram'da tasdiqlanishini kutish
  useEffect(() => {
    if (!login || !waiting) return;
    let stopped = false;
    const tick = async () => {
      if (stopped || busy.current || document.visibilityState !== 'visible') return;
      busy.current = true;
      try {
        const r = await api.post<PollResponse>('/web-login/poll', { id: login.id, secret: login.secret });
        if (stopped) return;
        if (r.status === 'approved') {
          stopped = true;
          savePending(null);
          onSuccess(r.token, r.employee);
        } else if (r.status === 'expired') void create();
      } catch (e) {
        if (!stopped && e instanceof ApiError && e.status === 404) void create();
      } finally {
        busy.current = false;
      }
    };
    void tick();
    const iv = setInterval(tick, 2000);
    const wake = () => void tick();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    return () => {
      stopped = true;
      clearInterval(iv);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
    };
  }, [login, waiting, create, onSuccess]);

  const opened = () => {
    if (!login) return;
    const p = { ...login, opened: true };
    savePending(p);
    setLogin(p);
    setWaiting(true);
  };

  return (
    <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center overflow-hidden px-5 py-10">
      <div className="mesh pointer-events-none absolute inset-0" />
      <div className="page-in relative space-y-4">
        <div className="flex flex-col items-center pb-2 text-center">
          <div className="mb-5 flex h-20 w-20 animate-float items-center justify-center rounded-[26px] bg-brand-gradient text-white shadow-glow">
            <Logo className="h-10 w-10" />
          </div>
          <h1 className="font-display text-[26px] font-extrabold tracking-tight">Lidex</h1>
          <p className="mt-1 text-[15px] text-muted">Lidlar bilan ishlash paneli</p>
        </div>

        <section className="card p-5 shadow-soft">
          {error ? (
            <ErrorBox error={error} onRetry={() => void create()} />
          ) : waiting && login ? (
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand" />
              <h2 className="mt-3 font-display text-[18px] font-bold">Telegram'da tasdiqlang</h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
                Botda <b className="text-fg">"✅ Ha, kiraman"</b> tugmasini bosing va shu yerga qayting — avtomatik kirasiz.
              </p>
              <a href={login.botUrl} target="_blank" rel="noopener noreferrer" className={clsx(LINK_BTN, 'mt-4 h-10 bg-surface-2 text-sm text-fg')}>
                <Send className="h-4 w-4" /> Telegram'ni qayta ochish
              </a>
              <button onClick={() => void create()} className="mt-3 text-[13px] font-semibold text-muted underline-offset-2 hover:underline">
                Bekor qilish
              </button>
            </div>
          ) : (
            <>
              <h2 className="font-display text-[18px] font-bold">Kirish</h2>
              <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
                Telegram akkauntingiz orqali kirasiz — kalit kerak emas. Bir marta tasdiqlasangiz, keyingi safar ilova o'z hisobingizda ochiladi.
              </p>
              {login ? (
                <a href={login.botUrl} target="_blank" rel="noopener noreferrer" onClick={opened} className={clsx(LINK_BTN, 'mt-4 h-12 bg-gradient-to-br from-sky-400 to-blue-600 text-[15px] text-white shadow-[0_14px_30px_-12px_rgb(14_165_233)]')}>
                  <Send className="h-4 w-4" /> Telegram orqali kirish
                </a>
              ) : (
                <Button size="lg" className="mt-4 w-full" disabled>
                  <Loader2 className="h-4 w-4 animate-spin" /> Tayyorlanmoqda...
                </Button>
              )}
              {login && (
                <p className="mt-3 text-center text-[12.5px] text-muted">
                  Telegram ochilmadimi?{' '}
                  <a href={tgDeepLink(login.botUrl)} onClick={opened} className="font-semibold text-brand">
                    Bu yerni bosing
                  </a>
                </p>
              )}
            </>
          )}
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-[12px] leading-relaxed text-muted">
            <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-good" />
            Telegram'ga hali ulanmagan bo'lsangiz, bot avval rahbaringiz bergan kirish kalitini so'raydi.
          </p>
        </section>

        {install !== 'installed' && <InstallCard />}

        {import.meta.env.DEV && (
          <p className="rounded-2xl bg-surface p-3.5 text-[13px] text-muted ring-1 ring-line">
            Lokal sinov: serverda <code className="font-semibold text-fg">DEV_AUTH=true</code> qilib, manzilga{' '}
            <code className="font-semibold text-fg">?dev_tg=111</code> qo'shing.
          </p>
        )}
      </div>
    </div>
  );
}

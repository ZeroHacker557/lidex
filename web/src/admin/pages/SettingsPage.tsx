import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Moon, Send, Sun, SunMoon } from 'lucide-react';
import { useState } from 'react';
import { Button, errorText, useToast } from '../../shared/ui';
import { api } from '../api';
import { Card, CopyField, Field, PageHeader } from '../components/common';
import { useAdmin } from '../context';

export function SettingsPage() {
  const { admin } = useAdmin();
  const toast = useToast();
  const qc = useQueryClient();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [link, setLink] = useState<{ url: string | null; command: string } | null>(null);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('lx_theme') ?? 'system';
    } catch {
      return 'system';
    }
  });

  const changePassword = useMutation({
    mutationFn: () => api.post('/auth/password', { current, next }),
    onSuccess: () => {
      toast('Parol o\'zgartirildi');
      setCurrent('');
      setNext('');
    },
    onError: (e) => toast(errorText(e), 'error'),
  });
  const tgLink = useMutation({ mutationFn: () => api.post<{ url: string | null; command: string }>('/auth/telegram-link'), onSuccess: setLink });
  const tgUnlink = useMutation({
    mutationFn: () => api.del('/auth/telegram-link'),
    onSuccess: () => {
      toast('Telegram uzildi');
      void qc.invalidateQueries({ queryKey: ['auth-me'] });
    },
  });

  const applyTheme = (t: string) => {
    setTheme(t);
    if (t === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    try {
      if (t === 'system') localStorage.removeItem('lx_theme');
      else localStorage.setItem('lx_theme', t);
    } catch {
      /* */
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Sozlamalar" subtitle={`${admin.fullName} · @${admin.username}`} />
      <div className="space-y-5">
        <Card title="Telegram bildirishnomalari">
          <p className="text-[14px] text-muted">
            Telegramingizni ulasangiz, bot sizga kechikayotgan lidlar, biriktirilmagan lidlar va har kungi hisobotni yuboradi.
          </p>
          <div className="mt-4">
            {admin.telegramLinked ? (
              <div className="flex items-center gap-3">
                <span className="text-[14px] font-medium text-good">✅ Telegram ulangan</span>
                <Button variant="outline" size="sm" onClick={() => tgUnlink.mutate()}>
                  Uzish
                </Button>
              </div>
            ) : link ? (
              <div className="space-y-2">
                {link.url ? (
                  <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white">
                    <Send className="h-4 w-4" /> Telegramda ochish
                  </a>
                ) : (
                  <p className="text-sm">Botga quyidagi buyruqni yuboring:</p>
                )}
                <CopyField value={link.command} onCopy={() => toast('Nusxa olindi')} />
                <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['auth-me'] })}>
                  Uladim — tekshirish
                </Button>
              </div>
            ) : (
              <Button onClick={() => tgLink.mutate()} loading={tgLink.isPending}>
                <Send className="h-4 w-4" /> Telegramni ulash
              </Button>
            )}
          </div>
        </Card>

        <Card title="Parolni o'zgartirish">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Joriy parol">
              <input type="password" className="input" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
            </Field>
            <Field label="Yangi parol (kamida 8 belgi)">
              <input type="password" className="input" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
            </Field>
          </div>
          <Button className="mt-4" disabled={!current || next.length < 8} loading={changePassword.isPending} onClick={() => changePassword.mutate()}>
            Saqlash
          </Button>
        </Card>

        <Card title="Ko'rinish">
          <div className="flex gap-2">
            {[
              { id: 'system', label: 'Tizim', icon: SunMoon },
              { id: 'light', label: "Yorug'", icon: Sun },
              { id: 'dark', label: "Qorong'i", icon: Moon },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => applyTheme(id)}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium ${theme === id ? 'border-brand bg-brand/10 text-brand' : 'border-line'}`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

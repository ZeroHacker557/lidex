import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, CircleCheckBig, ExternalLink, History, KeyRound, LogOut, ShieldAlert, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { fullDate, timeAgo } from '../../shared/format';
import { Button, errorText, useToast } from '../../shared/ui';
import { api } from '../api';
import { Card, Field } from './common';

interface State {
  status: 'disconnected' | 'code_sent' | 'password_needed' | 'connected';
  phone: string | null;
  apiId: number | null;
  account: { id: string; username: string | null; name: string } | null;
  lastRunAt: string | null;
  lastError: string | null;
}

/** Guruhga BOSHQA BOTLAR yuborgan lidlarni o'qish uchun Telegram akkauntni ulash */
export function UserbotCard() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['userbot'], queryFn: () => api.get<State>('/userbot') });
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [phone, setPhone] = useState('+998');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['userbot'] });

  const sendCode = useMutation({
    mutationFn: () => api.post('/userbot/code', { apiId: Number(apiId), apiHash, phone }),
    onSuccess: () => {
      toast('Kod Telegramingizga yuborildi');
      void refresh();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });
  const signIn = useMutation({
    mutationFn: () => api.post<{ needPassword: boolean }>('/userbot/sign-in', { code: code || undefined, password: password || undefined }),
    onSuccess: (r) => {
      if (r.needPassword) toast("Akkauntda 2 bosqichli parol bor — uni kiriting", 'info');
      else toast('Akkaunt ulandi — endi bot xabarlari ham o\'qiladi');
      void refresh();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });
  const sync = useMutation({
    mutationFn: (backfillHours?: number) => api.post<{ messages: number; groups: number; errors: string[] }>('/userbot/sync', { backfillHours }),
    onSuccess: (r) => {
      toast(r.errors.length ? `Xato: ${r.errors[0]}` : `${r.groups} ta guruh o'qildi, ${r.messages} ta yangi xabar`, r.errors.length ? 'error' : 'success');
      void refresh();
      void qc.invalidateQueries({ queryKey: ['leads'] });
      void qc.invalidateQueries({ queryKey: ['inbox'] });
    },
    onError: (e) => toast(errorText(e), 'error'),
  });
  const logout = useMutation({ mutationFn: () => api.del('/userbot'), onSuccess: () => void refresh() });

  const s = q.data;

  return (
    <Card title="Bot lidlarini o'qish (Telegram akkaunt)" icon={Bot}>
      <div className="mb-4 rounded-xl bg-amber-500/10 p-3.5 text-[13px] leading-relaxed text-fg/85 ring-1 ring-amber-500/20">
        <p className="flex items-center gap-2 font-semibold text-warn">
          <ShieldAlert className="h-4 w-4" /> Nima uchun kerak?
        </p>
        <p className="mt-1">
          Telegram qoidasiga ko'ra bot guruhdagi <b>boshqa botlar</b> yuborgan xabarlarni ko'rmaydi. Lid formalari guruhga bot orqali tushsa,
          ularni o'qish uchun guruhda <b>a'zo bo'lgan oddiy Telegram akkaunt</b> ulanadi. Lidex shu akkaunt orqali har daqiqada guruh tarixini o'qiydi
          — bot ishlamay qolgan paytdagi lidlar ham tiklanadi.
        </p>
      </div>

      {s?.status === 'connected' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-emerald-500/10 p-3.5 ring-1 ring-emerald-500/20">
            <CircleCheckBig className="h-5 w-5 text-good" />
            <div className="min-w-0 flex-1 text-[13.5px]">
              <p className="font-semibold">
                Ulangan: {s.account?.name} {s.account?.username && <span className="text-muted">@{s.account.username}</span>}
              </p>
              <p className="text-[12px] text-muted">
                Oxirgi o'qish: {s.lastRunAt ? <span title={fullDate(s.lastRunAt)}>{timeAgo(s.lastRunAt)}</span> : 'hali yo\'q'}
                {s.lastError && <span className="text-danger"> · {s.lastError}</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" loading={sync.isPending && sync.variables === undefined} onClick={() => sync.mutate(undefined)}>
              <History className="h-4 w-4" /> Hozir o'qish
            </Button>
            <Button size="sm" variant="outline" loading={sync.isPending && sync.variables === 24} onClick={() => confirm("Oxirgi 24 soatdagi hali ishlanmagan xabarlar lid sifatida xodimlarga yuboriladi. Davom etasizmi?") && sync.mutate(24)}>
              Oxirgi 24 soatni yuklash
            </Button>
            <Button size="sm" variant="ghost" loading={logout.isPending} onClick={() => confirm('Akkaunt uzilsinmi?') && logout.mutate()}>
              <LogOut className="h-4 w-4" /> Uzish
            </Button>
          </div>
          <p className="text-[12px] text-muted">
            Har daqiqada avtomatik o'qish uchun cron'ni yoqing (Qo'llanma → "Har daqiqalik cron"). Akkauntni guruhdan chiqarmang.
          </p>
        </div>
      ) : s?.status === 'code_sent' || s?.status === 'password_needed' ? (
        <div className="space-y-3">
          <p className="text-[13.5px]">
            <Smartphone className="mr-1 inline h-4 w-4 text-brand" /> <b>{s.phone}</b> raqamiga Telegram ichida kod yuborildi.
          </p>
          {s.status === 'code_sent' && (
            <Field label="Telegramdan kelgan kod">
              <input className="input w-40 font-mono tracking-widest" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} inputMode="numeric" autoFocus />
            </Field>
          )}
          {(s.status === 'password_needed' || signIn.data?.needPassword) && (
            <Field label="2 bosqichli tekshiruv paroli (Cloud password)">
              <input className="input w-64" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            </Field>
          )}
          <div className="flex gap-2">
            <Button loading={signIn.isPending} disabled={s.status === 'code_sent' ? code.length < 5 : !password} onClick={() => signIn.mutate()}>
              <KeyRound className="h-4 w-4" /> Ulash
            </Button>
            <Button variant="ghost" onClick={() => logout.mutate()}>
              Bekor qilish
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-[13px] text-muted">
            <li>
              <a href="https://my.telegram.org/apps" target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">
                my.telegram.org/apps <ExternalLink className="inline h-3 w-3" />
              </a>{' '}
              ga kiring (shu akkaunt raqami bilan), ilova yarating va <b className="text-fg">api_id</b> va <b className="text-fg">api_hash</b> ni oling.
            </li>
            <li>Akkaunt lidlar tushadigan guruhda a'zo bo'lishi kerak.</li>
            <li>Quyida ma'lumotlarni kiriting — Telegram ichida kod keladi.</li>
          </ol>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="api_id">
              <input className="input" value={apiId} onChange={(e) => setApiId(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
            </Field>
            <Field label="api_hash">
              <input className="input font-mono text-[13px]" value={apiHash} onChange={(e) => setApiHash(e.target.value.trim())} />
            </Field>
            <Field label="Telefon raqam">
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </div>
          <Button loading={sendCode.isPending} disabled={!apiId || apiHash.length < 10 || phone.length < 9} onClick={() => sendCode.mutate()}>
            Kod yuborish
          </Button>
          <p className="text-[12px] text-muted">
            Sessiya serverda shifrlangan holda saqlanadi va faqat guruh xabarlarini o'qish uchun ishlatiladi. Iloji bo'lsa shu ish uchun alohida
            (lekin eski, faol) akkaunt ishlating.
          </p>
        </div>
      )}
    </Card>
  );
}

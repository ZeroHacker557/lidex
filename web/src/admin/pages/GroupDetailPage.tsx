import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FlaskConical, Power } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DISTRIBUTION_LABELS, type DistributionStrategy, type GroupSettings } from '@shared/statuses';
import type { Employee, Group, Lead } from '../../shared/types';
import { Avatar, Button, ErrorBox, FullScreenLoader, StatusBadge, errorText, useToast } from '../../shared/ui';
import { api } from '../api';
import { Card, CopyField, Field, Select, Toggle, useOpenLead } from '../components/common';
import { useAdmin, useEmployees } from '../context';
import { groupStatusBadge } from './GroupsPage';

interface Detail {
  group: Group;
  employees: Employee[];
  ingestUrl: string;
}

const SAMPLE = '🆕 Yangi ariza\n👤 Ism: Aziz Karimov\n📞 Telefon: +998 90 123 45 67\n📍 Manzil: Toshkent\n💬 Izoh: kurs narxi qancha?';

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const toast = useToast();
  const { isSuper } = useAdmin();
  const openLead = useOpenLead();
  const q = useQuery({ queryKey: ['group', id], queryFn: () => api.get<Detail>(`/groups/${id}`) });
  const allEmployees = useEmployees();
  const [settings, setSettings] = useState<GroupSettings | null>(null);
  const [title, setTitle] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [sample, setSample] = useState(SAMPLE);
  const [testResult, setTestResult] = useState<Lead | null | undefined>(undefined);

  useEffect(() => {
    if (q.data) {
      setSettings(q.data.group.settings);
      setTitle(q.data.group.title);
      setMembers(q.data.employees.map((e) => e.id));
    }
  }, [q.data]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['group', id] });
    void qc.invalidateQueries({ queryKey: ['groups'] });
    void qc.invalidateQueries({ queryKey: ['alerts'] });
  };
  const save = useMutation({
    mutationFn: (body: object) => api.patch(`/groups/${id}`, body),
    onSuccess: () => {
      toast('Saqlandi');
      refresh();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });
  const saveMembers = useMutation({
    mutationFn: () => api.put(`/groups/${id}/employees`, { employeeIds: members }),
    onSuccess: () => {
      toast('Xodimlar biriktirildi');
      refresh();
      void qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (e) => toast(errorText(e), 'error'),
  });
  const regenToken = useMutation({ mutationFn: () => api.post(`/groups/${id}/token`), onSuccess: refresh });
  const test = useMutation({
    mutationFn: () => api.post<{ lead: Lead | null }>(`/groups/${id}/test-lead`, { text: sample }),
    onSuccess: (r) => {
      setTestResult(r.lead);
      void qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  if (q.isPending || !settings) return <FullScreenLoader />;
  if (q.isError) return <ErrorBox error={q.error} />;
  const { group } = q.data;
  const set = <K extends keyof GroupSettings>(k: K, v: GroupSettings[K]) => setSettings({ ...settings, [k]: v });
  const memberSet = new Set(members);
  const changedMembers =
    members.length !== q.data.employees.length || q.data.employees.some((e) => !memberSet.has(e.id));
  const ingestFull = `${location.origin}${q.data.ingestUrl}`;

  return (
    <div className="space-y-5">
      <Link to="/groups" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Guruhlar
      </Link>
      <div className="card flex flex-wrap items-center gap-4 p-5 shadow-card">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{group.title}</h1>
            {groupStatusBadge(group)}
          </div>
          <p className="mt-1 text-sm text-muted">
            {group.chatType === 'api' ? 'API manba' : `Telegram ${group.chatType} · chat ID ${group.chatId}`} · {group.leadCount ?? 0} ta lid
          </p>
        </div>
        {isSuper && (
          <div className="flex gap-2">
            {group.status !== 'active' ? (
              <Button onClick={() => save.mutate({ status: 'active' })} loading={save.isPending}>
                <Power className="h-4 w-4" /> Faollashtirish
              </Button>
            ) : (
              <Button variant="outline" onClick={() => confirm("Guruh o'chirilsinmi? Yangi lidlar qabul qilinmaydi.") && save.mutate({ status: 'disabled' })}>
                O'chirish
              </Button>
            )}
          </div>
        )}
      </div>
      {group.status === 'pending' && (
        <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-[13px] text-warn">
          Guruh hali faol emas — undagi xabarlar lid sifatida qabul qilinmayapti. Xodimlarni biriktirib, "Faollashtirish" tugmasini bosing.
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Sozlamalar" actions={<Button size="sm" loading={save.isPending} onClick={() => save.mutate({ title, settings })}>Saqlash</Button>}>
          <div className="space-y-4">
            <Field label="Nomi">
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Lidlarni taqsimlash">
              <Select value={settings.distribution} onChange={(e) => set('distribution', e.target.value as DistributionStrategy)}>
                {Object.entries(DISTRIBUTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Javob muddati (SLA), daq" hint="Kechiksa — ogohlantirish, x3 — adminlarga">
                <input type="number" min={1} max={1440} className="input" value={settings.slaMinutes} onChange={(e) => set('slaMinutes', Number(e.target.value))} />
              </Field>
              <Field label="Sanasiz keyinga: har N kunda" hint="Eslatma intervali">
                <input type="number" min={1} max={30} className="input" value={settings.postponeIntervalDays} onChange={(e) => set('postponeIntervalDays', Number(e.target.value))} />
              </Field>
              <Field label="Ko'tarmadi: N soatdan keyin" hint="Qayta qo'ng'iroq eslatmasi">
                <input type="number" min={1} max={72} className="input" value={settings.noAnswerRetryHours} onChange={(e) => set('noAnswerRetryHours', Number(e.target.value))} />
              </Field>
            </div>
            <SettingRow title="Faqat telefon raqami bor xabarlar lid" text="Guruhdagi oddiy suhbat xabarlari e'tiborsiz qoldiriladi">
              <Toggle checked={settings.requirePhone} onChange={(v) => set('requirePhone', v)} />
            </SettingRow>
            <SettingRow title="Takroriy raqam — avvalgi xodimga" text="Mijoz qayta yozsa, uni oldin gaplashgan xodim oladi">
              <Toggle checked={settings.stickyDuplicates} onChange={(v) => set('stickyDuplicates', v)} />
            </SettingRow>
            {group.chatType !== 'api' && (
              <Field
                label="Xabarlarni o'qish usuli"
                hint="Lidlar guruhga BOSHQA BOT orqali tushsa — Userbot tanlang (Telegram botlari bir-birining xabarini ko'rmaydi)"
              >
                <Select value={settings.ingestVia} onChange={(e) => set('ingestVia', e.target.value as 'bot' | 'userbot')}>
                  <option value="bot">Bot (odamlar yozgan / forward qilingan xabarlar, kanal postlari)</option>
                  <option value="userbot">Userbot (boshqa botlar yozgan xabarlar ham)</option>
                </Select>
              </Field>
            )}
          </div>
        </Card>

        <Card
          title={`Xodimlar (${members.length})`}
          actions={
            <Button size="sm" disabled={!changedMembers} loading={saveMembers.isPending} onClick={() => saveMembers.mutate()}>
              Saqlash
            </Button>
          }
        >
          <p className="mb-3 text-[13px] text-muted">Belgilangan xodimlar shu guruh lidlarini oladi. Faqat botga ulangan va faol xodimlarga taqsimlanadi.</p>
          <ul className="max-h-[420px] space-y-1 overflow-y-auto">
            {(allEmployees.data ?? [])
              .filter((e) => e.isActive || memberSet.has(e.id))
              .map((e) => (
                <li key={e.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
                    <input
                      type="checkbox"
                      checked={memberSet.has(e.id)}
                      onChange={(ev) => setMembers((s) => (ev.target.checked ? [...s, e.id] : s.filter((x) => x !== e.id)))}
                    />
                    <Avatar name={e.fullName} size={28} online={e.telegramId ? !!e.online : undefined} />
                    <span className="flex-1 text-[14px]">{e.fullName}</span>
                    <span className="text-[12px] text-muted">
                      {!e.telegramId ? 'ulanmagan' : !e.acceptingLeads ? "to'xtatilgan" : `${e.openLeads ?? 0} ochiq`}
                    </span>
                  </label>
                </li>
              ))}
          </ul>
          <Link to="/employees" className="mt-3 inline-block text-[13px] font-medium text-brand">
            + Yangi xodim qo'shish
          </Link>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><FlaskConical className="h-4 w-4" /> Lidni sinash</span>}>
          <p className="mb-3 text-[13px] text-muted">
            Guruhga tushadigan xabar namunasini kiriting — tizim uni qanday tushunishi va kimga biriktirishini ko'rasiz. Haqiqiy lid yaratiladi.
          </p>
          <textarea className="input resize-none font-mono text-[13px]" rows={6} value={sample} onChange={(e) => setSample(e.target.value)} />
          <Button className="mt-3" loading={test.isPending} onClick={() => test.mutate()}>
            Sinab ko'rish
          </Button>
          {testResult === null && <p className="mt-3 text-sm text-danger">Lid yaratilmadi (telefon raqami topilmadi).</p>}
          {testResult && (
            <button onClick={() => openLead(testResult.id)} className="mt-3 w-full rounded-xl border border-line p-3 text-left text-[13px] hover:bg-surface-2">
              <div className="flex items-center justify-between">
                <b>Lid #{testResult.seq} yaratildi</b>
                <StatusBadge status={testResult.status} size="sm" />
              </div>
              <p className="mt-1">
                Ism: <b>{testResult.name ?? '—'}</b> · Telefon: <b>{testResult.phone ?? '—'}</b>
              </p>
              <p className="text-muted">
                Maydonlar: {testResult.fields.map((f) => f.key).join(', ') || '—'} · Xodim:{' '}
                {(allEmployees.data ?? []).find((e) => e.id === testResult.assignedEmployeeId)?.fullName ?? 'biriktirilmadi'}
              </p>
            </button>
          )}
        </Card>

        <Card title="Sayt / API orqali lid yuborish">
          <p className="mb-3 text-[13px] text-muted">Sayt formasi, Tilda, Google Forms (Apps Script) yoki boshqa tizimdan lidni to'g'ridan-to'g'ri yuborish uchun:</p>
          <CopyField value={ingestFull} onCopy={() => toast('Nusxa olindi')} />
          <pre className="mt-3 overflow-x-auto rounded-xl bg-surface-2 p-3 text-[12px]">{`POST ${q.data.ingestUrl}
Content-Type: application/json

{ "name": "Aziz", "phone": "+998901234567",
  "text": "Izoh", "fields": { "Manzil": "Toshkent" } }`}</pre>
          {isSuper && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => confirm('Token yangilansinmi? Eski manzil ishlamay qoladi.') && regenToken.mutate()}>
              Tokenni yangilash
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}

function SettingRow({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-surface-2 px-3 py-2.5">
      <div>
        <p className="text-[14px] font-medium">{title}</p>
        <p className="text-[12px] text-muted">{text}</p>
      </div>
      {children}
    </div>
  );
}

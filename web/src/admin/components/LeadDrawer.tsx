import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Flag, History, MessageSquareWarning, Phone, StickyNote, X } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LEAD_STATUSES, STATUS_META, type LeadStatus } from '@shared/statuses';
import { duration, formatPhone, fullDate, smartDate, tashkentDateKey, tashkentIso } from '../../shared/format';
import { ease, spring } from '../../shared/motion';
import { STATUS_ICON } from '../../shared/statusIcons';
import { Timeline } from '../../shared/Timeline';
import type { Employee, Lead, LeadEvent, StaffMessage } from '../../shared/types';
import { Avatar, Button, ErrorBox, Skeleton, StatusBadge, errorText, useToast } from '../../shared/ui';
import { api } from '../api';
import { useEmployees } from '../context';
import { Select, useOpenLead } from './common';
import { SendMessageModal } from './SendMessageModal';

interface Detail {
  lead: Lead;
  events: LeadEvent[];
  messages: StaffMessage[];
  employee: Employee | null;
  history: Lead[];
}

const SOURCE: Record<Lead['source'], string> = { telegram: 'Telegram bot', userbot: 'Userbot', api: 'API / sayt', manual: "Qo'lda" };

export function LeadDrawerHost() {
  const [params] = useSearchParams();
  const id = params.get('lead');
  return <AnimatePresence>{id && <LeadDrawer key={id} id={id} />}</AnimatePresence>;
}

function LeadDrawer({ id }: { id: string }) {
  const openLead = useOpenLead();
  const close = () => openLead(null);
  const qc = useQueryClient();
  const toast = useToast();
  const [msgOpen, setMsgOpen] = useState(false);
  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [postDate, setPostDate] = useState(tashkentDateKey(1));
  const [postTime, setPostTime] = useState('09:00');
  const [note, setNote] = useState('');

  const query = useQuery({ queryKey: ['lead', id], queryFn: () => api.get<Detail>(`/leads/${id}`) });
  const lead = query.data?.lead;
  const employees = useEmployees(lead?.groupId);

  const done = (msg: string) => {
    toast(msg);
    void qc.invalidateQueries({ queryKey: ['lead', id] });
    void qc.invalidateQueries({ queryKey: ['leads'] });
    void qc.invalidateQueries({ queryKey: ['alerts'] });
  };
  const assign = useMutation({
    mutationFn: (employeeId: string | null) => api.post(`/leads/${id}/assign`, { employeeId }),
    onSuccess: () => done('Lid qayta biriktirildi'),
    onError: (e) => toast(errorText(e), 'error'),
  });
  const changeStatus = useMutation({
    mutationFn: () =>
      api.post(`/leads/${id}/status`, {
        status,
        note: note.trim() || null,
        postponedUntil: status === 'postponed' && postDate ? tashkentIso(postDate, postTime) : null,
      }),
    onSuccess: () => {
      setStatus('');
      setNote('');
      done("Status o'zgartirildi");
    },
    onError: (e) => toast(errorText(e), 'error'),
  });
  const flag = useMutation({
    mutationFn: (flagged: boolean) =>
      api.post(`/leads/${id}/flag`, { flagged, note: flagged ? (window.prompt("Belgi sababi (xodim ko'radi):") ?? null) : null }),
    onSuccess: (_d, f) => done(f ? 'Lid belgilandi' : 'Belgi olib tashlandi'),
  });
  const addNote = useMutation({
    mutationFn: () => api.post(`/leads/${id}/notes`, { text: note }),
    onSuccess: () => {
      setNote('');
      done("Izoh qo'shildi");
    },
  });

  const color = lead ? STATUS_META[lead.status].color : 'var(--c-brand)';

  return (
    <div className="fixed inset-0 z-40">
      <motion.div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
      <motion.div
        className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-hidden bg-surface shadow-pop"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={spring}
      >
        <span className="absolute inset-x-0 top-0 z-10 h-1 transition-colors" style={{ backgroundColor: color }} />
        <div className="flex items-center justify-between border-b border-line/70 px-5 py-4">
          <div className="flex items-center gap-2 text-[13px]">
            {lead ? (
              <>
                <span className="rounded-lg bg-surface-2 px-2 py-1 font-display font-bold">#{lead.seq}</span>
                <span className="font-medium text-muted">{lead.groupTitle}</span>
              </>
            ) : (
              <Skeleton className="h-6 w-32" />
            )}
          </div>
          <button onClick={close} className="rounded-xl p-1.5 text-muted transition hover:bg-surface-2 hover:text-fg" aria-label="Yopish">
            <X className="h-5 w-5" />
          </button>
        </div>

        {query.isPending && (
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        )}
        {query.isError && <ErrorBox error={query.error} />}

        {query.data && lead && (
          <motion.div
            className="thin-scroll flex-1 space-y-5 overflow-y-auto p-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease, delay: 0.08 }}
          >
            {/* Sarlavha */}
            <div className="relative">
              <div className="pointer-events-none absolute -inset-5 -top-5" style={{ background: `radial-gradient(80% 100% at 0% 0%, ${color}1f, transparent 70%)` }} />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3.5">
                  <Avatar name={lead.name ?? '?'} size={54} ring={color} />
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-[22px] font-extrabold tracking-tight">{lead.name ?? "Ism ko'rsatilmagan"}</h2>
                    <p className="tabular mt-0.5 flex items-center gap-1.5 text-[14.5px] font-medium">
                      <Phone className="h-4 w-4 text-muted" />
                      {formatPhone(lead.phone)}
                      {lead.telegramUsername && <span className="text-muted"> · @{lead.telegramUsername}</span>}
                    </p>
                  </div>
                </div>
                <StatusBadge status={lead.status} />
              </div>
              <div className="relative mt-4 grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-4">
                <Info label="Tushgan" value={fullDate(lead.createdAt)} />
                <Info
                  label="Javob vaqti"
                  value={lead.responseSeconds != null ? duration(lead.responseSeconds) : lead.status === 'new' ? 'kutilmoqda' : '—'}
                  warn={lead.status === 'new' && !!lead.slaNotifiedAt}
                />
                <Info label="Ko'rilgan" value={lead.viewedAt ? smartDate(lead.viewedAt) : "ko'rilmagan"} />
                <Info label="Manba" value={SOURCE[lead.source]} />
                {lead.postponedUntil && <Info label="Eslatma sanasi" value={fullDate(lead.postponedUntil)} />}
                {lead.nextReminderAt && <Info label="Keyingi eslatma" value={smartDate(lead.nextReminderAt)} />}
                {lead.isDuplicate && <Info label="Takroriy" value="Ha, avval ham yozgan" />}
              </div>
              {lead.flagged && (
                <p className="relative mt-3 flex items-center gap-2 rounded-xl bg-red-500/10 px-3.5 py-2.5 text-[13px] font-semibold text-danger ring-1 ring-inset ring-red-500/20">
                  <Flag className="h-4 w-4" fill="currentColor" /> Belgilangan{lead.flagNote ? `: ${lead.flagNote}` : ''}
                </p>
              )}
            </div>

            {/* Boshqaruv */}
            <div className="grid gap-4 rounded-2xl bg-surface-2/60 p-4 ring-1 ring-line/60">
              <div className="grid gap-1.5">
                <span className="label !mb-0">Mas'ul xodim</span>
                <Select value={lead.assignedEmployeeId ?? ''} disabled={assign.isPending} onChange={(e) => assign.mutate(e.target.value || null)}>
                  <option value="">— Biriktirilmagan —</option>
                  {(employees.data ?? [])
                    .filter((e) => e.isActive || e.id === lead.assignedEmployeeId)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.fullName}
                        {!e.telegramId ? ' (botga ulanmagan)' : ''}
                      </option>
                    ))}
                </Select>
              </div>

              <div className="grid gap-1.5">
                <span className="label !mb-0">Statusni o'zgartirish</span>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {LEAD_STATUSES.map((s) => {
                    const m = STATUS_META[s];
                    const Icon = STATUS_ICON[s];
                    const picked = status === s;
                    const current = lead.status === s;
                    return (
                      <motion.button
                        key={s}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setStatus(picked ? '' : s)}
                        className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[12.5px] font-semibold transition-colors"
                        style={{
                          color: picked ? '#fff' : m.color,
                          backgroundColor: picked ? m.color : `${m.color}12`,
                          boxShadow: current && !picked ? `inset 0 0 0 1.5px ${m.color}` : undefined,
                        }}
                        title={current ? 'Joriy status' : m.label}
                      >
                        <Icon className="h-4 w-4 shrink-0" strokeWidth={2.4} />
                        <span className="leading-tight">{m.short}</span>
                      </motion.button>
                    );
                  })}
                </div>
                <AnimatePresence initial={false}>
                  {status === 'postponed' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="flex items-center gap-2 pt-1">
                        <input type="date" className="input h-10 py-0 text-sm" value={postDate} onChange={(e) => setPostDate(e.target.value)} />
                        <input type="time" className="input h-10 w-32 py-0 text-sm" value={postTime} onChange={(e) => setPostTime(e.target.value)} />
                        <button className="whitespace-nowrap text-[12px] font-semibold text-muted underline" onClick={() => setPostDate('')}>
                          sanasiz
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative">
                <StickyNote className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-muted" />
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Izoh (ixtiyoriy)" className="input resize-none pl-10 text-sm" />
              </div>

              <div className="flex flex-wrap gap-2">
                <AnimatePresence initial={false}>
                  {status && (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                      <Button size="sm" loading={changeStatus.isPending} onClick={() => changeStatus.mutate()}>
                        Statusni saqlash
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
                <Button variant="outline" size="sm" disabled={!note.trim()} loading={addNote.isPending} onClick={() => addNote.mutate()}>
                  <StickyNote className="h-4 w-4" /> Izoh qo'shish
                </Button>
                <Button variant="outline" size="sm" onClick={() => flag.mutate(!lead.flagged)} loading={flag.isPending}>
                  <Flag className="h-4 w-4" /> {lead.flagged ? 'Belgini olish' : 'Belgilash'}
                </Button>
                <Button variant="soft" size="sm" disabled={!query.data.employee} onClick={() => setMsgOpen(true)}>
                  <MessageSquareWarning className="h-4 w-4" /> Xodimga xabar
                </Button>
              </div>
            </div>

            {lead.fields.length > 0 && (
              <div className="divide-y divide-line/60 overflow-hidden rounded-2xl ring-1 ring-line/70">
                {lead.fields.map((f, i) => (
                  <div key={i} className="grid grid-cols-[140px_1fr] gap-3 px-4 py-3 text-[13.5px]">
                    <span className="font-semibold text-muted">{f.key}</span>
                    <span className="whitespace-pre-wrap font-medium">{f.value}</span>
                  </div>
                ))}
              </div>
            )}

            <details className="group overflow-hidden rounded-2xl ring-1 ring-line/70">
              <summary className="cursor-pointer list-none px-4 py-3 text-[13.5px] font-semibold">Asl xabar</summary>
              <pre className="whitespace-pre-wrap border-t border-line/60 px-4 py-3 font-sans text-[13px] leading-relaxed text-muted">{lead.rawText || '—'}</pre>
            </details>

            {query.data.messages.length > 0 && (
              <div>
                <h4 className="mb-2 font-display text-[14px] font-bold">Yuborilgan xabarlar</h4>
                <div className="space-y-2">
                  {query.data.messages.map((m) => (
                    <div key={m.id} className="rounded-xl bg-surface-2/70 px-3.5 py-2.5 text-[13px] ring-1 ring-line/50">
                      <p className="font-medium">
                        {m.type === 'warning' ? '⚠️' : '✉️'} {m.text}
                      </p>
                      <p className="mt-1 text-[11.5px] text-muted">
                        {m.adminName} · {smartDate(m.createdAt)} ·{' '}
                        <b className={m.ackAt ? 'text-good' : m.readAt ? 'text-brand' : ''}>
                          {m.ackAt ? 'tasdiqladi' : m.readAt ? "o'qidi" : m.deliveredAt ? 'yetkazildi' : 'yuborilmoqda'}
                        </b>
                        {m.replyText && ` · javob: “${m.replyText}”`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {query.data.history.length > 0 && (
              <div>
                <h4 className="mb-2 font-display text-[14px] font-bold">Shu raqamning oldingi murojaatlari</h4>
                <div className="space-y-1">
                  {query.data.history.map((h) => (
                    <button key={h.id} onClick={() => openLead(h.id)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[13px] transition hover:bg-surface-2">
                      <span className="font-medium">
                        #{h.seq} · {smartDate(h.createdAt)}
                      </span>
                      <StatusBadge status={h.status} size="sm" short />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="mb-4 flex items-center gap-2 font-display text-[14px] font-bold">
                <History className="h-4 w-4 text-muted" /> To'liq tarix
              </h4>
              <Timeline events={query.data.events} />
            </div>
          </motion.div>
        )}
      </motion.div>
      {msgOpen && lead && query.data?.employee && <SendMessageModal open onClose={() => setMsgOpen(false)} employee={query.data.employee} lead={lead} />}
    </div>
  );
}

function Info({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2.5 ring-1 ${warn ? 'bg-red-500/10 ring-red-500/20' : 'bg-surface-2/70 ring-line/50'}`}>
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-0.5 truncate font-semibold ${warn ? 'text-danger' : ''}`}>{value}</p>
    </div>
  );
}

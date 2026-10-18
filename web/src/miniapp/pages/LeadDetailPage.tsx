import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { AlarmClock, ArrowLeft, ChevronDown, Copy, Flag, Megaphone, Pencil, Phone, Send, StickyNote } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { STATUS_META, type LeadStatus } from '@shared/statuses';
import { formatPhone, fullDate, smartDate, timeAgo } from '../../shared/format';
import { CheckDraw, ease, spring } from '../../shared/motion';
import { STATUS_ICON } from '../../shared/statusIcons';
import { Timeline } from '../../shared/Timeline';
import type { Lead, LeadEvent, StaffMessage } from '../../shared/types';
import { Avatar, Button, ErrorBox, FullScreenLoader, StatusBadge, errorText, useToast } from '../../shared/ui';
import { PostponeSheet } from '../components/PostponeSheet';
import { useBackButton } from '../hooks';
import { api, useSession } from '../session';
import { haptic, insideTelegram, openTelegramUser } from '../telegram';

interface Detail {
  lead: Lead;
  events: LeadEvent[];
  messages: StaffMessage[];
}

const ACTIONS: LeadStatus[] = ['success', 'rejected', 'no_answer', 'postponed', 'cancelled'];

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const back = useBackButton();
  const qc = useQueryClient();
  const toast = useToast();
  const { employee } = useSession();
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [postponeOpen, setPostponeOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const query = useQuery({ queryKey: ['lead', id], queryFn: () => api.get<Detail>(`/leads/${id}`) });
  const groups = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<{ groups: Array<{ id: string; postponeIntervalDays: number }> }>('/me'),
    staleTime: 300_000,
  });

  const onSaved = (lead: Lead) => {
    qc.setQueryData<Detail>(['lead', id], (old) => (old ? { ...old, lead } : old));
    void qc.invalidateQueries({ queryKey: ['lead', id] });
    void qc.invalidateQueries({ queryKey: ['leads'] });
    void qc.invalidateQueries({ queryKey: ['summary'] });
    void qc.invalidateQueries({ queryKey: ['reminders'] });
  };

  const status = useMutation({
    mutationFn: (body: { status: LeadStatus; postponedUntil?: string | null; note?: string | null }) =>
      api.post<{ lead: Lead }>(`/leads/${id}/status`, body),
    onSuccess: ({ lead }) => {
      haptic.success();
      if (lead.status === 'success') {
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 1500);
      } else toast(`${STATUS_META[lead.status].label}`);
      setNote('');
      setEditing(false);
      setPostponeOpen(false);
      onSaved(lead);
    },
    onError: (e) => {
      haptic.error();
      toast(errorText(e), 'error');
    },
  });

  const addNote = useMutation({
    mutationFn: (text: string) => api.post<{ lead: Lead }>(`/leads/${id}/notes`, { text }),
    onSuccess: ({ lead }) => {
      haptic.success();
      toast('Izoh saqlandi');
      setNote('');
      onSaved(lead);
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  if (query.isPending) return <FullScreenLoader />;
  if (query.isError) return <ErrorBox error={query.error} onRetry={() => query.refetch()} />;

  const { lead, events, messages } = query.data;
  const meta = STATUS_META[lead.status];
  const showFinal = meta.final && !editing;
  const intervalDays = groups.data?.groups.find((g) => g.id === lead.groupId)?.postponeIntervalDays ?? 2;
  const reminderOverdue = lead.nextReminderAt && new Date(lead.nextReminderAt).getTime() < Date.now();
  const FinalIcon = STATUS_ICON[lead.status];

  const setStatus = (s: LeadStatus) => {
    haptic.tap();
    if (s === 'postponed') return setPostponeOpen(true);
    status.mutate({ status: s, note: note.trim() || null });
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      haptic.success();
      toast('Nusxa olindi');
    } catch {
      toast("Nusxa olib bo'lmadi", 'error');
    }
  };

  return (
    <div className="mx-auto max-w-xl pb-12">
      {/* Hero */}
      <div className="relative overflow-hidden px-4 pb-5 pt-3">
        <motion.div
          key={lead.status}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(120% 90% at 50% -20%, ${meta.color}2e, transparent 70%)` }}
        />
        <div className="relative flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-muted">
            {!insideTelegram && (
              <button onClick={back} className="-ml-1 rounded-full bg-surface p-1.5 shadow-soft" aria-label="Orqaga">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <span className="rounded-lg bg-surface/80 px-2 py-1 font-semibold text-fg shadow-soft">#{lead.seq}</span>
            <span className="truncate">{lead.groupTitle}</span>
          </div>
          <StatusBadge status={lead.status} />
        </div>

        <div className="relative mt-5 flex items-center gap-3.5">
          <Avatar name={lead.name ?? '?'} size={56} ring={meta.color} />
          <div className="min-w-0">
            <h1 className="selectable truncate font-display text-[24px] font-extrabold leading-tight tracking-tight">{lead.name ?? "Ism ko'rsatilmagan"}</h1>
            <p className="mt-0.5 text-[13px] text-muted">
              {fullDate(lead.createdAt)} · {timeAgo(lead.createdAt)}
            </p>
          </div>
        </div>
        {lead.isDuplicate && (
          <p className="relative mt-3 inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2.5 py-1 text-[12px] font-semibold text-violet-600">
            ♻️ Bu mijoz avval ham murojaat qilgan
          </p>
        )}

        {lead.phone && (
          <div className="relative mt-5 flex gap-2">
            <motion.a
              whileTap={{ scale: 0.97 }}
              href={`tel:${lead.phone}`}
              onClick={() => haptic.tap()}
              className="relative flex h-14 flex-1 items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 font-display text-[16px] font-bold text-white shadow-[0_10px_24px_-8px_rgba(22,163,74,.6)]"
            >
              <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-white/30" />
                <Phone className="relative h-4 w-4" fill="currentColor" />
              </span>
              <span className="tabular">{formatPhone(lead.phone)}</span>
            </motion.a>
            <IconAction label="Nusxa" onClick={() => copy(lead.phone!)}>
              <Copy className="h-5 w-5" />
            </IconAction>
            {lead.telegramUsername && (
              <IconAction label="Telegram" onClick={() => openTelegramUser(lead.telegramUsername!)} className="bg-sky-500/10 text-sky-500">
                <Send className="h-5 w-5" />
              </IconAction>
            )}
          </div>
        )}
        {lead.phones
          .filter((p) => p !== lead.phone)
          .map((p) => (
            <a key={p} href={`tel:${p}`} className="relative mt-2.5 inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <Phone className="h-4 w-4" /> {formatPhone(p)}
            </a>
          ))}
      </div>

      <div className="space-y-3 px-4">
        {lead.flagged && (
          <Notice tone="red" icon={<Flag className="h-5 w-5" fill="currentColor" />} title="Admin bu lidni belgiladi">
            {lead.flagNote}
          </Notice>
        )}
        {messages.map((m) => (
          <Notice key={m.id} tone={m.type === 'warning' ? 'amber' : 'brand'} icon={<Megaphone className="h-5 w-5" />} title={m.adminName} meta={smartDate(m.createdAt)}>
            {m.text}
          </Notice>
        ))}
        {(lead.status === 'postponed' || lead.status === 'no_answer') && lead.nextReminderAt && (
          <Notice
            tone={reminderOverdue ? 'red' : 'amber'}
            icon={<AlarmClock className="h-5 w-5" />}
            title={lead.status === 'postponed' && !lead.postponedUntil ? `Har ${intervalDays} kunda eslatiladi` : "Qayta qo'ng'iroq"}
          >
            Keyingi eslatma: <b>{smartDate(lead.nextReminderAt)}</b>
          </Notice>
        )}

        {/* Status */}
        <section className="card overflow-hidden p-4 shadow-card">
          <>
            {showFinal ? (
              <motion.div key="final" initial={{ y: 8 }} animate={{ y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease }}>
                <div className="flex items-center gap-3.5 rounded-2xl p-3.5" style={{ backgroundColor: `${meta.color}12` }}>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-card" style={{ backgroundColor: meta.color }}>
                    <FinalIcon className="h-6 w-6" strokeWidth={2.4} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[16px] font-bold" style={{ color: meta.color }}>
                      {meta.label}
                    </p>
                    <p className="text-[12px] text-muted">
                      {lead.statusChangedBy} · {smartDate(lead.statusChangedAt)}
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="mt-3 w-full" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" /> Statusni tahrirlash
                </Button>
              </motion.div>
            ) : (
              <motion.div key="pick" initial={{ y: 8 }} animate={{ y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease }}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-[16px] font-bold">{editing ? 'Yangi statusni tanlang' : 'Natijani belgilang'}</h2>
                  {editing && (
                    <button className="text-sm font-semibold text-muted" onClick={() => setEditing(false)}>
                      Bekor
                    </button>
                  )}
                </div>
                <div className="relative mb-3">
                  <StickyNote className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-muted" />
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    maxLength={1000}
                    placeholder="Izoh (ixtiyoriy): mijoz nima dedi?"
                    className="input resize-none rounded-2xl pl-10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ACTIONS.map((s, i) => {
                    const m = STATUS_META[s];
                    const Icon = STATUS_ICON[s];
                    const current = s === lead.status;
                    return (
                      <motion.button
                        key={s}
                        initial={{ y: 8 }}
                        animate={{ y: 0 }}
                        transition={{ ...spring, delay: i * 0.03 }}
                        whileTap={{ scale: 0.95 }}
                        disabled={status.isPending}
                        onClick={() => setStatus(s)}
                        className={clsx(
                          'flex min-h-[60px] items-center gap-2.5 rounded-2xl px-3 text-left text-[13.5px] font-bold leading-tight transition-shadow disabled:opacity-50',
                          s === 'cancelled' && 'col-span-2 justify-center',
                          current && 'shadow-card',
                        )}
                        style={{
                          color: current ? '#fff' : m.color,
                          backgroundColor: current ? m.color : `${m.color}12`,
                          boxShadow: current ? undefined : `inset 0 0 0 1px ${m.color}26`,
                        }}
                      >
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                          style={{ backgroundColor: current ? 'rgba(255,255,255,.22)' : `${m.color}1c` }}
                        >
                          <Icon className="h-[18px] w-[18px]" strokeWidth={2.4} />
                        </span>
                        <span>
                          <span className="block">{s === 'postponed' ? 'Keyinga qoldirish' : s === 'cancelled' ? 'Bekor qilish' : m.short}</span>
                          {(s === 'success' || s === 'rejected') && (
                            <span className="block text-[11px] font-semibold opacity-75">Javob berildi</span>
                          )}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
                <AnimatePresence>
                  {note.trim() && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                      <Button variant="soft" className="mt-2 w-full" loading={addNote.isPending} onClick={() => addNote.mutate(note.trim())}>
                        <StickyNote className="h-4 w-4" /> Faqat izohni saqlash
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </>
        </section>

        {/* Ma'lumotlar */}
        {(lead.fields.length > 0 || lead.lastNote) && (
          <section className="card divide-y divide-line/70 shadow-soft">
            {lead.lastNote && <Field label="Oxirgi izoh" value={lead.lastNote} />}
            {lead.fields.map((f, i) => (
              <Field key={i} label={f.key} value={f.value} />
            ))}
          </section>
        )}

        <section className="card overflow-hidden shadow-soft">
          <button className="flex w-full items-center justify-between p-4 text-[14px] font-semibold" onClick={() => setRawOpen((v) => !v)}>
            Asl xabar
            <motion.span animate={{ rotate: rawOpen ? 180 : 0 }} transition={spring}>
              <ChevronDown className="h-4 w-4 text-muted" />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {rawOpen && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.25, ease }} className="overflow-hidden">
                <pre className="selectable whitespace-pre-wrap break-words border-t border-line/70 p-4 font-sans text-[13px] leading-relaxed text-muted">{lead.rawText || '—'}</pre>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section className="card p-4 shadow-soft">
          <h2 className="mb-4 font-display text-[16px] font-bold">Tarix</h2>
          <Timeline events={events} showActor={events.some((e) => e.actorId !== employee.id)} />
        </section>
      </div>

      <PostponeSheet
        open={postponeOpen}
        onClose={() => setPostponeOpen(false)}
        intervalDays={intervalDays}
        loading={status.isPending}
        onSubmit={({ postponedUntil }) => status.mutate({ status: 'postponed', postponedUntil, note: note.trim() || null })}
      />

      {/* Muvaffaqiyat animatsiyasi */}
      <AnimatePresence>
        {celebrate && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCelebrate(false)}
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={spring}
              className="flex flex-col items-center rounded-[28px] bg-surface px-10 py-8 shadow-pop"
            >
              <CheckDraw size={84} color={STATUS_META.success.color} />
              <p className="mt-3 font-display text-[18px] font-extrabold">Ajoyib! HA dedi 🎉</p>
              <p className="mt-1 text-[13px] text-muted">Lid muvaffaqiyatli yopildi</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function IconAction({ children, label, onClick, className }: { children: React.ReactNode; label: string; onClick: () => void; className?: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      aria-label={label}
      className={clsx('flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-fg shadow-soft ring-1 ring-line/70', className)}
    >
      {children}
    </motion.button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="selectable mt-0.5 whitespace-pre-wrap text-[14.5px] font-medium">{value}</p>
    </div>
  );
}

const TONES = {
  red: 'bg-red-500/10 text-danger ring-red-500/20',
  amber: 'bg-amber-500/10 text-warn ring-amber-500/25',
  brand: 'bg-brand/10 text-brand ring-brand/20',
};

function Notice({ tone, icon, title, meta, children }: { tone: keyof typeof TONES; icon: React.ReactNode; title: string; meta?: string; children?: React.ReactNode }) {
  return (
    <motion.div initial={{ y: 6 }} animate={{ y: 0 }} transition={{ duration: 0.3, ease }} className={clsx('flex gap-3 rounded-2xl p-3.5 ring-1 ring-inset', TONES[tone])}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 text-[14px]">
        <p className="font-bold">{title}</p>
        {children && <div className="selectable mt-0.5 whitespace-pre-wrap text-fg/85">{children}</div>}
        {meta && <p className="mt-1 text-[11.5px] opacity-70">{meta}</p>}
      </div>
    </motion.div>
  );
}

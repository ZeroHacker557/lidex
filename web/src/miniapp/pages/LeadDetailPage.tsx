import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlarmClock, ArrowLeft, ChevronDown, Copy, Flag, Pencil, Phone, Send, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { STATUS_META, type LeadStatus } from '@shared/statuses';
import { formatPhone, fullDate, smartDate, timeAgo } from '../../shared/format';
import { Timeline } from '../../shared/Timeline';
import type { Lead, LeadEvent, StaffMessage } from '../../shared/types';
import { Button, ErrorBox, FullScreenLoader, StatusBadge, errorText, useToast } from '../../shared/ui';
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
      const m = STATUS_META[lead.status];
      toast(`${m.emoji} ${m.label}`);
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
      toast('📝 Izoh saqlandi');
      setNote('');
      onSaved(lead);
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  if (query.isPending) return <FullScreenLoader />;
  if (query.isError) return <ErrorBox error={query.error} onRetry={() => query.refetch()} />;

  const { lead, events, messages } = query.data;
  const meta = STATUS_META[lead.status];
  const isFinal = meta.final && !editing;
  const intervalDays = groups.data?.groups.find((g) => g.id === lead.groupId)?.postponeIntervalDays ?? 2;
  const reminderOverdue = lead.nextReminderAt && new Date(lead.nextReminderAt).getTime() < Date.now();

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
      toast('Nusxa olib bo\'lmadi', 'error');
    }
  };

  return (
    <div className="mx-auto max-w-xl pb-10">
      {/* Sarlavha */}
      <div className="relative overflow-hidden bg-surface px-4 pb-5 pt-3 shadow-card">
        <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: meta.color }} />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-muted">
            {!insideTelegram && (
              <button onClick={back} className="-ml-1 rounded-full p-1 active:bg-surface-2" aria-label="Orqaga">
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <span className="font-medium">#{lead.seq}</span>·<span className="truncate">{lead.groupTitle}</span>
          </div>
          <StatusBadge status={lead.status} />
        </div>
        <h1 className="selectable mt-3 text-2xl font-bold leading-tight">{lead.name ?? "Ism ko'rsatilmagan"}</h1>
        <p className="mt-1 text-[13px] text-muted">
          {fullDate(lead.createdAt)} · {timeAgo(lead.createdAt)}
          {lead.isDuplicate && <span className="ml-1 text-violet-500">· ♻️ takroriy murojaat</span>}
        </p>

        {lead.phone && (
          <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
            <a
              href={`tel:${lead.phone}`}
              onClick={() => haptic.tap()}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-green-600 text-[15px] font-semibold text-white active:brightness-90"
            >
              <Phone className="h-5 w-5" /> {formatPhone(lead.phone)}
            </a>
            <button
              onClick={() => copy(lead.phone!)}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 active:opacity-70"
              aria-label="Nusxa"
            >
              <Copy className="h-5 w-5" />
            </button>
            {lead.telegramUsername ? (
              <button
                onClick={() => openTelegramUser(lead.telegramUsername!)}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/15 text-sky-500 active:opacity-70"
                aria-label="Telegram"
              >
                <Send className="h-5 w-5" />
              </button>
            ) : (
              <span />
            )}
          </div>
        )}
        {lead.phones.filter((p) => p !== lead.phone).map((p) => (
          <a key={p} href={`tel:${p}`} className="mt-2 flex items-center gap-2 text-sm font-medium text-brand">
            <Phone className="h-4 w-4" /> {formatPhone(p)}
          </a>
        ))}
      </div>

      <div className="space-y-3 px-4 pt-3">
        {lead.flagged && (
          <div className="flex gap-3 rounded-2xl bg-red-500/10 p-3 text-[14px] text-red-600">
            <Flag className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Admin bu lidni belgiladi</p>
              {lead.flagNote && <p className="mt-0.5">{lead.flagNote}</p>}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={clsx('flex gap-3 rounded-2xl p-3 text-[14px]', m.type === 'warning' ? 'bg-amber-500/10 text-amber-700' : 'bg-brand/10 text-fg')}
          >
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">{m.adminName}</p>
              <p className="selectable mt-0.5 whitespace-pre-wrap">{m.text}</p>
              <p className="mt-1 text-[11px] opacity-70">{smartDate(m.createdAt)}</p>
            </div>
          </div>
        ))}

        {(lead.status === 'postponed' || lead.status === 'no_answer') && lead.nextReminderAt && (
          <div className={clsx('flex items-center gap-3 rounded-2xl p-3 text-[14px]', reminderOverdue ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-amber-700')}>
            <AlarmClock className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">
                {lead.status === 'postponed' && !lead.postponedUntil ? `Har ${intervalDays} kunda eslatiladi` : 'Qayta qo\'ng\'iroq'}
              </p>
              <p>Keyingi eslatma: {smartDate(lead.nextReminderAt)}</p>
            </div>
          </div>
        )}

        {/* Status */}
        <section className="card p-4">
          {isFinal ? (
            <div>
              <div className="flex items-center gap-3 rounded-2xl p-3" style={{ backgroundColor: `${meta.color}18` }}>
                <span className="text-2xl">{meta.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold" style={{ color: meta.color }}>
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
            </div>
          ) : (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">{editing ? 'Yangi statusni tanlang' : 'Natijani belgilang'}</h2>
                {editing && (
                  <button className="text-sm text-muted" onClick={() => setEditing(false)}>
                    Bekor
                  </button>
                )}
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Izoh (ixtiyoriy): mijoz nima dedi?"
                className="input mb-3 resize-none"
              />
              <div className="grid grid-cols-2 gap-2">
                {ACTIONS.map((s) => {
                  const m = STATUS_META[s];
                  const current = s === lead.status;
                  return (
                    <button
                      key={s}
                      disabled={status.isPending}
                      onClick={() => setStatus(s)}
                      className={clsx(
                        'flex min-h-[52px] items-center gap-2 rounded-xl px-3 text-left text-[14px] font-semibold transition active:scale-[.98] disabled:opacity-50',
                        s === 'cancelled' && 'col-span-2 justify-center',
                      )}
                      style={{
                        color: current ? '#fff' : m.color,
                        backgroundColor: current ? m.color : `${m.color}1a`,
                      }}
                    >
                      <span>{m.emoji}</span>
                      <span className="leading-tight">{m.label}</span>
                    </button>
                  );
                })}
              </div>
              {note.trim() && (
                <Button variant="secondary" className="mt-2 w-full" loading={addNote.isPending} onClick={() => addNote.mutate(note.trim())}>
                  📝 Faqat izohni saqlash
                </Button>
              )}
            </div>
          )}
        </section>

        {/* Ma'lumotlar */}
        {(lead.fields.length > 0 || lead.lastNote) && (
          <section className="card divide-y divide-line">
            {lead.lastNote && (
              <div className="p-3.5">
                <p className="text-[12px] text-muted">Oxirgi izoh</p>
                <p className="selectable mt-0.5 whitespace-pre-wrap text-[14px]">{lead.lastNote}</p>
              </div>
            )}
            {lead.fields.map((f, i) => (
              <div key={i} className="p-3.5">
                <p className="text-[12px] text-muted">{f.key}</p>
                <p className="selectable mt-0.5 whitespace-pre-wrap text-[14px]">{f.value}</p>
              </div>
            ))}
          </section>
        )}

        <section className="card">
          <button className="flex w-full items-center justify-between p-3.5 text-[14px] font-medium" onClick={() => setRawOpen((v) => !v)}>
            Asl xabar
            <ChevronDown className={clsx('h-4 w-4 transition', rawOpen && 'rotate-180')} />
          </button>
          {rawOpen && (
            <pre className="selectable whitespace-pre-wrap break-words border-t border-line p-3.5 font-sans text-[13px] text-muted">
              {lead.rawText || '—'}
            </pre>
          )}
        </section>

        <section className="card p-4">
          <h2 className="mb-4 font-semibold">Tarix</h2>
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
    </div>
  );
}

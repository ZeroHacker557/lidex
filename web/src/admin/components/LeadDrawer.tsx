import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, MessageSquareWarning, Phone, X } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LEAD_STATUSES, STATUS_META, type LeadStatus } from '@shared/statuses';
import { duration, formatPhone, fullDate, smartDate, tashkentIso, tashkentDateKey } from '../../shared/format';
import { Timeline } from '../../shared/Timeline';
import type { Employee, Lead, LeadEvent, StaffMessage } from '../../shared/types';
import { Button, ErrorBox, Spinner, StatusBadge, errorText, useToast } from '../../shared/ui';
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

export function LeadDrawerHost() {
  const [params] = useSearchParams();
  const id = params.get('lead');
  return id ? <LeadDrawer key={id} id={id} /> : null;
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
    onSuccess: () => done('🔁 Lid qayta biriktirildi'),
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
      done('Status o\'zgartirildi');
    },
    onError: (e) => toast(errorText(e), 'error'),
  });
  const flag = useMutation({
    mutationFn: (flagged: boolean) =>
      api.post(`/leads/${id}/flag`, { flagged, note: flagged ? window.prompt('Belgi sababi (xodim ko\'radi):') ?? null : null }),
    onSuccess: (_d, f) => done(f ? '🚩 Lid belgilandi' : 'Belgi olib tashlandi'),
  });
  const addNote = useMutation({
    mutationFn: () => api.post(`/leads/${id}/notes`, { text: note }),
    onSuccess: () => {
      setNote('');
      done('Izoh qo\'shildi');
    },
  });

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" onClick={close} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-xl animate-slide-in-right flex-col bg-surface shadow-pop">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="font-semibold">{lead ? `Lid #${lead.seq}` : 'Lid'}</h3>
          <button onClick={close} className="rounded-lg p-1.5 hover:bg-surface-2" aria-label="Yopish">
            <X className="h-5 w-5" />
          </button>
        </div>
        {query.isPending && (
          <div className="flex flex-1 items-center justify-center">
            <Spinner className="h-6 w-6" />
          </div>
        )}
        {query.isError && <ErrorBox error={query.error} />}
        {query.data && lead && (
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{lead.name ?? "Ism ko'rsatilmagan"}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-[15px]">
                    <Phone className="h-4 w-4 text-muted" />
                    {formatPhone(lead.phone)}
                    {lead.telegramUsername && <span className="text-muted"> · @{lead.telegramUsername}</span>}
                  </p>
                </div>
                <StatusBadge status={lead.status} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-4">
                <Info label="Guruh" value={lead.groupTitle} />
                <Info label="Tushgan" value={fullDate(lead.createdAt)} />
                <Info label="Javob vaqti" value={lead.responseSeconds != null ? duration(lead.responseSeconds) : lead.status === 'new' ? 'kutilmoqda' : '—'} />
                <Info label="Ko'rilgan" value={lead.viewedAt ? smartDate(lead.viewedAt) : "ko'rilmagan"} />
                {lead.postponedUntil && <Info label="Eslatma sanasi" value={fullDate(lead.postponedUntil)} />}
                {lead.nextReminderAt && <Info label="Keyingi eslatma" value={smartDate(lead.nextReminderAt)} />}
                {lead.isDuplicate && <Info label="Takroriy" value="♻️ Ha" />}
                <Info label="Manba" value={{ telegram: 'Telegram bot', userbot: 'Userbot', api: 'API / sayt', manual: "Qo'lda" }[lead.source]} />
              </div>
              {lead.flagged && (
                <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-[13px] text-red-600">🚩 Belgilangan{lead.flagNote ? `: ${lead.flagNote}` : ''}</p>
              )}
            </div>

            {/* Boshqaruv */}
            <div className="grid gap-3 rounded-2xl border border-line p-4">
              <div className="grid gap-1.5">
                <span className="label !mb-0">Mas'ul xodim</span>
                <Select
                  value={lead.assignedEmployeeId ?? ''}
                  disabled={assign.isPending}
                  onChange={(e) => assign.mutate(e.target.value || null)}
                >
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
                <div className="flex gap-2">
                  <Select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)} className="flex-1">
                    <option value="">Tanlang…</option>
                    {LEAD_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_META[s].emoji} {STATUS_META[s].label}
                      </option>
                    ))}
                  </Select>
                  <Button disabled={!status} loading={changeStatus.isPending} onClick={() => changeStatus.mutate()}>
                    Saqlash
                  </Button>
                </div>
                {status === 'postponed' && (
                  <div className="flex gap-2">
                    <input type="date" className="input" value={postDate} onChange={(e) => setPostDate(e.target.value)} />
                    <input type="time" className="input w-32" value={postTime} onChange={(e) => setPostTime(e.target.value)} />
                    <button className="whitespace-nowrap text-[12px] text-muted underline" onClick={() => setPostDate('')}>
                      sanasiz
                    </button>
                  </div>
                )}
              </div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Izoh (ixtiyoriy)" className="input resize-none" />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" disabled={!note.trim()} loading={addNote.isPending} onClick={() => addNote.mutate()}>
                  Izoh qo'shish
                </Button>
                <Button variant="outline" size="sm" onClick={() => flag.mutate(!lead.flagged)} loading={flag.isPending}>
                  <Flag className="h-4 w-4" /> {lead.flagged ? 'Belgini olish' : 'Belgilash'}
                </Button>
                <Button size="sm" disabled={!query.data.employee} onClick={() => setMsgOpen(true)}>
                  <MessageSquareWarning className="h-4 w-4" /> Xodimga xabar
                </Button>
              </div>
            </div>

            {lead.fields.length > 0 && (
              <div className="divide-y divide-line rounded-2xl border border-line">
                {lead.fields.map((f, i) => (
                  <div key={i} className="grid grid-cols-[140px_1fr] gap-3 px-4 py-2.5 text-[13px]">
                    <span className="text-muted">{f.key}</span>
                    <span className="whitespace-pre-wrap">{f.value}</span>
                  </div>
                ))}
              </div>
            )}

            <details className="rounded-2xl border border-line">
              <summary className="cursor-pointer px-4 py-2.5 text-[13px] font-medium">Asl xabar</summary>
              <pre className="whitespace-pre-wrap border-t border-line px-4 py-3 font-sans text-[13px] text-muted">{lead.rawText || '—'}</pre>
            </details>

            {query.data.messages.length > 0 && (
              <div>
                <h4 className="mb-2 text-[13px] font-semibold">Yuborilgan xabarlar</h4>
                <div className="space-y-2">
                  {query.data.messages.map((m) => (
                    <div key={m.id} className="rounded-xl bg-surface-2 px-3 py-2 text-[13px]">
                      <p>
                        {m.type === 'warning' ? '⚠️' : '✉️'} {m.text}
                      </p>
                      <p className="mt-1 text-[11px] text-muted">
                        {m.adminName} · {smartDate(m.createdAt)} · {m.ackAt ? '✅ tasdiqladi' : m.readAt ? "👁 o'qidi" : m.deliveredAt ? 'yetkazildi' : 'yuborilmoqda'}
                        {m.replyText && ` · javob: “${m.replyText}”`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {query.data.history.length > 0 && (
              <div>
                <h4 className="mb-2 text-[13px] font-semibold">Shu raqamning oldingi murojaatlari</h4>
                <div className="space-y-1">
                  {query.data.history.map((h) => (
                    <button key={h.id} onClick={() => openLead(h.id)} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[13px] hover:bg-surface-2">
                      <span>
                        #{h.seq} · {smartDate(h.createdAt)}
                      </span>
                      <StatusBadge status={h.status} size="sm" short />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="mb-3 text-[13px] font-semibold">To'liq tarix</h4>
              <Timeline events={query.data.events} />
            </div>
          </div>
        )}
      </div>
      {msgOpen && lead && query.data?.employee && (
        <SendMessageModal open onClose={() => setMsgOpen(false)} employee={query.data.employee} lead={lead} />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-0.5 truncate font-medium">{value}</p>
    </div>
  );
}

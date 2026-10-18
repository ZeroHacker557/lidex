import { OPEN_STATUSES, STATUS_META, type LeadStatus } from '../../../shared/statuses.js';
import { config } from '../config.js';
import { COL, db, type Employee, type Group, type Lead, type LeadField, type LeadSource, type WithId } from '../db/index.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { buildSearchTokens, parseLeadText } from '../lib/parser.js';
import { normalizePhone } from '../lib/phone.js';
import { addDays, addHours, atLocal, localParts, shiftOutOfQuietHours } from '../lib/time.js';
import { logger } from '../logger.js';
import { logEvent, SYSTEM, type Actor } from './events.js';
import { notifyAdmins, notifyNewLead, notifyReassigned } from './notify.js';
import { emitToAdmins, emitToEmployee } from './realtime.js';

export type LeadDto = Omit<WithId<Lead>, 'searchTokens'>;

export function toLeadDto(lead: WithId<Lead>): LeadDto {
  const { searchTokens: _s, ...rest } = lead;
  return rest;
}

export interface IngestInput {
  group: WithId<Group>;
  source: LeadSource;
  text: string;
  chatId?: number | null;
  messageId?: number | null;
  name?: string | null;
  phone?: string | null;
  telegramUsername?: string | null;
  fields?: LeadField[];
  actor?: Actor;
}

export interface IngestResult {
  lead: WithId<Lead>;
  created: boolean;
}

/** Guruhga biriktirilgan va lid qabul qila oladigan xodimlar */
export async function eligibleEmployees(groupId: string): Promise<WithId<Employee>[]> {
  const list = await db().query<Employee>(COL.employees, { where: [['groupIds', 'array-contains', groupId]] });
  return list
    .filter((e) => e.isActive && e.acceptingLeads && e.telegramId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
}

async function openLoad(employeeId: string): Promise<number> {
  return db().count(COL.leads, {
    where: [
      ['assignedEmployeeId', '==', employeeId],
      ['status', 'in', OPEN_STATUSES],
    ],
  });
}

function pickRoundRobin(candidates: WithId<Employee>[], lastId: string | null): WithId<Employee> | null {
  if (!candidates.length) return null;
  const idx = lastId ? candidates.findIndex((c) => c.id === lastId) : -1;
  return candidates[(idx + 1) % candidates.length]!;
}

export async function ingestLead(input: IngestInput): Promise<IngestResult | null> {
  const { group } = input;
  const text = input.text.trim().slice(0, 4000);
  const parsed = parseLeadText(text);
  const phone = (input.phone && normalizePhone(input.phone)) || parsed.phone;
  const phones = [...new Set([...(phone ? [phone] : []), ...parsed.phones])];
  const name = input.name?.trim() || parsed.name;
  const fields = [...(input.fields ?? []), ...parsed.fields].slice(0, 30);

  const fromChat = input.source === 'telegram' || input.source === 'userbot';
  if (fromChat && group.settings.requirePhone && !phone) return null;
  if (!fromChat && !phone && !name) throw badRequest('Lidda kamida ism yoki telefon bo\'lishi kerak');

  const leadId =
    input.chatId != null && input.messageId != null ? `m${Math.abs(input.chatId)}_${input.messageId}` : db().newId();

  // Takroriy raqamni tekshirish (tranzaksiyadan tashqarida — indeks so'rovi)
  let previous: WithId<Lead> | null = null;
  if (phone) {
    const prev = await db().query<Lead>(COL.leads, {
      where: [
        ['groupId', '==', group.id],
        ['phone', '==', phone],
      ],
      orderBy: [['createdAt', 'desc']],
      limit: 1,
    });
    previous = prev[0] ?? null;
  }

  const candidates = await eligibleEmployees(group.id);
  let loads: Map<string, number> | null = null;
  if (group.settings.distribution === 'least_loaded' && candidates.length) {
    loads = new Map(await Promise.all(candidates.map(async (c) => [c.id, await openLoad(c.id)] as const)));
  }

  const now = new Date();
  const result = await db().runTransaction(async (tx) => {
    const existing = await tx.get<Lead>(COL.leads, leadId);
    if (existing) return { lead: existing, created: false };

    const freshGroup = (await tx.get<Group>(COL.groups, group.id)) ?? group;
    const counter = await tx.get<{ value: number }>(COL.counters, 'leads');
    const seq = (counter?.value ?? 1000) + 1;

    let assignee: WithId<Employee> | null = null;
    const settings = freshGroup.settings;
    if (settings.stickyDuplicates && previous?.assignedEmployeeId) {
      assignee = candidates.find((c) => c.id === previous!.assignedEmployeeId) ?? null;
    }
    if (!assignee && settings.distribution !== 'manual') {
      if (settings.distribution === 'least_loaded' && loads) {
        assignee = [...candidates].sort((a, b) => (loads!.get(a.id) ?? 0) - (loads!.get(b.id) ?? 0))[0] ?? null;
      } else {
        assignee = pickRoundRobin(candidates, freshGroup.lastAssignedEmployeeId);
      }
    }

    const lead: Lead = {
      seq,
      groupId: group.id,
      groupTitle: freshGroup.title,
      assignedEmployeeId: assignee?.id ?? null,
      assignedAt: assignee ? now : null,
      source: input.source,
      sourceChatId: input.chatId ?? null,
      sourceMessageId: input.messageId ?? null,
      rawText: text,
      name: name ?? null,
      phone: phone ?? null,
      phones,
      telegramUsername: input.telegramUsername ?? parsed.telegramUsername,
      fields,
      status: 'new',
      postponedUntil: null,
      nextReminderAt: null,
      reminderCount: 0,
      isDuplicate: !!previous,
      duplicateOfId: previous?.id ?? null,
      flagged: false,
      flagNote: null,
      slaNotifiedAt: null,
      escalatedAt: null,
      firstActionAt: null,
      responseSeconds: null,
      statusChangedAt: null,
      statusChangedBy: null,
      lastNote: null,
      viewedAt: null,
      searchTokens: [],
      createdAt: now,
      updatedAt: now,
    };
    lead.searchTokens = buildSearchTokens({ seq, name: lead.name, phones, telegramUsername: lead.telegramUsername });

    tx.set(COL.leads, leadId, lead);
    tx.set(COL.counters, 'leads', { value: seq });
    tx.update(COL.groups, group.id, {
      lastAssignedEmployeeId: assignee?.id ?? freshGroup.lastAssignedEmployeeId,
      leadCount: (freshGroup.leadCount ?? 0) + 1,
      updatedAt: now,
    });
    return { lead: { ...lead, id: leadId }, created: true, assignee };
  });

  if (!result.created) return { lead: result.lead, created: false };
  const lead = result.lead;
  const assignee = (result as { assignee?: WithId<Employee> | null }).assignee ?? null;

  await logEvent(lead, input.actor ?? SYSTEM, 'created', {
    toStatus: 'new',
    meta: { source: input.source, duplicate: lead.isDuplicate },
  });
  if (assignee) {
    await logEvent(lead, SYSTEM, 'assigned', {
      text: assignee.fullName,
      meta: { employeeId: assignee.id, sticky: lead.isDuplicate && previous?.assignedEmployeeId === assignee.id },
    });
  }

  const dto = toLeadDto(lead);
  emitToAdmins(lead.groupId, 'lead:new', dto);
  if (assignee) {
    emitToEmployee(assignee.id, 'lead:new', dto);
    notifyNewLead(assignee, lead).catch((err) => logger.error({ err }, 'notifyNewLead'));
  } else {
    emitToAdmins(lead.groupId, 'alert', {
      kind: 'unassigned',
      leadId: lead.id,
      text: `Lid #${lead.seq} hech kimga biriktirilmadi — faol xodim yo'q`,
    });
    notifyAdmins(
      lead.groupId,
      `⚠️ <b>Lid #${lead.seq}</b> (${group.title}) hech kimga biriktirilmadi.\nGuruhda faol, botga ulangan xodim yo'q yoki taqsimlash "qo'lda".`,
    ).catch(() => undefined);
  }
  logger.info({ seq: lead.seq, group: group.title, employee: assignee?.fullName ?? null }, 'Yangi lid');
  return { lead, created: true };
}

// ---------------- Status ----------------

export interface StatusInput {
  status: LeadStatus;
  /** Faqat postponed uchun: aniq eslatma vaqti. Berilmasa — har N kunda eslatiladi */
  postponedUntil?: Date | null;
  note?: string | null;
}

export function tomorrowAtReminderHour(now = new Date()): Date {
  const p = localParts(now);
  return atLocal(p.year, p.month, p.day + 1, config.REMINDER_HOUR);
}

export function computeReminder(status: LeadStatus, postponedUntil: Date | null, group: Group, now = new Date()) {
  if (status === 'postponed') {
    if (postponedUntil) return postponedUntil;
    return shiftOutOfQuietHours(addDays(now, group.settings.postponeIntervalDays));
  }
  if (status === 'no_answer') return shiftOutOfQuietHours(addHours(now, group.settings.noAnswerRetryHours));
  return null;
}

export async function getLeadOr404(leadId: string): Promise<WithId<Lead>> {
  const lead = await db().get<Lead>(COL.leads, leadId);
  if (!lead) throw notFound('Lid topilmadi');
  return lead;
}

export async function changeStatus(leadId: string, actor: Actor, input: StatusInput): Promise<WithId<Lead>> {
  const lead = await getLeadOr404(leadId);
  if (actor.type === 'employee' && lead.assignedEmployeeId !== actor.id) throw forbidden('Bu lid sizga biriktirilmagan');

  const group = await db().get<Group>(COL.groups, lead.groupId);
  if (!group) throw notFound('Guruh topilmadi');

  const now = new Date();
  let postponedUntil: Date | null = null;
  if (input.status === 'postponed' && input.postponedUntil) {
    if (input.postponedUntil.getTime() < now.getTime() - 60_000) throw badRequest("O'tib ketgan sanani tanlab bo'lmaydi");
    if (input.postponedUntil.getTime() > addDays(now, 366).getTime()) throw badRequest('Sana 1 yildan uzoq bo\'lmasin');
    postponedUntil = input.postponedUntil;
  }
  const note = input.note?.trim().slice(0, 1000) || null;
  const nextReminderAt = computeReminder(input.status, postponedUntil, group, now);
  const isFirstAction = !lead.firstActionAt && actor.type !== 'system';

  const patch: Partial<Lead> = {
    status: input.status,
    postponedUntil,
    nextReminderAt,
    reminderCount: 0,
    statusChangedAt: now,
    statusChangedBy: actor.name,
    updatedAt: now,
    ...(note ? { lastNote: note } : {}),
    ...(isFirstAction
      ? { firstActionAt: now, responseSeconds: Math.round((now.getTime() - lead.createdAt.getTime()) / 1000) }
      : {}),
  };
  await db().update(COL.leads, lead.id, patch);
  const updated = { ...lead, ...patch } as WithId<Lead>;

  await logEvent(updated, actor, 'status_changed', {
    fromStatus: lead.status,
    toStatus: input.status,
    text: note,
    meta: {
      postponedUntil: postponedUntil?.toISOString() ?? null,
      edit: STATUS_META[lead.status].final,
    },
  });

  const dto = toLeadDto(updated);
  emitToEmployee(updated.assignedEmployeeId, 'lead:updated', dto);
  emitToAdmins(updated.groupId, 'lead:updated', dto);
  return updated;
}

export async function addNote(leadId: string, actor: Actor, text: string): Promise<WithId<Lead>> {
  const lead = await getLeadOr404(leadId);
  if (actor.type === 'employee' && lead.assignedEmployeeId !== actor.id) throw forbidden('Bu lid sizga biriktirilmagan');
  const clean = text.trim().slice(0, 1000);
  if (!clean) throw badRequest("Izoh bo'sh bo'lmasin");
  const now = new Date();
  await db().update(COL.leads, lead.id, { lastNote: clean, updatedAt: now });
  const updated = { ...lead, lastNote: clean, updatedAt: now };
  await logEvent(updated, actor, 'note', { text: clean });
  const dto = toLeadDto(updated);
  emitToEmployee(updated.assignedEmployeeId, 'lead:updated', dto);
  emitToAdmins(updated.groupId, 'lead:updated', dto);
  return updated;
}

export async function markViewed(lead: WithId<Lead>, actor: Actor): Promise<void> {
  if (lead.viewedAt || actor.type !== 'employee' || lead.assignedEmployeeId !== actor.id) return;
  const now = new Date();
  await db().update(COL.leads, lead.id, { viewedAt: now });
  lead.viewedAt = now;
  await logEvent(lead, actor, 'viewed');
  emitToAdmins(lead.groupId, 'lead:updated', toLeadDto(lead));
}

export async function reassignLead(leadId: string, employeeId: string | null, actor: Actor): Promise<WithId<Lead>> {
  const lead = await getLeadOr404(leadId);
  if (lead.assignedEmployeeId === employeeId) return lead;
  let emp: WithId<Employee> | null = null;
  if (employeeId) {
    emp = await db().get<Employee>(COL.employees, employeeId);
    if (!emp || !emp.isActive) throw badRequest('Xodim topilmadi yoki faol emas');
    if (!emp.groupIds.includes(lead.groupId)) throw badRequest('Xodim bu guruhga biriktirilmagan');
  }
  const now = new Date();
  const patch: Partial<Lead> = {
    assignedEmployeeId: employeeId,
    assignedAt: employeeId ? now : null,
    updatedAt: now,
    viewedAt: null,
    // Yangi xodim uchun SLA hisobi qaytadan boshlanadi
    ...(lead.status === 'new' ? { slaNotifiedAt: null, escalatedAt: null } : {}),
  };
  await db().update(COL.leads, lead.id, patch);
  const updated = { ...lead, ...patch } as WithId<Lead>;
  await logEvent(updated, actor, 'reassigned', {
    text: emp?.fullName ?? 'Biriktirilmagan',
    meta: { from: lead.assignedEmployeeId, to: employeeId },
  });

  const dto = toLeadDto(updated);
  if (lead.assignedEmployeeId) emitToEmployee(lead.assignedEmployeeId, 'lead:removed', { id: lead.id });
  if (emp) {
    emitToEmployee(emp.id, 'lead:new', dto);
    notifyReassigned(emp, updated).catch(() => undefined);
  }
  emitToAdmins(updated.groupId, 'lead:updated', dto);
  return updated;
}

export async function setFlag(leadId: string, flagged: boolean, note: string | null, actor: Actor) {
  const lead = await getLeadOr404(leadId);
  const now = new Date();
  const patch = { flagged, flagNote: flagged ? note?.trim() || null : null, updatedAt: now };
  await db().update(COL.leads, lead.id, patch);
  const updated = { ...lead, ...patch };
  await logEvent(updated, actor, flagged ? 'flagged' : 'unflagged', { text: patch.flagNote });
  const dto = toLeadDto(updated);
  emitToEmployee(updated.assignedEmployeeId, 'lead:updated', dto);
  emitToAdmins(updated.groupId, 'lead:updated', dto);
  return updated;
}

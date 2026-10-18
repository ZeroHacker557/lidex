// Admin panel API: /api/admin/*
import bcrypt from 'bcryptjs';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { DEFAULT_GROUP_SETTINGS, LEAD_STATUSES, OPEN_STATUSES } from '../../../../shared/statuses.js';
import { botInfo } from '../../bot/instance.js';
import {
  COL,
  db,
  type Admin,
  type Employee,
  type Filter,
  type Group,
  type InboxItem,
  type Lead,
  type LeadEvent,
  type StaffMessage,
  type WithId,
} from '../../db/index.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { searchTokenFor } from '../../lib/parser.js';
import { randomToken } from '../../lib/security.js';
import { addDays, startOfLocalDay } from '../../lib/time.js';
import { newKeyFields, publicEmployee } from '../../services/employees.js';
import { allGroups, invalidateGroups, newGroup } from '../../services/groups.js';
import {
  addNote,
  changeStatus,
  eligibleEmployees,
  getLeadOr404,
  ingestLead,
  reassignLead,
  setFlag,
  toLeadDto,
} from '../../services/leads.js';
import { forceIngestInbox } from '../../services/inbox.js';
import { sendStaffMessage } from '../../services/messages.js';
import { emitToAdmins, emitToEmployee, onlineEmployeeIds } from '../../services/realtime.js';
import { dashboard, employeeStats, leadsCsv, scopeFilter } from '../../services/stats.js';
import { adminActor, adminGroupScope, assertGroupAccess, requireAdmin, requireSuperadmin } from '../middleware.js';
import { publicAdmin } from './admin-auth.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

const id = z.string().min(1).max(128);
const isoDate = z.string().datetime({ offset: true });

// ---------------- Yordamchilar ----------------

async function scopedEmployees(req: Request): Promise<WithId<Employee>[]> {
  const scope = adminGroupScope(req.admin!);
  const all = await db().query<Employee>(COL.employees, {});
  const list = scope ? all.filter((e) => e.groupIds.some((g) => scope.includes(g))) : all;
  return list.sort((a, b) => a.fullName.localeCompare(b.fullName));
}

async function getEmployeeScoped(req: Request, employeeId: string): Promise<WithId<Employee>> {
  const emp = await db().get<Employee>(COL.employees, employeeId);
  if (!emp) throw notFound('Xodim topilmadi');
  const scope = adminGroupScope(req.admin!);
  if (scope && !emp.groupIds.some((g) => scope.includes(g))) throw forbidden();
  return emp;
}

async function getLeadScoped(req: Request, leadId: string): Promise<WithId<Lead>> {
  const lead = await getLeadOr404(leadId);
  assertGroupAccess(req.admin!, lead.groupId);
  return lead;
}

function deepLink(key: string) {
  return botInfo.username ? `https://t.me/${botInfo.username}?start=${key}` : null;
}

function rangeFromQuery(q: { from?: string; to?: string; days?: number }) {
  const to = q.to ? new Date(q.to) : addDays(startOfLocalDay(), 1);
  const from = q.from ? new Date(q.from) : addDays(startOfLocalDay(), -((q.days ?? 7) - 1));
  return { from, to };
}

// ---------------- Dashboard ----------------

adminRouter.get('/dashboard', async (req, res) => {
  const q = z
    .object({ groupId: id.optional(), from: isoDate.optional(), to: isoDate.optional(), days: z.coerce.number().min(1).max(31).optional() })
    .parse(req.query);
  if (q.groupId) assertGroupAccess(req.admin!, q.groupId);
  const { from, to } = rangeFromQuery(q);
  let employees = (await scopedEmployees(req)).filter((e) => e.isActive);
  if (q.groupId) employees = employees.filter((e) => e.groupIds.includes(q.groupId!));
  const data = await dashboard({ scope: scopeFilter(adminGroupScope(req.admin!), q.groupId), from, to, employees });
  res.json(data);
});

adminRouter.get('/alerts', async (req, res) => {
  const scope = scopeFilter(adminGroupScope(req.admin!));
  const [escalated, unassigned, overdue, flagged] = await Promise.all([
    db().query<Lead>(COL.leads, {
      where: [...scope, ['status', '==', 'new'], ['escalatedAt', '!=', null]],
      orderBy: [['escalatedAt', 'desc']],
      limit: 50,
    }),
    db().query<Lead>(COL.leads, {
      where: [...scope, ['assignedEmployeeId', '==', null], ['status', 'in', OPEN_STATUSES]],
      orderBy: [['createdAt', 'desc']],
      limit: 50,
    }),
    db().query<Lead>(COL.leads, {
      where: [...scope, ['status', '==', 'postponed'], ['postponedUntil', '<', new Date()]],
      orderBy: [['postponedUntil', 'asc']],
      limit: 50,
    }),
    db().query<Lead>(COL.leads, {
      where: [...scope, ['flagged', '==', true]],
      orderBy: [['createdAt', 'desc']],
      limit: 50,
    }),
  ]);
  const groups = req.admin!.role === 'superadmin' ? (await allGroups(true)).filter((g) => g.status === 'pending') : [];
  const employees = (await scopedEmployees(req)).filter((e) => e.isActive && (!e.telegramId || e.botBlocked));
  res.json({
    escalated: escalated.map(toLeadDto),
    unassigned: unassigned.map(toLeadDto),
    overdue: overdue.map(toLeadDto),
    flagged: flagged.map(toLeadDto),
    pendingGroups: groups.map((g) => ({ id: g.id, title: g.title, chatId: g.chatId, createdAt: g.createdAt })),
    employeeIssues: employees.map((e) => ({
      id: e.id,
      fullName: e.fullName,
      issue: !e.telegramId ? 'not_bound' : 'bot_blocked',
    })),
  });
});

// ---------------- Lidlar ----------------

const leadsQuery = z.object({
  groupId: id.optional(),
  employeeId: id.optional(), // "none" — biriktirilmaganlar
  status: z.enum(['open', ...LEAD_STATUSES]).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  q: z.string().max(60).optional(),
  flagged: z.enum(['1', 'true']).optional(),
  duplicate: z.enum(['1', 'true']).optional(),
  cursor: isoDate.optional(),
  limit: z.coerce.number().min(1).max(100).default(30),
});

function leadsWhere(req: Request, q: z.infer<typeof leadsQuery>): Filter[] {
  if (q.groupId) assertGroupAccess(req.admin!, q.groupId);
  const where: Filter[] = scopeFilter(adminGroupScope(req.admin!), q.groupId);
  if (q.employeeId) where.push(['assignedEmployeeId', '==', q.employeeId === 'none' ? null : q.employeeId]);
  if (q.status === 'open') where.push(['status', 'in', OPEN_STATUSES]);
  else if (q.status) where.push(['status', '==', q.status]);
  if (q.flagged) where.push(['flagged', '==', true]);
  if (q.duplicate) where.push(['isDuplicate', '==', true]);
  if (q.from) where.push(['createdAt', '>=', new Date(q.from)]);
  if (q.to) where.push(['createdAt', '<', new Date(q.to)]);
  const token = q.q ? searchTokenFor(q.q) : null;
  if (token) where.push(['searchTokens', 'array-contains', token]);
  return where;
}

adminRouter.get('/leads', async (req, res) => {
  const q = leadsQuery.parse(req.query);
  const leads = await db().query<Lead>(COL.leads, {
    where: leadsWhere(req, q),
    orderBy: [['createdAt', 'desc']],
    startAfter: q.cursor ? [new Date(q.cursor)] : undefined,
    limit: q.limit + 1,
  });
  const page = leads.slice(0, q.limit);
  res.json({ items: page.map(toLeadDto), nextCursor: leads.length > q.limit ? page.at(-1)!.createdAt.toISOString() : null });
});

adminRouter.get('/leads/export.csv', async (req, res) => {
  const q = leadsQuery.parse(req.query);
  const leads = await db().query<Lead>(COL.leads, { where: leadsWhere(req, q), orderBy: [['createdAt', 'desc']], limit: 5000 });
  const names = new Map((await scopedEmployees(req)).map((e) => [e.id, e.fullName]));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="lidex-lidlar-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(leadsCsv(leads, names));
});

adminRouter.post('/leads', async (req, res) => {
  const body = z
    .object({ groupId: id, name: z.string().max(120).optional(), phone: z.string().max(40).optional(), text: z.string().max(4000).default('') })
    .parse(req.body);
  assertGroupAccess(req.admin!, body.groupId);
  const group = (await allGroups(true)).find((g) => g.id === body.groupId);
  if (!group) throw notFound('Guruh topilmadi');
  const text = [body.name ? `Ism: ${body.name}` : '', body.phone ? `Telefon: ${body.phone}` : '', body.text].filter(Boolean).join('\n');
  const result = await ingestLead({ group, source: 'manual', text, name: body.name, phone: body.phone, actor: adminActor(req) });
  res.status(201).json({ lead: result ? toLeadDto(result.lead) : null });
});

adminRouter.get('/leads/:id', async (req, res) => {
  const lead = await getLeadScoped(req, req.params.id!);
  const [events, messages, employee, duplicates] = await Promise.all([
    db().query<LeadEvent>(COL.events, { where: [['leadId', '==', lead.id]], orderBy: [['createdAt', 'asc']], limit: 300 }),
    db().query<StaffMessage>(COL.messages, { where: [['leadId', '==', lead.id]], orderBy: [['createdAt', 'desc']], limit: 50 }),
    lead.assignedEmployeeId ? db().get<Employee>(COL.employees, lead.assignedEmployeeId) : null,
    lead.phone
      ? db().query<Lead>(COL.leads, {
          where: [
            ['groupId', '==', lead.groupId],
            ['phone', '==', lead.phone],
          ],
          orderBy: [['createdAt', 'desc']],
          limit: 10,
        })
      : [],
  ]);
  res.json({
    lead: toLeadDto(lead),
    events,
    messages,
    employee: employee ? publicEmployee(employee) : null,
    history: duplicates.filter((d) => d.id !== lead.id).map(toLeadDto),
  });
});

adminRouter.post('/leads/:id/status', async (req, res) => {
  const body = z
    .object({ status: z.enum(LEAD_STATUSES), postponedUntil: isoDate.nullable().optional(), note: z.string().max(1000).nullable().optional() })
    .parse(req.body);
  await getLeadScoped(req, req.params.id!);
  const lead = await changeStatus(req.params.id!, adminActor(req), {
    status: body.status,
    postponedUntil: body.postponedUntil ? new Date(body.postponedUntil) : null,
    note: body.note,
  });
  res.json({ lead: toLeadDto(lead) });
});

adminRouter.post('/leads/:id/assign', async (req, res) => {
  const { employeeId } = z.object({ employeeId: id.nullable() }).parse(req.body);
  await getLeadScoped(req, req.params.id!);
  const lead = await reassignLead(req.params.id!, employeeId, adminActor(req));
  res.json({ lead: toLeadDto(lead) });
});

adminRouter.post('/leads/:id/flag', async (req, res) => {
  const { flagged, note } = z.object({ flagged: z.boolean(), note: z.string().max(500).nullable().optional() }).parse(req.body);
  await getLeadScoped(req, req.params.id!);
  const lead = await setFlag(req.params.id!, flagged, note ?? null, adminActor(req));
  res.json({ lead: toLeadDto(lead) });
});

adminRouter.post('/leads/:id/notes', async (req, res) => {
  const { text } = z.object({ text: z.string().min(1).max(1000) }).parse(req.body);
  await getLeadScoped(req, req.params.id!);
  const lead = await addNote(req.params.id!, adminActor(req), text);
  res.json({ lead: toLeadDto(lead) });
});

// ---------------- Xodimlar ----------------

const employeeBody = z.object({
  fullName: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(30).nullable().optional(),
  groupIds: z.array(id).max(50).default([]),
});

adminRouter.get('/employees', async (req, res) => {
  const { groupId } = z.object({ groupId: id.optional() }).parse(req.query);
  let list = await scopedEmployees(req);
  if (groupId) list = list.filter((e) => e.groupIds.includes(groupId));
  const online = onlineEmployeeIds();
  const openCounts = await Promise.all(
    list.map((e) => db().count(COL.leads, { where: [['assignedEmployeeId', '==', e.id], ['status', 'in', OPEN_STATUSES]] })),
  );
  res.json({
    items: list.map((e, i) => ({ ...publicEmployee(e), online: online.has(e.id), openLeads: openCounts[i] })),
  });
});

adminRouter.post('/employees', async (req, res) => {
  const body = employeeBody.parse(req.body);
  for (const g of body.groupIds) assertGroupAccess(req.admin!, g);
  const { key, keyHash, keyHint } = newKeyFields();
  const emp: Employee = {
    fullName: body.fullName,
    phone: body.phone ?? null,
    keyHash,
    keyHint,
    telegramId: null,
    telegramUsername: null,
    telegramName: null,
    groupIds: body.groupIds,
    isActive: true,
    acceptingLeads: true,
    onboardingDone: false,
    botBlocked: false,
    boundAt: null,
    lastSeenAt: null,
    lastDigestDate: null,
    progress: {},
    createdAt: new Date(),
    createdBy: req.admin!.id,
  };
  const empId = await db().create(COL.employees, emp);
  emitToAdmins(body.groupIds[0] ?? null, 'employee:updated', { id: empId });
  res.status(201).json({ employee: publicEmployee({ ...emp, id: empId }), key, deepLink: deepLink(key) });
});

adminRouter.get('/employees/:id', async (req, res) => {
  const emp = await getEmployeeScoped(req, req.params.id!);
  const q = z.object({ days: z.coerce.number().min(1).max(90).default(30) }).parse(req.query);
  const { from, to } = rangeFromQuery({ days: q.days });
  const [stats] = await employeeStats([emp], [['createdAt', '>=', from], ['createdAt', '<', to]]);
  const [events, messages, groups] = await Promise.all([
    db().query<LeadEvent>(COL.events, { where: [['employeeId', '==', emp.id]], orderBy: [['createdAt', 'desc']], limit: 100 }),
    db().query<StaffMessage>(COL.messages, { where: [['employeeId', '==', emp.id]], orderBy: [['createdAt', 'desc']], limit: 50 }),
    db().getMany<Group>(COL.groups, emp.groupIds),
  ]);
  res.json({
    employee: { ...publicEmployee(emp), online: onlineEmployeeIds().has(emp.id) },
    stats,
    events,
    messages,
    groups: groups.map((g) => ({ id: g.id, title: g.title })),
  });
});

adminRouter.patch('/employees/:id', async (req, res) => {
  const emp = await getEmployeeScoped(req, req.params.id!);
  const body = employeeBody
    .partial()
    .extend({ isActive: z.boolean().optional(), acceptingLeads: z.boolean().optional() })
    .parse(req.body);
  if (body.groupIds) for (const g of body.groupIds) assertGroupAccess(req.admin!, g);
  await db().update(COL.employees, emp.id, body);
  const updated = { ...emp, ...body };
  emitToAdmins(updated.groupIds[0] ?? null, 'employee:updated', { id: emp.id });
  res.json({ employee: publicEmployee(updated as WithId<Employee>) });
});

/** Yangi kalit: eski kalit bekor bo'ladi va Telegram bog'lanishi uziladi */
adminRouter.post('/employees/:id/key', async (req, res) => {
  const emp = await getEmployeeScoped(req, req.params.id!);
  const { key, keyHash, keyHint } = newKeyFields();
  await db().update(COL.employees, emp.id, { keyHash, keyHint, telegramId: null, telegramUsername: null, boundAt: null });
  emitToEmployee(emp.id, 'employee:updated', { id: emp.id, loggedOut: true });
  res.json({ key, deepLink: deepLink(key) });
});

adminRouter.post('/employees/:id/unbind', async (req, res) => {
  const emp = await getEmployeeScoped(req, req.params.id!);
  await db().update(COL.employees, emp.id, { telegramId: null, telegramUsername: null, boundAt: null });
  emitToEmployee(emp.id, 'employee:updated', { id: emp.id, loggedOut: true });
  res.json({ ok: true });
});

/** Xodimning ochiq lidlarini guruhdagi boshqa xodimlarga navbatma-navbat taqsimlash */
adminRouter.post('/employees/:id/redistribute', async (req, res) => {
  const emp = await getEmployeeScoped(req, req.params.id!);
  const leads = await db().query<Lead>(COL.leads, {
    where: [['assignedEmployeeId', '==', emp.id], ['status', 'in', OPEN_STATUSES]],
    limit: 500,
  });
  const pools = new Map<string, WithId<Employee>[]>();
  const cursor = new Map<string, number>();
  let moved = 0;
  for (const lead of leads) {
    if (!pools.has(lead.groupId)) pools.set(lead.groupId, (await eligibleEmployees(lead.groupId)).filter((e) => e.id !== emp.id));
    const pool = pools.get(lead.groupId)!;
    if (!pool.length) continue;
    const i = cursor.get(lead.groupId) ?? 0;
    cursor.set(lead.groupId, i + 1);
    await reassignLead(lead.id, pool[i % pool.length]!.id, adminActor(req));
    moved++;
  }
  res.json({ moved, total: leads.length });
});

// ---------------- Guruhlar ----------------

const settingsSchema = z
  .object({
    distribution: z.enum(['round_robin', 'least_loaded', 'manual']),
    slaMinutes: z.number().int().min(1).max(1440),
    postponeIntervalDays: z.number().int().min(1).max(30),
    noAnswerRetryHours: z.number().int().min(1).max(72),
    requirePhone: z.boolean(),
    stickyDuplicates: z.boolean(),
    ingestVia: z.enum(['bot', 'userbot']),
  })
  .partial();

function publicGroup(g: WithId<Group>, employees: WithId<Employee>[]) {
  const members = employees.filter((e) => e.groupIds.includes(g.id));
  return {
    ...g,
    settings: { ...DEFAULT_GROUP_SETTINGS, ...g.settings },
    employeeCount: members.length,
    activeEmployeeCount: members.filter((e) => e.isActive && e.acceptingLeads && e.telegramId).length,
  };
}

adminRouter.get('/groups', async (req, res) => {
  const scope = adminGroupScope(req.admin!);
  const groups = (await allGroups(true)).filter((g) => !scope || scope.includes(g.id));
  const employees = await db().query<Employee>(COL.employees, {});
  res.json({
    items: groups
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((g) => publicGroup(g, employees)),
  });
});

adminRouter.post('/groups', requireSuperadmin, async (req, res) => {
  const body = z
    .object({ title: z.string().trim().min(2).max(120), chatId: z.number().int().nullable().optional(), settings: settingsSchema.optional() })
    .parse(req.body);
  if (body.chatId && (await allGroups(true)).some((g) => g.chatId === body.chatId)) throw conflict('Bu chat allaqachon qo\'shilgan');
  const group = newGroup({
    title: body.title,
    chatId: body.chatId ?? null,
    chatType: body.chatId ? (String(body.chatId).startsWith('-100') ? 'supergroup' : 'group') : 'api',
    status: 'active',
    settings: body.settings,
  });
  const groupId = await db().create(COL.groups, group);
  invalidateGroups();
  res.status(201).json({ group: { ...group, id: groupId } });
});

adminRouter.get('/groups/:id', async (req, res) => {
  assertGroupAccess(req.admin!, req.params.id!);
  const group = await db().get<Group>(COL.groups, req.params.id!);
  if (!group) throw notFound('Guruh topilmadi');
  const employees = await db().query<Employee>(COL.employees, { where: [['groupIds', 'array-contains', group.id]] });
  res.json({
    group: publicGroup(group, employees),
    employees: employees.map(publicEmployee),
    ingestUrl: `/api/ingest/${group.ingestToken}`,
  });
});

adminRouter.patch('/groups/:id', async (req, res) => {
  assertGroupAccess(req.admin!, req.params.id!);
  const group = await db().get<Group>(COL.groups, req.params.id!);
  if (!group) throw notFound('Guruh topilmadi');
  const body = z
    .object({
      title: z.string().trim().min(2).max(120).optional(),
      status: z.enum(['pending', 'active', 'disabled']).optional(),
      settings: settingsSchema.optional(),
    })
    .parse(req.body);
  if (body.status && req.admin!.role !== 'superadmin') throw forbidden('Guruh holatini faqat superadmin o\'zgartiradi');
  const patch: Partial<Group> = { updatedAt: new Date() };
  if (body.title) patch.title = body.title;
  if (body.status) patch.status = body.status;
  if (body.settings) patch.settings = { ...DEFAULT_GROUP_SETTINGS, ...group.settings, ...body.settings };
  await db().update(COL.groups, group.id, patch);
  invalidateGroups();
  emitToAdmins(group.id, 'group:updated', { id: group.id });
  res.json({ group: { ...group, ...patch } });
});

adminRouter.put('/groups/:id/employees', async (req, res) => {
  assertGroupAccess(req.admin!, req.params.id!);
  const { employeeIds } = z.object({ employeeIds: z.array(id).max(200) }).parse(req.body);
  const groupId = req.params.id!;
  const all = await scopedEmployees(req);
  const wanted = new Set(employeeIds);
  await Promise.all(
    all.map(async (e) => {
      const has = e.groupIds.includes(groupId);
      if (wanted.has(e.id) && !has) await db().update(COL.employees, e.id, { groupIds: [...e.groupIds, groupId] });
      if (!wanted.has(e.id) && has) await db().update(COL.employees, e.id, { groupIds: e.groupIds.filter((g) => g !== groupId) });
    }),
  );
  emitToAdmins(groupId, 'group:updated', { id: groupId });
  res.json({ ok: true });
});

adminRouter.post('/groups/:id/token', requireSuperadmin, async (req, res) => {
  const token = randomToken(18);
  await db().update(COL.groups, String(req.params.id), { ingestToken: token, updatedAt: new Date() });
  invalidateGroups();
  res.json({ ingestUrl: `/api/ingest/${token}` });
});

/** Parser va taqsimlashni sinash: matnni xuddi guruhga tushgandek qayta ishlaydi */
adminRouter.post('/groups/:id/test-lead', async (req, res) => {
  assertGroupAccess(req.admin!, req.params.id!);
  const { text } = z.object({ text: z.string().min(3).max(4000) }).parse(req.body);
  const group = (await allGroups(true)).find((g) => g.id === req.params.id);
  if (!group) throw notFound('Guruh topilmadi');
  const result = await ingestLead({ group, source: 'manual', text, actor: adminActor(req) });
  res.json({ lead: result ? toLeadDto(result.lead) : null });
});

/** Guruhga tushgan xabarlar va ularning natijasi (lid bo'ldimi, nega bo'lmadi) */
adminRouter.get('/groups/:id/inbox', async (req, res) => {
  assertGroupAccess(req.admin!, String(req.params.id));
  const { status } = z.object({ status: z.enum(['lead', 'skipped', 'failed', 'pending']).optional() }).parse(req.query);
  const where: Filter[] = [['groupId', '==', String(req.params.id)]];
  if (status) where.push(['status', '==', status]);
  const items = await db().query<InboxItem>(COL.inbox, { where, orderBy: [['createdAt', 'desc']], limit: 50 });
  res.json({ items });
});

/** Lid deb topilmagan xabarni qo'lda lid qilish (ism/telefonni to'ldirib) */
adminRouter.post('/inbox/:id/ingest', async (req, res) => {
  const item = await db().get<InboxItem>(COL.inbox, String(req.params.id));
  if (!item) throw notFound('Xabar topilmadi');
  assertGroupAccess(req.admin!, item.groupId);
  const body = z.object({ name: z.string().max(120).nullable().optional(), phone: z.string().max(40).nullable().optional() }).parse(req.body ?? {});
  const lead = await forceIngestInbox(item.id, body);
  if (!lead) throw badRequest("Lid yaratilmadi: ism yoki telefonni kiriting");
  res.json({ lead });
});

adminRouter.delete('/groups/:id', requireSuperadmin, async (req, res) => {
  await db().update(COL.groups, String(req.params.id), { status: 'disabled', updatedAt: new Date() });
  invalidateGroups();
  res.json({ ok: true });
});

// ---------------- Xabarlar ----------------

adminRouter.get('/messages', async (req, res) => {
  const { employeeId } = z.object({ employeeId: id.optional() }).parse(req.query);
  let items: WithId<StaffMessage>[];
  if (employeeId) {
    await getEmployeeScoped(req, employeeId);
    items = await db().query<StaffMessage>(COL.messages, { where: [['employeeId', '==', employeeId]], orderBy: [['createdAt', 'desc']], limit: 200 });
  } else {
    items = await db().query<StaffMessage>(COL.messages, { orderBy: [['createdAt', 'desc']], limit: 300 });
    const allowed = new Set((await scopedEmployees(req)).map((e) => e.id));
    items = items.filter((m) => allowed.has(m.employeeId));
  }
  res.json({ items });
});

adminRouter.post('/messages', async (req, res) => {
  const body = z
    .object({
      employeeIds: z.array(id).min(1).max(100),
      leadId: id.nullable().optional(),
      type: z.enum(['info', 'warning']).default('info'),
      text: z.string().trim().min(1).max(2000),
    })
    .parse(req.body);
  if (body.leadId) await getLeadScoped(req, body.leadId);
  const sent = [];
  for (const employeeId of body.employeeIds) {
    await getEmployeeScoped(req, employeeId);
    sent.push(await sendStaffMessage(req.admin!, { employeeId, text: body.text, type: body.type, leadId: body.leadId }));
  }
  res.status(201).json({ items: sent });
});

// ---------------- Faollik jurnali ----------------

adminRouter.get('/activity', async (req, res) => {
  const q = z
    .object({
      employeeId: id.optional(),
      groupId: id.optional(),
      type: z.string().max(40).optional(),
      cursor: isoDate.optional(),
      limit: z.coerce.number().min(1).max(200).default(50),
    })
    .parse(req.query);
  const where: Filter[] = [];
  if (q.employeeId) {
    await getEmployeeScoped(req, q.employeeId);
    where.push(['employeeId', '==', q.employeeId]);
  } else {
    if (q.groupId) assertGroupAccess(req.admin!, q.groupId);
    where.push(...scopeFilter(adminGroupScope(req.admin!), q.groupId));
  }
  if (q.type) where.push(['type', '==', q.type]);
  const items = await db().query<LeadEvent>(COL.events, {
    where,
    orderBy: [['createdAt', 'desc']],
    startAfter: q.cursor ? [new Date(q.cursor)] : undefined,
    limit: q.limit + 1,
  });
  const page = items.slice(0, q.limit);
  res.json({ items: page, nextCursor: items.length > q.limit ? page.at(-1)!.createdAt.toISOString() : null });
});

// ---------------- Adminlar (superadmin) ----------------

const adminBody = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[a-zA-Z0-9_.@-]+$/, 'Faqat lotin harflari, raqam va _ . - @'),
  fullName: z.string().trim().min(2).max(80),
  password: z.string().min(8).max(128),
  role: z.enum(['superadmin', 'admin']).default('admin'),
  groupIds: z.array(id).max(50).default([]),
});

adminRouter.get('/admins', requireSuperadmin, async (_req, res) => {
  const items = await db().query<Admin>(COL.admins, { orderBy: [['createdAt', 'asc']] });
  res.json({ items: items.map(publicAdmin) });
});

adminRouter.post('/admins', requireSuperadmin, async (req, res) => {
  const body = adminBody.parse(req.body);
  const lower = body.username.toLowerCase();
  const exists = await db().query<Admin>(COL.admins, { where: [['usernameLower', '==', lower]], limit: 1 });
  if (exists.length) throw conflict('Bu login band');
  const admin: Admin = {
    username: body.username,
    usernameLower: lower,
    passwordHash: await bcrypt.hash(body.password, 10),
    fullName: body.fullName,
    role: body.role,
    groupIds: body.groupIds,
    telegramId: null,
    telegramLinkToken: null,
    isActive: true,
    createdAt: new Date(),
    lastLoginAt: null,
  };
  const adminId = await db().create(COL.admins, admin);
  res.status(201).json({ admin: publicAdmin({ ...admin, id: adminId }) });
});

adminRouter.patch('/admins/:id', requireSuperadmin, async (req, res) => {
  const target = await db().get<Admin>(COL.admins, String(req.params.id));
  if (!target) throw notFound('Admin topilmadi');
  const body = adminBody.omit({ username: true }).partial().extend({ isActive: z.boolean().optional() }).parse(req.body);
  if (target.id === req.admin!.id && (body.isActive === false || body.role === 'admin')) {
    throw badRequest("O'zingizni o'chira olmaysiz yoki rolingizni pasaytira olmaysiz");
  }
  const { password, ...rest } = body;
  const patch: Partial<Admin> = { ...rest };
  if (password) patch.passwordHash = await bcrypt.hash(password, 10);
  await db().update(COL.admins, target.id, patch);
  res.json({ admin: publicAdmin({ ...target, ...patch }) });
});

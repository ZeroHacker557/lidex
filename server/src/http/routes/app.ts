// Xodim paneli (Telegram Mini App) API: /api/app/*
import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { LEAD_STATUSES, OPEN_STATUSES, type LeadStatus } from '../../../../shared/statuses.js';
import { config } from '../../config.js';
import { COL, db, type Employee, type Filter, type Group, type Lead, type LeadEvent, type RoadmapStep, type StaffMessage } from '../../db/index.js';
import { badRequest, notFound, unauthorized } from '../../lib/errors.js';
import { searchTokenFor } from '../../lib/parser.js';
import { signToken, verifyInitData, type TelegramWebAppUser } from '../../lib/security.js';
import { addDays, startOfLocalDay } from '../../lib/time.js';
import { bindEmployeeByKey, findEmployeeByTelegram, publicEmployee } from '../../services/employees.js';
import { addNote, changeStatus, getLeadOr404, markViewed, toLeadDto } from '../../services/leads.js';
import { markMessageRead } from '../../services/messages.js';
import { emitToAdmins } from '../../services/realtime.js';
import { employeeActor, requireEmployee } from '../middleware.js';

export const appRouter = Router();

// ---------------- Auth ----------------

function resolveInitData(initData: string): TelegramWebAppUser {
  if (config.DEV_AUTH && initData.startsWith('dev:')) {
    const id = Number(initData.slice(4));
    if (!id) throw unauthorized();
    return { id, first_name: 'Dev', username: `dev${id}` };
  }
  if (!config.BOT_TOKEN) throw unauthorized('Bot sozlanmagan (BOT_TOKEN)');
  const v = verifyInitData(initData, config.BOT_TOKEN);
  if (!v) throw unauthorized("Telegram ma'lumotlari tasdiqlanmadi. Panelni bot orqali qayta oching");
  return v.user;
}

function issue(emp: { id: string; telegramId: number | null }) {
  return signToken({ kind: 'employee', sub: emp.id, tg: emp.telegramId! }, '7d');
}

const authLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });

appRouter.post('/auth', authLimiter, async (req, res) => {
  const { initData } = z.object({ initData: z.string().min(1) }).parse(req.body);
  const user = resolveInitData(initData);
  const emp = await findEmployeeByTelegram(user.id);
  if (!emp || !emp.isActive) {
    res.json({ needKey: true, user: { firstName: user.first_name, username: user.username ?? null } });
    return;
  }
  // Telegram profil ma'lumotlarini yangilab boramiz
  const patch: Partial<Employee> = { lastSeenAt: new Date() };
  if (user.username !== undefined && user.username !== emp.telegramUsername) patch.telegramUsername = user.username;
  await db().update(COL.employees, emp.id, patch);
  res.json({ token: issue(emp), employee: publicEmployee({ ...emp, ...patch }) });
});

appRouter.post('/auth/key', authLimiter, async (req, res) => {
  const { initData, key } = z.object({ initData: z.string().min(1), key: z.string().min(4).max(40) }).parse(req.body);
  const user = resolveInitData(initData);
  const emp = await bindEmployeeByKey(key, {
    id: user.id,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
  });
  res.json({ token: issue(emp), employee: publicEmployee(emp) });
});

// ---------------- Quyidagilar token talab qiladi ----------------
appRouter.use(requireEmployee);

async function markProgress(req: Request, step: RoadmapStep) {
  const emp = req.employee!;
  if (emp.progress?.[step]) return;
  await db().update(COL.employees, emp.id, { progress: { ...(emp.progress ?? {}), [step]: new Date() } });
}

appRouter.get('/me', async (req, res) => {
  const emp = req.employee!;
  const groups = await db().getMany<Group>(COL.groups, emp.groupIds);
  await db().update(COL.employees, emp.id, { lastSeenAt: new Date() });
  res.json({
    employee: publicEmployee(emp),
    groups: groups.map((g) => ({ id: g.id, title: g.title, slaMinutes: g.settings.slaMinutes, postponeIntervalDays: g.settings.postponeIntervalDays })),
  });
});

appRouter.patch('/me', async (req, res) => {
  const body = z.object({ acceptingLeads: z.boolean().optional(), onboardingDone: z.boolean().optional() }).parse(req.body);
  await db().update(COL.employees, req.employee!.id, body);
  emitToAdmins(req.employee!.groupIds[0] ?? null, 'employee:updated', { id: req.employee!.id });
  res.json({ ok: true });
});

appRouter.get('/summary', async (req, res) => {
  const id = req.employee!.id;
  const base: Filter = ['assignedEmployeeId', '==', id];
  const endOfDay = addDays(startOfLocalDay(), 1);
  const [counts, dueToday, unread] = await Promise.all([
    Promise.all(LEAD_STATUSES.map((s) => db().count(COL.leads, { where: [base, ['status', '==', s]] }))),
    db().count(COL.leads, {
      where: [base, ['status', 'in', ['postponed', 'no_answer']], ['nextReminderAt', '<', endOfDay]],
    }),
    db().count(COL.messages, { where: [['employeeId', '==', id], ['readAt', '==', null]] }),
  ]);
  const byStatus = Object.fromEntries(LEAD_STATUSES.map((s, i) => [s, counts[i]])) as Record<LeadStatus, number>;
  res.json({
    byStatus,
    active: OPEN_STATUSES.reduce((a, s) => a + byStatus[s], 0),
    total: counts.reduce((a, b) => a + b, 0),
    dueToday,
    unreadMessages: unread,
  });
});

const listQuery = z.object({
  tab: z.enum(['active', 'all', ...LEAD_STATUSES]).default('active'),
  q: z.string().max(60).optional(),
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(50).default(25),
});

appRouter.get('/leads', async (req, res) => {
  const { tab, q, cursor, limit } = listQuery.parse(req.query);
  const where: Filter[] = [['assignedEmployeeId', '==', req.employee!.id]];
  if (tab === 'active') where.push(['status', 'in', OPEN_STATUSES]);
  else if (tab !== 'all') where.push(['status', '==', tab]);
  const token = q ? searchTokenFor(q) : null;
  if (token) where.push(['searchTokens', 'array-contains', token]);
  const leads = await db().query<Lead>(COL.leads, {
    where,
    orderBy: [['createdAt', 'desc']],
    startAfter: cursor ? [new Date(cursor)] : undefined,
    limit: limit + 1,
  });
  const page = leads.slice(0, limit);
  res.json({
    items: page.map(toLeadDto),
    nextCursor: leads.length > limit ? page.at(-1)!.createdAt.toISOString() : null,
  });
});

appRouter.get('/reminders', async (req, res) => {
  const leads = await db().query<Lead>(COL.leads, {
    where: [
      ['assignedEmployeeId', '==', req.employee!.id],
      ['status', 'in', ['postponed', 'no_answer']],
    ],
    orderBy: [['nextReminderAt', 'asc']],
    limit: 200,
  });
  res.json({ items: leads.map(toLeadDto) });
});

appRouter.get('/leads/:id', async (req, res) => {
  const lead = await getLeadOr404(req.params.id!);
  if (lead.assignedEmployeeId !== req.employee!.id) throw notFound('Lid topilmadi');
  await markViewed(lead, employeeActor(req));
  const [events, messages] = await Promise.all([
    db().query<LeadEvent>(COL.events, { where: [['leadId', '==', lead.id]], orderBy: [['createdAt', 'asc']], limit: 200 }),
    db().query<StaffMessage>(COL.messages, {
      where: [
        ['employeeId', '==', req.employee!.id],
        ['leadId', '==', lead.id],
      ],
      orderBy: [['createdAt', 'desc']],
      limit: 20,
    }),
  ]);
  res.json({ lead: toLeadDto(lead), events, messages });
});

const statusBody = z.object({
  status: z.enum(LEAD_STATUSES),
  postponedUntil: z.string().datetime({ offset: true }).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
});

appRouter.post('/leads/:id/status', async (req, res) => {
  const body = statusBody.parse(req.body);
  if (body.status === 'new') throw badRequest('Lidni "Yangi" holatiga qaytarib bo\'lmaydi');
  const lead = await changeStatus(req.params.id!, employeeActor(req), {
    status: body.status,
    postponedUntil: body.postponedUntil ? new Date(body.postponedUntil) : null,
    note: body.note,
  });
  await markProgress(req, 'firstStatus');
  if (body.status === 'postponed') await markProgress(req, 'firstPostpone');
  if (body.note) await markProgress(req, 'firstNote');
  res.json({ lead: toLeadDto(lead) });
});

appRouter.post('/leads/:id/notes', async (req, res) => {
  const { text } = z.object({ text: z.string().min(1).max(1000) }).parse(req.body);
  const lead = await addNote(req.params.id!, employeeActor(req), text);
  await markProgress(req, 'firstNote');
  res.json({ lead: toLeadDto(lead) });
});

appRouter.get('/messages', async (req, res) => {
  const items = await db().query<StaffMessage>(COL.messages, {
    where: [['employeeId', '==', req.employee!.id]],
    orderBy: [['createdAt', 'desc']],
    limit: 100,
  });
  res.json({ items });
});

appRouter.post('/messages/:id/read', async (req, res) => {
  const m = await markMessageRead(req.employee!.id, req.params.id!);
  await markProgress(req, 'firstMessageRead');
  res.json({ message: m });
});

appRouter.post('/messages/:id/ack', async (req, res) => {
  const { replyText } = z.object({ replyText: z.string().max(1000).nullable().optional() }).parse(req.body ?? {});
  const m = await markMessageRead(req.employee!.id, req.params.id!, { replyText });
  await markProgress(req, 'firstMessageRead');
  res.json({ message: m });
});

appRouter.get('/stats', async (req, res) => {
  const { period } = z.object({ period: z.enum(['today', 'week', 'month']).default('today') }).parse(req.query);
  const start = startOfLocalDay();
  const from = period === 'today' ? start : addDays(start, period === 'week' ? -6 : -29);
  const base: Filter[] = [
    ['assignedEmployeeId', '==', req.employee!.id],
    ['createdAt', '>=', from],
  ];
  const [counts, response] = await Promise.all([
    Promise.all(LEAD_STATUSES.map((s) => db().count(COL.leads, { where: [...base, ['status', '==', s]] }))),
    // Firestore average() son bo'lmagan (null) qiymatlarni hisobga olmaydi
    db().aggregate(COL.leads, { where: base }, { avg: 'responseSeconds' }),
  ]);
  const byStatus = Object.fromEntries(LEAD_STATUSES.map((s, i) => [s, counts[i]]));
  const total = counts.reduce((a, b) => a + b, 0);
  res.json({
    period,
    total,
    byStatus,
    conversion: total ? Math.round(((byStatus.success ?? 0) / total) * 100) : 0,
    avgResponseSeconds: response.avg,
  });
});

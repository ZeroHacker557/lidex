// Fon vazifalari (har daqiqada):
//  1. Eslatmalar — "Keyinga qoldirildi" (sana bilan / har N kunda) va "Ko'tarmadi" (N soatdan keyin)
//  2. SLA — yangi lidga belgilangan vaqtda javob berilmasa xodimni, 3 barobar kechiksa adminlarni ogohlantirish
//  3. Ertalabki dayjest — xodimga bugungi rejalar, adminlarga kechagi hisobot

import { config } from '../config.js';
import { COL, db, type Employee, type Group, type Lead, type WithId } from '../db/index.js';
import { addDays, addHours, addMinutes, isQuietHours, localDateKey, localParts, shiftOutOfQuietHours, startOfLocalDay } from '../lib/time.js';
import { logger } from '../logger.js';
import { logEvent, SYSTEM } from '../services/events.js';
import { allGroups } from '../services/groups.js';
import { processPendingInbox } from '../services/inbox.js';
import { syncHistory } from '../userbot/history.js';
import { toLeadDto } from '../services/leads.js';
import { escalationText, notifyAdmins, notifyEmployeePlain, notifyReminder, notifySla } from '../services/notify.js';
import { emitToAdmins, emitToEmployee } from '../services/realtime.js';
import { panelKeyboard } from '../bot/texts.js';

let timer: NodeJS.Timeout | null = null;
let running = false;

class EmployeeCache {
  private map = new Map<string, WithId<Employee> | null>();
  async get(id: string | null): Promise<WithId<Employee> | null> {
    if (!id) return null;
    if (!this.map.has(id)) this.map.set(id, await db().get<Employee>(COL.employees, id));
    return this.map.get(id) ?? null;
  }
}

async function groupMap(): Promise<Map<string, WithId<Group>>> {
  return new Map((await allGroups()).map((g) => [g.id, g]));
}

export async function processReminders(now = new Date()) {
  const due = await db().query<Lead>(COL.leads, {
    where: [['nextReminderAt', '<=', now]],
    orderBy: [['nextReminderAt', 'asc']],
    limit: 200,
  });
  if (!due.length) return 0;
  const groups = await groupMap();
  const employees = new EmployeeCache();
  let sent = 0;

  for (const lead of due) {
    const group = groups.get(lead.groupId);
    if ((lead.status !== 'postponed' && lead.status !== 'no_answer') || !group) {
      await db().update(COL.leads, lead.id, { nextReminderAt: null });
      continue;
    }
    const s = group.settings;
    const count = (lead.reminderCount ?? 0) + 1;
    let next: Date;
    if (lead.status === 'postponed') {
      // Sana bilan: o'sha kuni eslatiladi, keyin ham ishlanmasa — har kuni; sanasiz: har N kunda
      next = lead.postponedUntil ? addDays(now, 1) : addDays(now, s.postponeIntervalDays);
    } else {
      next = count >= 3 ? addDays(now, 1) : addHours(now, s.noAnswerRetryHours);
    }
    next = shiftOutOfQuietHours(next);
    // Avval yangilaymiz — qayta ishga tushganda takroriy yuborilmasligi uchun
    await db().update(COL.leads, lead.id, { nextReminderAt: next, reminderCount: count });
    const updated = { ...lead, nextReminderAt: next, reminderCount: count };

    const emp = await employees.get(lead.assignedEmployeeId);
    if (emp?.isActive) {
      await notifyReminder(emp, updated);
      sent++;
    }
    await logEvent(updated, SYSTEM, 'reminder_sent', { meta: { count, next: next.toISOString() } });
    const dto = toLeadDto(updated);
    emitToEmployee(lead.assignedEmployeeId, 'lead:updated', dto);
    emitToAdmins(lead.groupId, 'lead:updated', dto);
  }
  if (sent) logger.info({ sent }, 'Eslatmalar yuborildi');
  return sent;
}

export async function processSla(now = new Date()) {
  if (isQuietHours(now)) return;
  const groups = await groupMap();
  const activeGroups = [...groups.values()].filter((g) => g.status === 'active');
  if (!activeGroups.length) return;
  const minSla = Math.min(...activeGroups.map((g) => g.settings.slaMinutes));
  const employees = new EmployeeCache();

  // 1) Xodimni ogohlantirish
  const late = await db().query<Lead>(COL.leads, {
    where: [
      ['status', '==', 'new'],
      ['slaNotifiedAt', '==', null],
      ['createdAt', '<=', addMinutes(now, -minSla)],
    ],
    orderBy: [['createdAt', 'desc']],
    limit: 200,
  });
  for (const lead of late) {
    const g = groups.get(lead.groupId);
    if (!g) continue;
    // Tunda kelgan lid uchun hisob ish boshlanishidan
    const start = shiftOutOfQuietHours(lead.createdAt);
    if (addMinutes(start, g.settings.slaMinutes) > now) continue;
    await db().update(COL.leads, lead.id, { slaNotifiedAt: now });
    const emp = await employees.get(lead.assignedEmployeeId);
    if (emp?.isActive) await notifySla(emp, lead);
    await logEvent(lead, SYSTEM, 'sla_warning', { meta: { slaMinutes: g.settings.slaMinutes } });
  }

  // 2) Adminlarga eskalatsiya (SLA x3)
  const veryLate = await db().query<Lead>(COL.leads, {
    where: [
      ['status', '==', 'new'],
      ['escalatedAt', '==', null],
      ['createdAt', '<=', addMinutes(now, -minSla * 3)],
    ],
    orderBy: [['createdAt', 'desc']],
    limit: 100,
  });
  for (const lead of veryLate) {
    const g = groups.get(lead.groupId);
    if (!g) continue;
    const start = shiftOutOfQuietHours(lead.createdAt);
    if (addMinutes(start, g.settings.slaMinutes * 3) > now) continue;
    await db().update(COL.leads, lead.id, { escalatedAt: now });
    const emp = await employees.get(lead.assignedEmployeeId);
    await logEvent(lead, SYSTEM, 'escalated', { meta: { employee: emp?.fullName ?? null } });
    emitToAdmins(lead.groupId, 'alert', {
      kind: 'sla',
      leadId: lead.id,
      text: `Lid #${lead.seq} (${emp?.fullName ?? 'biriktirilmagan'}) uzoq vaqtdan beri javobsiz`,
    });
    emitToAdmins(lead.groupId, 'lead:updated', toLeadDto({ ...lead, escalatedAt: now }));
    await notifyAdmins(lead.groupId, escalationText(lead, emp?.fullName ?? null));
  }
}

export async function processDigest(now = new Date()) {
  const p = localParts(now);
  if (p.hour !== config.REMINDER_HOUR || p.minute > 30) return;
  const today = localDateKey(now);
  const endOfDay = addDays(startOfLocalDay(now), 1);
  const employees = await db().query<Employee>(COL.employees, { where: [['isActive', '==', true]] });

  for (const emp of employees) {
    if (!emp.telegramId || emp.lastDigestDate === today) continue;
    await db().update(COL.employees, emp.id, { lastDigestDate: today });
    const base = [['assignedEmployeeId', '==', emp.id]] as const;
    const [reminders, fresh] = await Promise.all([
      db().count(COL.leads, {
        where: [...base, ['status', 'in', ['postponed', 'no_answer']], ['nextReminderAt', '<', endOfDay]],
      }),
      db().count(COL.leads, { where: [...base, ['status', '==', 'new']] }),
    ]);
    if (!reminders && !fresh) continue;
    await notifyEmployeePlain(
      emp,
      `☀️ <b>Xayrli tong, ${emp.fullName.split(' ')[0]}!</b>\n\nBugungi reja:\n` +
        `⏰ Qo'ng'iroq qilish kerak (eslatmalar): <b>${reminders}</b>\n` +
        `🆕 Javob berilmagan yangi lidlar: <b>${fresh}</b>\n\nOmad! 💪`,
      panelKeyboard(),
    );
  }

  // Adminlarga kechagi hisobot (bir marta)
  const marker = await db().get<{ date: string }>(COL.counters, 'adminDigest');
  if (marker?.date === today) return;
  await db().set(COL.counters, 'adminDigest', { date: today });
  const from = addDays(startOfLocalDay(now), -1);
  const to = startOfLocalDay(now);
  const range = [
    ['createdAt', '>=', from],
    ['createdAt', '<', to],
  ] as const;
  const [total, success, rejected, cancelled, open] = await Promise.all([
    db().count(COL.leads, { where: [...range] }),
    db().count(COL.leads, { where: [...range, ['status', '==', 'success']] }),
    db().count(COL.leads, { where: [...range, ['status', '==', 'rejected']] }),
    db().count(COL.leads, { where: [...range, ['status', '==', 'cancelled']] }),
    db().count(COL.leads, { where: [...range, ['status', 'in', ['new', 'no_answer', 'postponed']]] }),
  ]);
  if (!total) return;
  const conv = Math.round((success / total) * 100);
  await notifyAdmins(
    null,
    `📊 <b>Kechagi hisobot</b>\n\nJami lidlar: <b>${total}</b>\n🟢 HA dedi: <b>${success}</b> (${conv}%)\n🟠 YO'Q dedi: <b>${rejected}</b>\n🔴 Bekor: <b>${cancelled}</b>\n⏳ Hali ochiq: <b>${open}</b>`,
  );
}

/** Bitta tsikl: eslatmalar, SLA, dayjest. Serverless'da /api/cron/tick orqali chaqiriladi */
export async function runTick() {
  const startedAt = Date.now();
  // Userbot: guruh tarixidan yangi xabarlarni o'qish (boshqa botlar yuborgan lidlar ham)
  const history = await syncHistory().catch((err) => {
    logger.error({ err: (err as Error).message }, "Userbot tarixini o'qishda xato");
    return null;
  });
  // Avval qolib ketgan guruh xabarlari (internet uzilishi va h.k.) — lid yo'qolmasin
  const recovered = await processPendingInbox().catch((err) => {
    logger.error({ err: (err as Error).message }, 'Inbox qayta ishlashda xato');
    return 0;
  });
  const reminders = await processReminders();
  await processSla();
  await processDigest();
  return { history: history?.messages ?? null, recovered, reminders, ms: Date.now() - startedAt };
}

async function tick() {
  if (running) return;
  running = true;
  try {
    await runTick();
  } catch (err) {
    logger.error({ err }, 'Scheduler xatosi');
  } finally {
    running = false;
  }
}

export function startScheduler() {
  if (timer) return;
  timer = setInterval(tick, config.SCHEDULER_INTERVAL_SEC * 1000);
  setTimeout(tick, 5_000);
  logger.info({ everySec: config.SCHEDULER_INTERVAL_SEC }, 'Scheduler ishga tushdi');
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

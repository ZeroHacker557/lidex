import { GrammyError, type InlineKeyboard } from 'grammy';
import { bot } from '../bot/instance.js';
import { esc, leadCard, leadKeyboard, staffMessageKeyboard, staffMessageText } from '../bot/texts.js';
import { COL, db, type Admin, type Employee, type Lead, type StaffMessage, type WithId } from '../db/index.js';
import { logger } from '../logger.js';
import { formatDuration, formatLocal } from '../lib/time.js';

interface SendOpts {
  keyboard?: InlineKeyboard;
  silent?: boolean;
}

/** Telegramga xabar yuborish. Muvaffaqiyatli bo'lsa message_id qaytaradi. */
export async function sendTelegram(chatId: number, html: string, opts: SendOpts = {}): Promise<number | null> {
  if (!bot) {
    logger.debug({ chatId, text: html.slice(0, 80) }, '[bot o\'chirilgan] xabar yuborilmadi');
    return null;
  }
  try {
    const msg = await bot.api.sendMessage(chatId, html, {
      parse_mode: 'HTML',
      reply_markup: opts.keyboard,
      disable_notification: opts.silent,
      link_preview_options: { is_disabled: true },
    });
    return msg.message_id;
  } catch (err) {
    if (err instanceof GrammyError && (err.error_code === 403 || err.description.includes('chat not found'))) {
      throw Object.assign(new Error('BOT_BLOCKED'), { blocked: true });
    }
    logger.warn({ err: err instanceof Error ? err.message : err, chatId }, 'Telegram xabar yuborishda xato');
    return null;
  }
}

async function toEmployee(emp: WithId<Employee>, html: string, opts: SendOpts = {}): Promise<number | null> {
  if (!emp.telegramId) return null;
  try {
    const id = await sendTelegram(emp.telegramId, html, opts);
    if (id && emp.botBlocked) await db().update(COL.employees, emp.id, { botBlocked: false });
    return id;
  } catch (err) {
    if ((err as { blocked?: boolean }).blocked && !emp.botBlocked) {
      logger.warn({ employee: emp.fullName }, 'Xodim botni bloklagan');
      await db().update(COL.employees, emp.id, { botBlocked: true });
    }
    return null;
  }
}

export async function notifyNewLead(emp: WithId<Employee>, lead: WithId<Lead>) {
  const title = lead.isDuplicate ? '♻️ Takroriy lid' : '🆕 Yangi lid';
  return toEmployee(emp, leadCard(lead, title), { keyboard: leadKeyboard(lead) });
}

export async function notifyReassigned(emp: WithId<Employee>, lead: WithId<Lead>) {
  return toEmployee(emp, leadCard(lead, '🔁 Sizga lid o\'tkazildi'), { keyboard: leadKeyboard(lead) });
}

export async function notifyReminder(emp: WithId<Employee>, lead: WithId<Lead>) {
  const title =
    lead.status === 'postponed'
      ? lead.postponedUntil
        ? `⏰ Eslatma: bugun qo'ng'iroq qilish kerak`
        : `⏰ Eslatma: keyinga qoldirilgan lid`
      : `⏰ Qayta qo'ng'iroq qiling (avval ko'tarmagan)`;
  return toEmployee(emp, leadCard(lead, title), { keyboard: leadKeyboard(lead) });
}

export async function notifySla(emp: WithId<Employee>, lead: WithId<Lead>) {
  const waited = formatDuration((Date.now() - lead.createdAt.getTime()) / 1000);
  return toEmployee(emp, leadCard(lead, `⚠️ <b>${esc(waited)}</b> dan beri javobsiz lid`), {
    keyboard: leadKeyboard(lead),
  });
}

export async function notifyStaffMessage(emp: WithId<Employee>, message: WithId<StaffMessage>) {
  return toEmployee(emp, staffMessageText(message), { keyboard: staffMessageKeyboard(message.id, message.leadId) });
}

export async function notifyEmployeePlain(emp: WithId<Employee>, html: string, keyboard?: InlineKeyboard) {
  return toEmployee(emp, html, { keyboard });
}

/** Telegram ulagan adminlarga: superadminlar + shu guruh adminlari (groupId=null — faqat superadminlar) */
export async function notifyAdmins(groupId: string | null, html: string) {
  if (!bot) return;
  const admins = await db().query<Admin>(COL.admins, { where: [['isActive', '==', true]] });
  for (const a of admins) {
    if (!a.telegramId) continue;
    if (a.role !== 'superadmin' && (!groupId || !a.groupIds.includes(groupId))) continue;
    try {
      await sendTelegram(a.telegramId, html);
    } catch {
      /* admin botni bloklagan */
    }
  }
}

export function escalationText(lead: WithId<Lead>, employeeName: string | null): string {
  const waited = formatDuration((Date.now() - lead.createdAt.getTime()) / 1000);
  return (
    `🚨 <b>Kechikayotgan lid #${lead.seq}</b>\n\n` +
    `👤 ${esc(lead.name ?? "Ism ko'rsatilmagan")}\n` +
    `👨‍💼 Xodim: <b>${esc(employeeName ?? 'biriktirilmagan')}</b>\n` +
    `🗂 ${esc(lead.groupTitle)} · 🕒 ${formatLocal(lead.createdAt)}\n` +
    `⏱ ${esc(waited)} dan beri javob berilmagan`
  );
}

import { InlineKeyboard } from 'grammy';
import { STATUS_META, type LeadStatus } from '../../../shared/statuses.js';
import { webAppAvailable, webAppUrl } from '../config.js';
import type { Lead, StaffMessage, WithId } from '../db/index.js';
import { formatPhone } from '../lib/phone.js';
import { formatLocal } from '../lib/time.js';

export const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function leadCard(lead: WithId<Lead>, title: string): string {
  const lines = [`${title} <b>#${lead.seq}</b>`, ''];
  lines.push(`👤 <b>${esc(lead.name ?? "Ism ko'rsatilmagan")}</b>`);
  if (lead.phone) lines.push(`📞 ${esc(formatPhone(lead.phone))}`);
  for (const p of lead.phones.filter((x) => x !== lead.phone).slice(0, 2)) lines.push(`📞 ${esc(formatPhone(p))}`);
  if (lead.telegramUsername) lines.push(`✈️ @${esc(lead.telegramUsername)}`);
  for (const f of lead.fields.slice(0, 6)) lines.push(`▫️ ${esc(f.key)}: ${esc(f.value.slice(0, 200))}`);
  lines.push('');
  lines.push(`🗂 ${esc(lead.groupTitle)}  ·  🕒 ${formatLocal(lead.createdAt)}`);
  if (lead.isDuplicate) lines.push('♻️ <i>Bu raqam avval ham murojaat qilgan</i>');
  const meta = STATUS_META[lead.status];
  if (lead.status !== 'new') lines.push(`${meta.emoji} Status: <b>${esc(meta.label)}</b>`);
  if (lead.status === 'postponed' && lead.postponedUntil) lines.push(`📅 Eslatma: ${formatLocal(lead.postponedUntil)}`);
  return lines.join('\n');
}

/** callback_data: st:<leadId>:<kod> (64 baytdan oshmasligi kerak) */
export const STATUS_CODES: Record<string, { status: LeadStatus; postpone?: 'tomorrow' | 'nodate' }> = {
  s: { status: 'success' },
  r: { status: 'rejected' },
  n: { status: 'no_answer' },
  c: { status: 'cancelled' },
  pt: { status: 'postponed', postpone: 'tomorrow' },
  pn: { status: 'postponed', postpone: 'nodate' },
};

export function leadUrl(leadId: string) {
  return `${webAppUrl}/lead/${encodeURIComponent(leadId)}`;
}

export function leadKeyboard(lead: WithId<Lead>, opts: { quick?: boolean } = {}): InlineKeyboard {
  const kb = new InlineKeyboard();
  const quick = opts.quick ?? !STATUS_META[lead.status].final;
  // Asosiy tugma — ilovada lidni ochish (eng tepada)
  if (webAppAvailable) kb.webApp('📲 Ilovani ochish', leadUrl(lead.id)).row();
  if (quick) {
    kb.text('🟢 HA dedi', `st:${lead.id}:s`).text("🟠 YO'Q dedi", `st:${lead.id}:r`).row();
    kb.text("⚪️ Ko'tarmadi", `st:${lead.id}:n`).text('🔴 Bekor', `st:${lead.id}:c`).row();
    kb.text('🟡 Ertaga', `st:${lead.id}:pt`).text('🟡 Keyinga (sanasiz)', `st:${lead.id}:pn`).row();
  }
  return kb;
}

export function panelKeyboard(): InlineKeyboard | undefined {
  return webAppAvailable ? new InlineKeyboard().webApp('📋 Panelni ochish', `${webAppUrl}/`) : undefined;
}

export function staffMessageText(m: StaffMessage): string {
  const head = m.type === 'warning' ? '⚠️ <b>Ogohlantirish</b>' : '✉️ <b>Xabar</b>';
  const lines = [`${head} — ${esc(m.adminName)}`, '', esc(m.text)];
  if (m.leadSeq) lines.push('', `📎 Lid: <b>#${m.leadSeq}</b> ${esc(m.leadName ?? '')}`);
  return lines.join('\n');
}

export function staffMessageKeyboard(messageId: string, leadId: string | null): InlineKeyboard {
  const kb = new InlineKeyboard().text('✅ Tushundim', `ack:${messageId}`);
  if (leadId && webAppAvailable) kb.row().webApp('📎 Lidni ochish', leadUrl(leadId));
  return kb;
}

export const TEXT = {
  askKey:
    "👋 Assalomu alaykum! <b>Lidex</b> — lidlar bilan ishlash paneli.\n\n" +
    "Davom etish uchun rahbaringiz bergan <b>kirish kalitini</b> yuboring.\nMasalan: <code>LX-7KQ2-M9TD</code>",
  keyInvalid: "❌ Kalit noto'g'ri yoki faol emas. Tekshirib, qayta yuboring yoki rahbaringizga murojaat qiling.",
  keyUsed: '⛔️ Bu kalit boshqa Telegram akkauntga biriktirilgan. Rahbaringizdan yangi kalit so\'rang.',
  tooManyAttempts: '⏳ Juda ko\'p urinish. 10 daqiqadan keyin qayta urinib ko\'ring.',
  welcome: (name: string) =>
    `✅ Xush kelibsiz, <b>${esc(name)}</b>!\n\n` +
    'Endi sizga biriktirilgan lidlar shu yerga bildirishnoma bo\'lib keladi va panelda ko\'rinadi.\n\n' +
    '📌 <b>Muhim:</b> botni ovozsiz (mute) qilmang — eslatmalar va ogohlantirishlar shu yerga keladi.',
  help:
    '<b>Lidex — qisqa qo\'llanma</b>\n\n' +
    '1️⃣ Yangi lid kelganda bot xabar yuboradi.\n' +
    "2️⃣ Mijozga qo'ng'iroq qiling va statusni belgilang:\n" +
    '   🟢 HA dedi · 🟠 YO\'Q dedi · ⚪️ Ko\'tarmadi\n   🟡 Keyinga qoldirildi · 🔴 Bekor qilindi\n' +
    "3️⃣ \"Keyinga\" — sana tanlasangiz o'sha kuni, sanasiz bo'lsa har 2 kunda eslataman.\n" +
    "4️⃣ Yakunlangan lid statusini panelda <b>Tahrirlash</b> orqali o'zgartirish mumkin.\n" +
    '5️⃣ Yangi lidga imkon qadar tez (15 daqiqa ichida) javob bering — rahbarlar kechikishni ko\'radi.\n\n' +
    'Buyruqlar: /panel — panel, /stats — bugungi natijalar, /help — yordam',
};

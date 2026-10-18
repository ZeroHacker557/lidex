import { hostname } from 'node:os';
import { GrammyError, HttpError as GrammyHttpError, type Context } from 'grammy';
import type { Message } from 'grammy/types';
import { STATUS_META } from '../../../shared/statuses.js';
import { config, webAppAvailable, webAppUrl } from '../config.js';
import { COL, db, type Admin, type StaffMessage } from '../db/index.js';
import { looksLikeAccessKey } from '../lib/security.js';
import { startOfLocalDay } from '../lib/time.js';
import { logger } from '../logger.js';
import { bindEmployeeByKey, findEmployeeByTelegram, KeyError } from '../services/employees.js';
import { groupByChatId, migrateChat, registerChat } from '../services/groups.js';
import { changeStatus, ingestLead, tomorrowAtReminderHour } from '../services/leads.js';
import { markMessageRead } from '../services/messages.js';
import { bot, botInfo } from './instance.js';
import { esc, leadCard, leadKeyboard, panelKeyboard, STATUS_CODES, TEXT } from './texts.js';

const isGroupChat = (ctx: Context) => ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

/** Xabardan lid matnini olish (matn, rasm izohi, kontakt) */
function messageText(msg: Message): string {
  const parts: string[] = [];
  if (msg.text) parts.push(msg.text);
  if (msg.caption) parts.push(msg.caption);
  if (msg.contact) {
    const c = msg.contact;
    parts.push(`Ism: ${[c.first_name, c.last_name].filter(Boolean).join(' ')}`, `Telefon: ${c.phone_number}`);
  }
  return parts.join('\n').trim();
}

async function handleChatMessage(ctx: Context, msg: Message) {
  const chat = msg.chat;
  if (msg.from?.id === ctx.me.id) return;
  const text = messageText(msg);
  if (!text || text.startsWith('/')) return;

  let group = await groupByChatId(chat.id);
  if (!group) group = await registerChat({ id: chat.id, title: 'title' in chat ? chat.title : undefined, type: chat.type });
  if (group.status !== 'active') return;
  if (group.settings.ingestVia === 'userbot' && config.USERBOT_ENABLED) return; // userbot o'qiydi

  await ingestLead({
    group,
    source: 'telegram',
    text,
    chatId: chat.id,
    messageId: msg.message_id,
    telegramUsername: msg.forward_origin?.type === 'user' ? (msg.forward_origin.sender_user.username ?? null) : null,
  });
}

async function sendPanel(ctx: Context, greeting?: string) {
  const kb = panelKeyboard();
  await ctx.reply(
    (greeting ?? '📋 Lidlar paneli') + (kb ? '' : `\n\n<i>Panel manzili: ${esc(webAppUrl)} (HTTPS sozlanmagan)</i>`),
    { parse_mode: 'HTML', reply_markup: kb },
  );
}

async function tryBindAdmin(ctx: Context, token: string): Promise<boolean> {
  const [admin] = await db().query<Admin>(COL.admins, { where: [['telegramLinkToken', '==', token]], limit: 1 });
  if (!admin || !ctx.from) return false;
  await db().update(COL.admins, admin.id, { telegramId: ctx.from.id, telegramLinkToken: null });
  await ctx.reply(
    `✅ <b>${esc(admin.fullName)}</b>, Telegram akkauntingiz admin profilga ulandi.\nEndi kechikayotgan lidlar va muhim ogohlantirishlar shu yerga keladi.`,
    { parse_mode: 'HTML' },
  );
  return true;
}

async function tryBindKey(ctx: Context, key: string) {
  if (!ctx.from) return;
  try {
    const emp = await bindEmployeeByKey(key, {
      id: ctx.from.id,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
    });
    await sendPanel(ctx, TEXT.welcome(emp.fullName));
  } catch (err) {
    if (err instanceof KeyError) {
      const text = err.reason === 'rate' ? TEXT.tooManyAttempts : err.reason === 'invalid' ? TEXT.keyInvalid : `⛔️ ${esc(err.message)}`;
      await ctx.reply(text, { parse_mode: 'HTML' });
    } else throw err;
  }
}

export function setupBot() {
  if (!bot) return;

  bot.catch((err) => {
    const e = err.error;
    if (e instanceof GrammyError) logger.error({ desc: e.description }, 'Bot: Telegram API xatosi');
    else if (e instanceof GrammyHttpError) logger.error({ err: e.message }, 'Bot: tarmoq xatosi');
    else logger.error({ err: e }, 'Bot: handler xatosi');
  });

  // ---------- Guruhlar ----------
  bot.on('my_chat_member', async (ctx) => {
    const chat = ctx.chat;
    if (chat.type === 'private') return;
    const status = ctx.myChatMember.new_chat_member.status;
    const member = status === 'member' || status === 'administrator';
    await registerChat({ id: chat.id, title: 'title' in chat ? chat.title : undefined, type: chat.type }, member);
    if (member && chat.type !== 'channel') {
      await ctx
        .reply(
          '👋 Lidex boti guruhga qo\'shildi.\n\nAdmin panelda ushbu guruhni <b>faollashtiring</b> va xodimlarni biriktiring. ' +
            'Shundan so\'ng guruhga tushgan har bir lid avtomatik xodimga yuboriladi.',
          { parse_mode: 'HTML' },
        )
        .catch(() => undefined);
    }
  });

  bot.on('message:migrate_to_chat_id', async (ctx) => {
    await migrateChat(ctx.chat.id, ctx.message.migrate_to_chat_id);
  });

  bot.command('chatid', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply(`Sizning Telegram ID: <code>${ctx.from?.id}</code>`, { parse_mode: 'HTML' });
    const g = await groupByChatId(ctx.chat.id);
    await ctx.reply(
      `Chat ID: <code>${ctx.chat.id}</code>\nHolat: <b>${g ? (g.status === 'active' ? 'faol ✅' : g.status === 'pending' ? 'tasdiqlash kutilmoqda ⏳' : "o'chirilgan") : "ro'yxatda yo'q"}</b>`,
      { parse_mode: 'HTML' },
    );
  });

  bot.on('channel_post', async (ctx) => {
    const post = ctx.channelPost;
    const text = messageText(post);
    if (!text) return;
    let group = await groupByChatId(post.chat.id);
    if (!group) group = await registerChat({ id: post.chat.id, title: post.chat.title, type: 'channel' });
    if (group.status !== 'active') return;
    await ingestLead({ group, source: 'telegram', text, chatId: post.chat.id, messageId: post.message_id });
  });

  bot.on('message', async (ctx, next) => {
    if (isGroupChat(ctx)) return handleChatMessage(ctx, ctx.message);
    return next();
  });

  // ---------- Shaxsiy chat (xodimlar) ----------
  const privateChat = bot.chatType('private');

  privateChat.command('start', async (ctx) => {
    const payload = ctx.match?.trim();
    if (payload?.startsWith('adm_') && (await tryBindAdmin(ctx, payload.slice(4)))) return;

    const emp = await findEmployeeByTelegram(ctx.from.id);
    if (emp?.isActive) return sendPanel(ctx, `👋 Salom, <b>${esc(emp.fullName)}</b>!`);
    if (payload && looksLikeAccessKey(payload)) return tryBindKey(ctx, payload);
    await ctx.reply(TEXT.askKey, { parse_mode: 'HTML' });
  });

  privateChat.command('panel', async (ctx) => {
    const emp = await findEmployeeByTelegram(ctx.from.id);
    if (!emp?.isActive) return ctx.reply(TEXT.askKey, { parse_mode: 'HTML' });
    await sendPanel(ctx);
  });

  privateChat.command('help', (ctx) => ctx.reply(TEXT.help, { parse_mode: 'HTML', reply_markup: panelKeyboard() }));

  privateChat.command('stats', async (ctx) => {
    const emp = await findEmployeeByTelegram(ctx.from.id);
    if (!emp?.isActive) return ctx.reply(TEXT.askKey, { parse_mode: 'HTML' });
    const since = startOfLocalDay();
    const base = [['assignedEmployeeId', '==', emp.id]] as const;
    const [today, open, success] = await Promise.all([
      db().count(COL.leads, { where: [...base, ['createdAt', '>=', since]] }),
      db().count(COL.leads, { where: [...base, ['status', 'in', ['new', 'no_answer', 'postponed']]] }),
      db().count(COL.leads, { where: [...base, ['status', '==', 'success'], ['createdAt', '>=', since]] }),
    ]);
    await ctx.reply(
      `📊 <b>Bugungi natijalar</b>\n\n🆕 Bugun kelgan lidlar: <b>${today}</b>\n🟢 Ulardan HA dedi: <b>${success}</b>\n⏳ Ochiq (ishlash kerak): <b>${open}</b>`,
      { parse_mode: 'HTML', reply_markup: panelKeyboard() },
    );
  });

  privateChat.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim();
    const emp = await findEmployeeByTelegram(ctx.from.id);
    if (emp?.isActive) {
      if (looksLikeAccessKey(text)) return ctx.reply('✅ Siz allaqachon tizimga ulangansiz.', { reply_markup: panelKeyboard() });
      return ctx.reply("Lidlar bilan ishlash uchun panelni oching 👇\nYordam: /help", { reply_markup: panelKeyboard() });
    }
    if (looksLikeAccessKey(text)) return tryBindKey(ctx, text);
    await ctx.reply(TEXT.askKey, { parse_mode: 'HTML' });
  });

  // ---------- Tezkor tugmalar ----------
  bot.callbackQuery(/^st:([^:]+):(\w+)$/, async (ctx) => {
    const [, leadId, code] = ctx.match;
    const action = STATUS_CODES[code!];
    const emp = await findEmployeeByTelegram(ctx.from.id);
    if (!action || !emp?.isActive) return ctx.answerCallbackQuery({ text: "Ruxsat yo'q", show_alert: true });
    try {
      const lead = await changeStatus(
        leadId!,
        { type: 'employee', id: emp.id, name: emp.fullName },
        {
          status: action.status,
          postponedUntil: action.postpone === 'tomorrow' ? tomorrowAtReminderHour() : null,
        },
      );
      const meta = STATUS_META[lead.status];
      await ctx.answerCallbackQuery({ text: `${meta.emoji} ${meta.label}` });
      await ctx
        .editMessageText(leadCard(lead, `${meta.emoji} Lid`), {
          parse_mode: 'HTML',
          reply_markup: leadKeyboard(lead, { quick: false }),
          link_preview_options: { is_disabled: true },
        })
        .catch(() => undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Xato';
      await ctx.answerCallbackQuery({ text: message, show_alert: true });
    }
  });

  bot.callbackQuery(/^ack:(.+)$/, async (ctx) => {
    const emp = await findEmployeeByTelegram(ctx.from.id);
    if (!emp) return ctx.answerCallbackQuery();
    try {
      const m = (await markMessageRead(emp.id, ctx.match[1]!, {})) as StaffMessage;
      await ctx.answerCallbackQuery({ text: '✅ Qabul qilindi' });
      const kb = m.leadId ? leadKeyboardForAck(m.leadId) : undefined;
      await ctx.editMessageReplyMarkup({ reply_markup: kb }).catch(() => undefined);
    } catch {
      await ctx.answerCallbackQuery({ text: 'Xabar topilmadi' });
    }
  });

  bot.on('callback_query', (ctx) => ctx.answerCallbackQuery());
}

function leadKeyboardForAck(leadId: string) {
  if (!webAppAvailable) return undefined;
  return { inline_keyboard: [[{ text: '📎 Lidni ochish', web_app: { url: `${webAppUrl}/lead/${encodeURIComponent(leadId)}` } }]] };
}

const ALLOWED_UPDATES = ['message', 'edited_message', 'channel_post', 'callback_query', 'my_chat_member'] as const;

// ---------- Kompyuter (polling) va Vercel (webhook) o'rtasida kelishuv ----------
// Bitta bot tokeni bilan bir vaqtda faqat bitta usul ishlay oladi. Lokal polling har 30 soniyada
// Firestore'ga "tirikman" belgisini yozadi; Vercel bu belgi yangi bo'lsa webhookni o'rnatmaydi.
// Kompyuter o'chsa, belgi eskiradi va Vercel ~1 daqiqada webhookni qayta tiklaydi.
const RUNTIME_DOC = 'botRuntime';
const HEARTBEAT_MS = 30_000;
const STALE_MS = 90_000;
let heartbeat: NodeJS.Timeout | null = null;

async function writeHeartbeat(mode: 'polling' | 'stopped') {
  await db()
    .set(COL.counters, RUNTIME_DOC, { mode, host: hostname(), heartbeatAt: new Date() })
    .catch((err) => logger.warn({ err: err.message }, 'Bot heartbeat yozilmadi'));
}

/** Kompyuterdagi (polling) bot hozir ishlayaptimi */
export async function localPollingActive(): Promise<boolean> {
  const rt = await db().get<{ mode: string; heartbeatAt: Date }>(COL.counters, RUNTIME_DOC);
  return !!rt && rt.mode === 'polling' && Date.now() - new Date(rt.heartbeatAt).getTime() < STALE_MS;
}

async function setCommandsAndMenu() {
  if (!bot) return;
  await bot.api
    .setMyCommands([
      { command: 'start', description: 'Boshlash / kalit bilan kirish' },
      { command: 'panel', description: 'Lidlar paneli' },
      { command: 'stats', description: 'Bugungi natijalar' },
      { command: 'help', description: "Qo'llanma" },
    ])
    .catch(() => undefined);
  if (webAppAvailable) {
    await bot.api
      .setChatMenuButton({ menu_button: { type: 'web_app', text: 'Panel', web_app: { url: `${webAppUrl}/` } } })
      .catch((err) => logger.warn({ err: err.message }, "Menu button o'rnatilmadi"));
  } else {
    logger.warn("PUBLIC_URL HTTPS emas — Mini App tugmalari o'chirilgan (lokal rejim)");
  }
}

async function runPolling(): Promise<void> {
  if (!bot) return;
  for (;;) {
    try {
      await bot.api.deleteWebhook();
      await bot.start({
        allowed_updates: [...ALLOWED_UPDATES],
        drop_pending_updates: false,
        onStart: (me) => logger.info({ bot: me.username }, '🤖 Bot polling rejimida ishga tushdi (kompyuterda)'),
      });
      return; // bot.stop() chaqirildi
    } catch (err) {
      // 409: boshqa joyda (Vercel) webhook o'rnatilgan — uni olib tashlab qayta urinamiz
      const conflict = err instanceof GrammyError && err.error_code === 409;
      logger.warn({ err: err instanceof Error ? err.message : err }, conflict ? 'Webhook bilan to\'qnashuv — qayta ulanmoqda' : 'Bot polling uzildi — qayta ulanmoqda');
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

export async function startBot(): Promise<void> {
  if (!bot) {
    logger.warn("BOT_TOKEN berilmagan — Telegram bot o'chirilgan. Panel va API ishlayveradi.");
    return;
  }
  setupBot();
  const me = await bot.api.getMe();
  botInfo.set(me.username);
  bot.botInfo = me;
  await setCommandsAndMenu();

  if (config.BOT_MODE === 'webhook') {
    const url = `${config.PUBLIC_URL}/api/telegram/webhook`;
    await bot.api.setWebhook(url, { secret_token: config.WEBHOOK_SECRET, allowed_updates: [...ALLOWED_UPDATES] });
    logger.info({ bot: me.username, url }, 'Bot webhook rejimida ishga tushdi');
    return;
  }
  await writeHeartbeat('polling');
  heartbeat = setInterval(() => void writeHeartbeat('polling'), HEARTBEAT_MS);
  void runPolling();
}

export async function stopBot() {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
  if (bot && config.BOT_MODE === 'polling') {
    await writeHeartbeat('stopped');
    if (bot.isRunning()) await bot.stop();
  }
}

// ---------- Serverless (Vercel) ----------

let lastWebhookCheck = 0;

/**
 * Webhookni tekshirish/tiklash (har 60 soniyada ko'pi bilan bir marta).
 * Kompyuterdagi bot ishlayotgan bo'lsa — tegmaydi.
 */
export async function ensureWebhook(force = false): Promise<void> {
  if (!bot || config.BOT_MODE !== 'webhook') return;
  if (!force && Date.now() - lastWebhookCheck < 60_000) return;
  lastWebhookCheck = Date.now();
  if (await localPollingActive()) return;
  const url = `${config.PUBLIC_URL}/api/telegram/webhook`;
  const info = await bot.api.getWebhookInfo();
  if (info.url === url) return;
  await bot.api.setWebhook(url, { secret_token: config.WEBHOOK_SECRET, allowed_updates: [...ALLOWED_UPDATES] });
  await setCommandsAndMenu();
  logger.info({ url }, "Telegram webhook o'rnatildi");
}

/** Har bir sovuq ishga tushishda bir marta: handlerlar, bot ma'lumoti, webhook */
export async function initBotServerless(): Promise<void> {
  if (!bot) return;
  setupBot();
  await bot.init();
  botInfo.set(bot.botInfo.username);
  await ensureWebhook(true);
}

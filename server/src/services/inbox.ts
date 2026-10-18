// Kiruvchi xabarlar (inbox) — guruhga tushgan har bir xabar avval shu yerga yoziladi.
// Maqsad: lid hech qachon yo'qolmasin.
//  1) Xabar bazaga yozilmaguncha Telegram'ga "qabul qilindi" deyilmaydi (webhook 500 qaytaradi -> Telegram qayta yuboradi;
//     polling'da esa yozilguncha qayta urinadi).
//  2) Lid yaratishda xato bo'lsa — status "failed", scheduler har daqiqada qayta urinadi.
//  3) Lid deb topilmagan xabarlar (masalan telefon yo'q) sababi bilan saqlanadi — admin panelda ko'rib, qo'lda lid qilish mumkin.

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config, isServerless } from '../config.js';
import { SERVER_DIR } from '../paths.js';
import { COL, db, type Group, type InboxItem, type InboxStatus, type WithId } from '../db/index.js';
import { logger } from '../logger.js';
import { allGroups } from './groups.js';
import { ingestLead, toLeadDto } from './leads.js';
import { emitToAdmins } from './realtime.js';

const MAX_ATTEMPTS = 20;

// Kompyuter (polling) rejimida internet uzoq uzilsa — xabar vaqtincha diskka yoziladi va keyin bazaga o'tkaziladi
const LOCAL_QUEUE = join(SERVER_DIR, 'data', 'pending-messages.jsonl');

interface QueuedMessage {
  groupId: string;
  chatId: number;
  messageId: number;
  text: string;
  from: string | null;
  telegramUsername: string | null;
  isEdit: boolean;
  messageDate: string;
}

function queueLocally(m: QueuedMessage) {
  mkdirSync(dirname(LOCAL_QUEUE), { recursive: true });
  appendFileSync(LOCAL_QUEUE, JSON.stringify(m) + '\n');
  logger.warn({ chatId: m.chatId, messageId: m.messageId }, "Internet yo'q — xabar diskka saqlandi, keyin yuboriladi");
}

/** Diskdagi navbatni bazaga o'tkazish (internet qaytganda) */
async function flushLocalQueue(): Promise<number> {
  if (isServerless || !existsSync(LOCAL_QUEUE)) return 0;
  const processing = LOCAL_QUEUE + '.processing';
  renameSync(LOCAL_QUEUE, processing);
  const lines = readFileSync(processing, 'utf8').split('\n').filter(Boolean);
  const groups = new Map((await allGroups(true)).map((g) => [g.id, g]));
  let ok = 0;
  for (const [i, line] of lines.entries()) {
    const m = JSON.parse(line) as QueuedMessage;
    const group = groups.get(m.groupId);
    if (!group) continue;
    try {
      await receiveGroupMessage({ ...m, group, messageDate: new Date(m.messageDate) }, { noLocalFallback: true });
      ok++;
    } catch {
      // Hali ham internet yo'q — qolganlarini navbatga qaytaramiz
      for (const rest of lines.slice(i)) appendFileSync(LOCAL_QUEUE, rest + '\n');
      break;
    }
  }
  unlinkSync(processing);
  if (ok) logger.info({ ok }, "Diskdagi xabarlar bazaga o'tkazildi");
  return ok;
}

export function inboxId(chatId: number, messageId: number): string {
  return `${Math.abs(chatId)}_${messageId}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Tarmoq/Firestore vaqtincha ishlamasa qayta urinish.
 * Webhook (Vercel) da qisqa — keyin xato tashlanadi va Telegram o'zi qayta yuboradi.
 * Polling (kompyuter) da uzoqroq — internet qaytguncha kutadi (keyingi xabarlar ham navbatda turadi).
 */
export async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const delays = isServerless || config.BOT_MODE === 'webhook' ? [500, 1500] : [1000, 2000, 4000, 8000, 15000, 30000, 30000, 30000, 60000, 60000];
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= delays.length) throw err;
      logger.warn({ err: (err as Error).message?.slice(0, 160), attempt: i + 1 }, `${label}: qayta urinilmoqda`);
      await sleep(delays[i]!);
    }
  }
}

export interface IncomingMessage {
  group: WithId<Group>;
  chatId: number;
  messageId: number;
  text: string;
  from: string | null;
  telegramUsername?: string | null;
  isEdit?: boolean;
  messageDate: Date;
}

async function setStatus(id: string, status: InboxStatus, extra: Partial<InboxItem> = {}) {
  await db().update(COL.inbox, id, { status, processedAt: new Date(), ...extra });
}

/** Xabarni lidga aylantirishga urinish va natijani inbox'ga yozish */
async function processItem(id: string, item: InboxItem, group: WithId<Group>): Promise<InboxStatus> {
  if (group.status !== 'active') {
    await setStatus(id, 'skipped', { reason: 'group_inactive' });
    return 'skipped';
  }
  try {
    const result = await ingestLead({
      group,
      source: 'telegram',
      text: item.text,
      chatId: item.chatId,
      messageId: item.messageId,
      telegramUsername: item.telegramUsername,
    });
    if (!result) {
      await setStatus(id, 'skipped', { reason: 'no_phone' });
      return 'skipped';
    }
    await setStatus(id, 'lead', { leadId: result.lead.id, leadSeq: result.lead.seq, reason: null });
    return 'lead';
  } catch (err) {
    logger.error({ err: (err as Error).message?.slice(0, 200), id }, "Lid yaratilmadi — keyinroq qayta urinadi");
    await db()
      .update(COL.inbox, id, { status: 'failed', reason: (err as Error).message?.slice(0, 300) ?? 'xato', attempts: (item.attempts ?? 0) + 1 })
      .catch(() => undefined);
    return 'failed';
  }
}

/**
 * Guruh xabarini qabul qilish.
 *  - Webhook (Vercel): inbox'ga yozib bo'lmasa xato tashlaydi -> 500 -> Telegram xabarni qayta yuboradi.
 *  - Polling (kompyuter): diskka saqlab qo'yadi -> internet qaytgach scheduler bazaga o'tkazadi.
 */
export async function receiveGroupMessage(msg: IncomingMessage, opts: { noLocalFallback?: boolean } = {}): Promise<void> {
  try {
    await saveAndProcess(msg);
  } catch (err) {
    if (isServerless || config.BOT_MODE === 'webhook' || opts.noLocalFallback) throw err;
    queueLocally({
      groupId: msg.group.id,
      chatId: msg.chatId,
      messageId: msg.messageId,
      text: msg.text,
      from: msg.from,
      telegramUsername: msg.telegramUsername ?? null,
      isEdit: !!msg.isEdit,
      messageDate: msg.messageDate.toISOString(),
    });
  }
}

async function saveAndProcess(msg: IncomingMessage): Promise<void> {
  const id = inboxId(msg.chatId, msg.messageId);
  const existing = await withRetry(() => db().get<InboxItem>(COL.inbox, id), 'Inbox o\'qish');
  // Allaqachon lid bo'lgan xabar tahrirlansa — qayta ishlamaymiz
  if (existing?.status === 'lead') return;

  const item: InboxItem = {
    groupId: msg.group.id,
    groupTitle: msg.group.title,
    chatId: msg.chatId,
    messageId: msg.messageId,
    text: msg.text.slice(0, 4000),
    from: msg.from,
    telegramUsername: msg.telegramUsername ?? null,
    isEdit: !!msg.isEdit,
    status: 'pending',
    reason: null,
    leadId: null,
    leadSeq: null,
    attempts: existing?.attempts ?? 0,
    messageDate: msg.messageDate,
    createdAt: existing?.createdAt ?? new Date(),
    processedAt: null,
  };
  await withRetry(() => db().set(COL.inbox, id, item), 'Inbox yozish');
  const status = await processItem(id, item, msg.group);
  emitToAdmins(msg.group.id, 'group:updated', { id: msg.group.id, inbox: status });
}

/** Scheduler: "pending"/"failed" qolib ketgan xabarlarni qayta ishlash */
export async function processPendingInbox(): Promise<number> {
  await flushLocalQueue().catch((err) => logger.warn({ err: (err as Error).message }, "Diskdagi navbat hali yuborilmadi"));
  const items = await db().query<InboxItem>(COL.inbox, { where: [['status', 'in', ['pending', 'failed']]], limit: 100 });
  if (!items.length) return 0;
  const groups = new Map((await allGroups(true)).map((g) => [g.id, g]));
  const cutoff = Date.now() - 60_000; // hozir ishlanayotgan xabarlarga tegmaslik
  let done = 0;
  for (const it of items) {
    if (new Date(it.createdAt).getTime() > cutoff) continue;
    if ((it.attempts ?? 0) >= MAX_ATTEMPTS) continue;
    const group = groups.get(it.groupId);
    if (!group) continue;
    if ((await processItem(it.id, it, group)) === 'lead') done++;
  }
  if (done) logger.info({ done }, "Qolib ketgan xabarlardan lid tiklandi");
  return done;
}

/** Admin: lid deb topilmagan xabarni qo'lda lidga aylantirish */
export async function forceIngestInbox(id: string, override: { name?: string | null; phone?: string | null }) {
  const it = await db().get<InboxItem>(COL.inbox, id);
  if (!it) return null;
  const group = (await allGroups(true)).find((g) => g.id === it.groupId);
  if (!group) return null;
  const result = await ingestLead({
    group,
    source: 'manual',
    text: it.text,
    chatId: it.chatId,
    messageId: it.messageId,
    name: override.name ?? undefined,
    phone: override.phone ?? undefined,
    telegramUsername: it.telegramUsername,
  });
  if (result) await setStatus(id, 'lead', { leadId: result.lead.id, leadSeq: result.lead.seq, reason: null });
  return result ? toLeadDto(result.lead) : null;
}

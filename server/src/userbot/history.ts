// Userbot (Telegram foydalanuvchi akkaunti) orqali guruh TARIXINI o'qish — serverless (Vercel) uchun.
//
// Nima uchun: Telegram botlarga boshqa botlarning xabarlarini yetkazmaydi. Lid formalari guruhga bot orqali tushsa,
// Lidex boti ularni ko'rmaydi. Guruhda a'zo bo'lgan oddiy akkaunt esa hamma xabarni ko'radi.
//
// Qanday ishlaydi: har daqiqada (/api/cron/tick) akkaunt ulanadi, har bir faol guruhning oxirgi o'qilgan xabaridan
// keyingi xabarlarini oladi va ularni inbox orqali lidga aylantiradi. Tarixdan o'qilgani uchun uzilishlarda ham
// hech narsa yo'qolmaydi. Sessiya Firestore'da AES-256-GCM bilan shifrlangan holda saqlanadi.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { COL, db, type Group, type WithId } from '../db/index.js';
import { badRequest } from '../lib/errors.js';
import { logger } from '../logger.js';
import { allGroups, invalidateGroups } from '../services/groups.js';
import { receiveGroupMessage } from '../services/inbox.js';

type TelegramClient = import('telegram').TelegramClient;

const STATE_DOC = 'userbot';

export interface UserbotState {
  status: 'disconnected' | 'code_sent' | 'password_needed' | 'connected';
  apiId: number | null;
  apiHashEnc: string | null;
  phone: string | null;
  phoneCodeHash: string | null;
  pendingSessionEnc: string | null;
  sessionEnc: string | null;
  account: { id: string; username: string | null; name: string } | null;
  lastRunAt: Date | null;
  lastError: string | null;
  lockUntil: Date | null;
  updatedAt: Date;
}

// ---------- Shifrlash ----------
const key = () => createHash('sha256').update(`lidex-userbot:${config.JWT_SECRET}`).digest();

function enc(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

function dec(payload: string): string {
  const [iv, tag, data] = payload.split('.').map((s) => Buffer.from(s, 'base64'));
  const d = createDecipheriv('aes-256-gcm', key(), iv!);
  d.setAuthTag(tag!);
  return Buffer.concat([d.update(data!), d.final()]).toString('utf8');
}

// ---------- Holat ----------
export async function getState(): Promise<UserbotState | null> {
  return db().get<UserbotState>(COL.counters, STATE_DOC);
}

async function saveState(patch: Partial<UserbotState>) {
  await db().set(COL.counters, STATE_DOC, { ...patch, updatedAt: new Date() }, { merge: true });
}

export function publicState(s: UserbotState | null) {
  return {
    status: s?.status ?? 'disconnected',
    phone: s?.phone ?? null,
    apiId: s?.apiId ?? null,
    account: s?.account ?? null,
    lastRunAt: s?.lastRunAt ?? null,
    lastError: s?.lastError ?? null,
  };
}

async function createClient(apiId: number, apiHash: string, session = ''): Promise<TelegramClient> {
  const { TelegramClient } = await import('telegram');
  const { StringSession } = await import('telegram/sessions/index.js');
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 3, requestRetries: 2 });
  client.setLogLevel('error' as never);
  await client.connect();
  return client;
}

const errMsg = (e: unknown) => (e as { errorMessage?: string; message?: string })?.errorMessage ?? (e as Error)?.message ?? String(e);

// ---------- Ulash (login) ----------

export async function sendLoginCode(input: { apiId: number; apiHash: string; phone: string }) {
  const phone = input.phone.replace(/[^\d+]/g, '');
  const client = await createClient(input.apiId, input.apiHash);
  try {
    const { phoneCodeHash } = await client.sendCode({ apiId: input.apiId, apiHash: input.apiHash }, phone);
    await saveState({
      status: 'code_sent',
      apiId: input.apiId,
      apiHashEnc: enc(input.apiHash),
      phone,
      phoneCodeHash,
      pendingSessionEnc: enc(client.session.save() as unknown as string),
      lastError: null,
    });
  } catch (e) {
    throw badRequest(`Kod yuborilmadi: ${errMsg(e)}`);
  } finally {
    await client.disconnect().catch(() => undefined);
  }
}

export async function signIn(input: { code?: string; password?: string }) {
  const s = await getState();
  if (!s?.apiId || !s.apiHashEnc || !s.pendingSessionEnc || !s.phone) throw badRequest('Avval kod yuboring');
  const apiHash = dec(s.apiHashEnc);
  const { Api } = await import('telegram');
  const client = await createClient(s.apiId, apiHash, dec(s.pendingSessionEnc));
  try {
    if (s.status === 'code_sent') {
      if (!input.code) throw badRequest('Telegramdan kelgan kodni kiriting');
      try {
        await client.invoke(new Api.auth.SignIn({ phoneNumber: s.phone, phoneCodeHash: s.phoneCodeHash!, phoneCode: input.code.trim() }));
      } catch (e) {
        if (errMsg(e) !== 'SESSION_PASSWORD_NEEDED') throw badRequest(`Kod noto'g'ri: ${errMsg(e)}`);
        await saveState({ status: 'password_needed', pendingSessionEnc: enc(client.session.save() as unknown as string) });
        if (!input.password) return { needPassword: true };
      }
    }
    const fresh = await getState();
    if (fresh?.status === 'password_needed') {
      if (!input.password) return { needPassword: true };
      try {
        await client.signInWithPassword(
          { apiId: s.apiId, apiHash },
          {
            password: async () => input.password!,
            onError: async (e) => {
              throw e;
            },
          },
        );
      } catch (e) {
        throw badRequest(`2FA parol noto'g'ri: ${errMsg(e)}`);
      }
    }
    const me = (await client.getMe()) as unknown as { id: { toString(): string }; username?: string; firstName?: string; lastName?: string };
    await saveState({
      status: 'connected',
      sessionEnc: enc(client.session.save() as unknown as string),
      pendingSessionEnc: null,
      phoneCodeHash: null,
      account: { id: me.id.toString(), username: me.username ?? null, name: [me.firstName, me.lastName].filter(Boolean).join(' ') },
      lastError: null,
    });
    logger.info({ account: me.username }, 'Userbot ulandi');
    return { needPassword: false };
  } finally {
    await client.disconnect().catch(() => undefined);
  }
}

export async function disconnectUserbot() {
  const s = await getState();
  if (s?.sessionEnc && s.apiId && s.apiHashEnc) {
    const { Api } = await import('telegram');
    const client = await createClient(s.apiId, dec(s.apiHashEnc), dec(s.sessionEnc)).catch(() => null);
    await client?.invoke(new Api.auth.LogOut()).catch(() => undefined);
    await client?.disconnect().catch(() => undefined);
  }
  await saveState({ status: 'disconnected', sessionEnc: null, pendingSessionEnc: null, phoneCodeHash: null, account: null });
}

// ---------- Tarixni o'qish ----------

interface GroupCursor {
  userbotLastId?: number | null;
  userbotAccessHash?: string | null;
}

/** Bot API chat id (-100XXXXXXXXXX) -> MTProto kanal id */
const channelIdOf = (chatId: number) => String(-chatId - 1_000_000_000_000);

async function resolvePeer(client: TelegramClient, g: WithId<Group> & GroupCursor, dialogs: { loaded: boolean }) {
  const { Api } = await import('telegram');
  const bigInt = (await import('big-integer')).default;
  const isChannel = g.chatId! < -1_000_000_000_000;
  if (!isChannel) return new Api.InputPeerChat({ chatId: bigInt(String(-g.chatId!)) });
  if (g.userbotAccessHash) {
    return new Api.InputPeerChannel({ channelId: bigInt(channelIdOf(g.chatId!)), accessHash: bigInt(g.userbotAccessHash) });
  }
  // Birinchi marta: akkaunt suhbatlaridan guruhni topib, accessHash ni saqlaymiz
  if (!dialogs.loaded) dialogs.loaded = true;
  for await (const d of client.iterDialogs({ limit: 500 })) {
    const ent = d.entity as unknown as { className?: string; id?: { toString(): string }; accessHash?: { toString(): string } };
    if (ent?.className === 'Channel' && ent.id?.toString() === channelIdOf(g.chatId!)) {
      const accessHash = ent.accessHash!.toString();
      await db().update(COL.groups, g.id, { userbotAccessHash: accessHash });
      return new Api.InputPeerChannel({ channelId: bigInt(channelIdOf(g.chatId!)), accessHash: bigInt(accessHash) });
    }
  }
  return null;
}

export interface SyncResult {
  ran: boolean;
  reason?: string;
  groups: number;
  messages: number;
  errors: string[];
}

/**
 * Har bir faol guruhning yangi xabarlarini o'qish.
 * @param backfillHours berilsa — oxirgi N soatdagi (hali ishlanmagan) xabarlar ham olinadi
 */
export async function syncHistory(opts: { backfillHours?: number; force?: boolean } = {}): Promise<SyncResult> {
  const s = await getState();
  const res: SyncResult = { ran: false, groups: 0, messages: 0, errors: [] };
  if (s?.status !== 'connected' || !s.sessionEnc || !s.apiId || !s.apiHashEnc) return { ...res, reason: 'not_connected' };
  // Bir vaqtda ikki marta ishlamasligi uchun qulf
  if (!opts.force && s.lockUntil && new Date(s.lockUntil).getTime() > Date.now()) return { ...res, reason: 'locked' };
  await saveState({ lockUntil: new Date(Date.now() + 50_000) });

  let client: TelegramClient | null = null;
  try {
    client = await createClient(s.apiId, dec(s.apiHashEnc), dec(s.sessionEnc));
    const groups = (await allGroups(true)).filter((g) => g.status === 'active' && g.chatId && g.chatType !== 'api') as Array<
      WithId<Group> & GroupCursor
    >;
    const dialogs = { loaded: false };
    for (const g of groups) {
      try {
        const peer = await resolvePeer(client, g, dialogs);
        if (!peer) {
          res.errors.push(`${g.title}: akkaunt bu guruhda a'zo emas`);
          continue;
        }
        res.groups++;
        const since = opts.backfillHours ? Date.now() - opts.backfillHours * 3_600_000 : null;
        let msgs;
        if (g.userbotLastId == null && !since) {
          // Birinchi ulanish: shu paytdan boshlab o'qiymiz (eski xabarlar bilan xodimni ko'mib tashlamaslik uchun)
          const [latest] = await client.getMessages(peer, { limit: 1 });
          await db().update(COL.groups, g.id, { userbotLastId: latest?.id ?? 0 });
          continue;
        } else if (since) {
          msgs = (await client.getMessages(peer, { limit: 300 })).filter((m) => m.date * 1000 >= since);
        } else {
          msgs = await client.getMessages(peer, { minId: g.userbotLastId!, limit: 200 });
        }
        let maxId = g.userbotLastId ?? 0;
        for (const m of [...msgs].sort((a, b) => a.id - b.id)) {
          maxId = Math.max(maxId, m.id);
          const text = (m.message ?? '').trim();
          if (!text || text.startsWith('/')) continue;
          const exists = await db().get(COL.inbox, `${Math.abs(g.chatId!)}_${m.id}`);
          if (exists) continue;
          const sender = (m.sender ?? null) as { bot?: boolean; username?: string; firstName?: string; title?: string } | null;
          await receiveGroupMessage(
            {
              group: g,
              chatId: g.chatId!,
              messageId: m.id,
              text,
              from: sender?.username ? `@${sender.username}` : (sender?.firstName ?? sender?.title ?? null),
              fromBot: !!sender?.bot,
              messageDate: new Date(m.date * 1000),
            },
            { noLocalFallback: true },
          );
          res.messages++;
        }
        if (maxId !== (g.userbotLastId ?? 0)) await db().update(COL.groups, g.id, { userbotLastId: maxId });
      } catch (e) {
        res.errors.push(`${g.title}: ${errMsg(e)}`);
      }
    }
    // Yangi sessiya (DC almashishi va h.k.) bo'lsa saqlab qo'yamiz
    await saveState({ sessionEnc: enc(client.session.save() as unknown as string) });
    res.ran = true;
  } catch (e) {
    res.errors.push(errMsg(e));
    if (/AUTH_KEY_UNREGISTERED|SESSION_REVOKED|USER_DEACTIVATED/.test(errMsg(e))) {
      await saveState({ status: 'disconnected', sessionEnc: null, account: null });
    }
  } finally {
    await client?.disconnect().catch(() => undefined);
    invalidateGroups();
    await saveState({ lockUntil: null, lastRunAt: new Date(), lastError: res.errors[0] ?? null });
  }
  if (res.messages || res.errors.length) logger.info(res, 'Userbot: guruh tarixi o\'qildi');
  return res;
}

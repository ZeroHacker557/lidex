import { DEFAULT_GROUP_SETTINGS, type GroupSettings } from '../../../shared/statuses.js';
import { COL, db, type Group, type WithId } from '../db/index.js';
import { randomToken } from '../lib/security.js';
import { logger } from '../logger.js';
import { emitToAdmins } from './realtime.js';

// Guruhlar kam va tez-tez o'qiladi (har bir xabarda) — qisqa muddatli kesh
let cache: { at: number; list: WithId<Group>[] } | null = null;
const TTL = 30_000;

export async function allGroups(force = false): Promise<WithId<Group>[]> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.list;
  const list = await db().query<Group>(COL.groups, {});
  list.forEach((g) => (g.settings = { ...DEFAULT_GROUP_SETTINGS, ...g.settings }));
  cache = { at: Date.now(), list };
  return list;
}

export function invalidateGroups() {
  cache = null;
}

export async function groupByChatId(chatId: number): Promise<WithId<Group> | null> {
  return (await allGroups()).find((g) => g.chatId === chatId) ?? null;
}

export async function groupByToken(token: string): Promise<WithId<Group> | null> {
  return (await allGroups()).find((g) => g.ingestToken === token) ?? null;
}

export function newGroup(input: {
  title: string;
  chatId: number | null;
  chatType: Group['chatType'];
  status?: Group['status'];
  settings?: Partial<GroupSettings>;
  botMember?: boolean;
}): Group {
  const now = new Date();
  return {
    title: input.title.slice(0, 120),
    chatId: input.chatId,
    chatType: input.chatType,
    status: input.status ?? 'pending',
    ingestToken: randomToken(18),
    settings: { ...DEFAULT_GROUP_SETTINGS, ...input.settings },
    lastAssignedEmployeeId: null,
    botMember: input.botMember ?? false,
    leadCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/** Bot guruhga qo'shilganda yoki guruhdan birinchi xabar kelganda — guruhni ro'yxatga olish */
export async function registerChat(chat: { id: number; title?: string; type: string }, botMember = true) {
  const existing = await groupByChatId(chat.id);
  if (existing) {
    const patch: Partial<Group> = { botMember, updatedAt: new Date() };
    if (chat.title && chat.title !== existing.title) patch.title = chat.title;
    await db().update(COL.groups, existing.id, patch);
    invalidateGroups();
    return { ...existing, ...patch };
  }
  const chatType = chat.type === 'channel' ? 'channel' : chat.type === 'supergroup' ? 'supergroup' : 'group';
  const group = newGroup({ title: chat.title ?? `Chat ${chat.id}`, chatId: chat.id, chatType, botMember });
  const id = await db().create(COL.groups, group);
  invalidateGroups();
  logger.info({ chatId: chat.id, title: group.title }, 'Yangi guruh ro\'yxatga olindi (tasdiqlash kutilmoqda)');
  emitToAdmins(null, 'alert', {
    kind: 'group_pending',
    groupId: id,
    text: `Bot yangi guruhga qo'shildi: "${group.title}". Admin panelda faollashtiring.`,
  });
  emitToAdmins(null, 'group:updated', { id });
  return { ...group, id };
}

/** Oddiy guruh superguruhga aylanganda chat id o'zgaradi */
export async function migrateChat(oldId: number, newId: number) {
  const g = await groupByChatId(oldId);
  if (!g) return;
  await db().update(COL.groups, g.id, { chatId: newId, chatType: 'supergroup', updatedAt: new Date() });
  invalidateGroups();
  logger.info({ oldId, newId }, 'Guruh superguruhga ko\'chirildi');
}

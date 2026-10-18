import { COL, db, type Employee, type WithId } from '../db/index.js';
import { HttpError } from '../lib/errors.js';
import { generateAccessKey, hashAccessKey, normalizeAccessKey } from '../lib/security.js';
import { emitToAdmins } from './realtime.js';

export interface TelegramIdentity {
  id: number;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export async function findEmployeeByTelegram(tgId: number): Promise<WithId<Employee> | null> {
  const list = await db().query<Employee>(COL.employees, { where: [['telegramId', '==', tgId]], limit: 1 });
  return list[0] ?? null;
}

export function newKeyFields() {
  const key = generateAccessKey();
  return { key, keyHash: hashAccessKey(key), keyHint: key.slice(-4) };
}

// Kalitni taxmin qilishdan himoya: 10 daqiqada 6 ta urinish
const attempts = new Map<number, { count: number; resetAt: number }>();
export function keyAttemptAllowed(tgId: number): boolean {
  const now = Date.now();
  const a = attempts.get(tgId);
  if (!a || a.resetAt < now) {
    attempts.set(tgId, { count: 1, resetAt: now + 10 * 60_000 });
    return true;
  }
  a.count++;
  return a.count <= 6;
}

export class KeyError extends HttpError {
  constructor(public reason: 'invalid' | 'used' | 'tg_taken' | 'rate') {
    const messages = {
      invalid: "Kalit noto'g'ri yoki faol emas",
      used: 'Bu kalit boshqa Telegram akkauntga biriktirilgan',
      tg_taken: 'Bu Telegram akkaunt boshqa xodimga ulangan',
      rate: "Juda ko'p urinish. 10 daqiqadan keyin qayta urinib ko'ring",
    };
    super(reason === 'rate' ? 429 : 400, messages[reason], `key_${reason}`);
  }
}

/** Xodimni kirish kaliti orqali Telegram akkauntga bog'lash */
export async function bindEmployeeByKey(rawKey: string, tg: TelegramIdentity): Promise<WithId<Employee>> {
  if (!keyAttemptAllowed(tg.id)) throw new KeyError('rate');
  const keyHash = hashAccessKey(normalizeAccessKey(rawKey));
  const [emp] = await db().query<Employee>(COL.employees, { where: [['keyHash', '==', keyHash]], limit: 1 });
  if (!emp || !emp.isActive) throw new KeyError('invalid');
  if (emp.telegramId && emp.telegramId !== tg.id) throw new KeyError('used');

  const other = await findEmployeeByTelegram(tg.id);
  if (other && other.id !== emp.id) throw new KeyError('tg_taken');

  const patch: Partial<Employee> = {
    telegramId: tg.id,
    telegramUsername: tg.username ?? null,
    telegramName: [tg.firstName, tg.lastName].filter(Boolean).join(' ') || null,
    boundAt: emp.boundAt ?? new Date(),
    botBlocked: false,
  };
  await db().update(COL.employees, emp.id, patch);
  const updated = { ...emp, ...patch };
  attempts.delete(tg.id);
  emitToAdmins(updated.groupIds[0] ?? null, 'employee:updated', { id: updated.id });
  return updated;
}

export function publicEmployee(e: WithId<Employee>) {
  const { keyHash: _k, ...rest } = e;
  return rest;
}

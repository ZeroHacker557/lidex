// Saytdan (brauzer / telefonga o'rnatilgan ilova) Telegram orqali kirish.
//  1) Sayt so'rov yaratadi: { id, secret } — secret faqat brauzerda qoladi, bazada uning xeshi.
//  2) Xodim t.me/<bot>?start=wl_<id> havolasini ochadi va botda "Ha, kiraman" ni bosadi.
//  3) Sayt secret bilan so'raydi va tasdiqlangan bo'lsa token oladi (so'rov bir martalik).
import { COL, db, type WithId } from '../db/index.js';
import { notFound } from '../lib/errors.js';
import { randomToken, sha256 } from '../lib/security.js';

export const WEB_LOGIN_TTL_MS = 10 * 60_000;
export const WEB_LOGIN_PREFIX = 'wl_';

export interface WebLogin {
  secretHash: string;
  status: 'pending' | 'approved' | 'used';
  employeeId: string | null;
  telegramId: number | null;
  createdAt: Date;
  expiresAt: Date;
  approvedAt: Date | null;
}

const expired = (w: WebLogin) => new Date(w.expiresAt).getTime() < Date.now();

export async function createWebLogin(): Promise<{ id: string; secret: string; expiresAt: Date }> {
  const id = randomToken(12); // base64url — Telegram start parametriga mos
  const secret = randomToken(24);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + WEB_LOGIN_TTL_MS);
  const doc: WebLogin = {
    secretHash: sha256(secret),
    status: 'pending',
    employeeId: null,
    telegramId: null,
    createdAt: now,
    expiresAt,
    approvedAt: null,
  };
  await db().create(COL.webLogins, doc, id);
  return { id, secret, expiresAt };
}

/** Bot: so'rov hali kutilmoqdami (tasdiqlash tugmasini ko'rsatishdan oldin) */
export async function getPendingWebLogin(id: string): Promise<WithId<WebLogin> | null> {
  const w = await db().get<WebLogin>(COL.webLogins, id);
  return w && w.status === 'pending' && !expired(w) ? w : null;
}

/** Bot: xodim tasdiqladi */
export async function approveWebLogin(id: string, emp: { id: string; telegramId: number }): Promise<boolean> {
  return db().runTransaction(async (tx) => {
    const w = await tx.get<WebLogin>(COL.webLogins, id);
    if (!w || w.status !== 'pending' || expired(w)) return false;
    tx.update(COL.webLogins, id, { status: 'approved', employeeId: emp.id, telegramId: emp.telegramId, approvedAt: new Date() });
    return true;
  });
}

export type WebLoginPoll = { status: 'pending' | 'expired' } | { status: 'approved'; employeeId: string };

/** Sayt: holatni so'rash. Tasdiqlangan bo'lsa — bir marta employeeId qaytaradi */
export async function pollWebLogin(id: string, secret: string): Promise<WebLoginPoll> {
  const hash = sha256(secret);
  return db().runTransaction(async (tx) => {
    const w = await tx.get<WebLogin>(COL.webLogins, id);
    if (!w || w.secretHash !== hash) throw notFound("Kirish so'rovi topilmadi");
    if (w.status === 'used' || expired(w)) return { status: 'expired' };
    if (w.status === 'pending') return { status: 'pending' };
    tx.update(COL.webLogins, id, { status: 'used' });
    return { status: 'approved', employeeId: w.employeeId! };
  });
}

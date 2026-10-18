import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { isProd } from '../../config.js';
import { COL, db, type Admin, type WithId } from '../../db/index.js';
import { badRequest, unauthorized } from '../../lib/errors.js';
import { randomToken, signToken } from '../../lib/security.js';
import { botInfo } from '../../bot/instance.js';
import { ADMIN_COOKIE, requireAdmin } from '../middleware.js';

export const adminAuthRouter = Router();

export function publicAdmin(a: WithId<Admin>) {
  const { passwordHash: _p, telegramLinkToken: _t, ...rest } = a;
  return { ...rest, telegramLinked: !!a.telegramId };
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring", code: 'rate_limited' },
});

adminAuthRouter.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = z.object({ username: z.string().min(1).max(64), password: z.string().min(1).max(128) }).parse(req.body);
  const [admin] = await db().query<Admin>(COL.admins, {
    where: [['usernameLower', '==', username.trim().toLowerCase()]],
    limit: 1,
  });
  const ok = admin && admin.isActive && (await bcrypt.compare(password, admin.passwordHash));
  if (!ok) throw unauthorized("Login yoki parol noto'g'ri");
  await db().update(COL.admins, admin.id, { lastLoginAt: new Date() });
  const token = signToken({ kind: 'admin', sub: admin.id, role: admin.role }, '12h');
  res.cookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 12 * 3600_000,
    path: '/',
  });
  res.json({ admin: publicAdmin(admin), token });
});

adminAuthRouter.post('/logout', (_req, res) => {
  res.clearCookie(ADMIN_COOKIE, { path: '/' });
  res.json({ ok: true });
});

adminAuthRouter.get('/me', requireAdmin, (req, res) => {
  res.json({ admin: publicAdmin(req.admin!), botUsername: botInfo.username });
});

adminAuthRouter.post('/password', requireAdmin, async (req, res) => {
  const { current, next } = z.object({ current: z.string(), next: z.string().min(8).max(128) }).parse(req.body);
  if (!(await bcrypt.compare(current, req.admin!.passwordHash))) throw badRequest("Joriy parol noto'g'ri");
  await db().update(COL.admins, req.admin!.id, { passwordHash: await bcrypt.hash(next, 10) });
  res.json({ ok: true });
});

/** Admin Telegram akkauntini ulash uchun bir martalik havola */
adminAuthRouter.post('/telegram-link', requireAdmin, async (req, res) => {
  const token = randomToken(12);
  await db().update(COL.admins, req.admin!.id, { telegramLinkToken: token });
  const username = botInfo.username;
  res.json({ url: username ? `https://t.me/${username}?start=adm_${token}` : null, command: `/start adm_${token}` });
});

adminAuthRouter.delete('/telegram-link', requireAdmin, async (req, res) => {
  await db().update(COL.admins, req.admin!.id, { telegramId: null, telegramLinkToken: null });
  res.json({ ok: true });
});

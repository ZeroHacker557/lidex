import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { COL, db, type Admin, type Employee, type WithId } from '../db/index.js';
import { forbidden, HttpError, unauthorized } from '../lib/errors.js';
import { verifyToken, type AdminClaims, type EmployeeClaims } from '../lib/security.js';
import { logger } from '../logger.js';
import type { Actor } from '../services/events.js';

export const ADMIN_COOKIE = 'lx_admin';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: WithId<Admin>;
      employee?: WithId<Employee>;
    }
  }
}

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  return schema.parse(data);
}

function bearer(req: Request): string | null {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const token = (req.cookies?.[ADMIN_COOKIE] as string | undefined) ?? bearer(req);
  const claims = token ? verifyToken<AdminClaims>(token, 'admin') : null;
  if (!claims) throw unauthorized();
  const admin = await db().get<Admin>(COL.admins, claims.sub);
  if (!admin || !admin.isActive) throw unauthorized('Sessiya tugagan');
  req.admin = admin;
  next();
}

export function requireSuperadmin(req: Request, _res: Response, next: NextFunction) {
  if (req.admin?.role !== 'superadmin') throw forbidden('Faqat superadmin uchun');
  next();
}

export async function requireEmployee(req: Request, _res: Response, next: NextFunction) {
  const token = bearer(req);
  const claims = token ? verifyToken<EmployeeClaims>(token, 'employee') : null;
  if (!claims) throw unauthorized();
  const emp = await db().get<Employee>(COL.employees, claims.sub);
  if (!emp || !emp.isActive || emp.telegramId !== claims.tg) throw unauthorized('Kirish huquqi bekor qilingan');
  req.employee = emp;
  next();
}

export const adminActor = (req: Request): Actor => ({ type: 'admin', id: req.admin!.id, name: req.admin!.fullName });
export const employeeActor = (req: Request): Actor => ({
  type: 'employee',
  id: req.employee!.id,
  name: req.employee!.fullName,
});

/** Admin ko'ra oladigan guruhlar (null — hammasi) */
export function adminGroupScope(admin: WithId<Admin>): string[] | null {
  return admin.role === 'superadmin' ? null : admin.groupIds;
}

export function assertGroupAccess(admin: WithId<Admin>, groupId: string) {
  const scope = adminGroupScope(admin);
  if (scope && !scope.includes(groupId)) throw forbidden("Bu guruhga ruxsatingiz yo'q");
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    res.status(400).json({
      error: first ? `${first.path.join('.') || 'so\'rov'}: ${first.message}` : "Noto'g'ri so'rov",
      code: 'validation',
      issues: err.issues,
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  const e = err as { code?: number; message?: string };
  // Firestore: kompozit indeks yo'q bo'lsa — havolani logga chiqaramiz
  if (e?.code === 9 && e.message?.includes('index')) {
    logger.error({ msg: e.message }, 'Firestore indeksi kerak (firestore.indexes.json ni deploy qiling)');
  } else {
    logger.error({ err, path: req.path }, 'Kutilmagan xato');
  }
  res.status(500).json({ error: 'Serverda xatolik yuz berdi', code: 'internal' });
}

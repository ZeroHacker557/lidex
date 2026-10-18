import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config, isProd } from './config.js';
import { COL, db, type Admin } from './db/index.js';
import { logger } from './logger.js';

/** Birinchi ishga tushishda superadmin yaratish */
export async function ensureSuperadmin() {
  const existing = await db().query<Admin>(COL.admins, { limit: 1 });
  if (existing.length) return;
  let password = config.ADMIN_PASSWORD;
  if (!password) {
    if (isProd) throw new Error("Birinchi ishga tushirish uchun ADMIN_PASSWORD o'rnatilishi kerak");
    password = randomBytes(6).toString('base64url');
  }
  await db().create(COL.admins, {
    username: config.ADMIN_USERNAME,
    usernameLower: config.ADMIN_USERNAME.toLowerCase(),
    passwordHash: await bcrypt.hash(password, 10),
    fullName: 'Bosh administrator',
    role: 'superadmin',
    groupIds: [],
    telegramId: null,
    telegramLinkToken: null,
    isActive: true,
    createdAt: new Date(),
    lastLoginAt: null,
  } satisfies Admin);
  logger.warn(
    { username: config.ADMIN_USERNAME, password: config.ADMIN_PASSWORD ? '(.env dagi ADMIN_PASSWORD)' : password },
    '👑 Superadmin yaratildi — kirgandan keyin parolni almashtiring',
  );
}

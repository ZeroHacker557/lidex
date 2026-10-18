import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { startBot, stopBot } from './bot/index.js';
import { config, isProd } from './config.js';
import { COL, db, initStore, type Admin } from './db/index.js';
import { createApp } from './http/app.js';
import { attachSocket } from './http/socket.js';
import { logger } from './logger.js';
import { startScheduler, stopScheduler } from './scheduler/index.js';
import { startUserbot, stopUserbot } from './userbot/index.js';

/** Birinchi ishga tushishda superadmin yaratish */
async function ensureSuperadmin() {
  const existing = await db().query<Admin>(COL.admins, { limit: 1 });
  if (existing.length) return;
  let password = config.ADMIN_PASSWORD;
  if (!password) {
    if (isProd) {
      logger.fatal('Birinchi ishga tushirish uchun ADMIN_PASSWORD o\'rnatilishi kerak');
      process.exit(1);
    }
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

async function main() {
  await initStore();
  await ensureSuperadmin();

  const app = createApp();
  const server = createServer(app);
  attachSocket(server);

  await new Promise<void>((resolve) => server.listen(config.PORT, resolve));
  logger.info(`🚀 Lidex server: http://localhost:${config.PORT}  (admin: /admin, mini app: /app)`);

  await startBot().catch((err) => logger.error({ err: err.message }, 'Botni ishga tushirib bo\'lmadi'));
  await startUserbot().catch((err) => logger.error({ err: err.message }, 'Userbotni ishga tushirib bo\'lmadi'));
  startScheduler();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'To\'xtatilmoqda...');
    stopScheduler();
    await Promise.allSettled([stopBot(), stopUserbot()]);
    server.close();
    await db().close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandledRejection'));

main().catch((err) => {
  logger.fatal({ err }, 'Server ishga tushmadi');
  process.exit(1);
});

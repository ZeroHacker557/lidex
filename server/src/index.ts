// Doimiy server (VPS / Docker / lokal): HTTP + Socket.IO + bot (polling yoki webhook) + scheduler.
// Vercel uchun kirish nuqtasi: api/index.ts
import { createServer } from 'node:http';
import { startBot, stopBot } from './bot/index.js';
import { ensureSuperadmin } from './bootstrap.js';
import { config } from './config.js';
import { db, initStore } from './db/index.js';
import { createApp } from './http/app.js';
import { attachSocket } from './http/socket.js';
import { logger } from './logger.js';
import { startScheduler, stopScheduler } from './scheduler/index.js';
import { startUserbot, stopUserbot } from './userbot/index.js';

async function main() {
  await initStore();
  await ensureSuperadmin();

  const app = createApp();
  const server = createServer(app);
  attachSocket(server);

  await new Promise<void>((resolve) => server.listen(config.PORT, resolve));
  logger.info(`🚀 Lidex server: http://localhost:${config.PORT}  (admin: /admin, mini app: /app)`);

  await startBot().catch((err) => logger.error({ err: err.message }, "Botni ishga tushirib bo'lmadi"));
  await startUserbot().catch((err) => logger.error({ err: err.message }, "Userbotni ishga tushirib bo'lmadi"));
  startScheduler();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "To'xtatilmoqda...");
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

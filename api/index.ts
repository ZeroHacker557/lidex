// Vercel serverless kirish nuqtasi: barcha /api/* so'rovlari shu funksiyaga yo'naltiriladi (vercel.json).
// Doimiy serverdan farqi: Socket.IO yo'q (mijozlar so'rovlar bilan yangilanadi), bot webhook orqali,
// fon vazifalari esa /api/cron/tick orqali (Vercel Cron yoki cron-job.org) bajariladi.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ensureWebhook, initBotServerless } from '../server/src/bot/index.js';
import { ensureSuperadmin } from '../server/src/bootstrap.js';
import { initStore } from '../server/src/db/index.js';
import { createApp } from '../server/src/http/app.js';
import { logger } from '../server/src/logger.js';

let ready: Promise<ReturnType<typeof createApp>> | null = null;

function boot() {
  return (async () => {
    await initStore();
    await ensureSuperadmin();
    await initBotServerless().catch((err) => logger.error({ err: err?.message ?? err }, 'Bot init xatosi'));
    return createApp();
  })();
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  ready ??= boot().catch((err) => {
    ready = null; // keyingi so'rovda qayta urinish
    throw err;
  });
  const app = await ready;
  // Kompyuterdagi bot o'chgan bo'lsa — webhookni tiklash (60 soniyada ko'pi bilan bir marta tekshiriladi)
  await ensureWebhook().catch((err) => logger.warn({ err: err?.message ?? err }, 'Webhook tekshiruvi xatosi'));
  return app(req as never, res as never);
}

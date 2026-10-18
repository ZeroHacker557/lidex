import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import helmet from 'helmet';
import { webhookCallback } from 'grammy';
import { config, isProd, isServerless } from '../config.js';
import { db } from '../db/index.js';
import { bot } from '../bot/instance.js';
import { notFound, unauthorized } from '../lib/errors.js';
import { runTick } from '../scheduler/index.js';
import { WEB_DIST_DIR } from '../paths.js';
import { errorHandler } from './middleware.js';
import { adminRouter } from './routes/admin.js';
import { adminAuthRouter } from './routes/admin-auth.js';
import { appRouter } from './routes/app.js';
import { ingestRouter } from './routes/ingest.js';

export function createApp(): Express {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Mini App Telegram ichida (web.telegram.org) iframe'da ochiladi — frameguard o'chiriladi,
  // admin sahifalari uchun alohida X-Frame-Options: DENY qo'yiladi.
  app.use(helmet({ contentSecurityPolicy: false, frameguard: false, crossOriginEmbedderPolicy: false }));
  app.use(cookieParser());
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, db: db().kind, bot: !!bot, realtime: !isServerless, time: new Date().toISOString() });
  });

  if (bot && config.BOT_MODE === 'webhook') {
    app.post(
      '/api/telegram/webhook',
      webhookCallback(bot, 'express', { secretToken: config.WEBHOOK_SECRET, onTimeout: 'return', timeoutMilliseconds: 25_000 }),
    );
  }

  // Fon vazifalari (eslatma, SLA, dayjest) — Vercel Cron yoki tashqi cron har daqiqada chaqiradi
  app.all('/api/cron/tick', async (req, res) => {
    const auth = req.headers.authorization;
    const key = typeof req.query.key === 'string' ? req.query.key : null;
    if (!config.CRON_SECRET || (auth !== `Bearer ${config.CRON_SECRET}` && key !== config.CRON_SECRET)) {
      throw unauthorized("Cron kaliti noto'g'ri");
    }
    res.json({ ok: true, ...(await runTick()) });
  });

  app.use('/api/admin/auth', adminAuthRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/app', appRouter);
  app.use('/api/ingest', ingestRouter);
  app.use('/api', () => {
    throw notFound('API manzili topilmadi');
  });

  // Frontend (vite build natijasi)
  if (existsSync(WEB_DIST_DIR)) {
    app.use(
      '/assets',
      express.static(join(WEB_DIST_DIR, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }),
    );
    app.use(express.static(WEB_DIST_DIR, { index: false, maxAge: isProd ? '1h' : 0 }));
    app.get(['/app', '/app/{*rest}'], (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(join(WEB_DIST_DIR, 'app.html'));
    });
    app.get(['/admin', '/admin/{*rest}'], (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Frame-Options', 'DENY');
      res.sendFile(join(WEB_DIST_DIR, 'admin.html'));
    });
  }
  app.get('/', (_req, res) => res.redirect('/admin'));

  app.use(errorHandler);
  return app;
}

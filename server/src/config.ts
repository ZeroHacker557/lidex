import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';
import { z } from 'zod';
import { ROOT_DIR, SERVER_DIR } from './paths.js';

loadEnv({ path: [join(ROOT_DIR, '.env'), join(SERVER_DIR, '.env')], quiet: true });

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  /** Tashqi HTTPS manzil (Mini App va webhook uchun), masalan https://lidex.example.uz */
  PUBLIC_URL: z
    .string()
    .default(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:4000')
    .transform((v) => v.replace(/\/+$/, '')),
  JWT_SECRET: z.string().min(16).default('dev-only-secret-change-me-0123456789abcdef'),
  ADMIN_USERNAME: z.string().default('admin'),
  ADMIN_PASSWORD: optional,

  // Ma'lumotlar bazasi
  DB_DRIVER: z.enum(['firestore', 'memory']).default('memory'),
  MEMORY_DB_FILE: z.string().default('data/dev-db.json'),
  FIREBASE_PROJECT_ID: optional,
  FIREBASE_SERVICE_ACCOUNT: optional,
  FIREBASE_SERVICE_ACCOUNT_PATH: optional,
  FIRESTORE_DATABASE_ID: optional,
  /** Bitta Firebase loyihada bir nechta muhit bo'lsa: kolleksiya prefiksi (masalan "staging_") */
  FIRESTORE_PREFIX: z.string().default(''),

  // Telegram bot
  BOT_TOKEN: optional,
  BOT_MODE: z.enum(['polling', 'webhook']).default('polling'),
  WEBHOOK_SECRET: optional,
  /** Tashqi cron (Vercel Cron / cron-job.org) /api/cron/tick ni chaqirish uchun maxfiy kalit */
  CRON_SECRET: optional,

  // Userbot (MTProto) — boshqa botlar guruhga yozgan lidlarni o'qish uchun
  USERBOT_ENABLED: bool(false),
  TG_API_ID: z.coerce.number().optional(),
  TG_API_HASH: optional,
  TG_USERBOT_SESSION: optional,

  // Vaqt va bildirishnomalar
  TZ_OFFSET_MINUTES: z.coerce.number().default(300), // Asia/Tashkent = UTC+5
  QUIET_HOURS_START: z.coerce.number().min(0).max(23).default(21),
  QUIET_HOURS_END: z.coerce.number().min(0).max(23).default(8),
  REMINDER_HOUR: z.coerce.number().min(0).max(23).default(9),
  SCHEDULER_INTERVAL_SEC: z.coerce.number().min(10).default(60),

  /** Faqat lokal sinov: Telegramsiz brauzerda Mini App'ni ochish (?dev_tg=123) */
  DEV_AUTH: bool(false),
  LOG_LEVEL: z.string().default('info'),
});

/** Vercel kabi serverless muhit: doimiy jarayon yo'q (Socket.IO, polling, setInterval ishlamaydi) */
export const isServerless = !!process.env.VERCEL;

function fail(message: string): never {
  console.error(`❌ ${message}`);
  if (isServerless) throw new Error(message);
  process.exit(1);
}

const parsed = schema.safeParse(process.env);
if (!parsed.success) fail(`.env sozlamalarida xato: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);

export const config = parsed.data;
export const isProd = config.NODE_ENV === 'production';
export const webAppUrl = `${config.PUBLIC_URL}/app`;
/** Telegram Web App tugmalari faqat HTTPS bilan ishlaydi */
export const webAppAvailable = config.PUBLIC_URL.startsWith('https://');

if (isProd) {
  if (config.JWT_SECRET.startsWith('dev-only')) fail("Production rejimida JWT_SECRET o'rnatilishi shart");
  if (config.DEV_AUTH) fail('DEV_AUTH production rejimida yoqilmasligi kerak');
}

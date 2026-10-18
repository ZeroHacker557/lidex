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
  PUBLIC_URL: z.string().default('http://localhost:4000').transform((v) => v.replace(/\/+$/, '')),
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

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ .env sozlamalarida xato:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export const isProd = config.NODE_ENV === 'production';
export const webAppUrl = `${config.PUBLIC_URL}/app`;
/** Telegram Web App tugmalari faqat HTTPS bilan ishlaydi */
export const webAppAvailable = config.PUBLIC_URL.startsWith('https://');

if (isProd) {
  if (config.JWT_SECRET.startsWith('dev-only')) {
    console.error('❌ Production rejimida JWT_SECRET o\'rnatilishi shart');
    process.exit(1);
  }
  if (config.DEV_AUTH) {
    console.error('❌ DEV_AUTH production rejimida yoqilmasligi kerak');
    process.exit(1);
  }
}

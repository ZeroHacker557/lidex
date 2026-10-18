import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 0/O, 1/I chalkashmasligi uchun

/** Xodim kirish kaliti: LX-7KQ2-M9TD */
export function generateAccessKey(): string {
  const block = () => Array.from({ length: 4 }, () => KEY_ALPHABET[randomInt(KEY_ALPHABET.length)]).join('');
  return `LX-${block()}-${block()}`;
}

export function normalizeAccessKey(input: string): string {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = s.startsWith('LX') ? s.slice(2) : s;
  return body.length === 8 ? `LX-${body.slice(0, 4)}-${body.slice(4)}` : input.trim().toUpperCase();
}

export function looksLikeAccessKey(input: string): boolean {
  return /^LX-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalizeAccessKey(input));
}

export function hashAccessKey(key: string): string {
  return createHmac('sha256', config.JWT_SECRET).update(normalizeAccessKey(key)).digest('hex');
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

// ---------- JWT ----------

export interface AdminClaims {
  kind: 'admin';
  sub: string;
  role: 'superadmin' | 'admin';
}
export interface EmployeeClaims {
  kind: 'employee';
  sub: string;
  tg: number;
}
export type Claims = AdminClaims | EmployeeClaims;

export function signToken(claims: Claims, expiresIn: jwt.SignOptions['expiresIn']): string {
  return jwt.sign(claims, config.JWT_SECRET, { expiresIn, issuer: 'lidex' });
}

export function verifyToken<T extends Claims>(token: string, kind: T['kind']): T | null {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, { issuer: 'lidex' }) as T;
    return decoded.kind === kind ? decoded : null;
  } catch {
    return null;
  }
}

// ---------- Telegram Mini App initData tekshiruvi ----------

export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface VerifiedInitData {
  user: TelegramWebAppUser;
  startParam: string | null;
  authDate: Date;
}

/**
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * hash dan boshqa barcha maydonlar alifbo tartibida "key=value\n" ko'rinishida HMAC qilinadi.
 */
export function verifyInitData(initData: string, botToken: string, maxAgeSec = 24 * 3600): VerifiedInitData | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dataCheck = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calc = createHmac('sha256', secret).update(dataCheck).digest();
  const given = Buffer.from(hash, 'hex');
  if (given.length !== calc.length || !timingSafeEqual(given, calc)) return null;

  const authDate = Number(params.get('auth_date') ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;
  const userRaw = params.get('user');
  if (!userRaw) return null;
  try {
    const user = JSON.parse(userRaw) as TelegramWebAppUser;
    if (typeof user.id !== 'number') return null;
    return { user, startParam: params.get('start_param'), authDate: new Date(authDate * 1000) };
  } catch {
    return null;
  }
}

import { config } from '../config.js';

const OFFSET_MS = () => config.TZ_OFFSET_MINUTES * 60_000;

export interface LocalParts {
  year: number;
  month: number; // 0-11
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

/** UTC sanani mahalliy (Toshkent) qismlarga ajratish */
export function localParts(d: Date = new Date()): LocalParts {
  const x = new Date(d.getTime() + OFFSET_MS());
  return {
    year: x.getUTCFullYear(),
    month: x.getUTCMonth(),
    day: x.getUTCDate(),
    hour: x.getUTCHours(),
    minute: x.getUTCMinutes(),
    weekday: x.getUTCDay(),
  };
}

/** Mahalliy vaqtdan UTC Date yasash */
export function atLocal(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month, day, hour, minute) - OFFSET_MS());
}

export function startOfLocalDay(d: Date = new Date()): Date {
  const p = localParts(d);
  return atLocal(p.year, p.month, p.day);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

export function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * 3_600_000);
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

/** YYYY-MM-DD (mahalliy) */
export function localDateKey(d: Date = new Date()): string {
  const p = localParts(d);
  return `${p.year}-${String(p.month + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function isQuietHours(d: Date = new Date()): boolean {
  const { hour } = localParts(d);
  const { QUIET_HOURS_START: s, QUIET_HOURS_END: e } = config;
  if (s === e) return false;
  return s > e ? hour >= s || hour < e : hour >= s && hour < e;
}

/** Agar vaqt tungi (jim) soatlarga tushsa — keyingi ish boshlanishiga (REMINDER_HOUR) suriladi */
export function shiftOutOfQuietHours(d: Date): Date {
  if (!isQuietHours(d)) return d;
  const p = localParts(d);
  const target = Math.max(config.QUIET_HOURS_END, config.REMINDER_HOUR);
  const sameDay = atLocal(p.year, p.month, p.day, target);
  return sameDay.getTime() > d.getTime() ? sameDay : atLocal(p.year, p.month, p.day + 1, target);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 18.10.2026 14:05 */
export function formatLocal(d: Date | null | undefined, withTime = true): string {
  if (!d) return '—';
  const p = localParts(d);
  const date = `${pad(p.day)}.${pad(p.month + 1)}.${p.year}`;
  return withTime ? `${date} ${pad(p.hour)}:${pad(p.minute)}` : date;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} soniya`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} daqiqa`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h < 24) return rest ? `${h} soat ${rest} daqiqa` : `${h} soat`;
  const days = Math.floor(h / 24);
  return `${days} kun ${h % 24} soat`;
}

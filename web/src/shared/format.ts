export const TZ = 'Asia/Tashkent';

const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

interface Parts {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
  wd: number;
}

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  weekday: 'short',
  hourCycle: 'h23',
});
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function tzParts(d: Date): Parts {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year!, m: +p.month! - 1, d: +p.day!, h: +p.hour! % 24, min: +p.minute!, wd: WD[p.weekday!] ?? 0 };
}

const pad = (n: number) => String(n).padStart(2, '0');
const toDate = (v: string | Date) => (typeof v === 'string' ? new Date(v) : v);

function dayDiff(a: Parts, b: Parts): number {
  return Math.round((Date.UTC(a.y, a.m, a.d) - Date.UTC(b.y, b.m, b.d)) / 86_400_000);
}

/** 14:05 | Kecha 14:05 | 12-okt 14:05 | 12.10.2025 */
export function smartDate(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const d = tzParts(toDate(v));
  const now = tzParts(new Date());
  const diff = dayDiff(d, now);
  const time = `${pad(d.h)}:${pad(d.min)}`;
  if (diff === 0) return `Bugun ${time}`;
  if (diff === -1) return `Kecha ${time}`;
  if (diff === 1) return `Ertaga ${time}`;
  if (d.y === now.y) return `${d.d}-${MONTHS[d.m]} ${time}`;
  return `${pad(d.d)}.${pad(d.m + 1)}.${d.y}`;
}

export function fullDate(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const d = tzParts(toDate(v));
  return `${pad(d.d)}.${pad(d.m + 1)}.${d.y} ${pad(d.h)}:${pad(d.min)}`;
}

export function dayLabel(v: string | Date): string {
  const d = tzParts(toDate(v));
  const diff = dayDiff(d, tzParts(new Date()));
  if (diff === 0) return 'Bugun';
  if (diff === 1) return 'Ertaga';
  if (diff === -1) return 'Kecha';
  return `${WEEKDAYS[d.wd]}, ${d.d}-${MONTHS[d.m]}`;
}

export function shortDay(dateKey: string): string {
  const [, m, d] = dateKey.split('-').map(Number);
  return `${d}-${MONTHS[(m ?? 1) - 1]}`;
}

export function timeAgo(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const sec = (Date.now() - toDate(v).getTime()) / 1000;
  if (sec < 45) return 'hozirgina';
  if (sec < 3600) return `${Math.round(sec / 60)} daqiqa oldin`;
  if (sec < 86_400) return `${Math.round(sec / 3600)} soat oldin`;
  if (sec < 7 * 86_400) return `${Math.round(sec / 86_400)} kun oldin`;
  return smartDate(v);
}

export function duration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${Math.round(seconds)} son`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} daq`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h} soat ${m % 60} daq` : `${h} soat`;
  return `${Math.floor(h / 24)} kun ${h % 24} soat`;
}

export function formatPhone(p: string | null | undefined): string {
  if (!p) return '—';
  const m = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(p);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : p;
}

/** Toshkent vaqti bo'yicha sana + soatdan ISO (UTC+5) */
export function tashkentIso(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr || '09:00'}:00+05:00`).toISOString();
}

/** Sana (ISO) -> YYYY-MM-DD (Toshkent) */
export function dateKeyOf(v: string | Date): string {
  const d = tzParts(typeof v === 'string' ? new Date(v) : v);
  return `${d.y}-${pad(d.m + 1)}-${pad(d.d)}`;
}

/** Bugundan n kun keyingi sana (YYYY-MM-DD, Toshkent) */
export function tashkentDateKey(offsetDays = 0): string {
  const d = tzParts(new Date(Date.now() + offsetDays * 86_400_000));
  return `${d.y}-${pad(d.m + 1)}-${pad(d.d)}`;
}

export function startOfTashkentDay(offsetDays = 0): Date {
  return new Date(`${tashkentDateKey(offsetDays)}T00:00:00+05:00`);
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '?').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function plural(n: number, word: string) {
  return `${n} ${word}`;
}

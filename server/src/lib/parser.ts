import { extractPhones, normalizePhone } from './phone.js';

/**
 * Guruhga tushgan xabardan lid ma'lumotlarini ajratib olish.
 * Odatiy formatlar:
 *   🆕 Yangi ariza
 *   👤 Ism: Aziz Karimov
 *   📞 Telefon: +998 90 123 45 67
 *   📍 Manzil: Toshkent
 */

export interface ParsedLead {
  name: string | null;
  phone: string | null;
  phones: string[];
  telegramUsername: string | null;
  fields: Array<{ key: string; value: string }>;
}

const NAME_KEYS = [
  'ism', 'ismi', 'ismingiz', 'ism familiya', 'ism-familiya', 'fio', 'f.i.o', 'f.i.sh', 'fish', 'name', 'full name',
  'fullname', 'mijoz', 'klient', 'client', 'customer', 'имя', 'фио', 'ф.и.о', 'клиент', 'исм',
];
const PHONE_KEYS = [
  'tel', 'tel.', 'telefon', 'telefon raqam', 'telefon raqami', 'telefoningiz', 'raqam', 'raqami', 'raqamingiz',
  'phone', 'phone number', 'mobile', 'nomer', 'номер', 'телефон', 'тел', 'тел.', 'contact', 'kontakt', 'aloqa',
];
const TELEGRAM_KEYS = ['telegram', 'username', 'tg', 'телеграм'];

// "Kalit: qiymat" yoki "Kalit — qiymat"
const FIELD_LINE = /^[^\p{L}\p{N}]*([\p{L}][\p{L}\p{N} .'ʻ’‘`_/()?!-]{0,60}?)\s*(?::|：|\s[—–-]\s|—)\s*(.+)$/u;
// Ro'yxat raqami: "1. Kalit: qiymat", "2) Kalit: qiymat"
const LEADING_EMOJI = /^[\p{Extended_Pictographic}️‍\s]+/u;
const LIST_PREFIX = /^[^\p{L}\p{N}]*\d{1,2}[.)]\s+/u;

/** Forma savollarini qisqa nomga keltirish */
const KEY_RENAME: Array<[RegExp, string]> = [
  [/viloyat|region|область|вилоят/i, 'Viloyat'],
  [/^(shahar|city|город)/i, 'Shahar'],
  [/^nomi$|^forma|^form name/i, 'Forma'],
];

function displayKey(rawKey: string): string {
  const clean = rawKey.replace(/[?!:]+$/g, '').replace(/\s+/g, ' ').trim();
  for (const [re, name] of KEY_RENAME) if (re.test(clean)) return name;
  return clean.slice(0, 60);
}

function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/[ʻ’‘`]/g, "'")
    .replace(/[^\p{L}\p{N} .'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function keyMatches(key: string, list: string[]): boolean {
  return list.some((k) => key === k || key.startsWith(k + ' ') || key.startsWith(k + '('));
}

function cleanValue(v: string): string {
  return v.replace(/\s+/g, ' ').trim();
}

export function parseLeadText(text: string): ParsedLead {
  const result: ParsedLead = { name: null, phone: null, phones: [], telegramUsername: null, fields: [] };
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const rawLine of lines) {
    // Boshidagi emoji (ℹ️ kabi harfga o'xshash belgilar ham) va ro'yxat raqamini olib tashlash
    const line = rawLine.replace(LEADING_EMOJI, '').replace(LIST_PREFIX, '');
    const m = FIELD_LINE.exec(line);
    if (!m) continue;
    const rawKey = m[1]!.trim();
    const value = cleanValue(m[2]!);
    if (!value || value.startsWith('//')) continue;
    const key = normalizeKey(rawKey);

    if (!result.name && keyMatches(key, NAME_KEYS)) {
      result.name = value.slice(0, 120);
      continue;
    }
    if (keyMatches(key, TELEGRAM_KEYS)) {
      const u = /@?([a-zA-Z][a-zA-Z0-9_]{3,31})/.exec(value);
      if (u) result.telegramUsername = u[1]!;
      continue;
    }
    if (keyMatches(key, PHONE_KEYS)) {
      const p = normalizePhone(value) ?? extractPhones(value)[0] ?? null;
      if (p && !result.phone) {
        result.phone = p;
        continue;
      }
    }
    result.fields.push({ key: displayKey(rawKey), value: value.slice(0, 500) });
  }

  result.phones = extractPhones(text);
  if (result.phone && !result.phones.includes(result.phone)) result.phones.unshift(result.phone);
  if (!result.phone) result.phone = result.phones[0] ?? null;

  if (!result.telegramUsername) {
    const u = /(?:^|\s)@([a-zA-Z][a-zA-Z0-9_]{3,31})\b/.exec(text);
    if (u) result.telegramUsername = u[1]!;
  }

  // Ism kalit bilan berilmagan bo'lsa: qisqa, raqamsiz, kalitsiz qatorni ism deb olish
  if (!result.name) {
    const candidate = lines.find(
      (l) =>
        !FIELD_LINE.test(l) &&
        !/\d/.test(l) &&
        l.length >= 3 &&
        l.length <= 40 &&
        /^[\p{L}][\p{L} .'ʻ’‘-]+$/u.test(l) &&
        l.split(' ').length <= 4 &&
        !/(ariza|zayavka|заявка|lid|lead|buyurtma|yangi|new|заказ)/i.test(l),
    );
    if (candidate) result.name = candidate;
  }

  return result;
}

/** Firestore'da qidirish uchun tokenlar: ism so'zlari prefikslari, telefon bo'laklari, lid raqami */
export function buildSearchTokens(input: { seq: number; name: string | null; phones: string[]; telegramUsername: string | null }): string[] {
  const tokens = new Set<string>();
  tokens.add(String(input.seq));
  const words = (input.name ?? '')
    .toLowerCase()
    .replace(/[ʻ’‘`']/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2);
  for (const w of words) for (let i = 2; i <= Math.min(w.length, 15); i++) tokens.add(w.slice(0, i));
  for (const p of input.phones) {
    const digits = p.replace(/\D/g, '');
    tokens.add(digits);
    if (digits.length >= 9) tokens.add(digits.slice(-9));
    if (digits.length >= 7) tokens.add(digits.slice(-7));
    if (digits.length >= 4) tokens.add(digits.slice(-4));
  }
  if (input.telegramUsername) tokens.add(input.telegramUsername.toLowerCase());
  return [...tokens].slice(0, 200);
}

/** Foydalanuvchi qidiruv so'rovini tokenga aylantirish */
export function searchTokenFor(q: string): string | null {
  const s = q.trim().toLowerCase().replace(/^#/, '').replace(/^@/, '');
  if (!s) return null;
  const digits = s.replace(/[\s\-()+]/g, '');
  if (/^\d+$/.test(digits)) {
    if (digits.length >= 12) return digits.slice(-12);
    if (digits.length > 9) return digits.slice(-9);
    return digits;
  }
  const word = s.replace(/[ʻ’‘`']/g, '').split(/[^\p{L}\p{N}_]+/u).filter(Boolean)[0];
  return word ? word.slice(0, 15) : null;
}

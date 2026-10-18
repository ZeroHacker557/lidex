// Tashqi manbalardan (sayt formasi, Tilda, amoCRM webhook va h.k.) lid qabul qilish:
//   POST /api/ingest/:token   { "name": "...", "phone": "...", "text": "...", "fields": { "Manzil": "..." } }
// JSON yoki application/x-www-form-urlencoded qabul qilinadi. Noma'lum maydonlar "qo'shimcha" bo'lib saqlanadi.
import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { notFound } from '../../lib/errors.js';
import { groupByToken } from '../../services/groups.js';
import { ingestLead } from '../../services/leads.js';

export const ingestRouter = Router();

const limiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false });

const NAME_KEYS = ['name', 'ism', 'fio', 'fullname', 'full_name', 'Name', 'Ism'];
const PHONE_KEYS = ['phone', 'tel', 'telefon', 'phone_number', 'Phone', 'Telefon'];
const TEXT_KEYS = ['text', 'message', 'comment', 'izoh'];

ingestRouter.post('/:token', limiter, express.urlencoded({ extended: true, limit: '64kb' }), async (req, res) => {
  const group = await groupByToken(String(req.params.token));
  if (!group || group.status !== 'active') throw notFound('Manba topilmadi yoki faol emas');

  const body = (req.body ?? {}) as Record<string, unknown>;
  const pick = (keys: string[]) => {
    for (const k of keys) if (typeof body[k] === 'string' && (body[k] as string).trim()) return (body[k] as string).trim();
    return null;
  };
  const used = new Set([...NAME_KEYS, ...PHONE_KEYS, ...TEXT_KEYS, 'fields']);
  const fields: Array<{ key: string; value: string }> = [];
  const extra = typeof body.fields === 'object' && body.fields ? (body.fields as Record<string, unknown>) : {};
  for (const [k, v] of [...Object.entries(extra), ...Object.entries(body).filter(([k]) => !used.has(k))]) {
    if (v === null || v === undefined || typeof v === 'object') continue;
    fields.push({ key: k.slice(0, 60), value: String(v).slice(0, 500) });
  }

  const result = await ingestLead({
    group,
    source: 'api',
    text: pick(TEXT_KEYS) ?? '',
    name: pick(NAME_KEYS),
    phone: pick(PHONE_KEYS),
    fields: fields.slice(0, 30),
  });
  res.status(201).json({ ok: true, id: result?.lead.id ?? null, seq: result?.lead.seq ?? null });
});

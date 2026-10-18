import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AggregateResult, AggregateSpec, Filter, Query, Store, Tx, WithId } from './store.js';
import { isIncrement } from './store.js';

type Data = Record<string, unknown>;
const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function getField(doc: Data, path: string): unknown {
  let cur: unknown = doc;
  for (const part of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Data)[part];
  }
  return cur;
}

function norm(v: unknown): unknown {
  return v instanceof Date ? v.getTime() : v;
}

/** Firestore tartibiga yaqin taqqoslash: null < boolean < number < date < string */
function typeRank(v: unknown): number {
  if (v === null) return 0;
  if (typeof v === 'boolean') return 1;
  if (typeof v === 'number') return 2;
  if (v instanceof Date) return 3;
  if (typeof v === 'string') return 4;
  return 5;
}

function compare(a: unknown, b: unknown): number {
  const ra = typeRank(a);
  const rb = typeRank(b);
  if (ra !== rb) return ra - rb;
  const na = norm(a) as number | string | boolean | null;
  const nb = norm(b) as number | string | boolean | null;
  if (na === nb) return 0;
  return (na as never) < (nb as never) ? -1 : 1;
}

function eq(a: unknown, b: unknown): boolean {
  return typeRank(a) === typeRank(b) && norm(a) === norm(b);
}

function matches(doc: Data, [field, op, value]: Filter): boolean {
  const v = getField(doc, field);
  if (v === undefined) return false; // Firestore: maydon yo'q bo'lsa, hujjat filtrdan o'tmaydi
  switch (op) {
    case '==':
      return eq(v, value);
    case '!=':
      return v !== null && !eq(v, value);
    case '<':
      return typeRank(v) === typeRank(value) && compare(v, value) < 0;
    case '<=':
      return typeRank(v) === typeRank(value) && compare(v, value) <= 0;
    case '>':
      return typeRank(v) === typeRank(value) && compare(v, value) > 0;
    case '>=':
      return typeRank(v) === typeRank(value) && compare(v, value) >= 0;
    case 'in':
      return (value as unknown[]).some((x) => eq(v, x));
    case 'not-in':
      return v !== null && !(value as unknown[]).some((x) => eq(v, x));
    case 'array-contains':
      return Array.isArray(v) && v.some((x) => eq(x, value));
    case 'array-contains-any':
      return Array.isArray(v) && v.some((x) => (value as unknown[]).some((y) => eq(x, y)));
  }
}

const clone = <T>(v: T): T => structuredClone(v);

// JSON fayl uchun sanalarni kodlash
function encode(v: unknown): unknown {
  if (v instanceof Date) return { $d: v.toISOString() };
  if (Array.isArray(v)) return v.map(encode);
  if (v && typeof v === 'object') {
    const out: Data = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined) out[k] = encode(x);
    return out;
  }
  return v;
}
function decode(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(decode);
  if (v && typeof v === 'object') {
    const o = v as Data;
    if (typeof o.$d === 'string' && Object.keys(o).length === 1) return new Date(o.$d);
    const out: Data = {};
    for (const [k, x] of Object.entries(o)) out[k] = decode(x);
    return out;
  }
  return v;
}

function stripUndefined(data: object): Data {
  const out: Data = {};
  for (const [k, v] of Object.entries(data)) if (v !== undefined && k !== 'id') out[k] = v;
  return out;
}

function applyPatch(target: Data, patch: object) {
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'id' || v === undefined) continue;
    if (isIncrement(v)) {
      const cur = target[k];
      target[k] = (typeof cur === 'number' ? cur : 0) + v.n;
    } else {
      target[k] = clone(v);
    }
  }
}

export class MemoryStore implements Store {
  readonly kind = 'memory' as const;
  private cols = new Map<string, Map<string, Data>>();
  private saveTimer: NodeJS.Timeout | null = null;
  private txChain: Promise<unknown> = Promise.resolve();

  constructor(private file: string | null) {
    if (file && existsSync(file)) {
      const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Record<string, unknown>>;
      for (const [col, docs] of Object.entries(raw)) {
        this.cols.set(col, new Map(Object.entries(docs).map(([id, d]) => [id, decode(d) as Data])));
      }
    }
  }

  private c(name: string): Map<string, Data> {
    let m = this.cols.get(name);
    if (!m) this.cols.set(name, (m = new Map()));
    return m;
  }

  private scheduleSave() {
    if (!this.file || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flush();
    }, 250);
  }

  private flush() {
    if (!this.file) return;
    const out: Record<string, Record<string, unknown>> = {};
    for (const [col, docs] of this.cols) out[col] = Object.fromEntries([...docs].map(([id, d]) => [id, encode(d)]));
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    writeFileSync(tmp, JSON.stringify(out));
    renameSync(tmp, this.file);
  }

  newId(): string {
    const bytes = randomBytes(20);
    let id = '';
    for (const b of bytes) id += ID_CHARS[b % ID_CHARS.length];
    return id;
  }

  private run<T>(col: string, q: Query = {}): WithId<T>[] {
    let docs = [...this.c(col).entries()].map(([id, d]) => ({ ...d, id }) as Data);
    for (const f of q.where ?? []) docs = docs.filter((d) => matches(d, f));
    const order = q.orderBy ?? [];
    // Firestore: orderBy maydoni yo'q hujjatlar natijaga kirmaydi
    for (const [field] of order) docs = docs.filter((d) => getField(d, field) !== undefined);
    const sortKeys: Array<[string, 'asc' | 'desc']> = [...order, ['id', order.at(-1)?.[1] ?? 'asc']];
    docs.sort((a, b) => {
      for (const [field, dir] of sortKeys) {
        const r = compare(getField(a, field), getField(b, field));
        if (r !== 0) return dir === 'asc' ? r : -r;
      }
      return 0;
    });
    if (q.startAfter?.length) {
      const cursor = q.startAfter;
      docs = docs.filter((d) => {
        for (let i = 0; i < cursor.length && i < order.length; i++) {
          const [field, dir] = order[i]!;
          const r = compare(getField(d, field), cursor[i]);
          if (r !== 0) return dir === 'asc' ? r > 0 : r < 0;
        }
        return false;
      });
    }
    if (q.limit) docs = docs.slice(0, q.limit);
    if (q.select?.length) {
      docs = docs.map((d) => {
        const out: Data = { id: d.id };
        for (const f of q.select!) if (d[f] !== undefined) out[f] = d[f];
        return out;
      });
    }
    return clone(docs) as WithId<T>[];
  }

  async get<T>(col: string, id: string): Promise<WithId<T> | null> {
    const d = this.c(col).get(id);
    return d ? ({ ...clone(d), id } as WithId<T>) : null;
  }

  async getMany<T>(col: string, ids: string[]): Promise<WithId<T>[]> {
    const out: WithId<T>[] = [];
    for (const id of new Set(ids)) {
      const d = await this.get<T>(col, id);
      if (d) out.push(d);
    }
    return out;
  }

  async query<T>(col: string, q?: Query): Promise<WithId<T>[]> {
    return this.run<T>(col, q);
  }

  async count(col: string, q?: Query): Promise<number> {
    return this.run(col, { ...q, limit: undefined, select: undefined }).length;
  }

  async aggregate(col: string, q: Query, spec: AggregateSpec): Promise<AggregateResult> {
    const docs = this.run<Data>(col, { ...q, limit: undefined, select: undefined });
    const nums = (f: string) => docs.map((d) => getField(d, f)).filter((v): v is number => typeof v === 'number');
    const sumOf = (f: string) => nums(f).reduce((a, b) => a + b, 0);
    return {
      count: docs.length,
      sum: spec.sum ? sumOf(spec.sum) : null,
      avg: spec.avg ? (nums(spec.avg).length ? sumOf(spec.avg) / nums(spec.avg).length : null) : null,
    };
  }

  async create(col: string, data: object, id?: string): Promise<string> {
    const docId = id ?? this.newId();
    if (this.c(col).has(docId)) throw Object.assign(new Error(`ALREADY_EXISTS: ${col}/${docId}`), { code: 6 });
    this.c(col).set(docId, clone(stripUndefined(data)));
    this.scheduleSave();
    return docId;
  }

  async set(col: string, id: string, data: object, opts?: { merge?: boolean }): Promise<void> {
    const existing = this.c(col).get(id);
    if (opts?.merge && existing) applyPatch(existing, data);
    else {
      const fresh: Data = {};
      applyPatch(fresh, data);
      this.c(col).set(id, fresh);
    }
    this.scheduleSave();
  }

  async update(col: string, id: string, patch: object): Promise<void> {
    const existing = this.c(col).get(id);
    if (!existing) throw Object.assign(new Error(`NOT_FOUND: ${col}/${id}`), { code: 5 });
    applyPatch(existing, patch);
    this.scheduleSave();
  }

  async delete(col: string, id: string): Promise<void> {
    this.c(col).delete(id);
    this.scheduleSave();
  }

  /** Tranzaksiyalar ketma-ket bajariladi; yozuvlar oxirida birdaniga qo'llanadi */
  runTransaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    const exec = async () => {
      const writes: Array<() => void> = [];
      const tx: Tx = {
        get: (col, id) => this.get(col, id),
        query: (col, q) => this.query(col, q),
        set: (col, id, data) => {
          writes.push(() => {
            const fresh: Data = {};
            applyPatch(fresh, data);
            this.c(col).set(id, fresh);
          });
        },
        update: (col, id, patch) => {
          writes.push(() => {
            const existing = this.c(col).get(id);
            if (!existing) throw new Error(`NOT_FOUND: ${col}/${id}`);
            applyPatch(existing, patch);
          });
        },
      };
      const result = await fn(tx);
      for (const w of writes) w();
      if (writes.length) this.scheduleSave();
      return result;
    };
    const p = this.txChain.then(exec, exec);
    this.txChain = p.catch(() => undefined);
    return p;
  }

  async close(): Promise<void> {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.flush();
  }
}

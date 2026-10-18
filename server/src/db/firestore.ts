import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp, applicationDefault, type App } from 'firebase-admin/app';
import {
  AggregateField,
  FieldValue,
  Timestamp,
  getFirestore,
  type CollectionReference,
  type DocumentData,
  type Firestore,
  type Query as FsQuery,
  type Transaction,
} from 'firebase-admin/firestore';
import { config } from '../config.js';
import type { AggregateResult, AggregateSpec, Query, Store, Tx, WithId } from './store.js';
import { isIncrement } from './store.js';

/** Firestore Timestamp -> Date (rekursiv) */
function fromFs(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate();
  if (Array.isArray(value)) return value.map(fromFs);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = fromFs(v);
    return out;
  }
  return value;
}

/** inc() -> FieldValue.increment, `id` maydonini tashlab yuborish */
function toFs(data: object): DocumentData {
  const out: DocumentData = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === 'id') continue;
    out[k] = isIncrement(v) ? FieldValue.increment(v.n) : v;
  }
  return out;
}

function loadCredentials(): App {
  if (getApps().length) return getApps()[0]!;
  const raw = config.FIREBASE_SERVICE_ACCOUNT;
  const path = config.FIREBASE_SERVICE_ACCOUNT_PATH;
  let credential;
  if (raw) {
    const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    credential = cert(JSON.parse(json));
  } else if (path) {
    credential = cert(JSON.parse(readFileSync(path, 'utf8')));
  } else {
    // GOOGLE_APPLICATION_CREDENTIALS yoki Cloud Run / GCE muhitidagi standart hisob
    credential = applicationDefault();
  }
  return initializeApp({ credential, projectId: config.FIREBASE_PROJECT_ID });
}

export class FirestoreStore implements Store {
  readonly kind = 'firestore' as const;
  private db: Firestore;

  constructor() {
    const app = loadCredentials();
    this.db = config.FIRESTORE_DATABASE_ID ? getFirestore(app, config.FIRESTORE_DATABASE_ID) : getFirestore(app);
    this.db.settings({ ignoreUndefinedProperties: true });
  }

  newId(): string {
    return this.db.collection('_').doc().id;
  }

  private col(name: string): CollectionReference {
    return this.db.collection(config.FIRESTORE_PREFIX + name);
  }

  private build(col: string, q: Query = {}): FsQuery {
    let query: FsQuery = this.col(col);
    for (const [field, op, value] of q.where ?? []) query = query.where(field, op, value);
    for (const [field, dir] of q.orderBy ?? []) query = query.orderBy(field, dir);
    if (q.startAfter?.length) query = query.startAfter(...q.startAfter);
    if (q.limit) query = query.limit(q.limit);
    if (q.select?.length) query = query.select(...q.select);
    return query;
  }

  async get<T>(col: string, id: string): Promise<WithId<T> | null> {
    const snap = await this.col(col).doc(id).get();
    return snap.exists ? ({ ...(fromFs(snap.data()) as T), id: snap.id } as WithId<T>) : null;
  }

  async getMany<T>(col: string, ids: string[]): Promise<WithId<T>[]> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return [];
    const snaps = await this.db.getAll(...unique.map((id) => this.col(col).doc(id)));
    return snaps.filter((s) => s.exists).map((s) => ({ ...(fromFs(s.data()) as T), id: s.id }) as WithId<T>);
  }

  async query<T>(col: string, q?: Query): Promise<WithId<T>[]> {
    const snap = await this.build(col, q).get();
    return snap.docs.map((d) => ({ ...(fromFs(d.data()) as T), id: d.id }) as WithId<T>);
  }

  async count(col: string, q?: Query): Promise<number> {
    const snap = await this.build(col, { ...q, limit: undefined, select: undefined }).count().get();
    return snap.data().count;
  }

  async aggregate(col: string, q: Query, spec: AggregateSpec): Promise<AggregateResult> {
    const fields: Record<string, ReturnType<typeof AggregateField.count>> = { count: AggregateField.count() };
    if (spec.sum) fields.sum = AggregateField.sum(spec.sum) as never;
    if (spec.avg) fields.avg = AggregateField.average(spec.avg) as never;
    const snap = await this.build(col, { ...q, limit: undefined, select: undefined }).aggregate(fields).get();
    const data = snap.data() as Record<string, number | null>;
    return { count: data.count ?? 0, sum: data.sum ?? null, avg: data.avg ?? null };
  }

  async create(col: string, data: object, id?: string): Promise<string> {
    const ref = id ? this.col(col).doc(id) : this.col(col).doc();
    await ref.create(toFs(data));
    return ref.id;
  }

  async set(col: string, id: string, data: object, opts?: { merge?: boolean }): Promise<void> {
    await this.col(col).doc(id).set(toFs(data), { merge: !!opts?.merge });
  }

  async update(col: string, id: string, patch: object): Promise<void> {
    await this.col(col).doc(id).update(toFs(patch));
  }

  async delete(col: string, id: string): Promise<void> {
    await this.col(col).doc(id).delete();
  }

  runTransaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    return this.db.runTransaction(async (t: Transaction) => {
      const tx: Tx = {
        get: async <T>(col: string, id: string) => {
          const snap = await t.get(this.col(col).doc(id));
          return snap.exists ? ({ ...(fromFs(snap.data()) as T), id: snap.id } as WithId<T>) : null;
        },
        query: async <T>(col: string, q?: Query) => {
          const snap = await t.get(this.build(col, q));
          return snap.docs.map((d) => ({ ...(fromFs(d.data()) as T), id: d.id }) as WithId<T>);
        },
        set: (col, id, data) => void t.set(this.col(col).doc(id), toFs(data)),
        update: (col, id, patch) => void t.update(this.col(col).doc(id), toFs(patch)),
      };
      return fn(tx);
    });
  }

  async close(): Promise<void> {
    await this.db.terminate();
  }
}

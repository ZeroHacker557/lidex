// Ma'lumotlar ombori interfeysi. Ilova kodi faqat shu interfeys orqali ishlaydi:
//  - FirestoreStore — production (Firebase Firestore)
//  - MemoryStore    — lokal ishlab chiqish / testlar (JSON faylga saqlaydi)
// Ikkalasi ham Firestore semantikasiga mos keladi (where / orderBy / limit / startAfter, tranzaksiya).

export type Op = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'not-in' | 'array-contains' | 'array-contains-any';
export type Filter = readonly [field: string, op: Op, value: unknown];

export interface Query {
  where?: Filter[];
  orderBy?: Array<[field: string, dir: 'asc' | 'desc']>;
  limit?: number;
  /** orderBy maydonlari qiymatlari bo'yicha kursor */
  startAfter?: unknown[];
  /** Faqat kerakli maydonlarni o'qish */
  select?: string[];
}

export type WithId<T> = T & { id: string };

/** Atomar oshirish (Firestore FieldValue.increment) */
export interface Increment {
  __op: 'inc';
  n: number;
}
export const inc = (n = 1): Increment => ({ __op: 'inc', n });
export const isIncrement = (v: unknown): v is Increment =>
  typeof v === 'object' && v !== null && (v as Increment).__op === 'inc';

export interface AggregateSpec {
  sum?: string;
  avg?: string;
}
export interface AggregateResult {
  count: number;
  sum: number | null;
  avg: number | null;
}

export interface Tx {
  get<T>(col: string, id: string): Promise<WithId<T> | null>;
  query<T>(col: string, q?: Query): Promise<WithId<T>[]>;
  /** To'liq yozish (mavjud bo'lsa ustidan yoziladi) */
  set(col: string, id: string, data: object): void;
  update(col: string, id: string, patch: object): void;
}

export interface Store {
  readonly kind: 'firestore' | 'memory';
  newId(): string;
  get<T>(col: string, id: string): Promise<WithId<T> | null>;
  getMany<T>(col: string, ids: string[]): Promise<WithId<T>[]>;
  query<T>(col: string, q?: Query): Promise<WithId<T>[]>;
  count(col: string, q?: Query): Promise<number>;
  aggregate(col: string, q: Query, spec: AggregateSpec): Promise<AggregateResult>;
  /** Yangi hujjat yaratadi, id qaytaradi. id berilsa va mavjud bo'lsa — xato. */
  create(col: string, data: object, id?: string): Promise<string>;
  set(col: string, id: string, data: object, opts?: { merge?: boolean }): Promise<void>;
  /** Mavjud bo'lmagan hujjatni yangilash — xato (Firestore kabi) */
  update(col: string, id: string, patch: object): Promise<void>;
  delete(col: string, id: string): Promise<void>;
  runTransaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R>;
  close(): Promise<void>;
}

export const COL = {
  admins: 'admins',
  groups: 'groups',
  employees: 'employees',
  leads: 'leads',
  events: 'events',
  messages: 'messages',
  counters: 'counters',
} as const;

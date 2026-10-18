import { isAbsolute, join } from 'node:path';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { SERVER_DIR } from '../paths.js';
import { MemoryStore } from './memory.js';
import type { Store } from './store.js';

export * from './store.js';
export * from './models.js';

let store: Store | null = null;

export async function initStore(): Promise<Store> {
  if (store) return store;
  if (config.DB_DRIVER === 'firestore') {
    const { FirestoreStore } = await import('./firestore.js');
    store = new FirestoreStore();
    logger.info({ project: config.FIREBASE_PROJECT_ID ?? '(default)' }, 'Firestore ulandi');
  } else {
    const file = isAbsolute(config.MEMORY_DB_FILE) ? config.MEMORY_DB_FILE : join(SERVER_DIR, config.MEMORY_DB_FILE);
    store = new MemoryStore(config.NODE_ENV === 'test' ? null : file);
    logger.warn({ file }, "Lokal JSON ombor ishlatilmoqda (DB_DRIVER=memory). Production uchun Firestore'ni ulang");
  }
  return store;
}

/** Testlar uchun omborni almashtirish */
export function setStore(s: Store) {
  store = s;
}

export function db(): Store {
  if (!store) throw new Error('Store hali ishga tushirilmagan (initStore)');
  return store;
}
